import React, { useState, useEffect, useRef } from 'react';

export default function GPSGeofenceMap({ user, shops, addToast, apiReq }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);

  const [branches, setBranches] = useState([]);
  const [punches, setPunches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('all');

  const loadMapData = async () => {
    setIsLoading(true);
    try {
      let q = [];
      if (selectedBranch) q.push(`shop_id=${selectedBranch}`);
      if (selectedDate) q.push(`date=${selectedDate}`);
      if (statusFilter !== 'all') q.push(`status=${statusFilter}`);
      const qs = q.length ? `?${q.join('&')}` : '';

      const [branchData, punchData] = await Promise.all([
        apiReq('/geofence/branches/'),
        apiReq(`/geofence/punches/${qs}`),
      ]);

      setBranches(branchData || []);
      setPunches(punchData || []);
    } catch (err) {
      addToast(err.message || 'Failed to load GPS geofence data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [selectedBranch, selectedDate, statusFilter]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!window.L) {
      console.warn('Leaflet (window.L) is not loaded.');
      return;
    }

    if (!mapInstanceRef.current) {
      // Create map
      const map = window.L.map(mapContainerRef.current, {
        center: [12.9716, 77.5946], // Default center
        zoom: 13,
      });

      // Add OpenStreetMap tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | PharmaTrack',
        maxZoom: 19,
      }).addTo(map);

      layersGroupRef.current = window.L.featureGroup().addTo(map);
      mapInstanceRef.current = map;
    }
  }, []);

  // Update Map Markers & Geofence Circles when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group || !window.L) return;

    group.clearLayers();

    const bounds = [];

    // 1. Draw Branches & Geofence Circles
    branches.forEach((b) => {
      if (!b.latitude || !b.longitude) return;
      bounds.push([b.latitude, b.longitude]);

      // Branch Pin Icon
      const branchIcon = window.L.divIcon({
        className: 'custom-map-marker branch-marker',
        html: `
          <div style="background: #0f766e; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 10px rgba(15,118,110,0.5); border: 2px solid white;">
            🏥
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = window.L.marker([b.latitude, b.longitude], { icon: branchIcon })
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px;">
            <strong style="color: #0f766e; font-size: 14px;">🏥 ${b.name}</strong><br/>
            <strong>Code:</strong> ${b.code}<br/>
            <strong>Address:</strong> ${b.address}<br/>
            <strong>Geofence Radius:</strong> ${b.allowed_radius_m} metres<br/>
            <strong>Active Staff:</strong> ${b.employee_count}
          </div>
        `);
      group.addLayer(marker);

      // Draw Geofence Circle
      const circle = window.L.circle([b.latitude, b.longitude], {
        radius: b.allowed_radius_m || 50,
        color: '#0f766e',
        fillColor: '#0f766e',
        fillOpacity: 0.15,
        weight: 2,
      }).bindTooltip(`Allowed Geofence: ${b.allowed_radius_m}m`, { permanent: false, direction: 'top' });
      group.addLayer(circle);
    });

    // 2. Draw Punch Events
    punches.forEach((p) => {
      if (!p.latitude || !p.longitude) return;
      bounds.push([p.latitude, p.longitude]);

      const isAccepted = p.accepted;
      const color = isAccepted ? '#10b981' : '#ef4444';
      const symbol = isAccepted ? '✓' : '✕';

      const punchIcon = window.L.divIcon({
        className: 'custom-map-marker punch-marker',
        html: `
          <div style="background: ${color}; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">
            ${symbol}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const punchMarker = window.L.marker([p.latitude, p.longitude], { icon: punchIcon })
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12.5px;">
            <strong style="font-size: 13px;">${p.employee_name} (${p.employee_code})</strong><br/>
            <strong>Event:</strong> ${p.kind.replace('_', ' ')}<br/>
            <strong>Branch:</strong> ${p.shop_name}<br/>
            <strong>Time:</strong> ${new Date(p.timestamp).toLocaleTimeString()}<br/>
            <strong>Distance from Shop:</strong> ${p.distance_m}m (Allowed: ${p.shop_radius}m)<br/>
            <strong>GPS Accuracy:</strong> ±${p.accuracy_m}m<br/>
            <strong>Validation:</strong> <span style="color: ${color}; font-weight: bold;">${isAccepted ? 'ACCEPTED' : 'REJECTED'}</span><br/>
            ${!isAccepted ? `<strong>Reason:</strong> ${p.reason || 'Outside boundary'}<br/>` : ''}
            ${p.is_suspicious ? `<div style="color: #b91c1c; font-weight: bold; margin-top: 4px;">⚠️ High Accuracy Deviation Detected</div>` : ''}
          </div>
        `);
      group.addLayer(punchMarker);
    });

    // Auto-fit bounds if we have points
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [branches, punches]);

  return (
    <div className="tab-pane-container">
      {/* Top Controls Bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>Interactive GPS Geofence Map</h3>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Inspect branch geofence radiuses and exact employee punch coordinates with verification markers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="filter-label">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="filter-label">Punches:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13 }}
              >
                <option value="all">All Punches</option>
                <option value="accepted">Accepted Inside (Green)</option>
                <option value="rejected">Rejected Outside (Red)</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadMapData}
              disabled={isLoading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--slate-100)', fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#0f766e' }} />
            <span>Pharmacy Branch (Geofence Radius Circle)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#10b981' }} />
            <span>Accepted Punch Inside Boundary ({punches.filter((p) => p.accepted).length})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#ef4444' }} />
            <span>Rejected Punch Outside Radius ({punches.filter((p) => !p.accepted).length})</span>
          </div>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '580px', minHeight: '420px', zIndex: 1 }}
        />
      </div>
    </div>
  );
}
