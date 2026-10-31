import io
import csv
from datetime import date, datetime, time, timedelta
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

# openpyxl for Excel
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# reportlab for PDF
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfgen import canvas

from shops.models import Shop, Employee, ShopManager, EmployeeTransfer, EmployeeHistory
from leaves.models import LeaveRequest
from .models import Attendance, AttendanceCorrection, Event

def get_report_shops(user):
    if user.role == "SUPER_ADMIN":
        return Shop.objects.all()
    elif user.role == "MANAGER":
        return Shop.objects.filter(manager_links__manager=user)
    elif user.role == "EMPLOYEE":
        return Shop.objects.filter(employees__user=user)
    return Shop.objects.none()

class ReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    def perform_content_negotiation(self, request, force=False):
        # Allow custom binary and document file formats (xlsx, pdf, csv)
        return (None, None)

    def get(self, request):
        user = request.user
        report_type = request.query_params.get("report_type", "daily_attendance")
        fmt = (request.query_params.get("export_format") or request.query_params.get("format") or "xlsx").lower()
        shop_id = request.query_params.get("shop_id")
        emp_id = request.query_params.get("employee_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        shops = get_report_shops(user)
        if shop_id:
            shops = shops.filter(id=shop_id)

        today = date.today()
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                end_date = today
        else:
            end_date = today

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            except ValueError:
                start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=30)

        # Restrict employee role to own data
        if user.role == "EMPLOYEE":
            try:
                current_emp = Employee.objects.get(user=user)
                emp_id = current_emp.id
            except Employee.DoesNotExist:
                return Response({"detail": "Employee profile not found."}, status=403)

        # 1. Gather Data based on report_type
        title, headers, rows = self.gather_data(report_type, shops, start_date, end_date, emp_id)

        filename_base = f"pharmatrack_{report_type}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"

        if fmt == "csv":
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="{filename_base}.csv"'
            writer = csv.writer(response)
            writer.writerow([f"PharmaTrack Report: {title}"])
            writer.writerow([f"Generated At: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"])
            writer.writerow([f"Date Range: {start_date} to {end_date}"])
            writer.writerow([])
            writer.writerow(headers)
            for row in rows:
                writer.writerow(row)
            return response

        elif fmt == "pdf":
            return self.generate_pdf(title, headers, rows, filename_base, start_date, end_date, user)

        else: # default to xlsx
            return self.generate_excel(title, headers, rows, filename_base, start_date, end_date, user)

    def gather_data(self, report_type, shops, start_date, end_date, emp_id):
        if report_type in ("daily_attendance", "monthly_attendance", "branch_attendance", "employee_history"):
            atts = Attendance.objects.filter(
                shop__in=shops,
                work_date__gte=start_date,
                work_date__lte=end_date
            )
            if emp_id:
                atts = atts.filter(employee_id=emp_id)

            atts = atts.select_related("employee__user", "shop").order_by("-work_date", "shop__name", "employee__code")

            title = "Attendance Records Report"
            if report_type == "daily_attendance":
                title = "Daily Attendance Log"
            elif report_type == "monthly_attendance":
                title = "Monthly Attendance Summary"
            elif report_type == "branch_attendance":
                title = "Branch Attendance Analysis"
            elif report_type == "employee_history":
                title = "Employee Attendance History"

            headers = ["Date", "Employee ID", "Employee Name", "Branch", "Check In", "Check Out", "Hours Worked", "Status"]
            rows = []
            for a in atts:
                u = a.employee.user
                cin = timezone.localtime(a.check_in).strftime("%H:%M:%S") if a.check_in else "—"
                cout = timezone.localtime(a.check_out).strftime("%H:%M:%S") if a.check_out else "—"
                hours = "—"
                if a.check_in and a.check_out:
                    h = (a.check_out - a.check_in).total_seconds() / 3600.0
                    hours = f"{h:.1f}h"
                status = "Present"
                if not a.check_in:
                    status = "Absent"
                elif a.check_in and not a.check_out and a.work_date < date.today():
                    status = "Missing Checkout"

                rows.append([
                    a.work_date.strftime("%Y-%m-%d"),
                    a.employee.code,
                    u.get_full_name() or u.username,
                    f"{a.shop.name} ({a.shop.code})",
                    cin,
                    cout,
                    hours,
                    status
                ])
            return title, headers, rows

        elif report_type == "late_arrivals":
            atts = Attendance.objects.filter(
                shop__in=shops,
                work_date__gte=start_date,
                work_date__lte=end_date,
                check_in__isnull=False
            ).select_related("employee__user", "shop").order_by("-work_date")

            title = "Late Arrivals Report"
            headers = ["Date", "Employee ID", "Employee Name", "Branch", "Check In Time", "Standard Time", "Late By"]
            rows = []
            for a in atts:
                local_in = timezone.localtime(a.check_in)
                if local_in.time() > time(9, 30):
                    # compute late minutes
                    standard_dt = datetime.combine(a.work_date, time(9, 30))
                    in_dt = datetime.combine(a.work_date, local_in.time())
                    diff_min = int((in_dt - standard_dt).total_seconds() / 60)
                    rows.append([
                        a.work_date.strftime("%Y-%m-%d"),
                        a.employee.code,
                        a.employee.user.get_full_name() or a.employee.user.username,
                        a.shop.name,
                        local_in.strftime("%H:%M:%S"),
                        "09:30:00",
                        f"+{diff_min} mins"
                    ])
            return title, headers, rows

        elif report_type == "missing_checkouts":
            atts = Attendance.objects.filter(
                shop__in=shops,
                work_date__gte=start_date,
                work_date__lt=date.today(),
                check_in__isnull=False,
                check_out__isnull=True
            ).select_related("employee__user", "shop").order_by("-work_date")

            title = "Missing Checkouts Report"
            headers = ["Date", "Employee ID", "Employee Name", "Branch", "Check In Time", "Status"]
            rows = []
            for a in atts:
                cin = timezone.localtime(a.check_in).strftime("%H:%M:%S") if a.check_in else "—"
                rows.append([
                    a.work_date.strftime("%Y-%m-%d"),
                    a.employee.code,
                    a.employee.user.get_full_name() or a.employee.user.username,
                    a.shop.name,
                    cin,
                    "Incomplete Shift (Unchecked Out)"
                ])
            return title, headers, rows

        elif report_type == "leave_history":
            leaves = LeaveRequest.objects.filter(
                shop__in=shops,
                start_date__lte=end_date,
                end_date__gte=start_date
            ).select_related("employee__user", "shop", "reviewed_by").order_by("-created_at")

            title = "Leave Applications & Approvals Report"
            headers = ["Employee ID", "Employee Name", "Branch", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reviewed By"]
            rows = []
            for l in leaves:
                rows.append([
                    l.employee.code,
                    l.employee.user.get_full_name() or l.employee.user.username,
                    l.shop.name,
                    l.leave_type,
                    l.start_date.strftime("%Y-%m-%d"),
                    l.end_date.strftime("%Y-%m-%d"),
                    str(l.total_days),
                    l.status,
                    l.reviewed_by.username if l.reviewed_by else "—"
                ])
            return title, headers, rows

        elif report_type == "corrections_history":
            corrs = AttendanceCorrection.objects.filter(
                shop__in=shops,
                attendance_date__gte=start_date,
                attendance_date__lte=end_date
            ).select_related("employee__user", "shop", "reviewed_by").order_by("-created_at")

            title = "Attendance Correction Audits Report"
            headers = ["Date", "Employee ID", "Branch", "Event", "Original Punch", "Requested Punch", "Reason", "Status", "Reviewed By"]
            rows = []
            for c in corrs:
                orig = timezone.localtime(c.original_timestamp).strftime("%H:%M:%S") if c.original_timestamp else "None"
                req = timezone.localtime(c.requested_timestamp).strftime("%H:%M:%S") if c.requested_timestamp else "—"
                rows.append([
                    c.attendance_date.strftime("%Y-%m-%d"),
                    c.employee.code,
                    c.shop.name,
                    c.event_type,
                    orig,
                    req,
                    c.reason,
                    c.status,
                    c.reviewed_by.username if c.reviewed_by else "—"
                ])
            return title, headers, rows

        elif report_type == "employee_lifecycle":
            transfers = EmployeeTransfer.objects.filter(
                from_shop__in=shops
            ).select_related("employee__user", "from_shop", "to_shop", "transferred_by").order_by("-created_at")

            title = "Employee Lifecycle & Transfers Audit"
            headers = ["Date", "Employee ID", "Employee Name", "From Branch", "To Branch", "Reason", "Authorized By"]
            rows = []
            for t in transfers:
                rows.append([
                    timezone.localtime(t.created_at).strftime("%Y-%m-%d %H:%M"),
                    t.employee.code,
                    t.employee.user.get_full_name() or t.employee.user.username,
                    t.from_shop.name,
                    t.to_shop.name,
                    t.reason,
                    t.transferred_by.username if t.transferred_by else "System"
                ])
            return title, headers, rows

        else: # GPS verification
            events = Event.objects.filter(
                shop__in=shops,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).select_related("employee__user", "shop").order_by("-created_at")[:500]

            title = "GPS Geofence Verification Audit"
            headers = ["Timestamp", "Employee ID", "Branch", "Event", "Distance (m)", "Accuracy (m)", "Status", "Reason"]
            rows = []
            for ev in events:
                rows.append([
                    timezone.localtime(ev.created_at).strftime("%Y-%m-%d %H:%M:%S"),
                    ev.employee.code,
                    ev.shop.name,
                    ev.kind,
                    f"{ev.distance_m:.1f}m",
                    f"{ev.accuracy_m:.1f}m",
                    "ACCEPTED" if ev.accepted else "REJECTED",
                    ev.reason or "Inside geofence"
                ])
            return title, headers, rows

    def generate_excel(self, title, headers, rows, filename_base, start_date, end_date, user):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "PharmaTrack Report"

        # Theme Colors
        teal_dark = "0F766E"
        teal_light = "CCFBF1"
        gray_text = "475569"
        border_color = "CBD5E1"

        # Branding Header
        ws.merge_cells("A1:H1")
        title_cell = ws["A1"]
        title_cell.value = f"PHARMATRACK ENTERPRISE — {title.upper()}"
        title_cell.font = Font(name="Segoe UI", size=15, bold=True, color="FFFFFF")
        title_cell.fill = PatternFill(start_color=teal_dark, end_color=teal_dark, fill_type="solid")
        title_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 36

        # Metadata Row
        ws.merge_cells("A2:H2")
        meta_cell = ws["A2"]
        meta_cell.value = f"Generated By: {user.username} ({user.role}) | Range: {start_date} to {end_date} | Timestamp: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')} | Copyright © 1103techstudios"
        meta_cell.font = Font(name="Segoe UI", size=9, italic=True, color=gray_text)
        meta_cell.alignment = Alignment(horizontal="center", vertical="center")
        meta_cell.fill = PatternFill(start_color=teal_light, end_color=teal_light, fill_type="solid")
        ws.row_dimensions[2].height = 22

        # Table Header Row (Row 4)
        thin_border = Border(
            left=Side(style='thin', color=border_color),
            right=Side(style='thin', color=border_color),
            top=Side(style='thin', color=border_color),
            bottom=Side(style='thin', color=border_color)
        )

        ws.row_dimensions[4].height = 26
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=4, column=col_idx, value=header)
            cell.font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

        # Data Rows
        row_idx = 5
        for row in rows:
            ws.row_dimensions[row_idx].height = 20
            bg_color = "F8FAFC" if row_idx % 2 == 0 else "FFFFFF"
            for col_idx, val in enumerate(row, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = Font(name="Segoe UI", size=9.5)
                cell.fill = PatternFill(start_color=bg_color, end_color=bg_color, fill_type="solid")
                cell.alignment = Alignment(horizontal="center" if col_idx in (1, 2, 5, 6, 7, 8) else "left", vertical="center")
                cell.border = thin_border
            row_idx += 1

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.row > 2 and cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            ws.column_dimensions[col_letter].width = max(max_len + 5, 14)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.xlsx"'
        return response

    def generate_pdf(self, title, headers, rows, filename_base, start_date, end_date, user):
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            rightMargin=20,
            leftMargin=20,
            topMargin=25,
            bottomMargin=25
        )

        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "PharmaTitle",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#0F766E"),
            spaceAfter=4,
            alignment=1,
            fontName="Helvetica-Bold"
        )

        sub_style = ParagraphStyle(
            "PharmaSub",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#475569"),
            spaceAfter=12,
            alignment=1,
            fontName="Helvetica"
        )

        elements.append(Paragraph(f"PHARMATRACK ENTERPRISE — {title.upper()}", title_style))
        elements.append(Paragraph(
            f"Generated By: <b>{user.username}</b> ({user.role}) | Date Range: <b>{start_date}</b> to <b>{end_date}</b> | Exported: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')} | Copyright © 1103techstudios",
            sub_style
        ))

        # Build table
        table_data = [headers]
        # Truncate to first 300 rows for PDF performance if large
        for r in rows[:300]:
            clean_row = [Paragraph(str(cell_val), ParagraphStyle("cell", fontSize=8, leading=10, fontName="Helvetica")) for cell_val in r]
            table_data.append(clean_row)

        header_row = [Paragraph(f"<b>{h}</b>", ParagraphStyle("hdr", fontSize=8.5, leading=11, textColor=colors.white, fontName="Helvetica-Bold")) for h in headers]
        table_data[0] = header_row

        t = Table(table_data, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)

        doc.build(elements)
        buf.seek(0)

        response = HttpResponse(buf.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.pdf"'
        return response
