from django.contrib import admin
from .models import Attendance, Event, AttendancePhoto

admin.site.register([Attendance, Event, AttendancePhoto])