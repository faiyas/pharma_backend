from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from shops.models import Shop, Employee, ShopManager
from leaves.models import LeavePolicy, LeaveBalance, LeaveRequest

User = get_user_model()

class LeaveManagementTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_superuser("admin_user", "admin@pharma.com", "AdminPass123!")
        self.manager = User.objects.create_user("manager_user", "manager@pharma.com", "ManagerPass123!", role="MANAGER")
        self.emp_user = User.objects.create_user("emp_user", "emp@pharma.com", "EmpPass123!", role="EMPLOYEE")

        # Shop
        self.shop = Shop.objects.create(
            name="Apollo Pharmacy",
            code="APOLLO01",
            address="123 Health Ave",
            latitude=12.9716,
            longitude=77.5946,
            created_by=self.admin
        )
        ShopManager.objects.create(shop=self.shop, manager=self.manager)

        # Employee
        self.emp = Employee.objects.create(
            user=self.emp_user,
            shop=self.shop,
            code="S1001",
            designation="Chief Pharmacist"
        )

    def test_apply_leave_and_overlap_validation(self):
        self.client.force_authenticate(user=self.emp_user)

        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=7)

        # 1. Apply for leave
        res = self.client.post("/api/leaves/", {
            "leave_type": "Casual Leave",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "reason": "Family vacation",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["total_days"], 3)
        self.assertEqual(res.data["status"], "PENDING")

        # 2. Prevent overlapping application
        res2 = self.client.post("/api/leaves/", {
            "leave_type": "Sick Leave",
            "start_date": (start + timedelta(days=1)).isoformat(),
            "end_date": (end + timedelta(days=2)).isoformat(),
            "reason": "Doctor appointment",
        })
        self.assertEqual(res2.status_code, 400)
        self.assertIn("overlapping", res2.data["detail"].lower())

    def test_manager_approve_leave_and_balance(self):
        # Create leave request
        start = date.today() + timedelta(days=10)
        end = date.today() + timedelta(days=11)
        leave = LeaveRequest.objects.create(
            employee=self.emp,
            shop=self.shop,
            leave_type="Casual Leave",
            start_date=start,
            end_date=end,
            total_days=2,
            reason="Personal work",
            status="PENDING"
        )

        # Manager approves
        self.client.force_authenticate(user=self.manager)
        res = self.client.post(f"/api/leaves/{leave.id}/approve/", {"comments": "Approved. Enjoy!"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "APPROVED")

        # Verify LeaveBalance updated
        balance = LeaveBalance.objects.get(employee=self.emp, year=start.year)
        self.assertEqual(balance.casual_used, 2)
