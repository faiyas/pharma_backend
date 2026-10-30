from django.urls import path
from .views import AuditLogsView

urlpatterns = [
    path("auditlog/", AuditLogsView.as_view()),
]