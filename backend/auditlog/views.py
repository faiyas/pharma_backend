from rest_framework.views import APIView
from rest_framework.response import Response
from accounts.permissions import SuperAdmin
from .models import AuditLog

class AuditLogsView(APIView):
    permission_classes = [SuperAdmin]

    def get(self, r):
        logs = AuditLog.objects.select_related("user").order_by("-created_at")[:200]
        return Response([
            {
                "id": log.id,
                "user": log.user.username if log.user else "System/Anonymous",
                "role": log.user.role if log.user else None,
                "action": log.action,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ])
