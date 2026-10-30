import math
import re
import base64
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Employee, ShopManager
from .models import Attendance, Event
from auditlog.models import AuditLog

def distance(a, b, c, d):
    R = 6371000  # Earth radius in metres
    p1 = math.radians(a)
    p2 = math.radians(c)
    dp = math.radians(c - a)
    dl = math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))

class TodayStatus(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, r):
        if r.user.role != "EMPLOYEE":
            return Response({"detail": "Only employees have attendance punch status."}, status=200)
        try:
            emp = r.user.employee
            shop = emp.shop
        except Employee.DoesNotExist:
            return Response({"detail": "Employee profile not found.", "has_profile": False}, status=200)

        today = timezone.localdate()
        att = Attendance.objects.filter(employee=emp, work_date=today).first()

        return Response({
            "has_profile": True,
            "employee_code": emp.code,
            "shop": {
                "id": shop.id,
                "name": shop.name,
                "code": shop.code,
                "address": shop.address,
                "latitude": shop.latitude,
                "longitude": shop.longitude,
                "allowed_radius_m": shop.allowed_radius_m,
            },
            "today": today.isoformat(),
            "checked_in": att.check_in is not None if att else False,
            "check_in_time": att.check_in.isoformat() if att and att.check_in else None,
            "checked_out": att.check_out is not None if att else False,
            "check_out_time": att.check_out.isoformat() if att and att.check_out else None,
        })

class Submit(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, r):
        if r.user.role != "EMPLOYEE":
            return Response({"detail": "Employees only can submit attendance."}, status=403)
        try:
            e = r.user.employee
            s = e.shop
        except Employee.DoesNotExist:
            return Response({"detail": "Employee profile missing. Contact manager."}, status=400)

        d = r.data
        try:
            lat = float(d["latitude"])
            lon = float(d["longitude"])
            acc = float(d["gps_accuracy_m"])
            kind = d["event_type"]
            img = d["selfie_data_url"]
        except (KeyError, ValueError, TypeError):
            return Response({"detail": "GPS coordinates, event type and camera selfie are required."}, status=400)

        if kind not in ("CHECK_IN", "CHECK_OUT") or not -90 <= lat <= 90 or not -180 <= lon <= 180:
            return Response({"detail": "Invalid submission data."}, status=400)

        m = re.fullmatch(r"data:image/jpeg;base64,([A-Za-z0-9+/=]+)", img)
        if not m:
            return Response({"detail": "Camera JPEG selfie required."}, status=400)

        try:
            raw = base64.b64decode(m.group(1), validate=True)
            if len(raw) > 500000:
                return Response({"detail": "Selfie image exceeds maximum allowable size (500KB)."}, status=400)
        except Exception:
            return Response({"detail": "Invalid selfie image format."}, status=400)

        dist = distance(s.latitude, s.longitude, lat, lon)
        if dist > s.allowed_radius_m:
            Event.objects.create(
                employee=e,
                shop=s,
                kind=kind,
                latitude=lat,
                longitude=lon,
                accuracy_m=acc,
                distance_m=dist,
                accepted=False,
                reason=f"Outside allowed radius ({dist:.1f}m > {s.allowed_radius_m}m)",
                selfie_data_url=img
            )
            AuditLog.log_event(
                user=r.user,
                action="ATTENDANCE_REJECTED",
                details=f"{e.code} tried {kind} at {s.code} but was {dist:.1f}m away (radius: {s.allowed_radius_m}m)"
            )
            return Response({
                "detail": f"Outside shop radius! You are {dist:.1f}m away from '{s.name}' (allowed radius: {s.allowed_radius_m}m).",
                "distance_m": round(dist, 1),
                "allowed_radius_m": s.allowed_radius_m
            }, status=403)

        today = timezone.localdate()
        with transaction.atomic():
            a, _ = Attendance.objects.select_for_update().get_or_create(employee=e, work_date=today, defaults={"shop": s})
            now = timezone.now()
            if kind == "CHECK_IN":
                if a.check_in:
                    return Response({"detail": f"Already checked in today at {a.check_in.strftime('%I:%M %p')}."}, status=400)
                a.check_in = now
            else:
                if not a.check_in:
                    return Response({"detail": "You must check in before checking out."}, status=400)
                if a.check_out:
                    return Response({"detail": f"Already checked out today at {a.check_out.strftime('%I:%M %p')}."}, status=400)
                a.check_out = now
            a.save()

            Event.objects.create(
                employee=e,
                shop=s,
                kind=kind,
                latitude=lat,
                longitude=lon,
                accuracy_m=acc,
                distance_m=dist,
                accepted=True,
                reason="Verified within geofence",
                selfie_data_url=img
            )
            AuditLog.log_event(
                user=r.user,
                action=f"ATTENDANCE_{kind}",
                details=f"{e.code} successful {kind} at {s.code} ({dist:.1f}m distance, {acc:.1f}m GPS accuracy)"
            )

        return Response({
            "detail": f"Successfully {'checked in' if kind == 'CHECK_IN' else 'checked out'}!",
            "distance_m": round(dist, 1),
            "server_time": now.isoformat(),
            "event_type": kind
        }, status=201)

class Records(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, r):
        q = Attendance.objects.select_related("employee__user", "shop")
        if r.user.role == "EMPLOYEE":
            q = q.filter(employee__user=r.user)
        elif r.user.role == "MANAGER":
            q = q.filter(shop__manager_links__manager=r.user).distinct()
        elif r.user.role != "SUPER_ADMIN":
            return Response([])

        # Filter by shop_id or date if provided
        shop_id = r.query_params.get("shop_id")
        if shop_id:
            q = q.filter(shop_id=shop_id)
        date = r.query_params.get("date")
        if date:
            q = q.filter(work_date=date)

        records = q.order_by("-work_date", "-id")[:500]
        return Response([
            {
                "id": a.id,
                "employee": a.employee.code,
                "employee_name": a.employee.user.first_name or a.employee.code,
                "shop": a.shop.name,
                "shop_code": a.shop.code,
                "date": a.work_date.isoformat(),
                "check_in": a.check_in.isoformat() if a.check_in else None,
                "check_out": a.check_out.isoformat() if a.check_out else None,
            }
            for a in records
        ])

class Evidence(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, r):
        q = Event.objects.select_related("employee__user", "shop")
        if r.user.role == "EMPLOYEE":
            q = q.filter(employee__user=r.user)
        elif r.user.role == "MANAGER":
            q = q.filter(shop__manager_links__manager=r.user).distinct()
        elif r.user.role != "SUPER_ADMIN":
            return Response([])

        # Filter by shop_id or accepted status if provided
        shop_id = r.query_params.get("shop_id")
        if shop_id:
            q = q.filter(shop_id=shop_id)
        status_param = r.query_params.get("status")
        if status_param == "accepted":
            q = q.filter(accepted=True)
        elif status_param == "rejected":
            q = q.filter(accepted=False)

        events = q.order_by("-created_at")[:300]
        return Response([
            {
                "id": x.id,
                "employee": x.employee.code,
                "employee_name": x.employee.user.first_name or x.employee.code,
                "shop": x.shop.name,
                "shop_code": x.shop.code,
                "kind": x.kind,
                "time": x.created_at.isoformat(),
                "latitude": x.latitude,
                "longitude": x.longitude,
                "accuracy_m": x.accuracy_m,
                "distance_m": x.distance_m,
                "accepted": x.accepted,
                "reason": x.reason,
                "selfie": x.selfie_data_url
            }
            for x in events
        ])
