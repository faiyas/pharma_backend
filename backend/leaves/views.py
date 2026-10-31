from datetime import datetime, date
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Shop, Employee, ShopManager
from auditlog.models import AuditLog
from .models import LeavePolicy, LeaveBalance, LeaveRequest
from .serializers import LeavePolicySerializer, LeaveBalanceSerializer, LeaveRequestSerializer

def can_manage_shop(user, shop):
    if user.role == "SUPER_ADMIN":
        return True
    if user.role == "MANAGER":
        return ShopManager.objects.filter(manager=user, shop=shop).exists()
    return False

class LeaveRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        shop_id = request.query_params.get("shop_id")
        status_filter = request.query_params.get("status")
        employee_id = request.query_params.get("employee_id")

        if user.role == "SUPER_ADMIN":
            qs = LeaveRequest.objects.all()
        elif user.role == "MANAGER":
            managed_shops = Shop.objects.filter(manager_links__manager=user)
            qs = LeaveRequest.objects.filter(shop__in=managed_shops)
        elif user.role == "EMPLOYEE":
            try:
                emp = Employee.objects.get(user=user)
                qs = LeaveRequest.objects.filter(employee=emp)
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

        serializer = LeaveRequestSerializer(qs.select_related("employee__user", "shop", "reviewed_by"), many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        data = request.data

        if user.role != "EMPLOYEE":
            return Response({"detail": "Only employees can apply for leave."}, status=403)

        try:
            emp = Employee.objects.get(user=user)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee profile not found for current user."}, status=400)
        shop = emp.shop

        leave_type = data.get("leave_type", "Casual Leave").strip()
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        reason = str(data.get("reason", "")).strip()
        supporting_document = data.get("supporting_document", "")

        if not start_date_str or not end_date_str:
            return Response({"detail": "start_date and end_date are required."}, status=400)
        if not reason:
            return Response({"detail": "Reason is required."}, status=400)

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Dates must be in YYYY-MM-DD format."}, status=400)

        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=400)

        # Check for overlapping leave requests that are PENDING or APPROVED
        overlapping = LeaveRequest.objects.filter(
            employee=emp,
            status__in=["PENDING", "APPROVED"]
        ).filter(
            Q(start_date__lte=end_date) & Q(end_date__gte=start_date)
        ).exists()

        if overlapping:
            return Response({
                "detail": "An overlapping leave request already exists for this period."
            }, status=400)

        total_days = (end_date - start_date).days + 1

        # Check supporting document size (limit to ~5MB base64)
        if supporting_document and len(supporting_document) > 7_000_000:
            return Response({"detail": "Supporting document too large (max 5MB)."}, status=400)

        with transaction.atomic():
            leave = LeaveRequest.objects.create(
                employee=emp,
                shop=shop,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                total_days=total_days,
                reason=reason,
                supporting_document=supporting_document,
                status="PENDING",
            )
            AuditLog.log_event(
                user=user,
                action="LEAVE_REQUESTED",
                details=f"Leave {leave.id} ({leave_type}, {start_date} to {end_date}, {total_days} days) requested for {emp.code}."
            )

        serializer = LeaveRequestSerializer(leave)
        return Response(serializer.data, status=201)

class LeaveRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            leave = LeaveRequest.objects.select_related("employee__user", "shop", "reviewed_by").get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({"detail": "Leave request not found."}, status=404)

        user = request.user
        if user.role == "EMPLOYEE" and leave.employee.user != user:
            return Response({"detail": "Forbidden."}, status=403)
        if user.role == "MANAGER" and not can_manage_shop(user, leave.shop):
            return Response({"detail": "Forbidden."}, status=403)

        return Response(LeaveRequestSerializer(leave).data)

class LeaveApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            leave = LeaveRequest.objects.select_related("employee__user", "shop").get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({"detail": "Leave request not found."}, status=404)

        user = request.user
        if not can_manage_shop(user, leave.shop):
            return Response({"detail": "You do not have permission to review this leave request."}, status=403)

        if leave.status != "PENDING":
            return Response({"detail": f"Cannot approve leave request with status {leave.status}."}, status=400)

        comments = request.data.get("comments", "").strip()

        with transaction.atomic():
            leave.status = "APPROVED"
            leave.reviewed_by = user
            leave.review_comments = comments
            leave.reviewed_at = timezone.now()
            leave.save()

            # Update leave balance if present
            current_year = leave.start_date.year
            balance, _ = LeaveBalance.objects.get_or_create(employee=leave.employee, year=current_year)
            ltype = leave.leave_type.upper()
            if "CASUAL" in ltype:
                balance.casual_used += leave.total_days
            elif "SICK" in ltype:
                balance.sick_used += leave.total_days
            elif "EMERGENCY" in ltype:
                balance.emergency_used += leave.total_days
            elif "PAID" in ltype:
                balance.paid_used += leave.total_days
            else:
                balance.unpaid_used += leave.total_days
            balance.save()

            AuditLog.log_event(
                user=user,
                action="LEAVE_APPROVED",
                details=f"Leave {leave.id} for {leave.employee.code} approved by {user.username}. Comments: {comments}"
            )

        return Response(LeaveRequestSerializer(leave).data)

class LeaveRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            leave = LeaveRequest.objects.select_related("employee__user", "shop").get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({"detail": "Leave request not found."}, status=404)

        user = request.user
        if not can_manage_shop(user, leave.shop):
            return Response({"detail": "You do not have permission to review this leave request."}, status=403)

        if leave.status != "PENDING":
            return Response({"detail": f"Cannot reject leave request with status {leave.status}."}, status=400)

        comments = request.data.get("comments", "").strip()

        with transaction.atomic():
            leave.status = "REJECTED"
            leave.reviewed_by = user
            leave.review_comments = comments
            leave.reviewed_at = timezone.now()
            leave.save()

            AuditLog.log_event(
                user=user,
                action="LEAVE_REJECTED",
                details=f"Leave {leave.id} for {leave.employee.code} rejected by {user.username}. Comments: {comments}"
            )

        return Response(LeaveRequestSerializer(leave).data)

class LeaveCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            leave = LeaveRequest.objects.select_related("employee__user").get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({"detail": "Leave request not found."}, status=404)

        user = request.user
        if user.role == "EMPLOYEE" and leave.employee.user != user:
            return Response({"detail": "You can only cancel your own leave requests."}, status=403)
        if user.role == "MANAGER" and not can_manage_shop(user, leave.shop):
            return Response({"detail": "Forbidden."}, status=403)

        if leave.status != "PENDING":
            return Response({"detail": "Only PENDING leave requests can be cancelled."}, status=400)

        with transaction.atomic():
            leave.status = "CANCELLED"
            leave.review_comments = "Cancelled by employee / requester"
            leave.reviewed_at = timezone.now()
            leave.save()

            AuditLog.log_event(
                user=user,
                action="LEAVE_CANCELLED",
                details=f"Leave {leave.id} for {leave.employee.code} cancelled."
            )

        return Response(LeaveRequestSerializer(leave).data)

class LeaveBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        year = int(request.query_params.get("year", date.today().year))

        if user.role == "EMPLOYEE":
            try:
                emp = Employee.objects.get(user=user)
                balance, _ = LeaveBalance.objects.get_or_create(employee=emp, year=year)
                return Response(LeaveBalanceSerializer(balance).data)
            except Employee.DoesNotExist:
                return Response({"detail": "Employee profile not found."}, status=404)

        # Admin or Manager
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            try:
                emp = Employee.objects.get(id=employee_id)
                if not can_manage_shop(user, emp.shop):
                    return Response({"detail": "Forbidden."}, status=403)
                balance, _ = LeaveBalance.objects.get_or_create(employee=emp, year=year)
                return Response(LeaveBalanceSerializer(balance).data)
            except Employee.DoesNotExist:
                return Response({"detail": "Employee not found."}, status=404)

        if user.role == "SUPER_ADMIN":
            balances = LeaveBalance.objects.filter(year=year).select_related("employee__user")
        else:
            managed_shops = Shop.objects.filter(manager_links__manager=user)
            balances = LeaveBalance.objects.filter(employee__shop__in=managed_shops, year=year).select_related("employee__user")
        return Response(LeaveBalanceSerializer(balances, many=True).data)

class LeavePolicyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        policies = LeavePolicy.objects.all().order_by("id")
        if not policies.exists():
            # Seed default policies if empty
            defaults = [
                ("CASUAL", 12, "Casual leave for personal matters"),
                ("SICK", 10, "Sick leave with medical certificate where required"),
                ("EMERGENCY", 5, "Unforeseen emergencies"),
                ("PAID", 15, "Annual earned paid leave"),
                ("UNPAID", 30, "Unpaid leave of absence"),
            ]
            for lt, days, desc in defaults:
                LeavePolicy.objects.get_or_create(leave_type=lt, defaults={"annual_days": days, "description": desc})
            policies = LeavePolicy.objects.all().order_by("id")
        return Response(LeavePolicySerializer(policies, many=True).data)

    def post(self, request):
        if request.user.role != "SUPER_ADMIN":
            return Response({"detail": "Only Super Admins can configure leave policies."}, status=403)
        serializer = LeavePolicySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
