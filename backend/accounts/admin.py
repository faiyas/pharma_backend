from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class UAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (('Access', {'fields': ('role', 'must_change_password', 'date_of_birth')}),)
    add_fieldsets = UserAdmin.add_fieldsets + (('Access', {'fields': ('role', 'must_change_password', 'date_of_birth')}),)