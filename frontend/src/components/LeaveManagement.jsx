import React, { useState, useEffect } from 'react';

export default function LeaveManagement({ user, shops, addToast, apiReq }) {
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterShop, setFilterShop] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchEmp, setSearchEmp] = useState('');

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null); // { leave, action: 'approve' | 'reject' }
  const [reviewComments, setReviewComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Apply Form State
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [supportingDoc, setSupportingDoc] = useState('');
  const [docFileName, setDocFileName] = useState('');

  const isEmployee = user.role === 'EMPLOYEE';

  const loadLeavesData = async () => {
    setIsLoading(true);
    try {
      let q = [];
      if (filterShop) q.push(`shop_id=${filterShop}`);
      if (filterStatus) q.push(`status=${filterStatus}`);
      const qs = q.length ? `?${q.join('&')}` : '';

      const [leavesData, balancesData, policiesData] = await Promise.all([
        apiReq(`/leaves/${qs}`),
        apiReq('/leaves/balances/'),
        apiReq('/leaves/policies/').catch(() => []),
      ]);

      setLeaves(leavesData || []);
      setBalances(Array.isArray(balancesData) ? balancesData : balancesData ? [balancesData] : []);
      setPolicies(policiesData || []);
    } catch (err) {
      addToast(err.message || 'Failed to load leaves data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeavesData();
  }, [filterShop, filterStatus]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('Document must be under 5MB', 'error');
      return;
    }
    setDocFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSupportingDoc(reader.result);
    reader.readAsDataURL(file);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) {
      addToast('Please complete all required fields.', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      addToast('Start date cannot be after end date.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiReq('/leaves/', {
        method: 'POST',
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          supporting_document: supportingDoc,
        }),
      });

      addToast('Leave request submitted successfully!', 'success');
      setShowApplyModal(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setSupportingDoc('');
      setDocFileName('');
      loadLeavesData();
    } catch (err) {
      addToast(err.message || 'Failed to submit leave request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewAction = async () => {
    if (!reviewModal) return;
    setIsSubmitting(true);
    try {
      const endpoint = `/leaves/${reviewModal.leave.id}/${reviewModal.action}/`;
      await apiReq(endpoint, {
        method: 'POST',
        body: JSON.stringify({ comments: reviewComments.trim() }),
      });

      addToast(`Leave request ${reviewModal.action}d successfully.`, 'success');
      setReviewModal(null);
      setReviewComments('');
      loadLeavesData();
    } catch (err) {
      addToast(err.message || `Failed to ${reviewModal.action} leave.`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await apiReq(`/leaves/${leaveId}/cancel/`, { method: 'POST' });
      addToast('Leave request cancelled.', 'success');
      loadLeavesData();
    } catch (err) {
      addToast(err.message || 'Failed to cancel leave.', 'error');
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (searchEmp) {
      const q = searchEmp.toLowerCase();
      const code = (l.employee_code || '').toLowerCase();
      const name = (l.employee_name || '').toLowerCase();
      if (!code.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  const myBalance = balances[0] || null;

  return (
    <div className="tab-pane-container">
      {/* Top Action Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              {isEmployee ? 'My Leave Applications' : 'Leave Management & Approvals'}
            </h3>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              {isEmployee
                ? 'Apply for casual, sick, or emergency leave and track approval status.'
                : 'Review employee leave requests, enforce policies, and monitor branch availability.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadLeavesData}
              disabled={isLoading}
            >
              ↻ Refresh
            </button>
            {isEmployee && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowApplyModal(true)}
              >
                + Apply for Leave
              </button>
            )}
          </div>
        </div>

        {/* Leave Balance Chips (Specifically for employee) */}
        {isEmployee && myBalance && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--slate-200)' }}>
            <div className="quick-chip" style={{ flex: '1 1 140px' }}>
              <span className="chip-label">Casual Leave</span>
              <span className="chip-val" style={{ color: 'var(--primary-700)' }}>
                {myBalance.casual_used} / {myBalance.casual_allowed} used
              </span>
            </div>
            <div className="quick-chip" style={{ flex: '1 1 140px' }}>
              <span className="chip-label">Sick Leave</span>
              <span className="chip-val" style={{ color: 'var(--accent-blue)' }}>
                {myBalance.sick_used} / {myBalance.sick_allowed} used
              </span>
            </div>
            <div className="quick-chip" style={{ flex: '1 1 140px' }}>
              <span className="chip-label">Emergency Leave</span>
              <span className="chip-val" style={{ color: 'var(--amber-600, #d97706)' }}>
                {myBalance.emergency_used} / {myBalance.emergency_allowed} used
              </span>
            </div>
            <div className="quick-chip" style={{ flex: '1 1 140px' }}>
              <span className="chip-label">Paid Annual</span>
              <span className="chip-val" style={{ color: 'var(--emerald-600, #059669)' }}>
                {myBalance.paid_used} / {myBalance.paid_allowed} used
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Row */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {!isEmployee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="filter-label">Branch:</span>
              <select
                value={filterShop}
                onChange={(e) => setFilterShop(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13 }}
              >
                <option value="">All Branches</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="filter-label">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13 }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {!isEmployee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
              <input
                type="text"
                placeholder="Search staff name or ID..."
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}
              />
            </div>
          )}

          {(filterShop || filterStatus || searchEmp) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFilterShop('');
                setFilterStatus('');
                setSearchEmp('');
              }}
            >
              ↺ Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                {!isEmployee && <th>Employee</th>}
                <th>Branch</th>
                <th>Leave Type</th>
                <th>Date Range</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Supporting Doc</th>
                <th>Status</th>
                <th>Reviewer / Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map((l) => (
                <tr key={l.id}>
                  {!isEmployee && (
                    <td>
                      <strong>{l.employee_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        {l.employee_code}
                      </div>
                    </td>
                  )}
                  <td>
                    <span>{l.shop_name}</span>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{l.shop_code}</div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{l.leave_type}</span>
                  </td>
                  <td>
                    <strong>{l.start_date}</strong> to <strong>{l.end_date}</strong>
                  </td>
                  <td>
                    <span className="badge badge-code">{l.total_days} {l.total_days === 1 ? 'day' : 'days'}</span>
                  </td>
                  <td style={{ maxWidth: 220, fontSize: 12.5, color: 'var(--slate-700)' }}>
                    {l.reason}
                  </td>
                  <td>
                    {l.supporting_document ? (
                      <a
                        href={l.supporting_document}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                      >
                        📎 View Doc
                      </a>
                    ) : (
                      <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>None</span>
                    )}
                  </td>
                  <td>
                    {l.status === 'APPROVED' && <span className="badge badge-success">✓ Approved</span>}
                    {l.status === 'PENDING' && <span className="badge badge-warning">⏳ Pending</span>}
                    {l.status === 'REJECTED' && <span className="badge badge-danger">✕ Rejected</span>}
                    {l.status === 'CANCELLED' && <span className="badge badge-neutral">Cancelled</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {l.reviewed_by_name ? (
                      <div>
                        <strong>{l.reviewed_by_name}</strong>
                        {l.review_comments && <div style={{ color: 'var(--slate-500)', fontStyle: 'italic' }}>"{l.review_comments}"</div>}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--slate-400)' }}>Awaiting review</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Manager/Admin Actions */}
                      {!isEmployee && l.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => {
                              setReviewModal({ leave: l, action: 'approve' });
                              setReviewComments('');
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => {
                              setReviewModal({ leave: l, action: 'reject' });
                              setReviewComments('');
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Employee Cancel Action */}
                      {isEmployee && l.status === 'PENDING' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: 12, color: 'var(--rose-600)' }}
                          onClick={() => handleCancelLeave(l.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredLeaves.length && (
                <tr>
                  <td colSpan={isEmployee ? 9 : 10} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-500)' }}>
                    {isLoading ? 'Loading leave applications...' : 'No leave applications found for the selected filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL: APPLY FOR LEAVE (EMPLOYEE ONLY)                             */}
      {/* ================================================================== */}
      {isEmployee && showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apply for Leave</h3>
              <button type="button" className="close-btn" onClick={() => setShowApplyModal(false)}>✕</button>
            </div>

            <form onSubmit={handleApplyLeave} className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Leave Type *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  required
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                  <option value="Paid Leave">Paid Annual Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {startDate && endDate && new Date(startDate) <= new Date(endDate) && (
                <div style={{ background: 'var(--teal-50)', padding: 10, borderRadius: 6, fontSize: 13, color: 'var(--teal-800)' }}>
                  📅 Total requested: <strong>{Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 3600 * 24)) + 1} day(s)</strong>
                </div>
              )}

              <div className="form-group">
                <label>Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the purpose of your leave request..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Supporting Document (Medical certificate / notes, max 5MB)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                />
                {docFileName && (
                  <span style={{ fontSize: 12, color: 'var(--teal-700)', marginTop: 4 }}>
                    ✓ Attached: {docFileName}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: APPROVE / REJECT LEAVE                                      */}
      {/* ================================================================== */}
      {reviewModal && (
        <div className="modal-overlay" onClick={() => setReviewModal(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ textTransform: 'capitalize' }}>
                {reviewModal.action} Leave Request #{reviewModal.leave.id}
              </h3>
              <button type="button" className="close-btn" onClick={() => setReviewModal(null)}>✕</button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
                <div>Employee: <strong>{reviewModal.leave.employee_name} ({reviewModal.leave.employee_code})</strong></div>
                <div>Dates: <strong>{reviewModal.leave.start_date}</strong> to <strong>{reviewModal.leave.end_date}</strong> ({reviewModal.leave.total_days} days)</div>
                <div>Reason: <em>"{reviewModal.leave.reason}"</em></div>
              </div>

              <div className="form-group">
                <label>Supervisor Review Comments (Optional)</label>
                <textarea
                  rows={3}
                  placeholder={`Reason for ${reviewModal.action}ing this request...`}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewModal(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${reviewModal.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={handleReviewAction}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : `Confirm ${reviewModal.action.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
