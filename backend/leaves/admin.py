from django.contrib import admin
from .models import LeavePolicy, LeaveBalance, LeaveRequest

@admin.register(LeavePolicy)
class LeavePolicyAdmin(admin.ModelAdmin):
    list_display = ("leave_type", "annual_days", "created_at")

@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "year", "casual_used", "sick_used", "paid_used")

@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "shop", "leave_type", "start_date", "end_date", "total_days", "status", "created_at")
    list_filter = ("status", "leave_type", "shop")
    search_fields = ("employee__code", "employee__user__username", "reason")
