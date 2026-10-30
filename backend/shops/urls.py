from django.urls import path
from .views import Shops, ShopDetail, Managers, AssignManager, Employees

urlpatterns = [
    path('shops/', Shops.as_view()),
    path('shops/<int:shop_id>/', ShopDetail.as_view()),
    path('shops/<int:shop_id>/managers/', AssignManager.as_view()),
    path('managers/', Managers.as_view()),
    path('shops/<int:shop_id>/employees/', Employees.as_view()),
]