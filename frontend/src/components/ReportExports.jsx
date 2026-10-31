import React, { useState } from 'react';

export default function ReportExports({ user, shops, addToast, apiReq }) {
  const [reportType, setReportType] = useState('daily_attendance');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [isExporting, setIsExporting] = useState(false);

  const reportOptions = [
    { id: 'daily_attendance', title: '1. Daily Attendance Log', desc: 'Daily punch timestamps, shift durations, and presence status.' },
    { id: 'monthly_attendance', title: '2. Monthly Attendance Summary', desc: 'Monthly attendance aggregation by staff and branch.' },
    { id: 'branch_attendance', title: '3. Branch Attendance Analysis', desc: 'Branch-by-branch workforce attendance comparison.' },
    { id: 'employee_history', title: '4. Employee Attendance History', desc: 'Individual employee attendance timeline.' },
    { id: 'late_arrivals', title: '5. Late Arrival Report', desc: 'Punches recorded after standard 09:30 AM arrival window.' },
    { id: 'missing_checkouts', title: '6. Missing Checkout Report', desc: 'Incomplete shifts where checkout punch was never recorded.' },
    { id: 'leave_history', title: '7. Leave Applications & Approvals', desc: 'History of leave requests, types, days taken, and supervisor approvals.' },
    { id: 'corrections_history', title: '8. Attendance Correction History', desc: 'Missing-punch correction requests and permanent adjustment audit trace.' },
    { id: 'employee_lifecycle', title: '9. Employee Lifecycle & Transfers', desc: 'Staff status changes, activations, and inter-branch transfer logs.' },
    { id: 'gps_verification', title: '10. GPS Geofence Verification Audit', desc: 'Geofence distance calculations, coordinates, and accuracy readings.' },
    { id: 'monthly_attendance', title: '11. Monthly Compliance Report', desc: 'Overall workforce compliance and audit-ready summary.' },
  ];

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const RAW_API_BASE = import.meta.env.VITE_API_BASE || '';
      const API_BASE = RAW_API_BASE ? `${RAW_API_BASE.replace(/\/$/, '')}/api` : '/api';

      const token = localStorage.getItem('access');
      const params = new URLSearchParams({
        report_type: reportType,
        format: exportFormat,
        export_format: exportFormat,
        start_date: startDate,
        end_date: endDate,
      });

      if (selectedBranch) params.append('shop_id', selectedBranch);

      const url = `${API_BASE}/reports/export/?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Report generation failed (${res.status})`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `pharmatrack_${reportType}_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      addToast(`Report downloaded successfully (.${exportFormat})!`, 'success');

      if (startDate) {
        const mo = startDate.slice(0, 7);
        fetch(`${API_BASE}/attendance/monthly-export-record/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            month: mo,
            ...(selectedBranch ? { shop_id: selectedBranch } : {}),
            export_type: reportType.toUpperCase(),
          }),
        }).catch(() => {});
      }
    } catch (err) {
      addToast(err.message || 'Failed to download report.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="tab-pane-container">
      {/* Top Banner */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>Executive & Auditor Reports</h3>
          <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
            Generate and export branded, audit-ready Excel spreadsheets, formatted PDF documents, and CSV data files.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Left Column: Report Configuration */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">1. Select Report & Filter Criteria</h3>
              <p className="card-subtitle">Choose the report category and date parameters</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Report Type *</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                style={{ padding: '8px 12px', fontSize: 14 }}
              >
                {reportOptions.map((r, i) => (
                  <option key={i} value={r.id}>{r.title}</option>
                ))}
              </select>
              <span className="input-hint">
                {reportOptions.find((r) => r.id === reportType)?.desc}
              </span>
            </div>

            {user.role !== 'EMPLOYEE' && (
              <div className="form-group">
                <label>Branch Scope</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">All Permitted Branches</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Download Format *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  className={`btn ${exportFormat === 'xlsx' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setExportFormat('xlsx')}
                >
                  📊 Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className={`btn ${exportFormat === 'pdf' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setExportFormat('pdf')}
                >
                  📄 PDF Document
                </button>
                <button
                  type="button"
                  className={`btn ${exportFormat === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setExportFormat('csv')}
                >
                  📑 CSV Data
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ marginTop: 14 }}
              onClick={handleDownload}
              disabled={isExporting}
            >
              {isExporting ? 'Generating Report...' : `⬇️ Download Branded ${exportFormat.toUpperCase()} Report`}
            </button>
          </div>
        </div>

        {/* Right Column: Branded Report Preview & Standards */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Report Standards & Features</h3>
              <p className="card-subtitle">Enterprise formatting standards included in every download</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
            <div style={{ background: 'var(--teal-50)', padding: 14, borderRadius: 8, border: '1px solid var(--teal-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary-800)', fontWeight: 700, fontSize: 14 }}>
                <span>🏥</span> PharmaTrack Enterprise Certified
              </div>
              <p style={{ margin: '6px 0 0 0', color: 'var(--slate-700)', fontSize: 12.5 }}>
                All generated reports incorporate official PharmaTrack corporate banners, generated timestamps, auditor metadata, and full legal copyright protection for 1103techstudios.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <div>
                <strong>Excel (.xlsx) Formatter</strong>
                <p style={{ margin: '2px 0 0 0', color: 'var(--slate-600)', fontSize: 12 }}>
                  Formatted with styled header banners, alternating data rows, auto-fit column widths, and integer/currency alignments using openpyxl.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <div>
                <strong>Auditor PDF Document</strong>
                <p style={{ margin: '2px 0 0 0', color: 'var(--slate-600)', fontSize: 12 }}>
                  Rendered in Landscape A4 with formal title bars, metadata headers, and repeating column labels for regulatory reviews via ReportLab.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <div>
                <strong>Role-Based Access Enforcement</strong>
                <p style={{ margin: '2px 0 0 0', color: 'var(--slate-600)', fontSize: 12 }}>
                  Super Admins download enterprise-wide reports; Branch Managers access only their assigned shop rosters; Employees receive exclusively their own records.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
