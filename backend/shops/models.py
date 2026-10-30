from django.conf import settings
from django.db import models
class Shop(models.Model):
 name=models.CharField(max_length=150); code=models.CharField(max_length=20,unique=True); address=models.TextField()
 latitude=models.FloatField(); longitude=models.FloatField(); location_accuracy_m=models.FloatField(default=0)
 allowed_radius_m=models.PositiveIntegerField(default=50); prefix=models.PositiveSmallIntegerField(default=1); next_num=models.PositiveIntegerField(default=1)
 created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT); is_active=models.BooleanField(default=True)
class ShopManager(models.Model):
 shop=models.ForeignKey(Shop,on_delete=models.CASCADE,related_name="manager_links"); manager=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name="managed_shops")
 class Meta: unique_together=("shop","manager")
class Employee(models.Model):
 user=models.OneToOneField(settings.AUTH_USER_MODEL,on_delete=models.CASCADE); shop=models.ForeignKey(Shop,on_delete=models.PROTECT,related_name="employees")
 code=models.CharField(max_length=20,unique=True); is_active=models.BooleanField(default=True)
