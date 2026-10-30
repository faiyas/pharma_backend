from django.urls import path
from .views import Me, ChangePassword

urlpatterns = [
    path('me/', Me.as_view()),
    path('change-password/', ChangePassword.as_view()),
]