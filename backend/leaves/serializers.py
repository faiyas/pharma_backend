from rest_framework import serializers
from .models import LeavePolicy, LeaveBalance, LeaveRequest

class LeavePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeavePolicy
        fields = "__all__"

class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.code", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveBalance
        fields = "__all__"

    def get_employee_name(self, obj):
        u = obj.employee.user
        return u.get_full_name() or u.username

class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.code", read_only=True)
    employee_name = serializers.SerializerMethodField()
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_code = serializers.CharField(source="shop.code", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "shop",
            "shop_name",
            "shop_code",
            "leave_type",
            "start_date",
            "end_date",
            "total_days",
            "reason",
            "supporting_document",
            "status",
            "reviewed_by",
            "reviewed_by_name",
            "review_comments",
            "created_at",
            "reviewed_at",
        ]
        read_only_fields = ["status", "reviewed_by", "reviewed_at", "total_days"]

    def get_employee_name(self, obj):
        u = obj.employee.user
        return u.get_full_name() or u.username

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None
