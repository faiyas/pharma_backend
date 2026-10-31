import React, { useState, useEffect } from 'react';

export default function AttendanceAnalytics({ user, shops, addToast, apiReq }) {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [presetRange, setPresetRange] = useState('30'); // '7', '14', '30'

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(presetRange, 10));

      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      let q = [`start_date=${startStr}`, `end_date=${endStr}`];
      if (selectedBranch) q.push(`shop_id=${selectedBranch}`);
      const qs = `?${q.join('&')}`;

      const data = await apiReq(`/analytics/overview/${qs}`);
      setAnalytics(data);
    } catch (err) {
      addToast(err.message || 'Failed to load analytics.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedBranch, presetRange]);

  return (
    <div className="tab-pane-container">
      {/* Top Controls Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>Workforce Attendance Analytics & KPIs</h3>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Comprehensive metrics on punctuality, absence rate, shift durations, overtime, and branch compliance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {user.role !== 'EMPLOYEE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="filter-label">Branch:</span>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 13 }}
                >
                  <option value="">All Branches</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="btn-group-pill">
              <button
                type="button"
                className={`btn-pill ${presetRange === '7' ? 'active' : ''}`}
                onClick={() => setPresetRange('7')}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                className={`btn-pill ${presetRange === '14' ? 'active' : ''}`}
                onClick={() => setPresetRange('14')}
              >
                Last 14 Days
              </button>
              <button
                type="button"
                className={`btn-pill ${presetRange === '30' ? 'active' : ''}`}
                onClick={() => setPresetRange('30')}
              >
                Last 30 Days
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadAnalytics}
              disabled={isLoading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {analytics ? (
        <div>
          {/* Main Key Ratios */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon emerald">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Attendance Rate</span>
                <span className="stat-value" style={{ color: 'var(--emerald-600, #059669)' }}>
                  {analytics.attendance_percentage}%
                </span>
                <span className="stat-hint">{analytics.total_present_days} present shifts logged</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon amber">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Absence Rate</span>
                <span className="stat-value" style={{ color: 'var(--amber-600, #d97706)' }}>
                  {analytics.absence_percentage}%
                </span>
                <span className="stat-hint">Unfilled roster days</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon teal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Punctuality Score</span>
                <span className="stat-value" style={{ color: 'var(--primary-700)' }}>
                  {analytics.punctuality_rate}%
                </span>
                <span className="stat-hint">{analytics.late_arrivals} late punches</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Avg Daily Shift</span>
                <span className="stat-value">{analytics.avg_working_hours}h</span>
                <span className="stat-hint">Total overtime: {analytics.total_overtime_hours}h</span>
              </div>
            </div>
          </div>

          {/* Daily Attendance Trend Bar Visualizer */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Daily Attendance Trends</h3>
                <p className="card-subtitle">Daily distribution of staff present, absent, and arriving late</p>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--emerald-500, #10b981)' }} />
                  Present
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--rose-500, #f43f5e)' }} />
                  Late Arrivals
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--slate-300, #cbd5e1)' }} />
                  Absent
                </span>
              </div>
            </div>

            {analytics.daily_trends && analytics.daily_trends.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '20px 10px 0 10px', overflowX: 'auto' }}>
                {analytics.daily_trends.map((item, idx) => {
                  const maxStaff = Math.max(1, analytics.total_employees);
                  const presentH = Math.min(100, Math.round((item.present / maxStaff) * 160));
                  const lateH = Math.min(presentH, Math.round((item.late / maxStaff) * 160));

                  return (
                    <div key={idx} style={{ flex: '1 1 28px', minWidth: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ position: 'relative', width: '100%', height: `${presentH}px`, background: 'var(--emerald-500, #10b981)', borderRadius: '4px 4px 0 0', minHeight: 4 }}>
                        {item.late > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${lateH}px`,
                              background: 'var(--rose-500, #f43f5e)',
                              borderRadius: '0 0 0 0',
                            }}
                            title={`Late: ${item.late}`}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 6, whiteSpace: 'nowrap' }}>
                        {item.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--slate-400)' }}>No daily trend data available for this range.</div>
            )}
          </div>

          {/* Secondary Grid: Branch Breakdown & Leave/Correction Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {/* Branch Comparison */}
            {user.role !== 'EMPLOYEE' && analytics.branch_comparison && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Branch Attendance Comparison</h3>
                    <p className="card-subtitle">Punctuality and attendance percentages by location</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {analytics.branch_comparison.map((b, i) => (
                    <div key={i} style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>
                          <strong>{b.branch_name}</strong> ({b.branch_code}) — {b.employees} staff
                        </span>
                        <strong style={{ color: b.attendance_rate >= 80 ? 'var(--emerald-600)' : 'var(--amber-600)' }}>
                          {b.attendance_rate}%
                        </strong>
                      </div>
                      <div style={{ width: '100%', height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, b.attendance_rate)}%`,
                            height: '100%',
                            background: b.attendance_rate >= 80 ? 'var(--emerald-500)' : 'var(--amber-500)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leave & Correction Highlights */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Leave & Correction Overview</h3>
                  <p className="card-subtitle">Workforce applications during selected period</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Total Leave Requests</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--slate-800)', marginTop: 2 }}>
                    {analytics.leave_stats?.total_requests || 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                    Approved: {analytics.leave_stats?.approved || 0} | Pending: {analytics.leave_stats?.pending || 0}
                  </div>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Missing Checkouts</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#ea580c', marginTop: 2 }}>
                    {analytics.missing_checkouts || 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                    Unrecorded departure punches
                  </div>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Corrections Requested</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-700)', marginTop: 2 }}>
                    {analytics.correction_stats?.total || 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                    Approved: {analytics.correction_stats?.approved || 0} | Pending: {analytics.correction_stats?.pending || 0}
                  </div>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Early Departures</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--rose-600)', marginTop: 2 }}>
                    {analytics.early_departures || 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                    Left before 05:00 PM
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--slate-500)' }}>
          {isLoading ? 'Computing analytics from database...' : 'No analytics data available.'}
        </div>
      )}
    </div>
  );
}
