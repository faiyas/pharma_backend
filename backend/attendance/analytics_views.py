from datetime import date, datetime, time, timedelta
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shops.models import Shop, Employee, ShopManager
from leaves.models import LeaveRequest
from .models import Attendance, AttendanceCorrection

def get_analytics_shops(user):
    if user.role == "SUPER_ADMIN":
        return Shop.objects.all()
    elif user.role == "MANAGER":
        return Shop.objects.filter(manager_links__manager=user)
    elif user.role == "EMPLOYEE":
        return Shop.objects.filter(employees__user=user)
    return Shop.objects.none()

class AnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        shops = get_analytics_shops(user)

        shop_id = request.query_params.get("shop_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        if shop_id:
            shops = shops.filter(id=shop_id)

        today = date.today()
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                end_date = today
        else:
            end_date = today

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            except ValueError:
                start_date = end_date - timedelta(days=29)
        else:
            start_date = end_date - timedelta(days=29)

        if start_date > end_date:
            start_date, end_date = end_date, start_date

        num_days = (end_date - start_date).days + 1
        total_employees = Employee.objects.filter(shop__in=shops, is_active=True).count()

        # Attendances in range
        attendances = Attendance.objects.filter(
            shop__in=shops,
            work_date__gte=start_date,
            work_date__lte=end_date,
            employee__is_active=True
        ).select_related("employee")

        present_punches = attendances.filter(check_in__isnull=False)
        total_present_days = present_punches.count()
        total_potential_days = max(1, total_employees * num_days)

        attendance_percentage = round((total_present_days / total_potential_days) * 100, 1)
        absence_percentage = round(max(0, 100 - attendance_percentage), 1)

        # Working hours & Overtime calculations
        total_hours = 0.0
        overtime_hours = 0.0
        completed_shifts = 0
        late_count = 0
        early_departure_count = 0
        missing_checkout_count = 0

        for att in attendances:
            if att.check_in:
                local_in = timezone.localtime(att.check_in)
                if local_in.time() > time(9, 30):
                    late_count += 1

                if att.check_out:
                    local_out = timezone.localtime(att.check_out)
                    shift_sec = max(0, (att.check_out - att.check_in).total_seconds())
                    shift_hours = shift_sec / 3600.0
                    total_hours += shift_hours
                    completed_shifts += 1

                    if shift_hours > 8.0:
                        overtime_hours += (shift_hours - 8.0)
                    if local_out.time() < time(17, 0):
                        early_departure_count += 1
                else:
                    if att.work_date < today:
                        missing_checkout_count += 1

        avg_working_hours = round(total_hours / completed_shifts, 1) if completed_shifts > 0 else 0.0
        punctuality_rate = round(((total_present_days - late_count) / max(1, total_present_days)) * 100, 1)

        # Leave statistics in range
        leaves = LeaveRequest.objects.filter(
            shop__in=shops,
            start_date__lte=end_date,
            end_date__gte=start_date
        )
        leave_stats = {
            "total_requests": leaves.count(),
            "approved": leaves.filter(status="APPROVED").count(),
            "pending": leaves.filter(status="PENDING").count(),
            "rejected": leaves.filter(status="REJECTED").count(),
            "casual": leaves.filter(leave_type__icontains="casual", status="APPROVED").count(),
            "sick": leaves.filter(leave_type__icontains="sick", status="APPROVED").count(),
            "emergency": leaves.filter(leave_type__icontains="emergency", status="APPROVED").count(),
            "paid": leaves.filter(leave_type__icontains="paid", status="APPROVED").count(),
        }

        # Correction statistics
        corrections = AttendanceCorrection.objects.filter(
            shop__in=shops,
            attendance_date__gte=start_date,
            attendance_date__lte=end_date
        )
        correction_stats = {
            "total": corrections.count(),
            "pending": corrections.filter(status="PENDING").count(),
            "approved": corrections.filter(status="APPROVED").count(),
            "rejected": corrections.filter(status="REJECTED").count(),
        }

        # Daily trends (e.g. for charts)
        daily_trends = []
        curr = start_date
        # Limit to last 30 days for chart granularity
        step_days = max(1, (end_date - start_date).days // 30)
        while curr <= end_date:
            day_atts = attendances.filter(work_date=curr)
            present_c = day_atts.filter(check_in__isnull=False).count()
            absent_c = max(0, total_employees - present_c)
            late_c = 0
            for a in day_atts.filter(check_in__isnull=False):
                if a.check_in and timezone.localtime(a.check_in).time() > time(9, 30):
                    late_c += 1

            daily_trends.append({
                "date": curr.strftime("%b %d"),
                "present": present_c,
                "absent": absent_c,
                "late": late_c,
            })
            curr += timedelta(days=step_days)

        # Branch comparison
        branch_comparison = []
        for s in shops:
            s_emp = s.employees.filter(is_active=True).count()
            s_atts = attendances.filter(shop=s)
            s_pres = s_atts.filter(check_in__isnull=False).count()
            s_pot = max(1, s_emp * num_days)
            s_rate = round((s_pres / s_pot) * 100, 1)

            s_late = 0
            for a in s_atts.filter(check_in__isnull=False):
                if a.check_in and timezone.localtime(a.check_in).time() > time(9, 30):
                    s_late += 1

            branch_comparison.append({
                "branch_name": s.name,
                "branch_code": s.code,
                "employees": s_emp,
                "attendance_rate": s_rate,
                "late_count": s_late,
            })

        return Response({
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_employees": total_employees,
            "total_present_days": total_present_days,
            "attendance_percentage": attendance_percentage,
            "absence_percentage": absence_percentage,
            "punctuality_rate": punctuality_rate,
            "late_arrivals": late_count,
            "early_departures": early_departure_count,
            "missing_checkouts": missing_checkout_count,
            "avg_working_hours": avg_working_hours,
            "total_overtime_hours": round(overtime_hours, 1),
            "leave_stats": leave_stats,
            "correction_stats": correction_stats,
            "daily_trends": daily_trends,
            "branch_comparison": branch_comparison,
        })
