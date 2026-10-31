from datetime import date, datetime, timedelta
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from shops.models import Shop, Employee, ShopManager, EmployeeTransfer
from attendance.models import Attendance, AttendanceCorrection, AttendanceAdjustment, Event

User = get_user_model()

class V2FullStackTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_superuser("super_admin", "admin@pharma.com", "Admin1234!")
        self.manager = User.objects.create_user("branch_mgr", "mgr@pharma.com", "Mgr1234!", role="MANAGER")
        self.emp_user = User.objects.create_user("emp_john", "john@pharma.com", "John1234!", role="EMPLOYEE")

        # Shops
        self.shop1 = Shop.objects.create(
            name="Apollo Branch A",
            code="APO_A",
            address="1st Main Rd",
            latitude=12.9716,
            longitude=77.5946,
            allowed_radius_m=100,
            created_by=self.admin
        )
        self.shop2 = Shop.objects.create(
            name="Apollo Branch B",
            code="APO_B",
            address="2nd Cross Rd",
            latitude=12.9800,
            longitude=77.6000,
            allowed_radius_m=80,
            created_by=self.admin
        )
        ShopManager.objects.create(shop=self.shop1, manager=self.manager)
        ShopManager.objects.create(shop=self.shop2, manager=self.manager)

        # Employee
        self.emp = Employee.objects.create(
            user=self.emp_user,
            shop=self.shop1,
            code="EMP001",
            designation="Pharmacist",
            phone="9876543210"
        )

    def test_attendance_correction_approval_and_immutable_adjustment(self):
        # 1. Employee punches original check-in at 10:15 AM
        work_date = date.today()
        orig_in = timezone.now().replace(hour=10, minute=15, second=0, microsecond=0)
        att = Attendance.objects.create(
            employee=self.emp,
            shop=self.shop1,
            work_date=work_date,
            check_in=orig_in
        )

        # 2. Employee submits correction requesting 09:00 AM
        req_in = orig_in.replace(hour=9, minute=0)
        self.client.force_authenticate(user=self.emp_user)
        res = self.client.post("/api/attendance-corrections/", {
            "attendance_date": work_date.isoformat(),
            "event_type": "CHECK_IN",
            "requested_timestamp": req_in.isoformat(),
            "reason": "Biometric terminal glitched at 9am entrance.",
        })
        self.assertEqual(res.status_code, 201)
        corr_id = res.data["id"]
        self.assertEqual(res.data["original_timestamp"], orig_in.isoformat())

        # 3. Manager reviews and approves
        self.client.force_authenticate(user=self.manager)
        app_res = self.client.post(f"/api/attendance-corrections/{corr_id}/approve/", {
            "comments": "Verified with shop CCTV. Correction accepted."
        })
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.data["status"], "APPROVED")

        # 4. Verify immutable adjustment record created
        adj = AttendanceAdjustment.objects.filter(correction_id=corr_id).first()
        self.assertIsNotNone(adj)
        self.assertEqual(adj.field_name, "check_in")
        self.assertEqual(adj.old_value, orig_in)
        self.assertEqual(adj.new_value, req_in)
        self.assertEqual(adj.adjusted_by, self.manager)

        # 5. Verify attendance check_in updated
        att.refresh_from_db()
        self.assertEqual(att.check_in, req_in)

    def test_employee_transfer_preserves_attendance(self):
        # Create historical attendance under shop1
        hist_date = date.today() - timedelta(days=2)
        att = Attendance.objects.create(
            employee=self.emp,
            shop=self.shop1,
            work_date=hist_date,
            check_in=timezone.now() - timedelta(days=2)
        )

        # Perform transfer to shop2
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/api/employees/{self.emp.id}/transfer/", {
            "to_shop_id": self.shop2.id,
            "reason": "Branch rotation and promotion",
        })
        self.assertEqual(res.status_code, 200)

        # Verify active shop changed
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.shop, self.shop2)

        # Verify historical attendance still points to shop1
        att.refresh_from_db()
        self.assertEqual(att.shop, self.shop1)

        # Verify transfer log created
        transfer_log = EmployeeTransfer.objects.filter(employee=self.emp).first()
        self.assertIsNotNone(transfer_log)
        self.assertEqual(transfer_log.from_shop, self.shop1)
        self.assertEqual(transfer_log.to_shop, self.shop2)

    def test_monitoring_and_analytics_endpoints(self):
        self.client.force_authenticate(user=self.manager)

        # Monitoring summary
        res_summary = self.client.get("/api/monitoring/summary/")
        self.assertEqual(res_summary.status_code, 200)
        self.assertIn("total_employees", res_summary.data)
        self.assertIn("checked_in_today", res_summary.data)

        # Analytics overview
        res_analytics = self.client.get("/api/analytics/overview/")
        self.assertEqual(res_analytics.status_code, 200)
        self.assertIn("attendance_percentage", res_analytics.data)
        self.assertIn("daily_trends", res_analytics.data)

    def test_report_exports(self):
        self.client.force_authenticate(user=self.admin)

        # XLSX Export
        res_xlsx = self.client.get("/api/reports/export/?report_type=daily_attendance&format=xlsx")
        self.assertEqual(res_xlsx.status_code, 200)
        self.assertEqual(res_xlsx["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        # PDF Export
        res_pdf = self.client.get("/api/reports/export/?report_type=daily_attendance&format=pdf")
        self.assertEqual(res_pdf.status_code, 200)
        self.assertEqual(res_pdf["Content-Type"], "application/pdf")

        # CSV Export
        res_csv = self.client.get("/api/reports/export/?report_type=daily_attendance&format=csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertEqual(res_csv["Content-Type"], "text/csv")

    def test_manager_and_admin_cannot_request_correction_or_punch(self):
        correction_payload = {
            "attendance_date": date.today().isoformat(),
            "event_type": "CHECK_IN",
            "requested_timestamp": timezone.now().isoformat(),
            "reason": "Manager test",
        }

        # Manager cannot request correction
        self.client.force_authenticate(user=self.manager)
        res_mgr = self.client.post("/api/attendance-corrections/", correction_payload)
        self.assertEqual(res_mgr.status_code, 403)
        self.assertIn("Only employees can request attendance corrections", res_mgr.data["detail"])

        # Admin cannot request correction
        self.client.force_authenticate(user=self.admin)
        res_adm = self.client.post("/api/attendance-corrections/", correction_payload)
        self.assertEqual(res_adm.status_code, 403)
        self.assertIn("Only employees can request attendance corrections", res_adm.data["detail"])

        # Manager cannot punch attendance
        punch_payload = {
            "event_type": "CHECK_IN",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "gps_accuracy_m": 5.0,
            "selfie_data_url": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        }
        res_punch = self.client.post("/api/attendance/submit/", punch_payload)
        self.assertEqual(res_punch.status_code, 403)

    def test_attendance_acceptance_and_rejection_by_manager_and_admin(self):
        work_date = date.today()
        orig_in = timezone.now()
        att = Attendance.objects.create(
            employee=self.emp,
            shop=self.shop1,
            work_date=work_date,
            check_in=orig_in,
            status="PENDING"
        )

        # 1. Employee cannot approve/accept attendance
        self.client.force_authenticate(user=self.emp_user)
        emp_res = self.client.post(f"/api/attendance/{att.id}/approve/")
        self.assertEqual(emp_res.status_code, 403)

        # 2. Manager accepts attendance
        self.client.force_authenticate(user=self.manager)
        mgr_res = self.client.post(f"/api/attendance/{att.id}/accept/", {"comments": "Verified check-in"})
        self.assertEqual(mgr_res.status_code, 200)
        self.assertEqual(mgr_res.data["status"], "APPROVED")
        att.refresh_from_db()
        self.assertEqual(att.status, "APPROVED")
        self.assertEqual(att.reviewed_by, self.manager)

        # 3. Admin can reject attendance
        self.client.force_authenticate(user=self.admin)
        adm_res = self.client.post(f"/api/attendance/{att.id}/reject/", {"comments": "Discrepancy observed"})
        self.assertEqual(adm_res.status_code, 200)
        self.assertEqual(adm_res.data["status"], "REJECTED")
        att.refresh_from_db()
        self.assertEqual(att.status, "REJECTED")
        self.assertEqual(att.reviewed_by, self.admin)

    def test_monthly_data_purge_requires_export_first(self):
        test_date = date(2026, 6, 15)
        test_month = "2026-06"
        att = Attendance.objects.create(
            employee=self.emp,
            shop=self.shop1,
            work_date=test_date,
            check_in=datetime(2026, 6, 15, 9, 0, tzinfo=timezone.utc),
            check_out=datetime(2026, 6, 15, 17, 0, tzinfo=timezone.utc),
            status="APPROVED"
        )
        evt = Event.objects.create(
            employee=self.emp,
            shop=self.shop1,
            kind="CHECK_IN",
            latitude=12.9716,
            longitude=77.5946,
            accuracy_m=5.0,
            distance_m=10.0,
            accepted=True
        )
        Event.objects.filter(id=evt.id).update(created_at=datetime(2026, 6, 15, 9, 0, tzinfo=timezone.utc))

        # 1. Purge WITHOUT export -> Must be rejected with 400 EXPORT_REQUIRED
        self.client.force_authenticate(user=self.manager)
        purge_res1 = self.client.post("/api/attendance/monthly-purge/", {
            "month": test_month
        })
        self.assertEqual(purge_res1.status_code, 400)
        self.assertEqual(purge_res1.data["code"], "EXPORT_REQUIRED")
        self.assertIn("must be exported at least once", purge_res1.data["detail"])
        self.assertTrue(Attendance.objects.filter(id=att.id).exists())

        # 2. Check export status endpoint
        status_res = self.client.get(f"/api/attendance/monthly-export-record/?month={test_month}")
        self.assertEqual(status_res.status_code, 200)
        self.assertFalse(status_res.data["has_exported"])

        # 3. Record export for this month
        exp_res = self.client.post("/api/attendance/monthly-export-record/", {
            "month": test_month,
            "export_type": "AUDIT_DOSSIER"
        })
        self.assertEqual(exp_res.status_code, 201)
        self.assertTrue(exp_res.data["has_exported"])

        # Check export status again
        status_res2 = self.client.get(f"/api/attendance/monthly-export-record/?month={test_month}")
        self.assertTrue(status_res2.data["has_exported"])

        # 4. Purge with export verified -> Must succeed and erase all records
        purge_res2 = self.client.post("/api/attendance/monthly-purge/", {
            "month": test_month
        })
        self.assertEqual(purge_res2.status_code, 200)
        self.assertEqual(purge_res2.data["deleted_attendance"], 1)
        self.assertFalse(Attendance.objects.filter(work_date__year=2026, work_date__month=6).exists())
