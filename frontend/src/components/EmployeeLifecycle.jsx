import React, { useState, useEffect } from 'react';

export default function EmployeeLifecycle({ user, shops, addToast, apiReq }) {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterShop, setFilterShop] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [editModal, setEditModal] = useState(null); // employee obj
  const [transferModal, setTransferModal] = useState(null); // employee obj
  const [historyModal, setHistoryModal] = useState(null); // { employee, history: [] }
  const [resetPassModal, setResetPassModal] = useState(null); // employee obj
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transfer Form State
  const [targetShopId, setTargetShopId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Edit Form State
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editJoiningDate, setEditJoiningDate] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  // Reset Password State
  const [newTempPassword, setNewTempPassword] = useState('1234');

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      let q = [];
      if (filterShop) q.push(`shop_id=${filterShop}`);
      if (filterStatus) q.push(`status=${filterStatus}`);
      if (search) q.push(`search=${encodeURIComponent(search)}`);
      const qs = q.length ? `?${q.join('&')}` : '';

      const data = await apiReq(`/employees/${qs}`);
      setEmployees(data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load employees list.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [filterShop, filterStatus]);

  const handleActivateToggle = async (emp) => {
    const action = emp.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} employee ${emp.full_name} (${emp.code})?`)) return;

    try {
      await apiReq(`/employees/${emp.id}/${action}/`, { method: 'POST' });
      addToast(`Employee ${emp.code} ${action}d successfully.`, 'success');
      loadEmployees();
    } catch (err) {
      addToast(err.message || `Failed to ${action} employee.`, 'error');
    }
  };

  const handleOpenEdit = (emp) => {
    setEditModal(emp);
    setEditFullName(emp.full_name || '');
    setEditEmail(emp.email === '—' ? '' : emp.email);
    setEditPhone(emp.phone || '');
    setEditDesignation(emp.designation || 'Pharmacist');
    setEditJoiningDate(emp.joining_date === '—' ? '' : emp.joining_date);
    setEditEmergency(emp.emergency_contact || '');
    setEditStatus(emp.employment_status || 'ACTIVE');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editModal) return;

    setIsSubmitting(true);
    try {
      await apiReq(`/employees/${editModal.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: editFullName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          designation: editDesignation.trim(),
          joining_date: editJoiningDate || null,
          emergency_contact: editEmergency.trim(),
          employment_status: editStatus,
        }),
      });

      addToast(`Profile for ${editModal.code} updated.`, 'success');
      setEditModal(null);
      loadEmployees();
    } catch (err) {
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTransfer = (emp) => {
    setTransferModal(emp);
    // Default target shop to first other shop
    const otherShops = shops.filter((s) => s.id !== emp.shop_id);
    setTargetShopId(otherShops.length ? otherShops[0].id : '');
    setTransferReason('');
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    if (!transferModal || !targetShopId || !transferReason.trim()) {
      addToast('Please select target branch and enter transfer reason.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiReq(`/employees/${transferModal.id}/transfer/`, {
        method: 'POST',
        body: JSON.stringify({
          to_shop_id: targetShopId,
          reason: transferReason.trim(),
        }),
      });

      addToast(res.detail || 'Employee transferred successfully.', 'success');
      setTransferModal(null);
      loadEmployees();
    } catch (err) {
      addToast(err.message || 'Transfer failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistory = async (emp) => {
    try {
      const hist = await apiReq(`/employees/${emp.id}/history/`);
      setHistoryModal({ employee: emp, history: hist || [] });
    } catch (err) {
      addToast(err.message || 'Failed to load history.', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPassModal) return;

    setIsSubmitting(true);
    try {
      const res = await apiReq(`/employees/${resetPassModal.id}/reset-password/`, {
        method: 'POST',
        body: JSON.stringify({ password: newTempPassword }),
      });
      addToast(res.detail || 'Password reset successfully.', 'success');
      setResetPassModal(null);
    } catch (err) {
      addToast(err.message || 'Password reset failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      const code = (e.code || '').toLowerCase();
      const name = (e.full_name || '').toLowerCase();
      const desig = (e.designation || '').toLowerCase();
      if (!code.includes(q) && !name.includes(q) && !desig.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="tab-pane-container">
      {/* Top Banner */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>Employee Lifecycle & Branch Management</h3>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Manage workforce profiles, designations, activation status, and authorized inter-branch transfers while preserving all historical attendance data.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadEmployees}
              disabled={isLoading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="filter-label">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13 }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Staff</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search staff by ID, name or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}
            />
          </div>

          {(filterShop || filterStatus || search) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFilterShop('');
                setFilterStatus('');
                setSearch('');
              }}
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Branch</th>
                <th>Designation</th>
                <th>Contact</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th>Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.full_name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                      ID: {e.code}
                    </div>
                  </td>
                  <td>
                    <span>{e.shop_name}</span>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{e.shop_code}</div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{e.designation || 'Pharmacist'}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>📞 {e.phone || '—'}</div>
                    <div style={{ color: 'var(--slate-500)' }}>✉️ {e.email}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {e.joining_date || '—'}
                  </td>
                  <td>
                    {e.employment_status === 'ACTIVE' && <span className="badge badge-success">● Active</span>}
                    {e.employment_status === 'INACTIVE' && <span className="badge badge-neutral">Inactive</span>}
                    {e.employment_status === 'ON_LEAVE' && <span className="badge badge-warning">🏖️ On Leave</span>}
                    {e.employment_status === 'RESIGNED' && <span className="badge badge-danger">Resigned</span>}
                    {e.employment_status === 'TERMINATED' && <span className="badge badge-danger">Terminated</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleOpenEdit(e)}
                        title="Edit Profile"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleOpenTransfer(e)}
                        title="Transfer Branch"
                      >
                        ⇄ Transfer
                      </button>

                      <button
                        type="button"
                        className={`btn ${e.is_active ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleActivateToggle(e)}
                      >
                        {e.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => setResetPassModal(e)}
                        title="Reset Staff Password"
                      >
                        🔑 Password
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleOpenHistory(e)}
                        title="Lifecycle Audit History"
                      >
                        📋 History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredEmployees.length && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 32, color: 'var(--slate-500)' }}>
                    {isLoading ? 'Loading staff records...' : 'No employee records matching criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL: EDIT EMPLOYEE PROFILE                                       */}
      {/* ================================================================== */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Staff Profile — {editModal.code}</h3>
              <button type="button" className="close-btn" onClick={() => setEditModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveProfile} className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chief Pharmacist, Dispenser"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    value={editJoiningDate}
                    onChange={(e) => setEditJoiningDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Employment Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_LEAVE">ON LEAVE</option>
                    <option value="RESIGNED">RESIGNED</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Emergency Contact (Name & Number)</label>
                <input
                  type="text"
                  placeholder="e.g. Mary (Spouse): 9876543210"
                  value={editEmergency}
                  onChange={(e) => setEditEmergency(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModal(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: BRANCH TRANSFER WORKFLOW                                    */}
      {/* ================================================================== */}
      {transferModal && (
        <div className="modal-overlay" onClick={() => setTransferModal(null)}>
          <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transfer Employee — {transferModal.code}</h3>
              <button type="button" className="close-btn" onClick={() => setTransferModal(null)}>✕</button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="form-grid" style={{ marginTop: 16 }}>
              <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                <div>Employee: <strong>{transferModal.full_name} ({transferModal.code})</strong></div>
                <div>Current Branch: <strong>{transferModal.shop_name} ({transferModal.shop_code})</strong></div>
              </div>

              <div className="form-group">
                <label>Destination Pharmacy Branch *</label>
                <select
                  required
                  value={targetShopId}
                  onChange={(e) => setTargetShopId(e.target.value)}
                >
                  <option value="">Select target branch...</option>
                  {shops.filter((s) => s.id !== transferModal.shop_id).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Reason for Transfer *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Branch rotation, promotion, staff shortage balance..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--teal-50)', padding: 10, borderRadius: 6, fontSize: 12, color: 'var(--teal-800)', marginBottom: 10 }}>
                🛡️ <strong>Integrity Guarantee:</strong> Historical attendance logs under {transferModal.shop_name} will remain permanently intact under that branch for audits. Only future check-ins will use the destination coordinates.
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTransferModal(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Transferring...' : 'Confirm Branch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: RESET PASSWORD                                              */}
      {/* ================================================================== */}
      {resetPassModal && (
        <div className="modal-overlay" onClick={() => setResetPassModal(null)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password for {resetPassModal.code}</h3>
              <button type="button" className="close-btn" onClick={() => setResetPassModal(null)}>✕</button>
            </div>

            <form onSubmit={handleResetPassword} className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>New Temporary Password (min 4 characters)</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                />
                <span className="input-hint">Staff will be prompted to change password immediately on next login.</span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetPassModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting || newTempPassword.length < 4}>
                  {isSubmitting ? 'Saving...' : 'Set Temporary Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: LIFECYCLE & TRANSFER AUDIT HISTORY                          */}
      {/* ================================================================== */}
      {historyModal && (
        <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="modal-card" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lifecycle Audit Trail — {historyModal.employee.code}</h3>
              <button type="button" className="close-btn" onClick={() => setHistoryModal(null)}>✕</button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                <strong>{historyModal.employee.full_name}</strong> | Current Branch: <strong>{historyModal.employee.shop_name}</strong>
              </div>

              {historyModal.history && historyModal.history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {historyModal.history.map((h, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: h.type === 'TRANSFER' ? 'var(--teal-50)' : 'var(--slate-50)',
                        border: '1px solid var(--slate-200)',
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ color: h.type === 'TRANSFER' ? 'var(--primary-800)' : 'var(--slate-800)' }}>
                          {h.action}
                        </strong>
                        <span style={{ color: 'var(--slate-500)', fontSize: 11 }}>
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 4px 0', color: 'var(--slate-700)' }}>{h.details}</p>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        Authorized by: <strong>{h.performed_by}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--slate-400)', textAlign: 'center', padding: 24 }}>
                  No historical lifecycle changes recorded.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setHistoryModal(null)}>
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
