from django.conf import settings
from django.db import models

class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )
    action = models.CharField(max_length=60)
    details = models.TextField(blank=True)
    ip_address = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @classmethod
    def log_event(cls, user=None, action="", details="", ip_address=""):
        return cls.objects.create(
            user=user,
            action=action,
            details=details,
            ip_address=ip_address
        )

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.action} by {self.user}"
