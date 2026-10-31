import React, { useState, useEffect } from 'react';

export default function AttendanceCorrection({ user, shops, addToast, apiReq }) {
  const [corrections, setCorrections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterShop, setFilterShop] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchEmp, setSearchEmp] = useState('');

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null); // { correction, action: 'approve' | 'reject' }
  const [reviewComments, setReviewComments] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState('CHECK_IN');
  const [requestedTime, setRequestedTime] = useState('09:00');
  const [reason, setReason] = useState('');

  const isEmployee = user.role === 'EMPLOYEE';

  const loadCorrections = async () => {
    setIsLoading(true);
    try {
      let q = [];
      if (filterShop) q.push(`shop_id=${filterShop}`);
      if (filterStatus) q.push(`status=${filterStatus}`);
      const qs = q.length ? `?${q.join('&')}` : '';

      const data = await apiReq(`/attendance-corrections/${qs}`);
      setCorrections(data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load attendance corrections', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCorrections();
  }, [filterShop, filterStatus]);

  const handleCreateCorrection = async (e) => {
    e.preventDefault();
    if (!attendanceDate || !requestedTime || !reason.trim()) {
      addToast('Please provide date, time, and explanation.', 'error');
      return;
    }

    // Combine date and time to ISO
    const requestedTimestamp = `${attendanceDate}T${requestedTime}:00`;

    setIsSubmitting(true);
    try {
      await apiReq('/attendance-corrections/', {
        method: 'POST',
        body: JSON.stringify({
          attendance_date: attendanceDate,
          event_type: eventType,
          requested_timestamp: requestedTimestamp,
          reason: reason.trim(),
        }),
      });

      addToast('Attendance correction submitted for review!', 'success');
      setShowRequestModal(false);
      setReason('');
      loadCorrections();
    } catch (err) {
      addToast(err.message || 'Failed to submit correction request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewAction = async () => {
    if (!reviewModal) return;
    setIsSubmitting(true);
    try {
      const endpoint = `/attendance-corrections/${reviewModal.correction.id}/${reviewModal.action}/`;
      await apiReq(endpoint, {
        method: 'POST',
        body: JSON.stringify({ comments: reviewComments.trim() }),
      });

      addToast(`Correction request ${reviewModal.action}d successfully.`, 'success');
      setReviewModal(null);
      setReviewComments('');
      loadCorrections();
    } catch (err) {
      addToast(err.message || `Failed to ${reviewModal.action} correction.`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetails = async (corr) => {
    try {
      const full = await apiReq(`/attendance-corrections/${corr.id}/`);
      setDetailsModal(full);
    } catch {
      setDetailsModal(corr);
    }
  };

  const filteredCorrections = corrections.filter((c) => {
    if (searchEmp) {
      const q = searchEmp.toLowerCase();
      const code = (c.employee_code || '').toLowerCase();
      const name = (c.employee_name || '').toLowerCase();
      if (!code.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="tab-pane-container">
      {/* Top Banner & Action */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              {isEmployee ? 'My Missing Punch Corrections' : 'Attendance Correction & Audits'}
            </h3>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              {isEmployee
                ? 'Submit auditable timestamp corrections for missed check-ins or biometric delays.'
                : 'Review timestamp adjustment requests. Approved modifications create permanent audit trail records.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadCorrections}
              disabled={isLoading}
            >
              ↻ Refresh
            </button>
            {isEmployee && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowRequestModal(true)}
              >
                + Request Correction
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
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
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved & Adjusted</option>
              <option value="REJECTED">Rejected</option>
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
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Corrections Table */}
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                {!isEmployee && <th>Employee</th>}
                <th>Branch</th>
                <th>Work Date</th>
                <th>Event Type</th>
                <th>Original Record</th>
                <th>Requested Timestamp</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewer / Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCorrections.map((c) => (
                <tr key={c.id}>
                  {!isEmployee && (
                    <td>
                      <strong>{c.employee_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        {c.employee_code}
                      </div>
                    </td>
                  )}
                  <td>
                    <span>{c.shop_name}</span>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{c.shop_code}</div>
                  </td>
                  <td>
                    <strong>{c.attendance_date}</strong>
                  </td>
                  <td>
                    <span className={`badge ${c.event_type === 'CHECK_IN' ? 'badge-primary' : 'badge-danger'}`}>
                      {c.event_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {c.original_timestamp ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--slate-600)' }}>
                        {new Date(c.original_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>Missing Punch</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--primary-700)' }}>
                      {new Date(c.requested_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, fontSize: 12.5, color: 'var(--slate-700)' }}>
                    {c.reason}
                  </td>
                  <td>
                    {c.status === 'APPROVED' && <span className="badge badge-success">✓ Approved</span>}
                    {c.status === 'PENDING' && <span className="badge badge-warning">⏳ Pending</span>}
                    {c.status === 'REJECTED' && <span className="badge badge-danger">✕ Rejected</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.reviewed_by ? (
                      <div>
                        <strong>{c.reviewed_by}</strong>
                        {c.review_comments && <div style={{ color: 'var(--slate-500)', fontStyle: 'italic' }}>"{c.review_comments}"</div>}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--slate-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleOpenDetails(c)}
                        title="View Audit Details"
                      >
                        Audit Details
                      </button>

                      {!isEmployee && c.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => {
                              setReviewModal({ correction: c, action: 'approve' });
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
                              setReviewModal({ correction: c, action: 'reject' });
                              setReviewComments('');
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCorrections.length && (
                <tr>
                  <td colSpan={isEmployee ? 9 : 10} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-500)' }}>
                    {isLoading ? 'Loading corrections...' : 'No attendance correction requests found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL: REQUEST ATTENDANCE CORRECTION (EMPLOYEE ONLY)               */}
      {/* ================================================================== */}
      {isEmployee && showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request Attendance Correction</h3>
              <button type="button" className="close-btn" onClick={() => setShowRequestModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateCorrection} className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Attendance Date *</label>
                  <input
                    type="date"
                    required
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Event Type *</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                  >
                    <option value="CHECK_IN">Check In</option>
                    <option value="CHECK_OUT">Check Out</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Actual Timestamp Required *</label>
                <input
                  type="time"
                  required
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                />
                <span className="input-hint">Specify the exact time you arrived or completed your shift.</span>
              </div>

              <div className="form-group">
                <label>Reason for Correction / Missing Punch *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Device camera error, GPS signal glitch outdoors, urgent emergency shift arrival..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRequestModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: APPROVE / REJECT CORRECTION                                 */}
      {/* ================================================================== */}
      {reviewModal && (
        <div className="modal-overlay" onClick={() => setReviewModal(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ textTransform: 'capitalize' }}>
                {reviewModal.action} Correction #{reviewModal.correction.id}
              </h3>
              <button type="button" className="close-btn" onClick={() => setReviewModal(null)}>✕</button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 14, border: '1px solid var(--slate-200)' }}>
                <div>Staff: <strong>{reviewModal.correction.employee_name} ({reviewModal.correction.employee_code})</strong></div>
                <div>Date & Event: <strong>{reviewModal.correction.attendance_date} ({reviewModal.correction.event_type})</strong></div>
                <div>Original: <strong>{reviewModal.correction.original_timestamp ? new Date(reviewModal.correction.original_timestamp).toLocaleTimeString() : 'Missing Punch'}</strong></div>
                <div>Requested: <strong style={{ color: 'var(--primary-700)' }}>{new Date(reviewModal.correction.requested_timestamp).toLocaleTimeString()}</strong></div>
                <div style={{ marginTop: 4 }}>Reason: <em>"{reviewModal.correction.reason}"</em></div>
              </div>

              {reviewModal.action === 'approve' && (
                <div style={{ background: 'var(--teal-50)', padding: 10, borderRadius: 6, fontSize: 12, color: 'var(--teal-800)', marginBottom: 14 }}>
                  🛡️ <strong>Audit Guarantee:</strong> The original attendance record remains permanently archived. A separate adjustment entry will be generated.
                </div>
              )}

              <div className="form-group">
                <label>Reviewer Comments</label>
                <textarea
                  rows={3}
                  placeholder={`Reason for ${reviewModal.action}ing this correction...`}
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
                  {isSubmitting ? 'Updating...' : `Confirm ${reviewModal.action.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: AUDIT DETAILS & ADJUSTMENT TRACE                            */}
      {/* ================================================================== */}
      {detailsModal && (
        <div className="modal-overlay" onClick={() => setDetailsModal(null)}>
          <div className="modal-card" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Correction Audit Trail #{detailsModal.id}</h3>
              <button type="button" className="close-btn" onClick={() => setDetailsModal(null)}>✕</button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginBottom: 16 }}>
                <div><strong>Employee:</strong> {detailsModal.employee_name} ({detailsModal.employee_code})</div>
                <div><strong>Branch:</strong> {detailsModal.shop_name} ({detailsModal.shop_code})</div>
                <div><strong>Target Date:</strong> {detailsModal.attendance_date}</div>
                <div><strong>Event Type:</strong> {detailsModal.event_type}</div>
                <div><strong>Status:</strong> {detailsModal.status}</div>
                <div><strong>Requested By:</strong> {detailsModal.requested_by || 'Staff'}</div>
                <div><strong>Reviewed By:</strong> {detailsModal.reviewed_by || '—'}</div>
                <div><strong>Reviewed At:</strong> {detailsModal.reviewed_at ? new Date(detailsModal.reviewed_at).toLocaleString() : '—'}</div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                <strong>Reason provided:</strong>
                <p style={{ margin: '4px 0 0 0', color: 'var(--slate-700)' }}>{detailsModal.reason}</p>
                {detailsModal.review_comments && (
                  <p style={{ margin: '8px 0 0 0', color: 'var(--slate-600)', fontStyle: 'italic' }}>
                    Reviewer Notes: "{detailsModal.review_comments}"
                  </p>
                )}
              </div>

              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 8px 0' }}>Permanent Adjustments Log</h4>
              {detailsModal.adjustments && detailsModal.adjustments.length > 0 ? (
                <div className="table-responsive">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Old Value</th>
                        <th>New Value</th>
                        <th>Adjusted By</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsModal.adjustments.map((a, i) => (
                        <tr key={i}>
                          <td><strong>{a.field_name}</strong></td>
                          <td>{a.old_value ? new Date(a.old_value).toLocaleTimeString() : 'None (Missing)'}</td>
                          <td style={{ color: 'var(--primary-700)', fontWeight: 600 }}>{new Date(a.new_value).toLocaleTimeString()}</td>
                          <td>{a.adjusted_by}</td>
                          <td>{new Date(a.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>
                  {detailsModal.status === 'PENDING' ? 'No adjustments made yet (pending review).' : 'No adjustments recorded.'}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDetailsModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
