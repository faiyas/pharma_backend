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
    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("INACTIVE", "Inactive"),
        ("ON_LEAVE", "On Leave"),
        ("RESIGNED", "Resigned"),
        ("TERMINATED", "Terminated"),
        ("TRANSFERRED", "Transferred"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="employees")
    code = models.CharField(max_length=20, unique=True)
    phone = models.CharField(max_length=25, blank=True, default="")
    designation = models.CharField(max_length=100, blank=True, default="Pharmacist")
    joining_date = models.DateField(null=True, blank=True)
    employment_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
    emergency_contact = models.CharField(max_length=100, blank=True, default="")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} - {self.user.get_full_name() or self.user.username} ({self.shop.name})"

class EmployeeTransfer(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="transfers")
    from_shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="transfers_out")
    to_shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="transfers_in")
    reason = models.TextField()
    transferred_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Transfer of {self.employee.code} from {self.from_shop.code} to {self.to_shop.code}"

class EmployeeHistory(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=100)
    details = models.TextField(blank=True, default="")
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} on {self.employee.code} at {self.created_at}"
