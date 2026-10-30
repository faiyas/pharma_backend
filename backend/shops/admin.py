from django.contrib import admin
from .models import Shop, ShopManager, Employee

admin.site.register([Shop, ShopManager, Employee])