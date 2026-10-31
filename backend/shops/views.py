from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import ManagerOrAdmin, SuperAdmin
from .models import Shop, ShopManager, Employee
from auditlog.models import AuditLog

U = get_user_model()

def allowed(u, s):
    return u.role == "SUPER_ADMIN" or (u.role == "MANAGER" and ShopManager.objects.filter(manager=u, shop=s).exists())

class Shops(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, r):
        if r.user.role == "SUPER_ADMIN":
            q = Shop.objects.all()
        elif r.user.role == "MANAGER":
            q = Shop.objects.filter(manager_links__manager=r.user)
        elif r.user.role == "EMPLOYEE":
            q = Shop.objects.filter(employees__user=r.user)
        else:
            return Response([])
        return Response([self.out(s) for s in q.distinct().prefetch_related("employees", "manager_links__manager")])

    def out(self, s):
        managers = [link.manager.username for link in s.manager_links.all()]
        return {
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "address": s.address,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "allowed_radius_m": s.allowed_radius_m,
            "employee_count": s.employees.count(),
            "managers": managers,
            "is_active": s.is_active,
        }

    def post(self, r):
        if r.user.role not in ("SUPER_ADMIN", "MANAGER"):
            return Response({"detail": "Only Super Admins and Managers can create shops."}, status=403)
        d = r.data
        try:
            name = str(d.get("name", "")).strip()
            address = str(d.get("address", "")).strip()
            if not name or not address:
                return Response({"detail": "Shop name and address are required."}, status=400)
            lat = float(d["latitude"])
            lon = float(d["longitude"])
            acc = float(d.get("location_accuracy_m", 0))
            rad = int(d.get("allowed_radius_m", 50))
            if not -90 <= lat <= 90 or not -180 <= lon <= 180:
                raise ValueError()
            if not 20 <= rad <= 500:
                return Response({"detail": "Radius must be 20–500 metres."}, status=400)
        except (KeyError, ValueError, TypeError):
            return Response({"detail": "Valid shop name, address and GPS coordinates required."}, status=400)

        with transaction.atomic():
            n = Shop.objects.count() + 1
            s = Shop.objects.create(
                name=name,
                address=address,
                latitude=lat,
                longitude=lon,
                location_accuracy_m=acc,
                allowed_radius_m=rad,
                code=f"SHOP{n:03d}",
                prefix=min(n, 9),
                created_by=r.user
            )
            if r.user.role == "MANAGER":
                ShopManager.objects.create(shop=s, manager=r.user)

            AuditLog.log_event(
                user=r.user,
                action="SHOP_CREATED",
                details=f"Created shop '{s.name}' ({s.code}) with radius {rad}m"
            )

        return Response(self.out(s), status=201)

class ShopDetail(APIView):
    permission_classes = [ManagerOrAdmin]

    def patch(self, r, shop_id):
        try:
            s = Shop.objects.get(id=shop_id)
        except Shop.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=404)
        if not allowed(r.user, s):
            return Response({"detail": "Not authorised."}, status=403)

        if "allowed_radius_m" in r.data:
            try:
                rad = int(r.data["allowed_radius_m"])
                if not 20 <= rad <= 500:
                    return Response({"detail": "Radius must be 20–500 metres."}, status=400)
                s.allowed_radius_m = rad
            except (ValueError, TypeError):
                return Response({"detail": "Invalid radius."}, status=400)

        if "name" in r.data and r.data["name"].strip():
            s.name = r.data["name"].strip()
        if "address" in r.data and r.data["address"].strip():
            s.address = r.data["address"].strip()

        s.save()
        AuditLog.log_event(
            user=r.user,
            action="SHOP_UPDATED",
            details=f"Updated shop '{s.name}' ({s.code}) settings"
        )
        return Response(Shops().out(s))

class Managers(APIView):
    permission_classes = [SuperAdmin]

    def get(self, r):
        managers = U.objects.filter(role="MANAGER").prefetch_related("managed_shops__shop").order_by("username")
        out = []
        for m in managers:
            shops = [{"id": link.shop.id, "name": link.shop.name, "code": link.shop.code} for link in m.managed_shops.all()]
            out.append({
                "id": m.id,
                "username": m.username,
                "date_joined": m.date_joined.strftime("%Y-%m-%d"),
                "managed_shops": shops
            })
        return Response(out)

    def post(self, r):
        name = r.data.get("username", "").strip()
        pw = r.data.get("password", "")
        if not name or len(pw) < 8:
            return Response({"detail": "Username and password (8+ chars) required."}, status=400)
        if U.objects.filter(username=name).exists():
            return Response({"detail": "Username already exists."}, status=400)
        u = U.objects.create_user(username=name, password=pw, role="MANAGER", must_change_password=True)
        AuditLog.log_event(
            user=r.user,
            action="MANAGER_CREATED",
            details=f"Created manager user '{u.username}'"
        )
        return Response({"id": u.id, "username": u.username}, status=201)

