from datetime import datetime
from django.db import models, transaction
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import ManagerOrAdmin, SuperAdmin
from shops.models import Shop, ShopManager, Employee, EmployeeTransfer, EmployeeHistory
from auditlog.models import AuditLog

U = get_user_model()

def can_access_shop(user, shop):
    if user.role == "SUPER_ADMIN":
        return True
    if user.role == "MANAGER":
        return ShopManager.objects.filter(manager=user, shop=shop).exists()
    return False

def serialize_employee(e):
    u = e.user
    return {
        "id": e.id,
        "code": e.code,
        "username": u.username,
        "full_name": u.first_name or u.username,
        "email": u.email or "—",
        "date_of_birth": u.date_of_birth.isoformat() if u.date_of_birth else "—",
        "phone": e.phone,
        "designation": e.designation,
        "joining_date": e.joining_date.isoformat() if e.joining_date else "—",
        "employment_status": e.employment_status,
        "emergency_contact": e.emergency_contact,
        "is_active": e.is_active,
        "must_change_password": u.must_change_password,
        "shop_id": e.shop.id,
        "shop_name": e.shop.name,
        "shop_code": e.shop.code,
        "date_joined": u.date_joined.strftime("%Y-%m-%d"),
    }

class AllEmployeesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        shop_id = request.query_params.get("shop_id")
        status_filter = request.query_params.get("status")
        search = request.query_params.get("search", "").strip().lower()

        if user.role == "SUPER_ADMIN":
            qs = Employee.objects.all()
        elif user.role == "MANAGER":
            managed_shops = Shop.objects.filter(manager_links__manager=user)
            qs = Employee.objects.filter(shop__in=managed_shops)
        elif user.role == "EMPLOYEE":
            qs = Employee.objects.filter(user=user)
        else:
            return Response([])

        if shop_id:
            qs = qs.filter(shop_id=shop_id)
        if status_filter:
            qs = qs.filter(employment_status=status_filter.upper())
        if search:
            qs = qs.filter(
                models.Q(code__icontains=search) |
                models.Q(user__username__icontains=search) |
                models.Q(user__first_name__icontains=search) |
                models.Q(designation__icontains=search)
            )

        qs = qs.select_related("user", "shop").order_by("shop__name", "code")
        return Response([serialize_employee(e) for e in qs])

class EmployeeProfileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, emp_id):
        try:
            e = Employee.objects.select_related("user", "shop").get(id=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        if not can_access_shop(request.user, e.shop) and e.user != request.user:
            return Response({"detail": "Not authorized."}, status=403)

        return Response(serialize_employee(e))

    def patch(self, request, emp_id):
        try:
            e = Employee.objects.select_related("user", "shop").get(id=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        user = request.user
        # Allowed if manager of the shop, or super admin, or employee editing own contact info
        is_mgr = can_access_shop(user, e.shop)
        is_self = (e.user == user)

        if not is_mgr and not is_self:
            return Response({"detail": "Not authorized."}, status=403)

        d = request.data
        u = e.user

        with transaction.atomic():
            changes = []
            if "full_name" in d:
                u.first_name = str(d["full_name"]).strip()
                changes.append(f"Name updated to {u.first_name}")
            if "email" in d:
                u.email = str(d["email"]).strip()
                changes.append(f"Email updated to {u.email}")
            if "date_of_birth" in d and d["date_of_birth"]:
                try:
                    u.date_of_birth = datetime.strptime(d["date_of_birth"], "%Y-%m-%d").date()
                    changes.append(f"DOB updated")
                except ValueError:
                    pass
            u.save()

            if "phone" in d:
                e.phone = str(d["phone"]).strip()
                changes.append("Phone updated")
            if "emergency_contact" in d:
                e.emergency_contact = str(d["emergency_contact"]).strip()
                changes.append("Emergency contact updated")

            # Manager/Admin only fields
            if is_mgr:
                if "designation" in d:
                    e.designation = str(d["designation"]).strip()
                    changes.append(f"Designation updated to {e.designation}")
                if "employment_status" in d:
                    new_status = str(d["employment_status"]).strip().upper()
                    if new_status in dict(Employee.STATUS_CHOICES):
                        e.employment_status = new_status
                        e.is_active = (new_status == "ACTIVE")
                        changes.append(f"Status changed to {new_status}")
                if "joining_date" in d and d["joining_date"]:
                    try:
                        e.joining_date = datetime.strptime(d["joining_date"], "%Y-%m-%d").date()
                        changes.append("Joining date updated")
                    except ValueError:
                        pass
                if "is_active" in d:
                    e.is_active = bool(d["is_active"])
                    if not e.is_active and e.employment_status == "ACTIVE":
                        e.employment_status = "INACTIVE"
                    elif e.is_active and e.employment_status != "ACTIVE":
                        e.employment_status = "ACTIVE"
                    changes.append(f"Active status: {e.is_active}")

            e.save()

            if changes:
                change_desc = "; ".join(changes)
                EmployeeHistory.objects.create(
                    employee=e,
                    action="PROFILE_UPDATED",
                    details=change_desc,
                    performed_by=user
                )
                AuditLog.log_event(
                    user=user,
                    action="EMPLOYEE_UPDATED",
                    details=f"Updated employee {e.code}: {change_desc}"
                )

        return Response(serialize_employee(e))

class EmployeeActivateView(APIView):
    permission_classes = [ManagerOrAdmin]

    def post(self, request, emp_id):
        try:
            e = Employee.objects.select_related("shop", "user").get(id=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        if not can_access_shop(request.user, e.shop):
            return Response({"detail": "Not authorized to manage this branch."}, status=403)

        with transaction.atomic():
            e.is_active = True
            e.employment_status = "ACTIVE"
            e.save()

            EmployeeHistory.objects.create(
                employee=e,
                action="EMPLOYEE_ACTIVATED",
                details=f"Employee activated by {request.user.username}",
                performed_by=request.user
            )
            AuditLog.log_event(
                user=request.user,
                action="EMPLOYEE_ACTIVATED",
                details=f"Employee {e.code} activated"
            )

        return Response({"detail": f"Employee {e.code} activated successfully.", "employee": serialize_employee(e)})

class EmployeeDeactivateView(APIView):
    permission_classes = [ManagerOrAdmin]

    def post(self, request, emp_id):
        try:
            e = Employee.objects.select_related("shop", "user").get(id=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        if not can_access_shop(request.user, e.shop):
            return Response({"detail": "Not authorized to manage this branch."}, status=403)

        reason = request.data.get("reason", "Deactivated by administrator")

        with transaction.atomic():
            e.is_active = False
            e.employment_status = "INACTIVE"
            e.save()

            EmployeeHistory.objects.create(
                employee=e,
                action="EMPLOYEE_DEACTIVATED",
                details=f"Deactivated: {reason}",
                performed_by=request.user
            )
            AuditLog.log_event(
                user=request.user,
                action="EMPLOYEE_DEACTIVATED",
                details=f"Employee {e.code} deactivated. Reason: {reason}"
            )

        return Response({"detail": f"Employee {e.code} deactivated successfully.", "employee": serialize_employee(e)})

class EmployeeTransferView(APIView):
    permission_classes = [ManagerOrAdmin]

    def post(self, request, emp_id):
        try:
            e = Employee.objects.select_related("shop", "user").get(id=emp_id)
            to_shop_id = int(request.data.get("to_shop_id", 0))
            to_shop = Shop.objects.get(id=to_shop_id)
        except (Employee.DoesNotExist, Shop.DoesNotExist, ValueError):
            return Response({"detail": "Invalid employee or destination shop."}, status=400)

        if not can_access_shop(request.user, e.shop):
            return Response({"detail": "Not authorized for employee's current shop."}, status=403)
        if request.user.role == "MANAGER" and not can_access_shop(request.user, to_shop):
            return Response({"detail": "Not authorized for target destination shop."}, status=403)

        if e.shop == to_shop:
            return Response({"detail": "Target shop must be different from current shop."}, status=400)

        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response({"detail": "Transfer reason is required."}, status=400)

        from_shop = e.shop

        with transaction.atomic():
            EmployeeTransfer.objects.create(
                employee=e,
                from_shop=from_shop,
                to_shop=to_shop,
                reason=reason,
                transferred_by=request.user
            )

            # Update shop assignment while preserving historical attendance
            e.shop = to_shop
            e.employment_status = "ACTIVE"
            e.save()

            EmployeeHistory.objects.create(
                employee=e,
                action="EMPLOYEE_TRANSFERRED",
                details=f"Transferred from {from_shop.name} ({from_shop.code}) to {to_shop.name} ({to_shop.code}). Reason: {reason}",
                performed_by=request.user
            )

            AuditLog.log_event(
                user=request.user,
                action="EMPLOYEE_TRANSFERRED",
                details=f"Transferred {e.code} from {from_shop.code} to {to_shop.code}. Reason: {reason}"
            )

        return Response({
            "detail": f"Employee {e.code} successfully transferred to {to_shop.name}.",
            "employee": serialize_employee(e)
        })

class EmployeeHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, emp_id):
        try:
            e = Employee.objects.select_related("shop").get(id=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        if not can_access_shop(request.user, e.shop) and e.user != request.user:
            return Response({"detail": "Not authorized."}, status=403)

        history_items = []
        for h in e.history.select_related("performed_by").all():
            history_items.append({
                "type": "HISTORY",
                "action": h.action,
                "details": h.details,
                "performed_by": h.performed_by.username if h.performed_by else "System",
                "created_at": h.created_at.isoformat(),
            })

        for t in e.transfers.select_related("from_shop", "to_shop", "transferred_by").all():
            history_items.append({
                "type": "TRANSFER",
                "action": "BRANCH_TRANSFER",
                "details": f"Transferred from {t.from_shop.name} ({t.from_shop.code}) to {t.to_shop.name} ({t.to_shop.code}). Reason: {t.reason}",
                "performed_by": t.transferred_by.username if t.transferred_by else "System",
                "created_at": t.created_at.isoformat(),
            })

        history_items.sort(key=lambda x: x["created_at"], reverse=True)
        return Response(history_items)

class EmployeeResetPasswordView(APIView):
    permission_classes = [ManagerOrAdmin]

    def post(self, request, emp_id):
        try:
            e = Employee.objects.select_related("shop", "user").get(id=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        if not can_access_shop(request.user, e.shop):
            return Response({"detail": "Not authorized."}, status=403)

        new_password = request.data.get("password", "1234").strip()
        if len(new_password) < 4:
            return Response({"detail": "Password must be at least 4 characters long."}, status=400)

        u = e.user
        u.set_password(new_password)
        u.must_change_password = True
        u.save()

        EmployeeHistory.objects.create(
            employee=e,
            action="PASSWORD_RESET",
            details=f"Password reset to temporary password by {request.user.username}",
            performed_by=request.user
        )
        AuditLog.log_event(
            user=request.user,
            action="EMPLOYEE_PASSWORD_RESET",
            details=f"Reset password for {e.code}"
        )

        return Response({"detail": f"Password for {e.code} reset successfully. User will be prompted to change password on next login."})
