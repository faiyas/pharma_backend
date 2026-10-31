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