class AssignManager(APIView):
    permission_classes = [SuperAdmin]

    def post(self, r, shop_id):
        try:
            s = Shop.objects.get(id=shop_id)
            manager_id = int(r.data.get("manager_id", 0))
            mgr = U.objects.get(id=manager_id, role="MANAGER")
        except (Shop.DoesNotExist, U.DoesNotExist, ValueError):
            return Response({"detail": "Invalid shop or manager."}, status=400)

        action = r.data.get("action", "assign") # 'assign' or 'remove'
        if action == "assign":
            ShopManager.objects.get_or_create(shop=s, manager=mgr)
            AuditLog.log_event(user=r.user, action="MANAGER_ASSIGNED", details=f"Assigned manager {mgr.username} to {s.code}")
            return Response({"detail": f"Assigned {mgr.username} to {s.name}."})
        elif action == "remove":
            ShopManager.objects.filter(shop=s, manager=mgr).delete()
            AuditLog.log_event(user=r.user, action="MANAGER_REMOVED", details=f"Removed manager {mgr.username} from {s.code}")
            return Response({"detail": f"Removed {mgr.username} from {s.name}."})
        return Response({"detail": "Invalid action."}, status=400)

class Employees(APIView):
    permission_classes = [ManagerOrAdmin]

    def get(self, r, shop_id):
        try:
            s = Shop.objects.get(id=shop_id)
        except Shop.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=404)
        if not allowed(r.user, s):
            return Response({"detail": "Not authorised."}, status=403)
        return Response([
            {
                "id": e.id,
                "code": e.code,
                "username": e.user.username,
                "full_name": e.user.first_name or "Pending Activation",
                "email": e.user.email or "—",
                "date_of_birth": e.user.date_of_birth.isoformat() if e.user.date_of_birth else "—",
                "must_change_password": e.user.must_change_password,
                "is_active": e.is_active,
                "date_joined": e.user.date_joined.strftime("%Y-%m-%d"),
            }
            for e in s.employees.select_related("user").order_by("code")
        ])

    def post(self, r, shop_id):
        try:
            s = Shop.objects.get(id=shop_id)
            count = int(r.data.get("count", 0))
        except (Shop.DoesNotExist, ValueError):
            return Response({"detail": "Invalid shop or count."}, status=400)
        if not allowed(r.user, s):
            return Response({"detail": "Not authorised."}, status=403)
        if not 1 <= count <= 100:
            return Response({"detail": "Count must be 1–100."}, status=400)
        made = []
        with transaction.atomic():
            for _ in range(count):
                num = s.next_num
                code = f"S{s.prefix}{num:03d}"
                while U.objects.filter(username=code).exists():
                    num += 1
                    code = f"S{s.prefix}{num:03d}"
                u = U.objects.create_user(username=code, password="1234", role="EMPLOYEE", must_change_password=True)
                Employee.objects.create(user=u, shop=s, code=code)
                made.append({"username": code, "temporary_password": "1234"})
                s.next_num = num + 1
            s.save(update_fields=["next_num"])
            AuditLog.log_event(
                user=r.user,
                action="EMPLOYEE_BATCH_CREATED",
                details=f"Generated {count} employee accounts for shop '{s.name}' ({s.code})"
            )
        return Response({"created": made}, status=201)

class EmployeeDetail(APIView):
    permission_classes = [ManagerOrAdmin]

    def delete(self, r, shop_id, emp_id):
        try:
            s = Shop.objects.get(id=shop_id)
            emp = Employee.objects.select_related("user").get(id=emp_id, shop=s)
        except (Shop.DoesNotExist, Employee.DoesNotExist):
            return Response({"detail": "Employee or shop not found."}, status=404)

        if not allowed(r.user, s):
            return Response({"detail": "Not authorised to manage staff for this shop."}, status=403)

        emp_code = emp.code
        user = emp.user
        emp_name = user.first_name if user and user.first_name else emp_code

        try:
            with transaction.atomic():
                from attendance.models import Attendance, Event, AttendancePhoto
                # Clean up associated photos, events, and attendance records to prevent ProtectedError
                AttendancePhoto.objects.filter(event__employee=emp).delete()
                Event.objects.filter(employee=emp).delete()
                Attendance.objects.filter(employee=emp).delete()

                emp.delete()
                if user:
                    user.delete()

                AuditLog.log_event(
                    user=r.user,
                    action="EMPLOYEE_DELETED",
                    details=f"Deleted employee '{emp_name}' ({emp_code}) from shop '{s.name}' ({s.code})"
                )

            return Response({"detail": f"Employee {emp_code} deleted successfully."})
        except Exception as e:
            return Response({"detail": f"Failed to delete employee: {str(e)}"}, status=500)

class ManagerDetail(APIView):
    permission_classes = [SuperAdmin]

    def patch(self, r, manager_id):
        try:
            m = U.objects.get(id=manager_id, role="MANAGER")
        except U.DoesNotExist:
            return Response({"detail": "Manager not found."}, status=404)

        new_pw = str(r.data.get("password", "")).strip()
        if not new_pw or len(new_pw) < 8:
            return Response({"detail": "Password must be at least 8 characters long."}, status=400)

        m.set_password(new_pw)
        m.must_change_password = False
        m.save()

        AuditLog.log_event(
            user=r.user,
            action="MANAGER_PASSWORD_RESET",
            details=f"Super Admin reset password for manager '{m.username}'"
        )
        return Response({"detail": f"Password for manager '{m.username}' updated successfully."})

    def delete(self, r, manager_id):
        try:
            m = U.objects.get(id=manager_id, role="MANAGER")
        except U.DoesNotExist:
            return Response({"detail": "Manager not found."}, status=404)

        mgr_name = m.username
        with transaction.atomic():
            ShopManager.objects.filter(manager=m).delete()
            m.delete()
            AuditLog.log_event(
                user=r.user,
                action="MANAGER_DELETED",
                details=f"Deleted manager '{mgr_name}'"
            )
        return Response({"detail": f"Manager '{mgr_name}' deleted successfully."})
