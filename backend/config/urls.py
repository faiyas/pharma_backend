from django.contrib import admin
from django.urls import path,include
from django.http import JsonResponse
from accounts.views import CustomTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

from django.db import connection
from django.utils import timezone
import time

def health_check(request):
    return JsonResponse({"status": "healthy", "service": "pharma_backend"})

def db_check(request):
    start = time.time()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            row = cursor.fetchone()
        duration_ms = round((time.time() - start) * 1000, 2)
        return JsonResponse({
            "status": "healthy",
            "database": "connected",
            "result": row[0] if row else None,
            "latency_ms": duration_ms,
            "checked_at": timezone.now().isoformat()
        })
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "database": "unreachable",
            "error": str(e),
            "checked_at": timezone.now().isoformat()
        }, status=500)

urlpatterns=[
    path("health/", health_check),
    path("health", health_check),
    path("api/health/", health_check),
    path("api/health", health_check),
    path("db-check/", db_check),
    path("db-check", db_check),
    path("api/db-check/", db_check),
    path("api/db-check", db_check),
    path("admin/",admin.site.urls),
    path("api/auth/token/",CustomTokenObtainPairView.as_view()),
    path("api/auth/token/refresh/",TokenRefreshView.as_view()),
    path("api/auth/",include("accounts.urls")),
    path("api/",include("shops.urls")),
    path("api/",include("attendance.urls")),
    path("api/",include("auditlog.urls"))
]
