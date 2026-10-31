from django.urls import path
from .views import Shops, ShopDetail, Managers, ManagerDetail, AssignManager, Employees, EmployeeDetail

urlpatterns = [
    path('shops/', Shops.as_view()),
    path('shops/<int:shop_id>/', ShopDetail.as_view()),
    path('shops/<int:shop_id>/managers/', AssignManager.as_view()),
    path('managers/', Managers.as_view()),
    path('managers/<int:manager_id>/', ManagerDetail.as_view()),
    path('shops/<int:shop_id>/employees/', Employees.as_view()),
    path('shops/<int:shop_id>/employees/<int:emp_id>/', EmployeeDetail.as_view()),
]