from datetime import datetime
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Shop, Employee, ShopManager
from auditlog.models import AuditLog
from .models import Attendance, AttendanceCorrection, AttendanceAdjustment

def can_manage_attendance_shop(user, shop):
    if user.role == "SUPER_ADMIN":
        return True
    if user.role == "MANAGER":
        return ShopManager.objects.filter(manager=user, shop=shop).exists()
    return False

def serialize_correction(c):
    u = c.employee.user
    return {
        "id": c.id,
        "employee_id": c.employee.id,
        "employee_code": c.employee.code,
        "employee_name": u.get_full_name() or u.username,
        "shop_id": c.shop.id,
        "shop_name": c.shop.name,
        "shop_code": c.shop.code,
        "attendance_date": c.attendance_date.isoformat(),
        "event_type": c.event_type,
        "requested_timestamp": c.requested_timestamp.isoformat(),
        "original_timestamp": c.original_timestamp.isoformat() if c.original_timestamp else None,
        "reason": c.reason,
        "status": c.status,
        "requested_by": c.requested_by.username if c.requested_by else None,
        "reviewed_by": c.reviewed_by.username if c.reviewed_by else None,
        "review_comments": c.review_comments,
        "created_at": c.created_at.isoformat(),
        "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
    }

class AttendanceCorrectionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        shop_id = request.query_params.get("shop_id")
        status_filter = request.query_params.get("status")
        employee_id = request.query_params.get("employee_id")

        if user.role == "SUPER_ADMIN":
            qs = AttendanceCorrection.objects.all()
        elif user.role == "MANAGER":
            managed_shops = Shop.objects.filter(manager_links__manager=user)
            qs = AttendanceCorrection.objects.filter(shop__in=managed_shops)
        elif user.role == "EMPLOYEE":
            try:
                emp = Employee.objects.get(user=user)
                qs = AttendanceCorrection.objects.filter(employee=emp)
            except Employee.DoesNotExist:
                return Response([])
        else:
            return Response([])

        if shop_id:
            qs = qs.filter(shop_id=shop_id)
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        qs = qs.select_related("employee__user", "shop", "requested_by", "reviewed_by")
        return Response([serialize_correction(c) for c in qs])

    def post(self, request):
        user = request.user
        d = request.data

        if user.role == "EMPLOYEE":
            try:
                emp = Employee.objects.get(user=user)
            except Employee.DoesNotExist:
                return Response({"detail": "Employee profile not found."}, status=400)
            shop = emp.shop
        else:
            emp_id = d.get("employee_id") or d.get("employee")
            if not emp_id:
                return Response({"detail": "employee_id is required."}, status=400)
            try:
                emp = Employee.objects.get(id=emp_id)
            except Employee.DoesNotExist:
                return Response({"detail": "Employee not found."}, status=404)
            if not can_manage_attendance_shop(user, emp.shop):
                return Response({"detail": "Forbidden."}, status=403)
            shop = emp.shop

        attendance_date_str = d.get("attendance_date")
        event_type = str(d.get("event_type", "CHECK_IN")).strip().upper()
        requested_ts_str = d.get("requested_timestamp")
        reason = str(d.get("reason", "")).strip()

        if not attendance_date_str or not requested_ts_str:
            return Response({"detail": "attendance_date and requested_timestamp are required."}, status=400)
        if not reason:
            return Response({"detail": "Reason for correction is required."}, status=400)
        if event_type not in ("CHECK_IN", "CHECK_OUT"):
            return Response({"detail": "event_type must be CHECK_IN or CHECK_OUT."}, status=400)

        try:
            attendance_date = datetime.strptime(attendance_date_str, "%Y-%m-%d").date()
            # ISO timestamp parse
            requested_timestamp = datetime.fromisoformat(requested_ts_str.replace("Z", "+00:00"))
        except ValueError:
            return Response({"detail": "Invalid date or timestamp format."}, status=400)

        # Look up existing attendance record for original timestamp
        att = Attendance.objects.filter(employee=emp, work_date=attendance_date).first()
        original_ts = None
        if att:
            if event_type == "CHECK_IN":
                original_ts = att.check_in
            else:
                original_ts = att.check_out

        with transaction.atomic():
            corr = AttendanceCorrection.objects.create(
                employee=emp,
                shop=shop,
                attendance_date=attendance_date,
                event_type=event_type,
                requested_timestamp=requested_timestamp,
                original_timestamp=original_ts,
                reason=reason,
                status="PENDING",
                requested_by=user,
            )

            AuditLog.log_event(
                user=user,
                action="ATTENDANCE_CORRECTION_REQUESTED",
                details=f"Correction #{corr.id} requested for {emp.code} on {attendance_date} ({event_type}): {original_ts} -> {requested_timestamp}. Reason: {reason}"
            )

        return Response(serialize_correction(corr), status=201)

class AttendanceCorrectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = AttendanceCorrection.objects.select_related("employee__user", "shop", "requested_by", "reviewed_by").get(pk=pk)
        except AttendanceCorrection.DoesNotExist:
            return Response({"detail": "Correction not found."}, status=404)

        user = request.user
        if user.role == "EMPLOYEE" and c.employee.user != user:
            return Response({"detail": "Forbidden."}, status=403)
        if user.role == "MANAGER" and not can_manage_attendance_shop(user, c.shop):
            return Response({"detail": "Forbidden."}, status=403)

        data = serialize_correction(c)
        data["adjustments"] = [
            {
                "field_name": adj.field_name,
                "old_value": adj.old_value.isoformat() if adj.old_value else None,
                "new_value": adj.new_value.isoformat(),
                "reason": adj.reason,
                "adjusted_by": adj.adjusted_by.username if adj.adjusted_by else "System",
                "created_at": adj.created_at.isoformat(),
            }
            for adj in c.adjustments.select_related("adjusted_by").all()
        ]
        return Response(data)

class AttendanceCorrectionApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = AttendanceCorrection.objects.select_related("employee__user", "shop").get(pk=pk)
        except AttendanceCorrection.DoesNotExist:
            return Response({"detail": "Correction request not found."}, status=404)

        user = request.user
        if not can_manage_attendance_shop(user, c.shop):
            return Response({"detail": "Not authorized to approve corrections for this branch."}, status=403)

        if c.status != "PENDING":
            return Response({"detail": f"Cannot approve correction with status {c.status}."}, status=400)

        comments = str(request.data.get("comments", "")).strip()

        with transaction.atomic():
            # Get or create attendance record for this employee and date
            att, _ = Attendance.objects.get_or_create(
                employee=c.employee,
                work_date=c.attendance_date,
                defaults={"shop": c.shop}
            )

            if c.event_type == "CHECK_IN":
                old_val = att.check_in
                att.check_in = c.requested_timestamp
                field_name = "check_in"
            else:
                old_val = att.check_out
                att.check_out = c.requested_timestamp
                field_name = "check_out"

            att.save()

            # Create immutable AttendanceAdjustment record
            AttendanceAdjustment.objects.create(
                correction=c,
                attendance=att,
                field_name=field_name,
                old_value=old_val,
                new_value=c.requested_timestamp,
                reason=c.reason + (f" | Approver comments: {comments}" if comments else ""),
                adjusted_by=user
            )

            c.status = "APPROVED"
            c.reviewed_by = user
            c.review_comments = comments
            c.reviewed_at = timezone.now()
            c.save()

            AuditLog.log_event(
                user=user,
                action="ATTENDANCE_CORRECTION_APPROVED",
                details=f"Correction #{c.id} approved by {user.username} for {c.employee.code} ({field_name}: {old_val} -> {c.requested_timestamp})"
            )

        return Response(serialize_correction(c))

class AttendanceCorrectionRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = AttendanceCorrection.objects.select_related("employee__user", "shop").get(pk=pk)
        except AttendanceCorrection.DoesNotExist:
            return Response({"detail": "Correction request not found."}, status=404)

        user = request.user
        if not can_manage_attendance_shop(user, c.shop):
            return Response({"detail": "Not authorized to review corrections for this branch."}, status=403)

        if c.status != "PENDING":
            return Response({"detail": f"Cannot reject correction with status {c.status}."}, status=400)

        comments = str(request.data.get("comments", "")).strip()

        with transaction.atomic():
            c.status = "REJECTED"
            c.reviewed_by = user
            c.review_comments = comments
            c.reviewed_at = timezone.now()
            c.save()

            AuditLog.log_event(
                user=user,
                action="ATTENDANCE_CORRECTION_REJECTED",
                details=f"Correction #{c.id} rejected by {user.username} for {c.employee.code}. Reason: {comments}"
            )

        return Response(serialize_correction(c))
