from django.urls import path
from .views import Submit, TodayStatus, Records, Evidence

urlpatterns = [
    path('attendance/today/', TodayStatus.as_view()),
    path('attendance/submit/', Submit.as_view()),
    path('attendance/', Records.as_view()),
    path('attendance/evidence/', Evidence.as_view()),
]