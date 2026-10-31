import React, { useState, useEffect, useRef } from 'react';

export default function LiveMonitoring({ user, shops, addToast, apiReq }) {
  const [summary, setSummary] = useState(null);
  const [branchMetrics, setBranchMetrics] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(30); // 10, 30, 60, 0 = off
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  const [selectedBranch, setSelectedBranch] = useState('');

  const timerRef = useRef(null);

  const fetchMonitoringData = async () => {
    setIsLoading(true);
    try {
      const q = selectedBranch ? `?shop_id=${selectedBranch}` : '';
      const [sumData, branchData, actData] = await Promise.all([
        apiReq(`/monitoring/summary/${q}`),
        apiReq('/monitoring/branches/'),
        apiReq(`/monitoring/activity/${q}`),
      ]);

      setSummary(sumData);
      setBranchMetrics(branchData || []);
      setActivities(actData || []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      // Avoid spamming toast on background auto-refresh
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, [selectedBranch]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshIntervalSec > 0) {
      timerRef.current = setInterval(() => {
        fetchMonitoringData();
      }, refreshIntervalSec * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshIntervalSec, selectedBranch]);

  return (
    <div className="tab-pane-container">
      {/* Header & Controls Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-pulse-dot" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--emerald-500, #10b981)', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
              <h3 className="card-title" style={{ margin: 0 }}>Real-Time Branch Workforce Monitoring</h3>
            </div>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Live branch attendance, active shifts, late arrivals, and pending workflow requests.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {user.role !== 'EMPLOYEE' && (
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
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--slate-500)' }}>Auto-Refresh:</span>
              <select
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                style={{ padding: '5px 8px', fontSize: 12 }}
              >
                <option value={10}>Every 10s</option>
                <option value={30}>Every 30s</option>
                <option value={60}>Every 1m</option>
                <option value={0}>Manual Only</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchMonitoringData}
              disabled={isLoading}
            >
              ↻ Refresh Now
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--slate-500)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--slate-100)' }}>
          <span>Status as of latest recorded punch (not physical presence)</span>
          <span>Last updated: {lastRefreshedAt.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Staff</span>
              <span className="stat-value">{summary.total_employees}</span>
              <span className="stat-hint">Active roster staff</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon emerald">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Checked In Today</span>
              <span className="stat-value" style={{ color: 'var(--emerald-600, #059669)' }}>{summary.checked_in_today}</span>
              <span className="stat-hint">Arrived at branches</span>
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
              <span className="stat-label">Currently Working</span>
              <span className="stat-value" style={{ color: 'var(--primary-700)' }}>{summary.currently_working}</span>
              <span className="stat-hint">Active shift in progress</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon amber">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Not Checked In</span>
              <span className="stat-value" style={{ color: 'var(--amber-600, #d97706)' }}>{summary.not_checked_in}</span>
              <span className="stat-hint">Pending arrival</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon rose">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Late Arrivals</span>
              <span className="stat-value" style={{ color: 'var(--rose-600, #e11d48)' }}>{summary.late_arrivals}</span>
              <span className="stat-hint">Checked in after 09:30 AM</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">On Leave Today</span>
              <span className="stat-value" style={{ color: '#8b5cf6' }}>{summary.employees_on_leave}</span>
              <span className="stat-hint">Approved leave</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Missing Checkouts</span>
              <span className="stat-value" style={{ color: '#ea580c' }}>{summary.missing_checkouts}</span>
              <span className="stat-hint">Past incomplete shifts</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon teal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Pending Action</span>
              <span className="stat-value">{summary.pending_leave_requests + summary.pending_corrections}</span>
              <span className="stat-hint">{summary.pending_leave_requests} leaves, {summary.pending_corrections} corrections</span>
            </div>
          </div>
        </div>
      )}

      {/* Branch Breakdown & Activity Stream Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* Branch Overview Table */}
        {user.role !== 'EMPLOYEE' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Branch Workforce Status</h3>
                <p className="card-subtitle">Real-time attendance numbers across all branches</p>
              </div>
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Pharmacy Branch</th>
                    <th>Total Staff</th>
                    <th>Checked In</th>
                    <th>Currently Working</th>
                    <th>Not Checked In</th>
                    <th>Late Arrivals</th>
                    <th>On Leave</th>
                    <th>Pending Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {branchMetrics.map((b) => (
                    <tr key={b.shop_id}>
                      <td>
                        <strong>{b.shop_name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                          Code: {b.shop_code}
                        </div>
                      </td>
                      <td><strong>{b.total_employees}</strong></td>
                      <td>
                        <span style={{ color: 'var(--emerald-600, #059669)', fontWeight: 700 }}>
                          {b.checked_in}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-primary">{b.currently_working} active</span>
                      </td>
                      <td>
                        <span style={{ color: b.not_checked_in > 0 ? 'var(--amber-600, #d97706)' : 'var(--slate-400)' }}>
                          {b.not_checked_in}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: b.late_arrivals > 0 ? 'var(--rose-600, #e11d48)' : 'var(--slate-400)', fontWeight: b.late_arrivals > 0 ? 700 : 400 }}>
                          {b.late_arrivals}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: b.on_leave > 0 ? '#8b5cf6' : 'var(--slate-400)' }}>
                          {b.on_leave}
                        </span>
                      </td>
                      <td>
                        {b.pending_items > 0 ? (
                          <span className="badge badge-warning">{b.pending_items} pending</span>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!branchMetrics.length && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                        No branches assigned or registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Live Punch Activity Feed */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Today's Live Punch Activity Stream</h3>
              <p className="card-subtitle">Real-time geofenced punches with distance and GPS accuracy</p>
            </div>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Employee</th>
                  <th>Branch</th>
                  <th>Punch Event</th>
                  <th>GPS Distance</th>
                  <th>GPS Accuracy</th>
                  <th>Geofence Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <strong>{a.employee_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        {a.employee_code}
                      </div>
                    </td>
                    <td>{a.shop_name}</td>
                    <td>
                      <span className={`badge ${a.kind === 'CHECK_IN' ? 'badge-primary' : 'badge-danger'}`}>
                        {a.kind.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{a.distance_m}m</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                      ±{a.accuracy_m}m
                    </td>
                    <td>
                      {a.accepted ? (
                        <span className="badge badge-success">✓ Verified Inside</span>
                      ) : (
                        <span className="badge badge-danger" title={a.reason}>
                          ⚠️ Rejected ({a.reason || 'Outside radius'})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!activities.length && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                      No attendance punch activity recorded today yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
