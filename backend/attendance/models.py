from django.conf import settings
from django.db import models
from shops.models import Shop, Employee

class Attendance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT)
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT)
    work_date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("employee", "work_date")
        db_table = "attendance_attendance"

    def __str__(self):
        return f"{self.employee.code} @ {self.shop.code} on {self.work_date}"

class Event(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT)
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT)
    kind = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy_m = models.FloatField()
    distance_m = models.FloatField()
    accepted = models.BooleanField(default=True)
    reason = models.CharField(max_length=255, blank=True)
    selfie_data_url = models.TextField(blank=True, default="")

    class Meta:
        db_table = "attendance_event"

    def __str__(self):
        return f"{self.kind} by {self.employee.code} ({self.created_at})"

    @property
    def selfie(self):
        if hasattr(self, "photo") and self.photo:
            return self.photo.image_data
        return self.selfie_data_url

class AttendancePhoto(models.Model):
    event = models.OneToOneField(Event, on_delete=models.CASCADE, related_name="photo")
    image_data = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "attendance_photo"
        verbose_name = "Attendance Selfie Photo"
        verbose_name_plural = "Attendance Selfie Photos"

    def __str__(self):
        return f"Selfie Photo for Event #{self.event_id}"

class AttendanceCorrection(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]
    EVENT_TYPES = [
        ("CHECK_IN", "Check In"),
        ("CHECK_OUT", "Check Out"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance_corrections")
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="attendance_corrections")
    attendance_date = models.DateField()
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    requested_timestamp = models.DateTimeField()
    original_timestamp = models.DateTimeField(null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="requested_corrections"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_corrections"
    )
    review_comments = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "attendance_correction"

    def __str__(self):
        return f"Correction for {self.employee.code} on {self.attendance_date} ({self.event_type}) - {self.status}"

class AttendanceAdjustment(models.Model):
    correction = models.ForeignKey(
        AttendanceCorrection,
        on_delete=models.CASCADE,
        related_name="adjustments"
    )
    attendance = models.ForeignKey(
        Attendance,
        on_delete=models.CASCADE,
        related_name="adjustments"
    )
    field_name = models.CharField(max_length=30)
    old_value = models.DateTimeField(null=True, blank=True)
    new_value = models.DateTimeField()
    reason = models.TextField()
    adjusted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "attendance_adjustment"

    def __str__(self):
        return f"Adjustment for {self.attendance} ({self.field_name}): {self.old_value} -> {self.new_value}"

