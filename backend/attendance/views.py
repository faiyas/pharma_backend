import math
import re
import base64
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Shop, Employee, ShopManager
from .models import Attendance, Event, AttendancePhoto, AttendanceCorrection, MonthlyExportLog
from auditlog.models import AuditLog

def distance(a, b, c, d):
    R = 6371000  # Earth radius in metres
    p1 = math.radians(a)
    p2 = math.radians(c)
    dp = math.radians(c - a)
    dl = math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))

def can_manage_attendance_shop(user, shop):
    if user.role == "SUPER_ADMIN":
        return True
    if user.role == "MANAGER":
        return ShopManager.objects.filter(manager=user, shop=shop).exists()
    return False

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
            evt = Event.objects.create(
                employee=e,
                shop=s,
                kind=kind,
                latitude=lat,
                longitude=lon,
                accuracy_m=acc,
                distance_m=dist,
                accepted=False,
                reason=f"Outside allowed radius ({dist:.1f}m > {s.allowed_radius_m}m)",
                selfie_data_url=""
            )
            AttendancePhoto.objects.create(event=evt, image_data=img)
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
            a, _ = Attendance.objects.select_for_update().get_or_create(
                employee=e, work_date=today, defaults={"shop": s, "status": "PENDING"}
            )
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

            evt = Event.objects.create(
                employee=e,
                shop=s,
                kind=kind,
                latitude=lat,
                longitude=lon,
                accuracy_m=acc,
                distance_m=dist,
                accepted=True,
                reason="Verified within geofence",
                selfie_data_url=""
            )
            AttendancePhoto.objects.create(event=evt, image_data=img)
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

        # Filter by shop_id
        shop_id = r.query_params.get("shop_id")
        if shop_id:
            q = q.filter(shop_id=shop_id)

        # Filter by exact date
        date = r.query_params.get("date")
        if date:
            q = q.filter(work_date=date)

        # Filter by date range (start_date to end_date)
        start_date = r.query_params.get("start_date")
        end_date = r.query_params.get("end_date")
        if start_date:
            q = q.filter(work_date__gte=start_date)
        if end_date:
            q = q.filter(work_date__lte=end_date)

        # Filter by month (YYYY-MM)
        month = r.query_params.get("month")
        if month:
            try:
                yr, mo = month.split("-")
                q = q.filter(work_date__year=int(yr), work_date__month=int(mo))
            except ValueError:
                pass

        # Filter by day of week (1=Sunday, 2=Monday, ..., 7=Saturday)
        day_of_week = r.query_params.get("day_of_week")
        if day_of_week and day_of_week.isdigit():
            q = q.filter(work_date__week_day=int(day_of_week))

        # Filter by status (PENDING, APPROVED, REJECTED)
        status = r.query_params.get("status")
        if status:
            q = q.filter(status=status.upper())

        records = q.select_related("reviewed_by").order_by("-work_date", "-id")[:1000]
        out = []
        for a in records:
            hours = None
            if a.check_in and a.check_out:
                diff_sec = (a.check_out - a.check_in).total_seconds()
                hours = round(max(0.0, diff_sec / 3600), 2)

            out.append({
                "id": a.id,
                "employee": a.employee.code,
                "employee_name": a.employee.user.first_name or a.employee.code,
                "shop": a.shop.name,
                "shop_code": a.shop.code,
                "date": a.work_date.isoformat(),
                "day_of_week": a.work_date.strftime("%A"),
                "check_in": a.check_in.isoformat() if a.check_in else None,
                "check_out": a.check_out.isoformat() if a.check_out else None,
                "hours_worked": hours,
                "status": a.status,
                "reviewed_by": a.reviewed_by.username if a.reviewed_by else None,
                "review_comments": a.review_comments,
                "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            })
        return Response(out)

class AttendanceApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            att = Attendance.objects.select_related("employee__user", "shop").get(pk=pk)
        except Attendance.DoesNotExist:
            return Response({"detail": "Attendance record not found."}, status=404)

        user = request.user
        if not can_manage_attendance_shop(user, att.shop):
            return Response({"detail": "Not authorized to accept attendance for this branch."}, status=403)

        comments = str(request.data.get("comments", "")).strip()

        with transaction.atomic():
            att.status = "APPROVED"
            att.reviewed_by = user
            att.review_comments = comments
            att.reviewed_at = timezone.now()
            att.save()

            AuditLog.log_event(
                user=user,
                action="ATTENDANCE_APPROVED",
                details=f"Attendance #{att.id} for {att.employee.code} on {att.work_date} accepted by {user.username}."
            )

        return Response({
            "detail": f"Attendance for {att.employee.code} accepted/approved.",
            "id": att.id,
            "status": att.status,
            "reviewed_by": user.username,
            "reviewed_at": att.reviewed_at.isoformat(),
        })

class AttendanceRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            att = Attendance.objects.select_related("employee__user", "shop").get(pk=pk)
        except Attendance.DoesNotExist:
            return Response({"detail": "Attendance record not found."}, status=404)

        user = request.user
        if not can_manage_attendance_shop(user, att.shop):
            return Response({"detail": "Not authorized to review attendance for this branch."}, status=403)

        comments = str(request.data.get("comments", "")).strip()

        with transaction.atomic():
            att.status = "REJECTED"
            att.reviewed_by = user
            att.review_comments = comments
            att.reviewed_at = timezone.now()
            att.save()

            AuditLog.log_event(
                user=user,
                action="ATTENDANCE_REJECTED",
                details=f"Attendance #{att.id} for {att.employee.code} on {att.work_date} rejected by {user.username}. Reason: {comments}"
            )

        return Response({
            "detail": f"Attendance for {att.employee.code} rejected.",
            "id": att.id,
            "status": att.status,
            "reviewed_by": user.username,
            "reviewed_at": att.reviewed_at.isoformat(),
        })

class Evidence(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, r):
        q = Event.objects.select_related("employee__user", "shop", "photo")
        if r.user.role == "EMPLOYEE":
            q = q.filter(employee__user=r.user)
        elif r.user.role == "MANAGER":
            q = q.filter(shop__manager_links__manager=r.user).distinct()
        elif r.user.role != "SUPER_ADMIN":
            return Response([])

        # Filter by shop_id
        shop_id = r.query_params.get("shop_id")
        if shop_id:
            q = q.filter(shop_id=shop_id)

        # Filter by status
        status_param = r.query_params.get("status")
        if status_param == "accepted":
            q = q.filter(accepted=True)
        elif status_param == "rejected":
            q = q.filter(accepted=False)

        # Datewise filters
        date = r.query_params.get("date")
        if date:
            q = q.filter(created_at__date=date)
        start_date = r.query_params.get("start_date")
        end_date = r.query_params.get("end_date")
        if start_date:
            q = q.filter(created_at__date__gte=start_date)
        if end_date:
            q = q.filter(created_at__date__lte=end_date)

        # Month filter
        month = r.query_params.get("month")
        if month:
            try:
                yr, mo = month.split("-")
                q = q.filter(created_at__year=int(yr), created_at__month=int(mo))
            except ValueError:
                pass

        events = q.order_by("-created_at")[:2000]
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
                "selfie": x.photo.image_data if hasattr(x, "photo") and x.photo else x.selfie_data_url
            }
            for x in events
        ])

