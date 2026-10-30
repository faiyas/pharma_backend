from django.contrib import admin
from django.urls import path,include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView,TokenRefreshView

def health_check(request):
    return JsonResponse({"status": "healthy", "service": "pharma_backend"})

urlpatterns=[
    path("health/", health_check),
    path("api/health/", health_check),
    path("admin/",admin.site.urls),
    path("api/auth/token/",TokenObtainPairView.as_view()),
    path("api/auth/token/refresh/",TokenRefreshView.as_view()),
    path("api/auth/",include("accounts.urls")),
    path("api/",include("shops.urls")),
    path("api/",include("attendance.urls")),
    path("api/",include("auditlog.urls"))
]
