from django.urls import path
from .views import Shops, ShopDetail, Managers, ManagerDetail, AssignManager, Employees, EmployeeDetail
from .lifecycle_views import (
    AllEmployeesView,
    EmployeeProfileDetailView,
    EmployeeActivateView,
    EmployeeDeactivateView,
    EmployeeTransferView,
    EmployeeHistoryView,
    EmployeeResetPasswordView,
)

urlpatterns = [
    path('shops/', Shops.as_view()),
    path('shops/<int:shop_id>/', ShopDetail.as_view()),
    path('shops/<int:shop_id>/managers/', AssignManager.as_view()),
    path('managers/', Managers.as_view()),
    path('managers/<int:manager_id>/', ManagerDetail.as_view()),
    path('shops/<int:shop_id>/employees/', Employees.as_view()),
    path('shops/<int:shop_id>/employees/<int:emp_id>/', EmployeeDetail.as_view()),
    # Employee lifecycle & cross-shop management
    path('employees/', AllEmployeesView.as_view()),
    path('employees/<int:emp_id>/', EmployeeProfileDetailView.as_view()),
    path('employees/<int:emp_id>/activate/', EmployeeActivateView.as_view()),
    path('employees/<int:emp_id>/deactivate/', EmployeeDeactivateView.as_view()),
    path('employees/<int:emp_id>/transfer/', EmployeeTransferView.as_view()),
    path('employees/<int:emp_id>/history/', EmployeeHistoryView.as_view()),
    path('employees/<int:emp_id>/reset-password/', EmployeeResetPasswordView.as_view()),
]