class MonthlyExportRecordView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        month = request.query_params.get("month")
        if not month:
            return Response({"detail": "month parameter (YYYY-MM) is required."}, status=400)

        shop_id = request.query_params.get("shop_id")
        qs = MonthlyExportLog.objects.filter(month=month)
        if shop_id:
            qs = qs.filter(Q(shop_id=shop_id) | Q(shop__isnull=True))

        has_exported = qs.exists()
        last_log = qs.first()

        try:
            yr, mo = month.split("-")
            att_qs = Attendance.objects.filter(work_date__year=int(yr), work_date__month=int(mo))
            evt_qs = Event.objects.filter(created_at__year=int(yr), created_at__month=int(mo))
            if request.user.role == "MANAGER":
                managed_shops = Shop.objects.filter(manager_links__manager=request.user)
                att_qs = att_qs.filter(shop__in=managed_shops)
                evt_qs = evt_qs.filter(shop__in=managed_shops)
            if shop_id:
                att_qs = att_qs.filter(shop_id=shop_id)
                evt_qs = evt_qs.filter(shop_id=shop_id)
            att_count = att_qs.count()
            evt_count = evt_qs.count()
        except ValueError:
            att_count = 0
            evt_count = 0

        return Response({
            "month": month,
            "has_exported": has_exported,
            "export_count": qs.count(),
            "last_exported_at": last_log.exported_at.isoformat() if last_log else None,
            "exported_by": last_log.exported_by.username if last_log and last_log.exported_by else None,
            "attendance_count": att_count,
            "event_count": evt_count
        })

    def post(self, request):
        if request.user.role not in ("SUPER_ADMIN", "MANAGER"):
            return Response({"detail": "Only Super Admins and Managers can record exports."}, status=403)

        month = request.data.get("month")
        if not month:
            return Response({"detail": "month is required."}, status=400)

        shop_id = request.data.get("shop_id")
        export_type = request.data.get("export_type", "AUDIT_DOSSIER")
        shop = None
        if shop_id:
            try:
                shop = Shop.objects.get(id=shop_id)
            except Shop.DoesNotExist:
                pass

        log = MonthlyExportLog.objects.create(
            month=month,
            shop=shop,
            exported_by=request.user,
            export_type=export_type
        )

        AuditLog.log_event(
            user=request.user,
            action="MONTHLY_DATA_EXPORTED",
            details=f"Exported {export_type} report for month {month} (Shop: {shop.name if shop else 'All Branches'})."
        )

        return Response({
            "detail": f"Export recorded for {month}.",
            "month": month,
            "exported_at": log.exported_at.isoformat(),
            "has_exported": True
        }, status=201)

class MonthlyDataPurgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, r):
        if r.user.role not in ("SUPER_ADMIN", "MANAGER"):
            return Response({"detail": "Only Super Admins and Managers can delete monthly attendance data."}, status=403)

        month = r.data.get("month")
        if not month:
            return Response({"detail": "Please specify a month (YYYY-MM) to delete data."}, status=400)

        try:
            yr, mo = month.split("-")
            yr = int(yr)
            mo = int(mo)
        except ValueError:
            return Response({"detail": "Invalid month format. Expected YYYY-MM."}, status=400)

        shop_id = r.data.get("shop_id")

        # Pre-condition: Check if data for this month has been exported at least once
        export_qs = MonthlyExportLog.objects.filter(month=month)
        if shop_id:
            export_qs = export_qs.filter(Q(shop_id=shop_id) | Q(shop__isnull=True))

        if not export_qs.exists():
            return Response({
                "detail": f"Data for {month} must be exported at least once before deletion. Please download the report first. (Recommendation: Purge data every 6 months).",
                "code": "EXPORT_REQUIRED",
                "has_exported": False
            }, status=400)

        # Build querysets for all data in this month
        att_qs = Attendance.objects.filter(work_date__year=yr, work_date__month=mo)
        evt_qs = Event.objects.filter(created_at__year=yr, created_at__month=mo)
        corr_qs = AttendanceCorrection.objects.filter(attendance_date__year=yr, attendance_date__month=mo)

        if r.user.role == "MANAGER":
            managed_shops = Shop.objects.filter(manager_links__manager=r.user)
            att_qs = att_qs.filter(shop__in=managed_shops)
            evt_qs = evt_qs.filter(shop__in=managed_shops)
            corr_qs = corr_qs.filter(shop__in=managed_shops)

        if shop_id:
            att_qs = att_qs.filter(shop_id=shop_id)
            evt_qs = evt_qs.filter(shop_id=shop_id)
            corr_qs = corr_qs.filter(shop_id=shop_id)

        att_count = att_qs.count()
        evt_count = evt_qs.count()
        corr_count = corr_qs.count()

        if att_count == 0 and evt_count == 0:
            return Response({"detail": f"No attendance or evidence records found for {month}.", "deleted_attendance": 0, "deleted_events": 0})

        with transaction.atomic():
            # Delete photos and events
            AttendancePhoto.objects.filter(event__in=evt_qs).delete()
            evt_qs.delete()
            # Delete corrections and adjustments
            corr_qs.delete()
            # Delete all attendance records
            att_qs.delete()

            AuditLog.log_event(
                user=r.user,
                action="MONTHLY_DATA_PURGED",
                details=f"Permanently purged all data for {month}: {att_count} attendance records, {evt_count} event photos, and {corr_count} corrections."
            )

        return Response({
            "detail": f"Successfully deleted all {att_count} attendance records, {evt_count} events/photos, and {corr_count} corrections for {month}.",
            "deleted_attendance": att_count,
            "deleted_events": evt_count,
            "month": month
        })

# Alias for backwards compatibility
EvidencePurge = MonthlyDataPurgeView
