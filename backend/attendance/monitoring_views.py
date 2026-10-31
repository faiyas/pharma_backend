from datetime import date, datetime, time, timedelta
from django.utils import timezone
from django.db.models import Q, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Shop, Employee, ShopManager
from leaves.models import LeaveRequest
from .models import Attendance, AttendanceCorrection, Event

def get_accessible_shops(user):
    if user.role == "SUPER_ADMIN":
        return Shop.objects.all()
    elif user.role == "MANAGER":
        return Shop.objects.filter(manager_links__manager=user)
    elif user.role == "EMPLOYEE":
        return Shop.objects.filter(employees__user=user)
    return Shop.objects.none()

class MonitoringSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        accessible_shops = get_accessible_shops(user)

        target_date_str = request.query_params.get("date")
        if target_date_str:
            try:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
            except ValueError:
                target_date = date.today()
        else:
            target_date = date.today()

        shop_id = request.query_params.get("shop_id")
        if shop_id:
            accessible_shops = accessible_shops.filter(id=shop_id)

        # Base active employees in accessible shops
        employees = Employee.objects.filter(shop__in=accessible_shops, is_active=True)
        total_employees = employees.count()

        # Attendances on target date
        attendances = Attendance.objects.filter(
            shop__in=accessible_shops,
            work_date=target_date,
            employee__is_active=True
        ).select_related("employee__user", "shop")

        checked_in_today = attendances.filter(check_in__isnull=False).count()
        checked_out_today = attendances.filter(check_out__isnull=False).count()
        currently_working = attendances.filter(check_in__isnull=False, check_out__isnull=True).count()
        not_checked_in = max(0, total_employees - checked_in_today)

        # Late arrivals threshold: 09:30 AM local time
        # Check against time of check_in
        late_count = 0
        for att in attendances.filter(check_in__isnull=False):
            if att.check_in:
                local_dt = timezone.localtime(att.check_in)
                if local_dt.time() > time(9, 30):
                    late_count += 1

        # Missing checkouts: check_in present, check_out None, but work_date < today
        missing_checkouts = Attendance.objects.filter(
            shop__in=accessible_shops,
            work_date__lt=date.today(),
            check_in__isnull=False,
            check_out__isnull=True,
            employee__is_active=True
        ).count()

        # Employees on leave on target date
        on_leave_today = LeaveRequest.objects.filter(
            shop__in=accessible_shops,
            status="APPROVED",
            start_date__lte=target_date,
            end_date__gte=target_date
        ).values("employee_id").distinct().count()

        # Pending approvals
        pending_leaves = LeaveRequest.objects.filter(
            shop__in=accessible_shops,
            status="PENDING"
        ).count()

        pending_corrections = AttendanceCorrection.objects.filter(
            shop__in=accessible_shops,
            status="PENDING"
        ).count()

        return Response({
            "target_date": target_date.isoformat(),
            "total_employees": total_employees,
            "checked_in_today": checked_in_today,
            "currently_working": currently_working,
            "not_checked_in": not_checked_in,
            "late_arrivals": late_count,
            "checked_out_today": checked_out_today,
            "missing_checkouts": missing_checkouts,
            "employees_on_leave": on_leave_today,
            "pending_leave_requests": pending_leaves,
            "pending_corrections": pending_corrections,
        })

class MonitoringBranchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        accessible_shops = get_accessible_shops(user).order_by("name")
        target_date = date.today()

        results = []
        for s in accessible_shops:
            total_emp = s.employees.filter(is_active=True).count()
            atts = Attendance.objects.filter(shop=s, work_date=target_date, employee__is_active=True)
            checked_in = atts.filter(check_in__isnull=False).count()
            working = atts.filter(check_in__isnull=False, check_out__isnull=True).count()
            checked_out = atts.filter(check_out__isnull=False).count()

            late = 0
            for a in atts.filter(check_in__isnull=False):
                if a.check_in and timezone.localtime(a.check_in).time() > time(9, 30):
                    late += 1

            on_leave = LeaveRequest.objects.filter(
                shop=s,
                status="APPROVED",
                start_date__lte=target_date,
                end_date__gte=target_date
            ).values("employee_id").distinct().count()

            pending_items = (
                LeaveRequest.objects.filter(shop=s, status="PENDING").count() +
                AttendanceCorrection.objects.filter(shop=s, status="PENDING").count()
            )

            results.append({
                "shop_id": s.id,
                "shop_name": s.name,
                "shop_code": s.code,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "allowed_radius_m": s.allowed_radius_m,
                "total_employees": total_emp,
                "checked_in": checked_in,
                "currently_working": working,
                "not_checked_in": max(0, total_emp - checked_in),
                "checked_out": checked_out,
                "late_arrivals": late,
                "on_leave": on_leave,
                "pending_items": pending_items,
            })

        return Response(results)

class MonitoringLiveActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        accessible_shops = get_accessible_shops(user)
        shop_id = request.query_params.get("shop_id")
        if shop_id:
            accessible_shops = accessible_shops.filter(id=shop_id)

        target_date = date.today()

        # Fetch today's punches from Event and Attendance
        recent_events = Event.objects.filter(
            shop__in=accessible_shops,
            created_at__date=target_date
        ).select_related("employee__user", "shop").order_by("-created_at")[:50]

        activities = []
        for ev in recent_events:
            u = ev.employee.user
            activities.append({
                "id": ev.id,
                "employee_code": ev.employee.code,
                "employee_name": u.get_full_name() or u.username,
                "shop_name": ev.shop.name,
                "shop_code": ev.shop.code,
                "kind": ev.kind,
                "timestamp": timezone.localtime(ev.created_at).isoformat(),
                "latitude": ev.latitude,
                "longitude": ev.longitude,
                "accuracy_m": ev.accuracy_m,
                "distance_m": round(ev.distance_m, 1),
                "accepted": ev.accepted,
                "reason": ev.reason,
            })

        return Response(activities)
