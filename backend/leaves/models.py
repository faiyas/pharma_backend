from django.conf import settings
from django.db import models
from shops.models import Shop, Employee

class LeavePolicy(models.Model):
    LEAVE_TYPES = [
        ("CASUAL", "Casual Leave"),
        ("SICK", "Sick Leave"),
        ("EMERGENCY", "Emergency Leave"),
        ("PAID", "Paid Leave"),
        ("UNPAID", "Unpaid Leave"),
    ]
    leave_type = models.CharField(max_length=30, choices=LEAVE_TYPES, unique=True)
    annual_days = models.PositiveIntegerField(default=12)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_leave_type_display()} ({self.annual_days} days/yr)"

class LeaveBalance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_balances")
    year = models.PositiveIntegerField()
    casual_allowed = models.PositiveIntegerField(default=12)
    casual_used = models.PositiveIntegerField(default=0)
    sick_allowed = models.PositiveIntegerField(default=10)
    sick_used = models.PositiveIntegerField(default=0)
    emergency_allowed = models.PositiveIntegerField(default=5)
    emergency_used = models.PositiveIntegerField(default=0)
    paid_allowed = models.PositiveIntegerField(default=15)
    paid_used = models.PositiveIntegerField(default=0)
    unpaid_used = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("employee", "year")

    def __str__(self):
        return f"{self.employee.code} Balance ({self.year})"

class LeaveRequest(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]
    LEAVE_TYPES = [
        ("Casual Leave", "Casual Leave"),
        ("Sick Leave", "Sick Leave"),
        ("Emergency Leave", "Emergency Leave"),
        ("Paid Leave", "Paid Leave"),
        ("Unpaid Leave", "Unpaid Leave"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="leave_requests")
    leave_type = models.CharField(max_length=50, choices=LEAVE_TYPES, default="Casual Leave")
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.PositiveIntegerField(default=1)
    reason = models.TextField()
    supporting_document = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leaves"
    )
    review_comments = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee.code} - {self.leave_type} ({self.start_date} to {self.end_date}) [{self.status}]"
