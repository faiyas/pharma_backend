from django.urls import path
from .views import (
    Submit,
    TodayStatus,
    Records,
    Evidence,
    EvidencePurge,
    AttendanceApproveView,
    AttendanceRejectView,
    MonthlyExportRecordView,
    MonthlyDataPurgeView,
)
from .correction_views import (
    AttendanceCorrectionListCreateView,
    AttendanceCorrectionDetailView,
    AttendanceCorrectionApproveView,
    AttendanceCorrectionRejectView,
)
from .monitoring_views import (
    MonitoringSummaryView,
    MonitoringBranchesView,
    MonitoringLiveActivityView,
)
from .geofence_views import (
    GeofenceBranchesView,
    GeofencePunchesView,
)
from .analytics_views import AnalyticsOverviewView
from .report_views import ReportExportView

urlpatterns = [
    # Existing Core Attendance
    path('attendance/today/', TodayStatus.as_view()),
    path('attendance/submit/', Submit.as_view()),
    path('attendance/', Records.as_view()),
    path('attendance/<int:pk>/approve/', AttendanceApproveView.as_view()),
    path('attendance/<int:pk>/accept/', AttendanceApproveView.as_view()),
    path('attendance/<int:pk>/reject/', AttendanceRejectView.as_view()),
    path('attendance/evidence/', Evidence.as_view()),
    path('attendance/evidence/purge/', MonthlyDataPurgeView.as_view()),
    path('attendance/monthly-purge/', MonthlyDataPurgeView.as_view()),
    path('attendance/monthly-export-record/', MonthlyExportRecordView.as_view()),

    # Feature 2: Attendance Corrections & Adjustments
    path('attendance-corrections/', AttendanceCorrectionListCreateView.as_view()),
    path('attendance-corrections/<int:pk>/', AttendanceCorrectionDetailView.as_view()),
    path('attendance-corrections/<int:pk>/approve/', AttendanceCorrectionApproveView.as_view()),
    path('attendance-corrections/<int:pk>/reject/', AttendanceCorrectionRejectView.as_view()),

    # Feature 4: Live Branch Monitoring
    path('monitoring/summary/', MonitoringSummaryView.as_view()),
    path('monitoring/branches/', MonitoringBranchesView.as_view()),
    path('monitoring/activity/', MonitoringLiveActivityView.as_view()),

    # Feature 5: Interactive GPS Geofence Map
    path('geofence/branches/', GeofenceBranchesView.as_view()),
    path('geofence/punches/', GeofencePunchesView.as_view()),

    # Feature 6: Attendance Analytics
    path('analytics/overview/', AnalyticsOverviewView.as_view()),

    # Feature 7: Excel and PDF Reports
    path('reports/export/', ReportExportView.as_view()),
]