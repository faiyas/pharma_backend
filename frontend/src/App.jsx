import React, { useEffect, useRef, useState } from 'react';
import pharmaLogo from './assets/logo.jpg';
import LeaveManagement from './components/LeaveManagement';
import AttendanceCorrection from './components/AttendanceCorrection';
import EmployeeLifecycle from './components/EmployeeLifecycle';
import LiveMonitoring from './components/LiveMonitoring';
import GPSGeofenceMap from './components/GPSGeofenceMap';
import AttendanceAnalytics from './components/AttendanceAnalytics';
import ReportExports from './components/ReportExports';

const RAW_API_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE = RAW_API_BASE ? `${RAW_API_BASE.replace(/\/$/, '')}/api` : '/api';

// Haversine distance calculator in metres
function calcDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Format date and time
function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoStr;
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

// Authenticated API request helper
async function apiReq(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = localStorage.getItem('access');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let err = data.detail || data.message || data.error;
    if (!err && typeof data === 'object' && Object.keys(data).length > 0) {
      err = Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
    }
    if (!err) {
      err = `Server error (${res.status}: ${res.statusText || 'Request failed'})`;
    }
    throw new Error(err);
  }
  return data;
}

// Browser Geolocation Promisified
function getBrowserGPS() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return reject(
        new Error(
          'Insecure Connection: Mobile browsers block GPS on HTTP. Please open via https://' + window.location.host
        )
      );
    }
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gps_accuracy_m: pos.coords.accuracy,
          location_accuracy_m: pos.coords.accuracy,
        });
      },
      (err) => {
        let msg = 'Failed to acquire GPS location.';
        if (err.code === 1) {
          msg = 'Location permission denied. Please tap the lock icon in your browser address bar and set Location to Allow.';
        } else if (err.code === 2) {
          msg = 'Location position unavailable. Ensure device Location/GPS is turned ON in your phone settings.';
        } else if (err.code === 3) {
          msg = 'Location request timed out. Please retry outdoors or wait for GPS lock.';
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

// Live Camera Component with Retake & Face Guide
function CameraView({ onCapture, onClear, capturedPhoto }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [isRequesting, setIsRequesting] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    }
  };

  const startCamera = async (forceFacing = null) => {
    setIsRequesting(true);
    setCameraError(null);
    setIsReady(false);
    stopStream();

    const activeMode = forceFacing || facingMode;

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraError(
        'Insecure Connection (HTTP): Mobile browsers require HTTPS to access Camera & Location. Please open via https://' +
          window.location.host
      );
      setIsRequesting(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera API is not supported in this browser. Please access via https:// and ensure camera permissions are allowed in site settings.'
      );
      setIsRequesting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: activeMode },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('Video play warning:', e);
        }
      }
      setIsReady(true);
      setCameraError(null);
    } catch (err) {
      console.warn('Camera access failed:', err);
      let msg = err.message || 'Camera permission denied.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Tap the lock/tune icon in your browser address bar and set Camera to Allow.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another app. Please close other camera apps and retry.';
      }
      setCameraError(msg);
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    if (capturedPhoto) {
      stopStream();
      return;
    }

    startCamera();

    return () => {
      stopStream();
    };
  }, [capturedPhoto, facingMode]);

  function takeSnapshot() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 640 / Math.max(v.videoWidth || 640, v.videoHeight || 640));
    canvas.width = (v.videoWidth || 640) * scale;
    canvas.height = (v.videoHeight || 640) * scale;
    const ctx = canvas.getContext('2d');
    // Mirror for natural selfie if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    onCapture(dataUrl);
  }

  function toggleCamera() {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
  }

  if (capturedPhoto) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="preview-box">
          <img src={capturedPhoto} alt="Captured Selfie Preview" />
          <span className="preview-badge">✓ Selfie Captured</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            ↺ Retake Photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="camera-box">
        {cameraError ? (
          <div className="camera-error-wrap">
            <div className="camera-error-icon">📷⚠️</div>
            <div className="camera-error-title">Camera Permission Required</div>
            <p className="camera-error-msg">{cameraError}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => startCamera()}
                disabled={isRequesting}
              >
                {isRequesting ? 'Requesting...' : '📱 Tap to Allow Camera'}
              </button>
              {window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
                <a
                  href={`https://${window.location.host}`}
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  🔒 Switch to HTTPS
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted />
            <div className="camera-guide-overlay" />
            <div className="camera-guide-text">Position face inside oval</div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1, minWidth: 160 }}
          disabled={!isReady || Boolean(cameraError)}
          onClick={takeSnapshot}
        >
          📷 Capture Live Selfie
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={toggleCamera}
          title="Switch front/back camera"
        >
          🔄 Switch {facingMode === 'user' ? 'Back' : 'Front'}
        </button>
      </div>
      <span className="input-hint">Live camera capture is strictly required. File upload is disabled for anti-spoofing.</span>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, required = true, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-input-wrap">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        className="password-toggle-btn"
        title={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        onClick={() => setShow((prev) => !prev)}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Collapsible & Mobile Sidebar States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core Data
  const [shops, setShops] = useState([]);
  const [managers, setManagers] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [todayStatus, setTodayStatus] = useState(null);

  // Form states
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopRadius, setShopRadius] = useState(50);
  const [shopLatitude, setShopLatitude] = useState('');
  const [shopLongitude, setShopLongitude] = useState('');
  const [isLocatingShop, setIsLocatingShop] = useState(false);
  const [shopLocPreview, setShopLocPreview] = useState(null);

  // Employee creation
  const [selectedShopForEmp, setSelectedShopForEmp] = useState(null);
  const [empCount, setEmpCount] = useState(5);
  const [addStaffModalShop, setAddStaffModalShop] = useState(null);
  const [addStaffCount, setAddStaffCount] = useState(1);
  const [isGeneratingStaff, setIsGeneratingStaff] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [shopEmployeesRoster, setShopEmployeesRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Manager creation
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerPass, setNewManagerPass] = useState('');
  const [managerCreateLoading, setManagerCreateLoading] = useState(false);

  // Manager assign
  const [assignShopId, setAssignShopId] = useState('');
  const [assignManagerId, setAssignManagerId] = useState('');

  // Attendance Punch (Employee)
  const [punchType, setPunchType] = useState('CHECK_IN');
  const [selfiePhoto, setSelfiePhoto] = useState('');
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(null);
  const [isCheckingGPS, setIsCheckingGPS] = useState(false);
  const [lastGPSCoords, setLastGPSCoords] = useState(null);

  // Change Password & Profile Activation
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [empFullName, setEmpFullName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDob, setEmpDob] = useState('');

  // Modal Preview Image
  const [zoomedImage, setZoomedImage] = useState(null);

  // Advanced Filters & Reports
  const [filterShop, setFilterShop] = useState('');
  const [filterDateMode, setFilterDateMode] = useState('all'); // 'all', 'single', 'range', 'month'
  const [filterDate, setFilterDate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterDayOfWeek, setFilterDayOfWeek] = useState('');
  const [evidenceFilterStatus, setEvidenceFilterStatus] = useState('all');
  const [filterAttStatus, setFilterAttStatus] = useState('all');
  const [attReviewModal, setAttReviewModal] = useState(null); // { attendance, action: 'approve' | 'reject' }
  const [attReviewComments, setAttReviewComments] = useState('');
  const [isSubmittingAttReview, setIsSubmittingAttReview] = useState(false);

  // Modals: Manager Password Reset
  const [resetManagerModal, setResetManagerModal] = useState(null);
  const [resetManagerPass, setResetManagerPass] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [isMonthExported, setIsMonthExported] = useState(false);
  const [isExportingDossier, setIsExportingDossier] = useState(false);
  const [isDeletingMonthData, setIsDeletingMonthData] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  function addToast(message, type = 'info') {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  // Keep-alive heartbeat: ping backend every 30 seconds to prevent Render free tier spin-down
  useEffect(() => {
    const keepAlive = () => {
      fetch(`${API_BASE}/health/`, { method: 'GET', keepalive: true }).catch(() => {});
    };
    keepAlive();
    const interval = setInterval(keepAlive, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initial load
  useEffect(() => {
    const token = localStorage.getItem('access');
    if (token) {
      apiReq('/auth/me/')
        .then((u) => {
          setUser(u);
          loadAllData(u);
        })
        .catch(() => {
          localStorage.clear();
          setUser(null);
        });
    }
  }, []);

  async function loadAllData(currentUser = user) {
    if (!currentUser) return;
    try {
      // Load shops (safe for all roles now)
      const s = await apiReq('/shops/').catch(() => []);
      setShops(s);

      // Load attendance
      const att = await apiReq('/attendance/').catch(() => []);
      setAttendanceRows(att);

      // Load evidence (strictly scoped to target month)
      const targetMo = filterMonth || new Date().toISOString().slice(0, 7);
      const ev = await apiReq(`/attendance/evidence/?month=${targetMo}`).catch(() => []);
      setEvidenceList(ev);

      // If employee, load today punch status
      if (currentUser.role === 'EMPLOYEE') {
        setActiveTab((prev) => (prev === 'dashboard' ? 'punch' : prev));
        const today = await apiReq('/attendance/today/').catch(() => null);
        setTodayStatus(today);
        if (today?.checked_in && !today?.checked_out) {
          setPunchType('CHECK_OUT');
        } else {
          setPunchType('CHECK_IN');
        }
      }

      // If super admin, load managers and audit log
      if (currentUser.role === 'SUPER_ADMIN') {
        const m = await apiReq('/managers/').catch(() => []);
        setManagers(m);
        const logs = await apiReq('/auditlog/').catch(() => []);
        setAuditLogs(logs);
      }

      if (currentUser.role !== 'EMPLOYEE') {
        checkMonthExportStatus(targetMo, filterShop);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  }

  async function checkMonthExportStatus(month, shop) {
    if (!month) return;
    try {
      const res = await apiReq(`/attendance/monthly-export-record/?month=${month}${shop ? `&shop_id=${shop}` : ''}`);
      setIsMonthExported(Boolean(res?.has_exported));
    } catch {
      setIsMonthExported(false);
    }
  }

  useEffect(() => {
    if (user && user.role !== 'EMPLOYEE' && filterMonth) {
      checkMonthExportStatus(filterMonth, filterShop);
    }
  }, [filterMonth, filterShop, user]);

  // Handle Login
  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const data = await apiReq('/auth/token/', {
        method: 'POST',
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      localStorage.setItem('access', data.access);
      if (data.refresh) localStorage.setItem('refresh', data.refresh);

      const me = await apiReq('/auth/me/');
      setUser(me);
      if (me.role === 'EMPLOYEE') {
        setActiveTab('punch');
      } else {
        setActiveTab('dashboard');
      }
      addToast(`Welcome back, ${me.full_name || me.first_name || me.username}!`, 'success');
      await loadAllData(me);
    } catch (err) {
      addToast(err.message || 'Login failed. Check credentials.', 'error');
    } finally {
      setLoginLoading(false);
    }
  }

  // Handle Logout
  function handleLogout() {
    localStorage.clear();
    setUser(null);
    setShops([]);
    setAttendanceRows([]);
    setEvidenceList([]);
    setTodayStatus(null);
    setActiveTab('dashboard');
    addToast('You have been logged out.', 'info');
  }

  // Employee: Quick GPS Distance Check
  async function checkLiveDistance() {
    if (!user?.employee?.shop_latitude) {
      addToast('No assigned shop coordinates found on profile.', 'warning');
      return;
    }
    setIsCheckingGPS(true);
    try {
      const coords = await getBrowserGPS();
      setLastGPSCoords(coords);
      const d = calcDistance(
        coords.latitude,
        coords.longitude,
        user.employee.shop_latitude,
        user.employee.shop_longitude
      );
      setCurrentDistance(d);
      if (d <= user.employee.allowed_radius_m) {
        addToast(`GPS check passed! You are ${d.toFixed(1)}m from shop (allowed: ${user.employee.allowed_radius_m}m)`, 'success');
      } else {
        addToast(`Outside geofence! You are ${d.toFixed(1)}m away (allowed: ${user.employee.allowed_radius_m}m)`, 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsCheckingGPS(false);
    }
  }

  // Employee: Submit Attendance
  async function handleSubmitAttendance() {
    if (!selfiePhoto) {
      addToast('Please capture a live camera selfie before submitting.', 'warning');
      return;
    }
    setIsSubmittingPunch(true);
    try {
      const gps = await getBrowserGPS();
      const payload = {
        event_type: punchType,
        latitude: gps.latitude,
        longitude: gps.longitude,
        gps_accuracy_m: gps.gps_accuracy_m,
        selfie_data_url: selfiePhoto,
      };

      const res = await apiReq('/attendance/submit/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      addToast(res.detail, 'success');
      setSelfiePhoto('');
      setCurrentDistance(null);
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSubmittingPunch(false);
    }
  }

  // Admin/Manager: Locate current position for Shop Creation
  async function locateForShop() {
    setIsLocatingShop(true);
    try {
      const pos = await getBrowserGPS();
      setShopLocPreview(pos);
      setShopLatitude(pos.latitude.toFixed(6));
      setShopLongitude(pos.longitude.toFixed(6));
      addToast(`Acquired coordinates: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLocatingShop(false);
    }
  }

  // Admin/Manager: Create Shop
  async function handleCreateShop(e) {
    e.preventDefault();
    const lat = shopLatitude !== '' ? parseFloat(shopLatitude) : shopLocPreview?.latitude;
    const lng = shopLongitude !== '' ? parseFloat(shopLongitude) : shopLocPreview?.longitude;
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      addToast('Please click "Auto-Fetch GPS Coordinates" or enter Latitude and Longitude.', 'warning');
      return;
    }
    try {
      const payload = {
        name: shopName,
        address: shopAddress,
        allowed_radius_m: Number(shopRadius),
        latitude: lat,
        longitude: lng,
        location_accuracy_m: shopLocPreview ? shopLocPreview.gps_accuracy_m : 0,
      };
      const created = await apiReq('/shops/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      addToast(`Shop "${created.name}" (${created.code}) created successfully!`, 'success');
      setShopName('');
      setShopAddress('');
      setShopLatitude('');
      setShopLongitude('');
      setShopLocPreview(null);
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  // Generate Employee Batch
  async function handleGenerateEmployees(shop, count) {
    const n = Number(count);
    if (!n || n < 1 || n > 100) {
      addToast('Please enter a valid count between 1 and 100.', 'warning');
      return;
    }
    setIsGeneratingStaff(true);
    try {
      const res = await apiReq(`/shops/${shop.id}/employees/`, {
        method: 'POST',
        body: JSON.stringify({ count: n }),
      });
      setAddStaffModalShop(null);
      setGeneratedCredentials({
        shop,
        created: res.created,
      });
      addToast(`Generated ${res.created.length} employee accounts for ${shop.name}!`, 'success');
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsGeneratingStaff(false);
    }
  }

  // View Shop Employee Roster
  async function viewShopRoster(shop) {
    setSelectedShopForEmp(shop);
    setRosterLoading(true);
    try {
      const emps = await apiReq(`/shops/${shop.id}/employees/`);
      setShopEmployeesRoster({ shop, employees: emps });
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setRosterLoading(false);
    }
  }

  // Super Admin: Create Manager
  async function handleCreateManager(e) {
    e.preventDefault();
    setManagerCreateLoading(true);
    try {
      const res = await apiReq('/managers/', {
        method: 'POST',
        body: JSON.stringify({ username: newManagerName, password: newManagerPass }),
      });
      addToast(`Manager "${res.username}" created successfully!`, 'success');
      setNewManagerName('');
      setNewManagerPass('');
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setManagerCreateLoading(false);
    }
  }

  // Super Admin: Assign Manager to Shop
  async function handleAssignManager(action = 'assign') {
    if (!assignShopId || !assignManagerId) {
      addToast('Please select both a shop and a manager.', 'warning');
      return;
    }
    try {
      const res = await apiReq(`/shops/${assignShopId}/managers/`, {
        method: 'POST',
        body: JSON.stringify({ manager_id: Number(assignManagerId), action }),
      });
      addToast(res.detail, 'success');
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  // Change Password & Profile Setup
  async function handleChangePassword(e) {
    e.preventDefault();
    const isFirstTimeEmployee = user?.role === 'EMPLOYEE' && user?.must_change_password;

    if (isFirstTimeEmployee) {
      if (!empFullName.trim()) {
        addToast('Please enter your Full Name.', 'warning');
        return;
      }
      if (!empEmail.trim() || !empEmail.includes('@')) {
        addToast('Please enter a valid Email address.', 'warning');
        return;
      }
      if (!empDob) {
        addToast('Please select your Date of Birth (DOB).', 'warning');
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      addToast('New password and confirmation do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters long.', 'error');
      return;
    }
    setIsChangingPass(true);
    try {
      const payload = {
        old_password: oldPassword,
        new_password: newPassword,
        ...(isFirstTimeEmployee
          ? {
              full_name: empFullName.trim(),
              email: empEmail.trim(),
              date_of_birth: empDob,
            }
          : {}),
      };
      const res = await apiReq('/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      addToast(res.detail, 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEmpFullName('');
      setEmpEmail('');
      setEmpDob('');
      const updatedUser = await apiReq('/auth/me/');
      setUser(updatedUser);
      if (updatedUser.role === 'EMPLOYEE') {
        setActiveTab('punch');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsChangingPass(false);
    }
  }

  // Delete Employee (Manager or Super Admin)
  async function handleDeleteEmployee(shopId, emp) {
    const confirmMsg = `Are you sure you want to delete staff "${emp.full_name || emp.code}" (${emp.code})?\n\nThis will remove their profile and login access. This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiReq(`/shops/${shopId}/employees/${emp.id}/`, { method: 'DELETE' });
      addToast(`Employee ${emp.code} deleted successfully.`, 'success');
      // Refresh roster modal
      const emps = await apiReq(`/shops/${shopId}/employees/`);
      setShopEmployeesRoster((prev) => ({ ...prev, employees: emps }));
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  // Super Admin: Reset Manager Password
  async function handleResetManagerPassword(e) {
    e.preventDefault();
    if (!resetManagerModal) return;
    if (resetManagerPass.length < 8) {
      addToast('Password must be at least 8 characters long.', 'warning');
      return;
    }
    setIsResettingPass(true);
    try {
      const res = await apiReq(`/managers/${resetManagerModal.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetManagerPass }),
      });
      addToast(res.detail, 'success');
      setResetManagerModal(null);
      setResetManagerPass('');
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsResettingPass(false);
    }
  }

  // Super Admin: Delete Manager
  async function handleDeleteManager(m) {
    const confirmMsg = `Are you sure you want to delete manager "${m.username}"?\n\nThey will lose access to all managed pharmacy branches.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await apiReq(`/managers/${m.id}/`, { method: 'DELETE' });
      addToast(res.detail, 'success');
      await loadAllData(user);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  // Manager or Super Admin: Accept / Approve or Reject Attendance
  async function handleAttendanceReviewAction() {
    if (!attReviewModal) return;
    setIsSubmittingAttReview(true);
    try {
      const endpoint = `/attendance/${attReviewModal.attendance.id}/${attReviewModal.action}/`;
      const res = await apiReq(endpoint, {
        method: 'POST',
        body: JSON.stringify({ comments: attReviewComments.trim() }),
      });
      addToast(res.detail || `Attendance record ${attReviewModal.action === 'approve' ? 'accepted' : 'rejected'}.`, 'success');
      setAttReviewModal(null);
      setAttReviewComments('');
      await loadAllData(user);
    } catch (err) {
      addToast(err.message || 'Failed to review attendance.', 'error');
    } finally {
      setIsSubmittingAttReview(false);
    }
  }

  // Helper: Month-End Verification & Availability Check
  function getMonthEndStatus(monthStr) {
    const target = monthStr || new Date().toISOString().slice(0, 7);
    const parts = target.split('-');
    if (parts.length !== 2) return { isAvailable: false, reason: 'Invalid month' };
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10);
    if (isNaN(yr) || isNaN(mo)) return { isAvailable: false, reason: 'Invalid month' };

    const lastDayDate = new Date(yr, mo, 0);
    const lastDayNum = lastDayDate.getDate();
    const lastDayFormatted = lastDayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const now = new Date();
    const currentYr = now.getFullYear();
    const currentMo = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Past month: Already concluded, available for audit & purge anytime
    if (yr < currentYr || (yr === currentYr && mo < currentMo)) {
      return { isAvailable: true, isPast: true, lastDay: lastDayNum, lastDayFormatted };
    }

    // Current month: Strictly available on the final day of the month (e.g. 31st or 30th)
    if (yr === currentYr && mo === currentMo) {
      if (currentDay >= lastDayNum) {
        return { isAvailable: true, isCurrentMonthEnd: true, lastDay: lastDayNum, lastDayFormatted };
      } else {
        const daysLeft = lastDayNum - currentDay;
        return {
          isAvailable: false,
          reason: `Auto-purge unlocks on month end (${lastDayFormatted}). Attendance evidence is preserved during active shifts.`,
          daysLeft,
          lastDayFormatted,
        };
      }
    }

    return { isAvailable: false, reason: 'Future month has not completed yet.' };
  }

  // Generate Standalone Offline HTML Audit Dossier with Embedded Photos
  function generateAuditDossierHTML(records, targetMonth) {
    const totalCount = records.length;
    const acceptedCount = records.filter((r) => r.accepted).length;
    const rejectedCount = records.filter((r) => !r.accepted).length;
    const rate = totalCount ? ((acceptedCount / totalCount) * 100).toFixed(1) : '100.0';
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' });
    const monthName = new Date(`${targetMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const auditorName = user.full_name || user.first_name || user.username;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PharmaTrack Audit Dossier - ${targetMonth}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px 20px; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; gap: 20px; flex-wrap: wrap; }
    .brand-title { font-size: 24px; font-weight: 800; color: #059669; letter-spacing: -0.02em; }
    .doc-subtitle { font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .meta-box { background: #f1f5f9; padding: 12px 18px; border-radius: 10px; font-size: 13px; text-align: right; }
    .meta-box div { margin-bottom: 4px; }
    .meta-box strong { color: #0f172a; }
    .print-btn { background: #059669; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; }
    .print-btn:hover { background: #047857; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .stat-card .lbl { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-card .val { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .stat-card .val.green { color: #059669; }
    .stat-card .val.red { color: #dc2626; }
    .records-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
    .record-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .record-img-box { position: relative; height: 260px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .record-img-box img { width: 100%; height: 100%; object-fit: cover; }
    .badge { position: absolute; top: 12px; right: 12px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .record-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
    .record-title { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; font-size: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .record-row { display: flex; justify-content: space-between; }
    .record-lbl { color: #64748b; }
    .record-val { font-weight: 600; color: #0f172a; text-align: right; }
    .footer { margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 24px; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
    .sign-block { width: 240px; border-top: 1px solid #94a3b8; padding-top: 6px; margin-top: 30px; text-align: center; font-weight: 600; font-size: 12px; color: #475569; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .print-btn { display: none; }
      .record-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand-title">PharmaTrack Geofence Verification</div>
        <div class="doc-subtitle">Official Month-End Audit & Biometric Evidence Dossier</div>
        <div style="font-size: 14px; margin-top: 8px; font-weight: 600; color: #334155;">
          Audit Period: <span style="color: #059669;">${monthName} (${targetMonth})</span>
        </div>
      </div>
      <div class="meta-box">
        <div>Generated: <strong>${generatedAt}</strong></div>
        <div>Auditor: <strong>${auditorName} (${user.role.replace('_', ' ')})</strong></div>
        <div style="margin-top: 8px;">
          <button onclick="window.print()" class="print-btn">🖨️ Print / Save as PDF</button>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="lbl">Total Audit Records</div>
        <div class="val">${totalCount}</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Verified & Accepted</div>
        <div class="val green">${acceptedCount}</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Violations / Rejected</div>
        <div class="val red">${rejectedCount}</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Geofence Compliance</div>
        <div class="val green">${rate}%</div>
      </div>
    </div>

    <div class="records-grid">
      ${records.map((r) => `
        <div class="record-card">
          <div class="record-img-box">
            ${r.selfie ? `<img src="${r.selfie}" alt="Biometric Selfie" />` : `<div style="color: #94a3b8; font-size: 12px;">Photo previously purged</div>`}
            <span class="badge ${r.accepted ? 'badge-success' : 'badge-danger'}">
              ${r.accepted ? '✓ Accepted' : '✕ Rejected'}
            </span>
          </div>
          <div class="record-body">
            <div class="record-title">
              <span>${r.employee_name || r.employee}</span>
              <span style="font-size: 12px; color: #64748b;">${r.kind.replace('_', ' ')}</span>
            </div>
            <div class="record-row">
              <span class="record-lbl">Staff ID</span>
              <span class="record-val" style="font-family: monospace;">${r.employee}</span>
            </div>
            <div class="record-row">
              <span class="record-lbl">Pharmacy Branch</span>
              <span class="record-val">${r.shop} (${r.shop_code})</span>
            </div>
            <div class="record-row">
              <span class="record-lbl">Timestamp</span>
              <span class="record-val">${new Date(r.time).toLocaleString()}</span>
            </div>
            <div class="record-row">
              <span class="record-lbl">Distance from Branch</span>
              <span class="record-val">${Number(r.distance_m).toFixed(1)} meters</span>
            </div>
            <div class="record-row">
              <span class="record-lbl">GPS Accuracy</span>
              <span class="record-val">±${Number(r.accuracy_m).toFixed(1)}m</span>
            </div>
            ${r.reason ? `
            <div class="record-row" style="color: ${r.accepted ? '#065f46' : '#991b1b'}; margin-top: 4px;">
              <span class="record-lbl">Audit Note</span>
              <span class="record-val">${r.reason}</span>
            </div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <div>
        <p>This report contains authenticated biometric selfies, timestamps, and geospatial coordinates.</p>
        <p>© ${new Date().getFullYear()} 1103techstudios. All rights reserved.</p>
      </div>
      <div>
        <div class="sign-block">
          Authorized Auditor Signature / Date
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Manager or Super Admin: Export Offline HTML Audit Dossier (Available Anytime)
  async function handleExportAuditPackage(targetMonth) {
    const month = targetMonth || filterMonth || new Date().toISOString().slice(0, 7);
    setIsExportingDossier(true);
    try {
      // 1. Fetch complete records with photos for target month
      const evidenceData = await apiReq(
        `/attendance/evidence/?month=${month}${filterShop ? `&shop_id=${filterShop}` : ''}`
      );

      if (!evidenceData || !evidenceData.length) {
        addToast(`No evidence records found for ${month} to export.`, 'info');
        setIsExportingDossier(false);
        return;
      }

      // 2. Generate and download HTML dossier with embedded images
      const htmlContent = generateAuditDossierHTML(evidenceData, month);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PharmaTrack_Audit_Dossier_${month}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 3. Record that this month was successfully exported
      await apiReq('/attendance/monthly-export-record/', {
        method: 'POST',
        body: JSON.stringify({
          month,
          ...(filterShop ? { shop_id: filterShop } : {}),
          export_type: 'AUDIT_DOSSIER',
        }),
      }).catch(() => {});

      setIsMonthExported(true);
      addToast(
        `Audit Dossier for ${month} downloaded successfully! You can export anytime as needed.`,
        'success'
      );
    } catch (err) {
      addToast(err.message || 'Export failed.', 'error');
    } finally {
      setIsExportingDossier(false);
    }
  }

  // Manager or Super Admin: Delete All Attendance Records & Photos for Selected Month
  async function handleDeleteMonthData(targetMonth) {
    const month = targetMonth || filterMonth || new Date().toISOString().slice(0, 7);

    // Guard: Must be exported at least once before deletion
    if (!isMonthExported) {
      addToast(
        `Report Required: Data for ${month} must be exported at least once before deletion. Please click "Export Audit Dossier" first. (Recommendation: Purge data every 6 months).`,
        'warning'
      );
      return;
    }

    const confirmMsg =
      `⚠️ PERMANENT ATTENDANCE & EVIDENCE DATA DELETION (${month})\n\n` +
      `This will completely erase ALL attendance records, check-in/out timestamps, corrections, and selfie photos for ${month}.\n\n` +
      `✓ Verified: This month's report has been exported.\n\n` +
      `Are you sure you want to permanently delete all data for ${month}? This action CANNOT be undone.\n\n` +
      `(Recommendation: Take report and purge data every 6 months).`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeletingMonthData(true);
    try {
      const res = await apiReq('/attendance/monthly-purge/', {
        method: 'POST',
        body: JSON.stringify({ month, ...(filterShop ? { shop_id: filterShop } : {}) }),
      });

      addToast(
        res.detail || `All attendance records and evidence for ${month} have been permanently deleted.`,
        'success'
      );

      setIsMonthExported(false);
      await loadAllData(user);
    } catch (err) {
      addToast(err.message || 'Failed to delete month data.', 'error');
    } finally {
      setIsDeletingMonthData(false);
    }
  }

  // Quick Preset Handlers for Filters
  function setPresetDateFilter(preset) {
    const now = new Date();
    if (preset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      setFilterDateMode('single');
      setFilterDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setFilterDateMode('single');
      setFilterDate(y.toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      const mStr = now.toISOString().slice(0, 7);
      setFilterDateMode('month');
      setFilterMonth(mStr);
    } else if (preset === 'all') {
      setFilterDateMode('all');
      setFilterDate('');
      setFilterStartDate('');
      setFilterEndDate('');
      setFilterMonth('');
      setFilterDayOfWeek('');
      setFilterAttStatus('all');
    }
  }

  // CSV Export for Attendance Records (with full daywise and monthly details)
  function exportAttendanceCSV() {
    const listToExport = filteredAttendance.length ? filteredAttendance : attendanceRows;
    if (!listToExport.length) {
      addToast('No attendance records available to export.', 'info');
      return;
    }
    const headers = [
      'Record ID',
      'Staff ID',
      'Staff Name',
      'Branch',
      'Branch Code',
      'Work Date',
      'Day of Week',
      'Check In Time',
      'Check Out Time',
      'Hours Worked',
      'Shift Status',
      'Approval Status',
    ];
    const rows = listToExport.map((r) => {
      const dayName = new Date(r.date).toLocaleDateString('en-US', { weekday: 'long' });
      const status = r.check_out ? 'Completed' : r.check_in ? 'Active Shift' : 'Pending';
      return [
        `"${r.id}"`,
        `"${r.employee}"`,
        `"${(r.employee_name || r.employee).replace(/"/g, '""')}"`,
        `"${(r.shop || '').replace(/"/g, '""')}"`,
        `"${r.shop_code || ''}"`,
        `"${r.date}"`,
        `"${r.day_of_week || dayName}"`,
        `"${r.check_in ? new Date(r.check_in).toLocaleTimeString() : 'N/A'}"`,
        `"${r.check_out ? new Date(r.check_out).toLocaleTimeString() : 'N/A'}"`,
        `"${r.hours_worked !== undefined && r.hours_worked !== null ? r.hours_worked + ' hrs' : 'N/A'}"`,
        `"${status}"`,
        `"${r.status || 'PENDING'}"`,
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateLabel = filterDateMode === 'month' && filterMonth ? filterMonth : (filterDate || new Date().toISOString().slice(0, 10));
    link.setAttribute('download', `pharmacy_attendance_report_${dateLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Monthly attendance report exported successfully!', 'success');

    const monthForExport = filterDateMode === 'month' && filterMonth ? filterMonth : (filterDate ? filterDate.slice(0, 7) : new Date().toISOString().slice(0, 7));
    apiReq('/attendance/monthly-export-record/', {
      method: 'POST',
      body: JSON.stringify({ month: monthForExport, export_type: 'CSV' }),
    }).then(() => {
      if (monthForExport === filterMonth) setIsMonthExported(true);
    }).catch(() => {});
  }

  // --------------------------------------------------------------------------
  // RENDER: Login Page
  // --------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <img src={pharmaLogo} alt="PharmaTrack Logo" className="login-brand-logo" />
            <h2>PharmaTrack</h2>
            <p>Geofenced Pharmacy Attendance System</p>
          </div>

          <form onSubmit={handleLogin} className="form-grid">
            <div className="form-group">
              <label>Username or Staff ID</label>
              <input
                type="text"
                required
                placeholder="Enter username or Staff ID"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <PasswordInput
                required
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loginLoading} style={{ marginTop: 8 }}>
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: 14, background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
            <p style={{ fontSize: 12, color: 'var(--slate-600)' }}>
              <strong>Secure Portal:</strong> Authorized personnel only. If you are logging in for the first time, you will be prompted to set up your security credentials.
            </p>
          </div>

          <div className="login-footer">
            © {new Date().getFullYear()} 1103techstudios. All rights reserved.
          </div>
        </div>

        {/* Floating Toasts */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Role-based Nav Tabs
  // --------------------------------------------------------------------------
  const tabs = [];
  if (user.role === 'EMPLOYEE') {
    tabs.push({
      id: 'punch',
      label: 'Check In / Out',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    });
    tabs.push({
      id: 'my_records',
      label: 'My Attendance',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    });
    tabs.push({
      id: 'leaves',
      label: 'Apply & View Leave',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
    });
    tabs.push({
      id: 'corrections',
      label: 'Attendance Corrections',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    });
    tabs.push({
      id: 'my_evidence',
      label: 'My Evidence',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    });
    tabs.push({
      id: 'account',
      label: 'My Profile & Security',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    });
  } else if (user.role === 'MANAGER') {
    tabs.push({
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    });
    tabs.push({
      id: 'shops',
      label: 'My Branches',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    });
    tabs.push({
      id: 'lifecycle',
      label: 'Employees',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    });
    tabs.push({
      id: 'attendance',
      label: 'Attendance',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    });
    tabs.push({
      id: 'leaves',
      label: 'Leave Requests',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    });
    tabs.push({
      id: 'corrections',
      label: 'Attendance Corrections',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    });
    tabs.push({
      id: 'monitoring',
      label: 'Live Monitoring',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    });
    tabs.push({
      id: 'geofence_map',
      label: 'GPS Map',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    });
    tabs.push({
      id: 'analytics',
      label: 'Analytics',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    });
    tabs.push({
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    });
    tabs.push({
      id: 'evidence',
      label: 'Evidence Audit',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    });
    tabs.push({
      id: 'account',
      label: 'Account & Security',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    });
  } else if (user.role === 'SUPER_ADMIN') {
    tabs.push({
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    });
    tabs.push({
      id: 'shops',
      label: 'Branch Management',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    });
    tabs.push({
      id: 'managers',
      label: 'Manager Management',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    });
    tabs.push({
      id: 'lifecycle',
      label: 'Employee Management',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      ),
    });
    tabs.push({
      id: 'attendance',
      label: 'Attendance',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    });
    tabs.push({
      id: 'leaves',
      label: 'Leave Management',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    });
    tabs.push({
      id: 'corrections',
      label: 'Attendance Corrections',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    });
    tabs.push({
      id: 'monitoring',
      label: 'Live Monitoring',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    });
    tabs.push({
      id: 'geofence_map',
      label: 'GPS Geofence Map',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    });
    tabs.push({
      id: 'analytics',
      label: 'Analytics',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    });
    tabs.push({
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    });
    tabs.push({
      id: 'evidence',
      label: 'Evidence Audit',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    });
    tabs.push({
      id: 'auditlog',
      label: 'Security Log',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    });
    tabs.push({
      id: 'account',
      label: 'Settings & Security',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    });
  }


  // Filtered lists (Datewise, Daywise, Branchwise)
  const filteredAttendance = attendanceRows.filter((row) => {
    if (filterShop && row.shop_code !== filterShop && row.shop !== filterShop) return false;

    // Day of the week filter (Monday, Tuesday, etc.)
    if (filterDayOfWeek) {
      const d = new Date(row.date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayName !== filterDayOfWeek) return false;
    }

    // Date filters (single, range, month)
    if (filterDateMode === 'single' && filterDate) {
      if (row.date !== filterDate) return false;
    } else if (filterDateMode === 'range') {
      if (filterStartDate && row.date < filterStartDate) return false;
      if (filterEndDate && row.date > filterEndDate) return false;
    } else if (filterDateMode === 'month' && filterMonth) {
      if (!row.date.startsWith(filterMonth)) return false;
    }

    // Status filter (all, pending, approved, rejected)
    if (filterAttStatus && filterAttStatus !== 'all') {
      const rowStatus = (row.status || 'PENDING').toUpperCase();
      if (rowStatus !== filterAttStatus.toUpperCase()) return false;
    }

    return true;
  });

  const filteredEvidence = evidenceList.filter((ev) => {
    if (filterShop && ev.shop_code !== filterShop && ev.shop !== filterShop) return false;
    if (evidenceFilterStatus === 'accepted' && !ev.accepted) return false;
    if (evidenceFilterStatus === 'rejected' && ev.accepted) return false;

    const evDate = (ev.time || '').slice(0, 10);
    // User requested: Evidence strictly shows selected month
    const targetMonth = filterMonth || new Date().toISOString().slice(0, 7);
    if (!evDate.startsWith(targetMonth)) return false;

    if (filterDayOfWeek && evDate) {
      const d = new Date(evDate);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayName !== filterDayOfWeek) return false;
    }

    return true;
  });

  // --------------------------------------------------------------------------
  // RENDER: Authenticated Dashboard
  // --------------------------------------------------------------------------
  const displayName = user.full_name || user.first_name || user.username;
  const currentTabObj = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close navigation sidebar"
        />
      )}

      {/* Collapsible / Expandable Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileSidebarOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div
            className="sidebar-brand"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            style={{ cursor: 'pointer' }}
            title={isSidebarCollapsed ? 'Click logo to expand sidebar' : 'Click logo to collapse sidebar'}
          >
            <img src={pharmaLogo} alt="PharmaTrack" className="brand-logo-img" />
            <div className="brand-text">
              <h2>PharmaTrack</h2>
              <span>Attendance Hub</span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="mobile-close-btn mobile-only"
            onClick={() => setIsMobileSidebarOpen(false)}
            title="Close menu"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="sidebar-nav-container">
          <div className="sidebar-section-title">NAVIGATION MENU</div>
          <nav className="sidebar-nav">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`sidebar-nav-item ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setIsMobileSidebarOpen(false);
                }}
                title={t.label}
              >
                <span className="sidebar-icon">{t.icon}</span>
                <span className="sidebar-label">{t.label}</span>
                {activeTab === t.id && <span className="sidebar-active-indicator" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer: User Meta & Actions */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{displayName.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name" title={displayName}>{displayName}</span>
              <span className={`role-pill ${user.role === 'SUPER_ADMIN' ? 'super' : user.role === 'MANAGER' ? 'manager' : 'employee'}`}>
                {user.role === 'EMPLOYEE' && user.username !== displayName ? `${user.username} · ` : ''}{user.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="sidebar-action-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm sidebar-btn"
              onClick={() => loadAllData(user)}
              title="Refresh Data"
            >
              <span style={{ fontSize: 14 }}>↻</span>
              <span className="sidebar-btn-label">Refresh</span>
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm sidebar-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <span style={{ fontSize: 13 }}>⏻</span>
              <span className="sidebar-btn-label">Logout</span>
            </button>
          </div>
          <div className="sidebar-copyright">
            © {new Date().getFullYear()} 1103techstudios
          </div>
        </div>
      </aside>

      {/* Main Column Wrapper */}
      <div className="app-main-content">
        {/* Mobile Top Header (Visible on Mobile Devices) */}
        <header className="mobile-top-bar">
          <div className="mobile-top-left">
            <div
              className="mobile-bar-brand"
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{ cursor: 'pointer' }}
              title="Tap logo to open navigation menu"
            >
              <img src={pharmaLogo} alt="PharmaTrack" className="brand-logo-img xs" />
              <span className="mobile-bar-title">{currentTabObj?.label || 'PharmaTrack'}</span>
            </div>
          </div>

          <div className="mobile-top-right">
            <div
              className="mobile-bar-avatar"
              onClick={() => setIsMobileSidebarOpen(true)}
              title={`Logged in as ${displayName}`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <button
              type="button"
              className="btn btn-danger btn-sm mobile-logout-action-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Desktop Top Header Bar */}
        <header className="desktop-top-bar">
          <div className="top-bar-left">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title="Click logo to toggle sidebar"
            >
              <img src={pharmaLogo} alt="PharmaTrack" className="brand-logo-img xs" />
              <div>
                <h2 className="top-bar-page-title">{currentTabObj?.label || 'Dashboard'}</h2>
                <span className="top-bar-subtitle">Pharmacy Attendance & Geofence Verification</span>
              </div>
            </div>
          </div>

          <div className="top-bar-right">
            <div className="user-badge">
              <div className="user-avatar">{displayName.charAt(0).toUpperCase()}</div>
              <div className="user-meta">
                <span className="user-name">{displayName}</span>
                <span
                  className={`role-pill ${
                    user.role === 'SUPER_ADMIN' ? 'super' : user.role === 'MANAGER' ? 'manager' : 'employee'
                  }`}
                >
                  {user.role === 'EMPLOYEE' && user.username !== displayName ? `${user.username} · ` : ''}{user.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadAllData(user)}>
              ↻ Refresh
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="main-viewport">
          {/* HTTPS check banner for mobile permissions */}
          {window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
            <div className="alert-banner warning mobile-https-alert">
              <div className="alert-banner-content">
                <span style={{ fontSize: 22 }}>🔒</span>
                <div>
                  <strong>Secure Context (HTTPS) Required on Mobile:</strong>
                  <p style={{ fontSize: 12, marginTop: 2, color: 'var(--slate-600)' }}>
                    Mobile browsers strictly block Camera and GPS permissions over unencrypted HTTP. Tap the button to switch to HTTPS and grant permissions.
                  </p>
                </div>
              </div>
              <a
                href={`https://${window.location.host}`}
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                Switch to HTTPS
              </a>
            </div>
          )}
        {/* Mandatory Password Change Banner */}
        {user.must_change_password && (
          <div className="alert-banner warning">
            <div className="alert-banner-content">
              <span>⚠️</span>
              <div>
                <strong>Default temporary password in use.</strong> For security, please update your account password before proceeding.
              </div>
            </div>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => setActiveTab('account')}>
              Change Password Now
            </button>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: EMPLOYEE PUNCH ATTENDANCE                                     */}
        {/* ================================================================== */}
        {activeTab === 'punch' && (
          <div>
            {/* Assigned Shop Banner */}
            {user.employee ? (
              <div className="shop-info-banner compact">
                <div className="shop-banner-top">
                  <div>
                    <div className="shop-title-row">
                      <span className="shop-icon-badge">🏥</span>
                      <h2>{user.employee.shop_name}</h2>
                    </div>
                    <p className="shop-sub-address">{user.employee.shop_address}</p>
                  </div>
                  <div className="shop-badges-group">
                    <span className="badge badge-code">Code: {user.employee.shop_code}</span>
                    <span className={`badge ${todayStatus?.checked_in ? (todayStatus?.checked_out ? 'badge-neutral' : 'badge-success') : 'badge-warning'}`}>
                      {todayStatus?.checked_out ? '✓ Checked Out' : todayStatus?.checked_in ? '🟢 Present' : '⚪ Not Checked In'}
                    </span>
                  </div>
                </div>

                <div className="shop-quick-chips">
                  <div className="quick-chip">
                    <span className="chip-label">Staff</span>
                    <span className="chip-val">{user.full_name || user.first_name || user.username}</span>
                  </div>
                  <div className="quick-chip">
                    <span className="chip-label">ID</span>
                    <span className="chip-val mono">{user.employee.code}</span>
                  </div>
                  <div className="quick-chip">
                    <span className="chip-label">Radius</span>
                    <span className="chip-val">{user.employee.allowed_radius_m}m</span>
                  </div>
                  <div className="quick-chip">
                    <span className="chip-label">Date</span>
                    <span className="chip-val">{formatDate(new Date())}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert-banner danger">
                <div className="alert-banner-content">
                  <span>⚠️</span>
                  <div>
                    <strong>No pharmacy branch profile linked to this account.</strong> Please ask your manager or administrator to create your employee profile under your pharmacy branch.
                  </div>
                </div>
              </div>
            )}

            <div className="punch-card-wrapper">
              {/* Left Column: Camera View */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">1. Capture Verification Selfie</h3>
                    <p className="card-subtitle">Take a live photo at your workplace</p>
                  </div>
                </div>

                <CameraView
                  capturedPhoto={selfiePhoto}
                  onCapture={(data) => {
                    setSelfiePhoto(data);
                    addToast('Selfie captured! Now submit attendance.', 'success');
                  }}
                  onClear={() => setSelfiePhoto('')}
                />
              </div>

              {/* Right Column: GPS Check & Punch Action */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">2. Geofence & Submission</h3>
                    <p className="card-subtitle">Verify branch coordinates and confirm punch</p>
                  </div>
                </div>

                {/* Event Type Selector */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Attendance Event</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button
                      type="button"
                      className={`btn ${punchType === 'CHECK_IN' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPunchType('CHECK_IN')}
                      disabled={todayStatus?.checked_in}
                    >
                      🟢 Check In {todayStatus?.checked_in && '(Done)'}
                    </button>
                    <button
                      type="button"
                      className={`btn ${punchType === 'CHECK_OUT' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPunchType('CHECK_OUT')}
                      disabled={!todayStatus?.checked_in || todayStatus?.checked_out}
                    >
                      🔴 Check Out {todayStatus?.checked_out && '(Done)'}
                    </button>
                  </div>
                </div>

                {/* Today's Punch Timeline */}
                <div style={{ background: 'var(--slate-50)', padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 16, border: '1px solid var(--slate-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: 'var(--slate-600)' }}>Check-in timestamp:</span>
                    <strong>{formatTime(todayStatus?.check_in_time)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--slate-600)' }}>Check-out timestamp:</span>
                    <strong>{formatTime(todayStatus?.check_out_time)}</strong>
                  </div>
                </div>

                {/* Pre-check Distance Meter */}
                <div className="gps-gauge-card">
                  <div className="gps-gauge-header">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Branch Distance Check</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={checkLiveDistance}
                      disabled={isCheckingGPS || !user.employee}
                    >
                      {isCheckingGPS ? 'Acquiring GPS...' : '📍 Test GPS Distance'}
                    </button>
                  </div>

                  {currentDistance !== null ? (
                    <div>
                      <div
                        className={`distance-highlight ${
                          currentDistance <= (user.employee?.allowed_radius_m || 50) ? 'inside' : 'outside'
                        }`}
                      >
                        {currentDistance.toFixed(1)} metres away
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {currentDistance <= (user.employee?.allowed_radius_m || 50)
                            ? '✓ Within allowed shop boundary'
                            : '⚠️ Outside shop radius. Move closer.'}
                        </span>
                        {lastGPSCoords && <span>Accuracy: ±{lastGPSCoords.gps_accuracy_m.toFixed(1)}m</span>}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                      Click "Test GPS Distance" to verify that your current location is within the shop's {user.employee?.allowed_radius_m || 50}m radius.
                    </p>
                  )}
                </div>

                {/* Final Submit Button */}
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: 12 }}
                  disabled={!selfiePhoto || isSubmittingPunch || !user.employee}
                  onClick={handleSubmitAttendance}
                >
                  {isSubmittingPunch ? 'Verifying GPS & Submitting...' : `Submit ${punchType.replace('_', ' ')}`}
                </button>

                {!selfiePhoto && (
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', textAlign: 'center', marginTop: 8 }}>
                    Capture a selfie on the left to unlock submission
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: DASHBOARD (ADMIN & MANAGER)                                   */}
        {/* ================================================================== */}
        {activeTab === 'dashboard' && user.role !== 'EMPLOYEE' && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon emerald">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label">Pharmacy Shops</span>
                  <span className="stat-value">{shops.length}</span>
                  <span className="stat-hint">Active branches registered</span>
                </div>
              </div>

              {user.role === 'SUPER_ADMIN' && (
                <div className="stat-card">
                  <div className="stat-icon indigo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" />
                      <path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Branch Managers</span>
                    <span className="stat-value">{managers.length}</span>
                    <span className="stat-hint">Assigned supervisors</span>
                  </div>
                </div>
              )}

              <div className="stat-card">
                <div className="stat-icon blue">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <polyline points="17 11 19 13 23 9" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label">Attendance Rows</span>
                  <span className="stat-value">{attendanceRows.length}</span>
                  <span className="stat-hint">Total punches logged</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon rose">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label">Evidence Photos</span>
                  <span className="stat-value">{evidenceList.length}</span>
                  <span className="stat-hint">Geofence selfies captured</span>
                </div>
              </div>
            </div>

            {/* Quick Overview Table */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Recent Attendance Activity</h3>
                  <p className="card-subtitle">Latest check-in and check-out logs</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('attendance')}>
                  View All Records →
                </button>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Branch</th>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.slice(0, 6).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.employee_name || row.employee}</strong>
                          {row.employee_name && row.employee_name !== row.employee && (
                            <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                              ID: {row.employee}
                            </div>
                          )}
                        </td>
                        <td>{row.shop}</td>
                        <td>{formatDate(row.date)}</td>
                        <td>{formatTime(row.check_in)}</td>
                        <td>{formatTime(row.check_out)}</td>
                        <td>
                          {row.check_out ? (
                            <span className="badge badge-success">Completed</span>
                          ) : row.check_in ? (
                            <span className="badge badge-primary">Active</span>
                          ) : (
                            <span className="badge badge-neutral">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!attendanceRows.length && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                          No attendance activity logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: SHOPS & ROSTERS (ADMIN & MANAGER)                             */}
        {/* ================================================================== */}
        {activeTab === 'shops' && (
          <div>
            {/* Create Shop Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Register New Pharmacy Branch</h3>
                  <p className="card-subtitle">Set shop location with auto-detected GPS coordinates</p>
                </div>
              </div>

              <form onSubmit={handleCreateShop} className="form-grid">
                <div className="form-row">
                  <div className="form-group">
                    <label>Pharmacy Branch Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CarePlus Pharmacy - Downtown"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Allowed Geofence Radius: {shopRadius} Metres</label>
                    <input
                      type="number"
                      min="20"
                      max="500"
                      value={shopRadius}
                      onChange={(e) => setShopRadius(e.target.value)}
                    />
                    <span className="input-hint">Recommended: 50m for retail shops (20–500m supported).</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Physical Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 104 Health Ave, Suite 2"
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                  />
                </div>

                {/* GPS Coordinates & Auto-Fetch */}
                <div style={{ background: 'var(--slate-50)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>Branch GPS Location</strong>
                      <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                        Click Auto-Fetch to capture current browser location, or enter/edit coordinates manually.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={locateForShop}
                      disabled={isLocatingShop}
                    >
                      {isLocatingShop ? 'Acquiring GPS...' : '📍 Auto-Fetch GPS Coordinates'}
                    </button>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Latitude</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 11.959498"
                        value={shopLatitude}
                        onChange={(e) => setShopLatitude(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 79.839478"
                        value={shopLongitude}
                        onChange={(e) => setShopLongitude(e.target.value)}
                      />
                    </div>
                  </div>

                  {shopLocPreview && (
                    <div style={{ marginTop: 12, padding: 10, background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', fontSize: 13, color: '#065f46' }}>
                      ✓ GPS Detected: Latitude <strong>{shopLocPreview.latitude.toFixed(6)}</strong>, Longitude{' '}
                      <strong>{shopLocPreview.longitude.toFixed(6)}</strong> (Accuracy: ±{shopLocPreview.gps_accuracy_m.toFixed(1)}m)
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start', marginTop: 8 }}>
                  Create Pharmacy Branch
                </button>
              </form>
            </div>

            {/* Registered Shops List */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Registered Pharmacy Branches</h3>
                  <p className="card-subtitle">Manage geofence radius and employee accounts</p>
                </div>
              </div>

            <div className="table-responsive desktop-only">
              <table>
                <thead>
                  <tr>
                    <th>Branch Code</th>
                    <th>Name & Address</th>
                    <th>Coordinates</th>
                    <th>Geofence</th>
                    <th>Staff Count</th>
                    <th>Assigned Managers</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="badge badge-primary">{s.code}</span>
                      </td>
                      <td>
                        <strong>{s.name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{s.address}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {s.latitude?.toFixed(5)}, {s.longitude?.toFixed(5)}
                      </td>
                      <td>
                        <strong>{s.allowed_radius_m}m</strong>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{s.employee_count || 0} employees</span>
                      </td>
                      <td>
                        {s.managers?.length ? (
                          s.managers.map((m) => (
                            <span key={m} className="badge badge-success" style={{ marginRight: 4 }}>
                              {m}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setAddStaffModalShop(s);
                              setAddStaffCount(1);
                            }}
                          >
                            + Add Staff
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => viewShopRoster(s)}
                          >
                            View Staff
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!shops.length && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                        No pharmacy branches created yet. Use the form above to add your first branch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View for Registered Shops */}
            <div className="mobile-only mobile-cards-list">
              {shops.map((s) => (
                <div key={s.id} className="mobile-data-card">
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title">{s.name}</div>
                      <div className="mobile-card-sub">{s.address}</div>
                    </div>
                    <span className="badge badge-primary">{s.code}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Geofence Radius</span>
                    <span className="mobile-card-val"><strong>{s.allowed_radius_m}m</strong></span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Staff Count</span>
                    <span className="mobile-card-val"><span className="badge badge-neutral">{s.employee_count || 0} employees</span></span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Managers</span>
                    <span className="mobile-card-val">
                      {s.managers?.length ? s.managers.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="mobile-card-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setAddStaffModalShop(s);
                        setAddStaffCount(1);
                      }}
                    >
                      + Add Staff
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => viewShopRoster(s)}
                    >
                      View Staff
                    </button>
                  </div>
                </div>
              ))}
              {!shops.length && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                  No pharmacy branches created yet.
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: MANAGERS (SUPER ADMIN ONLY)                                   */}
        {/* ================================================================== */}
        {activeTab === 'managers' && user.role === 'SUPER_ADMIN' && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Create Branch Manager</h3>
                  <p className="card-subtitle">Authorize supervisors to manage shops and staff</p>
                </div>
              </div>

              <form onSubmit={handleCreateManager} className="form-grid">
                <div className="form-row">
                  <div className="form-group">
                    <label>Manager Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. manager_sarah"
                      value={newManagerName}
                      onChange={(e) => setNewManagerName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Temporary Password (8+ chars)</label>
                    <PasswordInput
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={newManagerPass}
                      onChange={(e) => setNewManagerPass(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={managerCreateLoading} style={{ justifySelf: 'start' }}>
                  {managerCreateLoading ? 'Creating...' : 'Create Manager'}
                </button>
              </form>
            </div>

            {/* Assign Manager to Shop */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Assign Manager to Branch</h3>
                  <p className="card-subtitle">Link a manager account to specific pharmacy branches</p>
                </div>
              </div>

              <div className="form-row" style={{ alignItems: 'flex-end' }}>
                <div className="form-group">
                  <label>Select Pharmacy Branch</label>
                  <select value={assignShopId} onChange={(e) => setAssignShopId(e.target.value)}>
                    <option value="">-- Choose Branch --</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Select Manager</label>
                  <select value={assignManagerId} onChange={(e) => setAssignManagerId(e.target.value)}>
                    <option value="">-- Choose Manager --</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-primary" onClick={() => handleAssignManager('assign')}>
                    Assign
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => handleAssignManager('remove')}>
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Managers Directory */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Managers Directory</h3>
                  <p className="card-subtitle">All active branch managers</p>
                </div>
              </div>

            <div className="table-responsive desktop-only">
              <table>
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Registered Date</th>
                    <th>Managed Branches</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.username}</strong>
                      </td>
                      <td>{m.date_joined}</td>
                      <td>
                        {m.managed_shops?.length ? (
                          m.managed_shops.map((s) => (
                            <span key={s.id} className="badge badge-primary" style={{ marginRight: 6 }}>
                              {s.code} ({s.name})
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>No branches assigned</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setResetManagerModal(m);
                              setResetManagerPass('');
                            }}
                          >
                            🔑 Reset Password
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDeleteManager(m)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!managers.length && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                        No managers registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Managers Directory */}
            <div className="mobile-only mobile-cards-list">
              {managers.map((m) => (
                <div key={m.id} className="mobile-data-card">
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title">{m.username}</div>
                      <div className="mobile-card-sub">Registered: {m.date_joined}</div>
                    </div>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Managed Branches</span>
                    <span className="mobile-card-val">
                      {m.managed_shops?.length ? (
                        m.managed_shops.map((s) => (
                          <span key={s.id} className="badge badge-primary" style={{ marginRight: 4, display: 'inline-block', marginBottom: 2 }}>
                            {s.code} ({s.name})
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>None</span>
                      )}
                    </span>
                  </div>
                  <div className="mobile-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setResetManagerModal(m);
                        setResetManagerPass('');
                      }}
                    >
                      🔑 Reset Password
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDeleteManager(m)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
              {!managers.length && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                  No managers registered yet.
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: ATTENDANCE RECORDS (ADMIN / MANAGER / EMPLOYEE)                */}
        {/* ================================================================== */}
        {(activeTab === 'attendance' || activeTab === 'my_records') && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  {user.role === 'EMPLOYEE' ? 'My Attendance History' : 'Attendance Punch Records'}
                </h3>
                <p className="card-subtitle">Verified check-in, check-out logs and shift duration</p>
              </div>

              {user.role !== 'EMPLOYEE' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={exportAttendanceCSV}>
                  📥 Export Monthly Report (CSV)
                </button>
              )}
            </div>

            {/* Filter Toolbar: Datewise, Daywise, Branchwise */}
            <div className="filter-toolbar">
              <div className="filter-row filter-pills-row">
                <span className="filter-label">Presets:</span>
                <button
                  type="button"
                  className={`btn-pill ${filterDateMode === 'all' && !filterDayOfWeek ? 'active' : ''}`}
                  onClick={() => setPresetDateFilter('all')}
                >
                  All Records
                </button>
                <button
                  type="button"
                  className={`btn-pill ${filterDateMode === 'single' && filterDate === new Date().toISOString().slice(0, 10) ? 'active' : ''}`}
                  onClick={() => setPresetDateFilter('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`btn-pill ${filterDateMode === 'single' && filterDate && filterDate !== new Date().toISOString().slice(0, 10) ? 'active' : ''}`}
                  onClick={() => setPresetDateFilter('yesterday')}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  className={`btn-pill ${filterDateMode === 'month' ? 'active' : ''}`}
                  onClick={() => setPresetDateFilter('this_month')}
                >
                  This Month
                </button>
              </div>

              <div className="filter-row">
                {/* Date Filter Mode */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="filter-label">Filter Mode:</span>
                  <select
                    value={filterDateMode}
                    onChange={(e) => setFilterDateMode(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="all">All Dates</option>
                    <option value="single">Single Date</option>
                    <option value="range">Date Range</option>
                    <option value="month">By Month</option>
                  </select>
                </div>

                {/* Single Date */}
                {filterDateMode === 'single' && (
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  />
                )}

                {/* Date Range */}
                {filterDateMode === 'range' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      title="From Date"
                    />
                    <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>to</span>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      title="To Date"
                    />
                  </div>
                )}

                {/* Month Selector */}
                {filterDateMode === 'month' && (
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  />
                )}

                {/* Day of Week Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="filter-label">Day:</span>
                  <select
                    value={filterDayOfWeek}
                    onChange={(e) => setFilterDayOfWeek(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="">All Days</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                {/* Branch Filter */}
                {user.role !== 'EMPLOYEE' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="filter-label">Branch:</span>
                    <select
                      value={filterShop}
                      onChange={(e) => setFilterShop(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 13 }}
                    >
                      <option value="">All Branches</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.code}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="filter-label">Status:</span>
                  <select
                    value={filterAttStatus}
                    onChange={(e) => setFilterAttStatus(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Accepted</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                {(filterDateMode !== 'all' || filterDayOfWeek || filterShop || filterAttStatus !== 'all') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setPresetDateFilter('all')}
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>

            {/* Summary Statistics Strip */}
            <div className="summary-strip">
              <div className="summary-item">
                <span>Total Punches:</span>
                <strong>{filteredAttendance.length}</strong>
              </div>
              <div className="summary-item">
                <span>Completed Shifts:</span>
                <strong style={{ color: 'var(--primary-700)' }}>
                  {filteredAttendance.filter((r) => r.check_out).length}
                </strong>
              </div>
              <div className="summary-item">
                <span>Active Shifts:</span>
                <strong style={{ color: 'var(--accent-blue)' }}>
                  {filteredAttendance.filter((r) => r.check_in && !r.check_out).length}
                </strong>
              </div>
            </div>

            <div className="table-responsive desktop-only">
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Branch</th>
                    <th>Work Date</th>
                    <th>Day</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours Worked</th>
                    <th>Shift Status</th>
                    <th>Approval</th>
                    {user.role !== 'EMPLOYEE' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((row) => {
                    const dayName = new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' });
                    let hoursDisplay = '—';
                    if (row.check_in && row.check_out) {
                      const diffSec = (new Date(row.check_out) - new Date(row.check_in)) / 1000;
                      hoursDisplay = `${(Math.max(0, diffSec) / 3600).toFixed(1)} hrs`;
                    }
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.employee_name || row.employee}</strong>
                          {row.employee_name && row.employee_name !== row.employee && (
                            <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                              ID: {row.employee}
                            </div>
                          )}
                        </td>
                        <td>
                          {row.shop} <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>({row.shop_code})</span>
                        </td>
                        <td>{formatDate(row.date)}</td>
                        <td>
                          <span className="badge badge-neutral">{dayName}</span>
                        </td>
                        <td>{formatTime(row.check_in)}</td>
                        <td>{formatTime(row.check_out)}</td>
                        <td>
                          <strong>{hoursDisplay}</strong>
                        </td>
                        <td>
                          {row.check_out ? (
                            <span className="badge badge-success">Completed</span>
                          ) : row.check_in ? (
                            <span className="badge badge-primary">Active Shift</span>
                          ) : (
                            <span className="badge badge-neutral">—</span>
                          )}
                        </td>
                        <td>
                          {row.status === 'APPROVED' ? (
                            <span className="badge badge-success">✓ Accepted</span>
                          ) : row.status === 'REJECTED' ? (
                            <span className="badge badge-danger">✕ Rejected</span>
                          ) : (
                            <span className="badge badge-warning">⏳ Pending</span>
                          )}
                        </td>
                        {user.role !== 'EMPLOYEE' && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {row.status !== 'APPROVED' && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    setAttReviewModal({ attendance: row, action: 'approve' });
                                    setAttReviewComments('');
                                  }}
                                >
                                  Accept
                                </button>
                              )}
                              {row.status !== 'REJECTED' && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    setAttReviewModal({ attendance: row, action: 'reject' });
                                    setAttReviewComments('');
                                  }}
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!filteredAttendance.length && (
                    <tr>
                      <td colSpan={user.role !== 'EMPLOYEE' ? 10 : 9} style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                        No attendance records found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="mobile-only mobile-cards-list">
              {filteredAttendance.map((row) => {
                const dayName = new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' });
                let hoursDisplay = '—';
                if (row.check_in && row.check_out) {
                  const diffSec = (new Date(row.check_out) - new Date(row.check_in)) / 1000;
                  hoursDisplay = `${(Math.max(0, diffSec) / 3600).toFixed(1)} hrs`;
                }
                return (
                  <div key={row.id} className="mobile-data-card">
                    <div className="mobile-card-top">
                      <div>
                        <div className="mobile-card-title">{row.employee_name || row.employee}</div>
                        <div className="mobile-card-sub">{row.shop} ({row.shop_code})</div>
                      </div>
                      {row.check_out ? (
                        <span className="badge badge-success">Completed</span>
                      ) : row.check_in ? (
                        <span className="badge badge-primary">Active Shift</span>
                      ) : (
                        <span className="badge badge-neutral">—</span>
                      )}
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Work Date</span>
                      <span className="mobile-card-val">{formatDate(row.date)} ({dayName})</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Check In</span>
                      <span className="mobile-card-val">{formatTime(row.check_in)}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Check Out</span>
                      <span className="mobile-card-val">{formatTime(row.check_out)}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Hours Worked</span>
                      <span className="mobile-card-val"><strong>{hoursDisplay}</strong></span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Approval</span>
                      <span className="mobile-card-val">
                        {row.status === 'APPROVED' ? (
                          <span className="badge badge-success">✓ Accepted</span>
                        ) : row.status === 'REJECTED' ? (
                          <span className="badge badge-danger">✕ Rejected</span>
                        ) : (
                          <span className="badge badge-warning">⏳ Pending</span>
                        )}
                      </span>
                    </div>
                    {user.role !== 'EMPLOYEE' && (
                      <div className="mobile-card-actions" style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        {row.status !== 'APPROVED' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setAttReviewModal({ attendance: row, action: 'approve' });
                              setAttReviewComments('');
                            }}
                          >
                            Accept
                          </button>
                        )}
                        {row.status !== 'REJECTED' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setAttReviewModal({ attendance: row, action: 'reject' });
                              setAttReviewComments('');
                            }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!filteredAttendance.length && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                  No attendance records found matching filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: EVIDENCE AUDIT (ADMIN / MANAGER / EMPLOYEE)                   */}
        {/* ================================================================== */}
        {(activeTab === 'evidence' || activeTab === 'my_evidence') && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Geofence Evidence & Month Data Management</h3>
                  <p className="card-subtitle">Selfie camera photos and GPS distance audit trail for {filterMonth}</p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {user.role !== 'EMPLOYEE' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleExportAuditPackage(filterMonth)}
                        disabled={isExportingDossier}
                        title="Export complete offline HTML audit report with all photos embedded. Can be exported anytime as needed."
                      >
                        {isExportingDossier ? '⏳ Exporting Dossier...' : '📥 Export Audit Dossier'}
                      </button>
                      <button
                        type="button"
                        className={`btn ${isMonthExported ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                        onClick={() => handleDeleteMonthData(filterMonth)}
                        disabled={isDeletingMonthData}
                        title={
                          isMonthExported
                            ? `Permanently delete all attendance records and photos for ${filterMonth}`
                            : `Please export report first before deleting data for ${filterMonth} (Recommendation: Purge data every 6 months)`
                        }
                      >
                        {isDeletingMonthData ? '⏳ Deleting Data...' : `🗑️ Delete Data (${filterMonth})`}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Data Retention & Purge Policy Notification Banner */}
              {user.role !== 'EMPLOYEE' && (
                <div
                  className={`alert-banner ${isMonthExported ? 'info' : 'warning'}`}
                  style={{ margin: '0 20px 16px 20px' }}
                >
                  <div className="alert-banner-content">
                    <span style={{ fontSize: 18 }}>{isMonthExported ? '🛡️' : 'ℹ️'}</span>
                    <div>
                      <strong>
                        {isMonthExported
                          ? `Export Verified for ${filterMonth} — Eligible for Deletion`
                          : `Data Retention Policy (${filterMonth})`}
                      </strong>
                      <div style={{ fontSize: 12, marginTop: 2, color: 'var(--slate-700)' }}>
                        {isMonthExported
                          ? `Report has been exported for this month. You may download it again anytime, or permanently delete the attendance and photo records if needed. (Recommendation: Take report and purge data every 6 months).`
                          : `You can export reports anytime whenever you need while data is available. Before deleting data for any selected month, the report must be exported at least once. (Recommendation: Take report and purge data every 6 months to maintain optimal performance).`}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${isMonthExported ? 'badge-success' : 'badge-warning'}`}>
                      {isMonthExported ? '✓ Exported' : '⚠️ Export Required to Delete'}
                    </span>
                  </div>
                </div>
              )}

              {/* Evidence Filter Bar */}
              <div className="filter-toolbar" style={{ margin: '0 20px 16px 20px' }}>
                <div className="filter-row">
                  <span className="filter-label">Target Month:</span>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => {
                      const m = e.target.value;
                      setFilterMonth(m);
                      if (m) {
                        checkMonthExportStatus(m, filterShop);
                        apiReq(`/attendance/evidence/?month=${m}${filterShop ? `&shop_id=${filterShop}` : ''}`)
                          .then((ev) => setEvidenceList(ev))
                          .catch(() => {});
                      }
                    }}
                    style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600 }}
                  />

                  <span className="filter-label" style={{ marginLeft: 8 }}>Status:</span>
                  <select
                    value={evidenceFilterStatus}
                    onChange={(e) => setEvidenceFilterStatus(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="all">All Evidence</option>
                    <option value="accepted">Accepted Only</option>
                    <option value="rejected">Rejected Only</option>
                  </select>

                  {user.role !== 'EMPLOYEE' && (
                    <>
                      <span className="filter-label" style={{ marginLeft: 8 }}>Branch:</span>
                      <select
                        value={filterShop}
                        onChange={(e) => {
                          const sCode = e.target.value;
                          setFilterShop(sCode);
                          apiReq(`/attendance/evidence/?month=${filterMonth}${sCode ? `&shop_id=${sCode}` : ''}`)
                            .then((ev) => setEvidenceList(ev))
                            .catch(() => {});
                        }}
                        style={{ padding: '6px 10px', fontSize: 13 }}
                      >
                        <option value="">All Branches</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.code}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {(filterShop || evidenceFilterStatus !== 'all') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => {
                        setFilterShop('');
                        setEvidenceFilterStatus('all');
                      }}
                    >
                      ↺ Reset Filters
                    </button>
                  )}
                </div>
              </div>

              <div className="gallery-grid">
                {filteredEvidence.map((ev) => (
                  <div key={ev.id} className="evidence-card">
                    <div
                      className="evidence-img-wrap"
                      onClick={() => ev.selfie && setZoomedImage(ev)}
                      style={{ cursor: ev.selfie ? 'pointer' : 'default' }}
                    >
                      {ev.selfie ? (
                        <img src={ev.selfie} alt={`Selfie by ${ev.employee}`} />
                      ) : (
                        <div className="evidence-purged-box">
                          <span style={{ fontSize: 28 }}>🛡️</span>
                          <span className="evidence-purged-badge">Photo Purged</span>
                          <span style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                            Preserved in Month-End Export
                          </span>
                        </div>
                      )}
                      <span className={`evidence-tag badge ${ev.accepted ? 'badge-success' : 'badge-danger'}`}>
                        {ev.accepted ? '✓ Accepted' : '✕ Rejected'}
                      </span>
                    </div>

                    <div className="evidence-body">
                      <div className="evidence-title">
                        <span>
                          {ev.employee_name || ev.employee} · {ev.kind.replace('_', ' ')}
                        </span>
                        <small style={{ color: 'var(--slate-400)' }}>{formatTime(ev.time)}</small>
                      </div>

                      <div className="evidence-meta">
                        <div>
                          Staff ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{ev.employee}</strong>
                        </div>
                        <div>
                          Branch: <strong>{ev.shop}</strong>
                        </div>
                        <div>
                          Distance from Branch: <strong>{Number(ev.distance_m).toFixed(1)}m</strong>
                        </div>
                        <div>
                          GPS Accuracy: <strong>±{Number(ev.accuracy_m).toFixed(1)}m</strong>
                        </div>
                        {ev.reason && (
                          <div style={{ marginTop: 4, color: ev.accepted ? 'var(--primary-700)' : '#dc2626' }}>
                            Note: {ev.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!filteredEvidence.length && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                  No evidence events found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: SECURITY & AUDIT LOG (SUPER ADMIN ONLY)                       */}
        {/* ================================================================== */}
        {activeTab === 'auditlog' && user.role === 'SUPER_ADMIN' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Security & System Audit Log</h3>
                <p className="card-subtitle">Chronological ledger of security and branch operations</p>
              </div>
            </div>

            <div className="table-mobile-hint">
              <span>⇄ Swipe horizontally to view full table</span>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{formatDate(log.created_at)} {formatTime(log.created_at)}</td>
                      <td>
                        <strong>{log.user}</strong>{' '}
                        {log.role && <span className="badge badge-neutral" style={{ fontSize: 10 }}>{log.role}</span>}
                      </td>
                      <td>
                        <span className="badge badge-primary">{log.action}</span>
                      </td>
                      <td>{log.details}</td>
                    </tr>
                  ))}
                  {!auditLogs.length && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                        No audit log events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: ACCOUNT & SECURITY                                            */}
        {/* ================================================================== */}
        {activeTab === 'account' && (
          <div style={{ maxWidth: 640 }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    {user.role === 'EMPLOYEE' && user.must_change_password
                      ? '👋 Complete Employee Profile & Set Password'
                      : 'Account & Security Settings'}
                  </h3>
                  <p className="card-subtitle">
                    {user.role === 'EMPLOYEE' && user.must_change_password
                      ? 'First-time setup: please provide your personal details to activate your account.'
                      : 'Manage your credentials and security settings'}
                  </p>
                </div>
              </div>

              {/* Show existing profile info if already activated */}
              {(!user.must_change_password || user.role !== 'EMPLOYEE') && (
                <div style={{ background: 'var(--slate-50)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'var(--slate-500)', fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Username</span>
                      <strong>{user.username}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-500)', fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Role</span>
                      <strong>{user.role}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-500)', fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Full Name</span>
                      <strong>{user.full_name || user.first_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-500)', fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Email</span>
                      <strong>{user.email || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-500)', fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Date of Birth</span>
                      <strong>{user.date_of_birth || '—'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {user.must_change_password && (
                <div className="alert-banner warning" style={{ marginBottom: 20 }}>
                  <div className="alert-banner-content">
                    <span>🔑</span>
                    <div>
                      {user.role === 'EMPLOYEE'
                        ? 'Initial setup required: please enter your personal details and set a secure personal password to activate your account.'
                        : 'Your account is using a temporary password. Please set a new secure password (8+ characters).'}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="form-grid">
                {/* FIRST TIME EMPLOYEE ONLY: Full Name, Email, DOB */}
                {user.role === 'EMPLOYEE' && user.must_change_password && (
                  <>
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter your full legal name"
                        value={empFullName}
                        onChange={(e) => setEmpFullName(e.target.value)}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="Enter your email address"
                          value={empEmail}
                          onChange={(e) => setEmpEmail(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Date of Birth (DOB) *</label>
                        <input
                          type="date"
                          required
                          value={empDob}
                          onChange={(e) => setEmpDob(e.target.value)}
                        />
                      </div>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--slate-200)', margin: '8px 0' }} />
                  </>
                )}

                <div className="form-group">
                  <label>Current Password *</label>
                  <PasswordInput
                    required
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>New Password (min 8 chars) *</label>
                    <PasswordInput
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password *</label>
                    <PasswordInput
                      required
                      minLength={8}
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={isChangingPass} style={{ marginTop: 8 }}>
                  {isChangingPass
                    ? 'Saving...'
                    : user.role === 'EMPLOYEE' && user.must_change_password
                    ? 'Activate My Profile & Save Password'
                    : 'Save New Password'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* PHARMATRACK V2 MODULES                                             */}
        {/* ================================================================== */}
        {activeTab === 'leaves' && (
          <LeaveManagement user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {activeTab === 'corrections' && (
          <AttendanceCorrection user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {activeTab === 'lifecycle' && (
          <EmployeeLifecycle user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {activeTab === 'monitoring' && (
          <LiveMonitoring user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {activeTab === 'geofence_map' && (
          <GPSGeofenceMap user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {activeTab === 'analytics' && (
          <AttendanceAnalytics user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {activeTab === 'reports' && (
          <ReportExports user={user} shops={shops} addToast={addToast} apiReq={apiReq} />
        )}

        {/* Global Footer */}
        <footer className="app-footer">
          <div className="app-footer-content">
            <span>PharmaTrack Geofence Attendance</span>
            <span className="footer-dot">•</span>
            <span>© {new Date().getFullYear()} 1103techstudios. All rights reserved.</span>
          </div>
        </footer>
        </main>

        {/* Native Mobile Bottom Navigation Bar */}
        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          {tabs.slice(0, user.role === 'SUPER_ADMIN' ? 4 : 5).map((t) => {
            const isActive = activeTab === t.id;
            const shortLabel =
              t.id === 'dashboard'
                ? user.role === 'EMPLOYEE'
                  ? 'Punch'
                  : 'Home'
                : t.id === 'shops'
                ? user.role === 'SUPER_ADMIN'
                  ? 'Shops'
                  : 'Staff'
                : t.id === 'my_attendance' || t.id === 'attendance'
                ? 'Records'
                : t.id === 'my_evidence' || t.id === 'evidence'
                ? 'Photos'
                : t.id === 'account'
                ? 'Profile'
                : t.label;

            return (
              <button
                key={t.id}
                type="button"
                className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(t.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-selected={isActive}
              >
                <span className="mobile-bottom-nav-icon">{t.icon}</span>
                <span className="mobile-bottom-nav-label">{shortLabel}</span>
                {isActive && <span className="mobile-bottom-nav-dot" />}
              </button>
            );
          })}
          {user.role === 'SUPER_ADMIN' && (
            <button
              type="button"
              className={`mobile-bottom-nav-item ${isMobileSidebarOpen || activeTab === 'auditlog' || activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open Full Navigation Menu"
            >
              <span className="mobile-bottom-nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                  <circle cx="5" cy="12" r="1.5" />
                </svg>
              </span>
              <span className="mobile-bottom-nav-label">More</span>
            </button>
          )}
        </nav>
      </div>

      {/* ================================================================== */}
      {/* MODAL: ADD STAFF COUNT                                             */}
      {/* ================================================================== */}
      {addStaffModalShop && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ width: 440 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Add Staff Accounts</h3>
                <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 2 }}>
                  Branch: <strong>{addStaffModalShop.name}</strong> ({addStaffModalShop.code})
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAddStaffModalShop(null)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateEmployees(addStaffModalShop, addStaffCount);
              }}
              className="form-grid"
            >
              <div className="form-group">
                <label>How many staff accounts to create?</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  autoFocus
                  value={addStaffCount}
                  onChange={(e) => setAddStaffCount(e.target.value)}
                  style={{ fontSize: 18, fontWeight: 700, padding: 12 }}
                />
              </div>

              {/* Quick Pick Buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>Quick select:</span>
                {[1, 2, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAddStaffCount(num)}
                  >
                    {num} staff
                  </button>
                ))}
              </div>

              <div style={{ padding: 12, background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)', fontSize: 12, color: 'var(--slate-600)' }}>
                ℹ️ Accounts will be created sequentially (e.g. <code>S1001</code>, <code>S1002</code>...) with default temporary PIN <code>1234</code>.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isGeneratingStaff}
                  onClick={() => setAddStaffModalShop(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isGeneratingStaff}
                >
                  {isGeneratingStaff ? 'Generating...' : `Create ${addStaffCount} Staff Account${Number(addStaffCount) > 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: GENERATED CREDENTIALS BATCH                                 */}
      {/* ================================================================== */}
      {generatedCredentials && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Employee Accounts Generated</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setGeneratedCredentials(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--slate-600)' }}>
              Successfully created {generatedCredentials.created.length} employee accounts for{' '}
              <strong>{generatedCredentials.shop.name}</strong>. Share these credentials with your pharmacy staff:
            </p>

            <div className="credentials-box">
              {generatedCredentials.created.map((c) => (
                <div key={c.username}>
                  Username: <strong>{c.username}</strong> | Temporary PIN: <strong>{c.temporary_password}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const text = generatedCredentials.created
                    .map((c) => `Username: ${c.username} | Password: ${c.temporary_password}`)
                    .join('\n');
                  navigator.clipboard.writeText(text);
                  addToast('Credentials copied to clipboard!', 'success');
                }}
              >
                📋 Copy All to Clipboard
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setGeneratedCredentials(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: SHOP ROSTER                                                 */}
      {/* ================================================================== */}
      {shopEmployeesRoster && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ width: 780 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  Staff Roster — {shopEmployeesRoster.shop.name}
                </h3>
                <span className="badge badge-primary">{shopEmployeesRoster.shop.code}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShopEmployeesRoster(null)}
              >
                ✕
              </button>
            </div>

            {rosterLoading ? (
              <p>Loading roster...</p>
            ) : (
              <>
                <div className="table-mobile-hint">
                  <span>⇄ Swipe horizontally to view full table</span>
                </div>
                <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Date of Birth</th>
                      <th>Account Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopEmployeesRoster.employees.map((emp) => (
                      <tr key={emp.id}>
                        <td>
                          <strong>{emp.code}</strong>
                        </td>
                        <td>
                          <strong>{emp.full_name}</strong>
                        </td>
                        <td style={{ fontSize: 12 }}>{emp.email}</td>
                        <td style={{ fontSize: 12 }}>{emp.date_of_birth}</td>
                        <td>
                          {emp.must_change_password ? (
                            <span className="badge badge-warning">Pending Activation</span>
                          ) : (
                            <span className="badge badge-success">✓ Profile Activated</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => handleDeleteEmployee(shopEmployeesRoster.shop.id, emp)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!shopEmployeesRoster.employees.length && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 20, color: 'var(--slate-500)' }}>
                          No employees registered under this branch yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShopEmployeesRoster(null)}
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: ZOOM EVIDENCE PHOTO                                         */}
      {/* ================================================================== */}
      {zoomedImage && (
        <div className="modal-overlay" onClick={() => setZoomedImage(null)}>
          <div
            className="modal-dialog"
            style={{ width: 500, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 16 }}>
                Evidence: {zoomedImage.employee_name || zoomedImage.employee} ({zoomedImage.kind.replace('_', ' ')})
              </strong>
              <button type="button" className="modal-close-btn" onClick={() => setZoomedImage(null)}>
                ✕
              </button>
            </div>

            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000' }}>
              <img src={zoomedImage.selfie} alt="Evidence Zoom" style={{ width: '100%', display: 'block' }} />
            </div>

            <div style={{ marginTop: 14, fontSize: 13, display: 'grid', gap: 4 }}>
              <div>Staff: <strong>{zoomedImage.employee_name || zoomedImage.employee} (ID: {zoomedImage.employee})</strong></div>
              <div>Branch: <strong>{zoomedImage.shop}</strong></div>
              <div>Captured at: <strong>{new Date(zoomedImage.time).toLocaleString()}</strong></div>
              <div>Distance: <strong>{zoomedImage.distance_m.toFixed(1)} metres</strong></div>
              <div>GPS Accuracy: <strong>±{zoomedImage.accuracy_m.toFixed(1)} metres</strong></div>
              <div>
                Status:{' '}
                <span className={`badge ${zoomedImage.accepted ? 'badge-success' : 'badge-danger'}`}>
                  {zoomedImage.accepted ? 'Verified within geofence' : `Rejected: ${zoomedImage.reason}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: RESET MANAGER PASSWORD                                      */}
      {/* ================================================================== */}
      {resetManagerModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ width: 440 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Reset Manager Password</h3>
                <span className="badge badge-primary">{resetManagerModal.username}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setResetManagerModal(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetManagerPassword} className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>New Password for {resetManagerModal.username} *</label>
                <PasswordInput
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={resetManagerPass}
                  onChange={(e) => setResetManagerPass(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetManagerModal(null)}
                  disabled={isResettingPass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isResettingPass || resetManagerPass.length < 8}
                >
                  {isResettingPass ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: ACCEPT / REJECT ATTENDANCE RECORD                           */}
      {/* ================================================================== */}
      {attReviewModal && (
        <div className="modal-overlay" onClick={() => setAttReviewModal(null)}>
          <div className="modal-dialog" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  {attReviewModal.action === 'approve' ? 'Accept Attendance Record' : 'Reject Attendance Record'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 2 }}>
                  Staff: <strong>{attReviewModal.attendance.employee_name || attReviewModal.attendance.employee}</strong> ({attReviewModal.attendance.employee})
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAttReviewModal(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 14, border: '1px solid var(--slate-200)' }}>
                <div>Branch: <strong>{attReviewModal.attendance.shop} ({attReviewModal.attendance.shop_code})</strong></div>
                <div>Date: <strong>{attReviewModal.attendance.date} ({attReviewModal.attendance.day_of_week})</strong></div>
                <div>Check In: <strong>{formatTime(attReviewModal.attendance.check_in)}</strong></div>
                <div>Check Out: <strong>{formatTime(attReviewModal.attendance.check_out)}</strong></div>
              </div>

              <div className="form-group">
                <label>Supervisor Note (Optional)</label>
                <textarea
                  rows={3}
                  placeholder={`Reason for ${attReviewModal.action === 'approve' ? 'accepting' : 'rejecting'} this attendance record...`}
                  value={attReviewComments}
                  onChange={(e) => setAttReviewComments(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAttReviewModal(null)}
                  disabled={isSubmittingAttReview}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${attReviewModal.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={handleAttendanceReviewAction}
                  disabled={isSubmittingAttReview}
                >
                  {isSubmittingAttReview ? 'Saving...' : `Confirm ${attReviewModal.action === 'approve' ? 'Accept' : 'Reject'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ================================================================== */}
      {/* FLOATING TOAST NOTIFICATIONS                                       */}
      {/* ================================================================== */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
