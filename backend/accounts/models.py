from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models

class CustomUserManager(DjangoUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", "SUPER_ADMIN")
        extra_fields.setdefault("must_change_password", False)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return super().create_superuser(username, email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = [
        ("SUPER_ADMIN", "Super Admin"),
        ("MANAGER", "Manager"),
        ("EMPLOYEE", "Employee"),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="EMPLOYEE")
    must_change_password = models.BooleanField(default=True)
    date_of_birth = models.DateField(null=True, blank=True)

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"
