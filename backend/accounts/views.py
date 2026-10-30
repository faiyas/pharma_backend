from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import User

class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, r):
        user = r.user
        data = {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.first_name,
            "email": user.email,
            "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
            "role": user.role,
            "must_change_password": user.must_change_password,
            "is_superuser": user.is_superuser,
        }
        if user.role == "EMPLOYEE" and hasattr(user, "employee"):
            emp = user.employee
            data["employee"] = {
                "id": emp.id,
                "code": emp.code,
                "shop_id": emp.shop.id,
                "shop_name": emp.shop.name,
                "shop_code": emp.shop.code,
                "shop_address": emp.shop.address,
                "shop_latitude": emp.shop.latitude,
                "shop_longitude": emp.shop.longitude,
                "allowed_radius_m": emp.shop.allowed_radius_m,
            }
        return Response(data)

class ChangePassword(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, r):
        old = r.data.get("old_password", "")
        new = r.data.get("new_password", "")
        if not r.user.check_password(old):
            return Response({"detail": "Current password is incorrect."}, status=400)
        if len(new) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=400)

        # On initial login for employees, require full name, email, and date of birth
        if r.user.must_change_password and r.user.role == "EMPLOYEE":
            full_name = str(r.data.get("full_name", "")).strip()
            email = str(r.data.get("email", "")).strip()
            dob_str = str(r.data.get("date_of_birth", "")).strip()

            if not full_name:
                return Response({"detail": "Full Name is required for initial account activation."}, status=400)
            if not email or "@" not in email:
                return Response({"detail": "A valid Email address is required for initial account activation."}, status=400)
            if not dob_str:
                return Response({"detail": "Date of Birth (DOB) is required for initial account activation."}, status=400)

            try:
                dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
            except ValueError:
                return Response({"detail": "Invalid Date of Birth format. Please use YYYY-MM-DD."}, status=400)

            r.user.first_name = full_name
            r.user.email = email
            r.user.date_of_birth = dob

        r.user.set_password(new)
        r.user.must_change_password = False
        r.user.save()

        # Log password change and activation
        try:
            from auditlog.models import AuditLog
            action = "EMPLOYEE_ACTIVATED" if r.user.role == "EMPLOYEE" else "PASSWORD_CHANGE"
            AuditLog.log_event(
                user=r.user,
                action=action,
                details=f"User {r.user.username} completed account activation and password setup."
            )
        except Exception:
            pass

        return Response({"detail": "Password and profile updated successfully."})
