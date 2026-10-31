from django.urls import path
from .views import (
    LeaveRequestListCreateView,
    LeaveRequestDetailView,
    LeaveApproveView,
    LeaveRejectView,
    LeaveCancelView,
    LeaveBalanceView,
    LeavePolicyListCreateView,
)

urlpatterns = [
    path("", LeaveRequestListCreateView.as_view(), name="leave-list-create"),
    path("<int:pk>/", LeaveRequestDetailView.as_view(), name="leave-detail"),
    path("<int:pk>/approve/", LeaveApproveView.as_view(), name="leave-approve"),
    path("<int:pk>/reject/", LeaveRejectView.as_view(), name="leave-reject"),
    path("<int:pk>/cancel/", LeaveCancelView.as_view(), name="leave-cancel"),
    path("balances/", LeaveBalanceView.as_view(), name="leave-balances"),
    path("policies/", LeavePolicyListCreateView.as_view(), name="leave-policies"),
]
