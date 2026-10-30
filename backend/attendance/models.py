from django.db import models
from shops.models import Shop,Employee
class Attendance(models.Model):
 employee=models.ForeignKey(Employee,on_delete=models.PROTECT); shop=models.ForeignKey(Shop,on_delete=models.PROTECT); work_date=models.DateField()
 check_in=models.DateTimeField(null=True); check_out=models.DateTimeField(null=True)
 class Meta: unique_together=("employee","work_date")
class Event(models.Model):
 employee=models.ForeignKey(Employee,on_delete=models.PROTECT); shop=models.ForeignKey(Shop,on_delete=models.PROTECT)
 kind=models.CharField(max_length=20); created_at=models.DateTimeField(auto_now_add=True)
 latitude=models.FloatField(); longitude=models.FloatField(); accuracy_m=models.FloatField(); distance_m=models.FloatField()
 accepted=models.BooleanField(default=True); reason=models.CharField(max_length=255,blank=True); selfie_data_url=models.TextField()
