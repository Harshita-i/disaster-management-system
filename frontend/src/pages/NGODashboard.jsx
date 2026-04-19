import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Marker, useMap } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { useTranslatedAlerts } from '../hooks/useTranslatedAlerts';
import 'leaflet/dist/leaflet.css';

const PRIORITY_COLORS = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#10b981'
};

const STATUS_COLORS = {
  pending: '#f59e0b',
  assigned: '#3b82f6',
  'in-progress': '#8b5cf6',
  resolved: '#10b981'
};

const STATUS_LABELS = {
  pending: { label: 'Pending', color: '#f59e0b' },
  assigned: { label: 'Assigned', color: '#3b82f6' },
  'in-progress': { label: 'In Progress', color: '#8b5cf6' },
  resolved: { label: 'Resolved', color: '#10b981' }
};

const PRIORITY_SECTIONS = [
  {
    priority: 'red',
    label: '🔴 Critical',
    sub: 'Handle First',
    color: '#ef4444'
  },
  {
    priority: 'yellow',
    label: '🟡 Moderate',
    sub: 'Handle Second',
    color: '#f59e0b'
  },
  {
    priority: 'green',
    label: '🟢 Safe',
    sub: 'Handle Last',
    color: '#10b981'
  }
];

const PRIORITY_WEIGHT = { red: 1, yellow: 2, green: 3 };

function normalizeSOSList(list) {
  const newestFirst = [...list].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const unique = new Map();

  newestFirst.forEach((item) => {
    const key = String(item.userId || item._id);
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    if (PRIORITY_WEIGHT[a.priority] !== PRIORITY_WEIGHT[b.priority]) {
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    }
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function upsertSOS(prev, sos) {
  const key = String(sos.userId || sos._id);
  const without = prev.filter(
    (item) =>
      String(item.userId || item._id) !== key &&
      String(item._id) !== String(sos._id)
  );
  return normalizeSOSList([sos, ...without]);
}

function assignedToId(sos) {
  const a = sos.assignedTo;
  if (a && typeof a === 'object' && a._id != null) return String(a._id);
  if (a != null) return String(a);
  return '';
}

function escapeHtmlForIcon(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createNgoHouseIcon(label, mine) {
  const safe = escapeHtmlForIcon(label);
  return L.divIcon({
    className: 'ngo-base-marker-wrap',
    html: `<div class="ngo-base-house${mine ? ' ngo-base-house--mine' : ''}"><span class="ngo-base-house-emoji" aria-hidden="true">🏠</span><span class="ngo-base-house-label">${safe}</span></div>`,
    iconSize: [148, 52],
    iconAnchor: [74, 52],
  });
}

function MapFitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    if (sw.equals(ne)) {
      map.setView(sw, 13);
      return;
    }
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14 });
  }, [map, bounds]);
  return null;
}

export default function NGODashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const [sosList, setSosList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const translatedAlerts = useTranslatedAlerts(alerts, i18n.language);
  const [ngoBases, setNgoBases] = useState([]);
  const [ngoBasesLoaded, setNgoBasesLoaded] = useState(false);
  const [baseHint, setBaseHint] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  /** List panel: your auto/manual assignments vs full network view */
  const [sosScope, setSosScope] = useState('mine');
  const [assignError, setAssignError] = useState('');

  const mapCenter = useMemo(() => [20.5937, 78.9629], []);

  const fetchNgoBases = async () => {
    try {
      const res = await api.get('/users/ngo-bases');
      setNgoBases(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch NGO bases:', err);
    } finally {
      setNgoBasesLoaded(true);
    }
  };

  const fetchSOS = async () => {
    try {
      const res = await api.get('/sos?showAll=true');
      setSosList(normalizeSOSList(res.data));
    } catch (err) {
      console.error('Failed to fetch SOS:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const saveMyBaseFromGps = () => {
    setBaseHint('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.patch('/users/me/location', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (res.data?.location) {
            updateUser({ location: res.data.location });
          }
          setBaseHint(t('ngo.baseSavedHint'));
          fetchNgoBases();
        } catch (err) {
          console.error(err);
          setBaseHint(t('ngo.baseSaveFailed'));
        }
      },
      () => {
        alert(t('ngo.enableGpsBase'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    fetchSOS();
    fetchAlerts();
    fetchNgoBases();

    socket.on('new-sos', (sos) => {
      setSosList((prev) => upsertSOS(prev, sos));
    });

    socket.on('sos-updated', ({ sos }) => {
      if (!sos) return;
      setSosList((prev) => upsertSOS(prev, sos));
    });

    socket.on('sos-assigned', ({ sosId, assignedTo }) => {
      setSosList((prev) =>
        prev.map((s) =>
          s._id === sosId ? { ...s, status: 'assigned', assignedTo: assignedTo ?? s.assignedTo } : s
        )
      );
    });

    socket.on('sos-status-updated', ({ sosId, status }) => {
      setSosList((prev) =>
        prev.map((s) => (s._id === sosId ? { ...s, status } : s))
      );
    });

    socket.on('new-alert', (alert) => {
      setAlerts((prev) => {
        const exists = prev.some((a) => String(a._id) === String(alert._id));
        if (exists) return prev;
        return [alert, ...prev];
      });
    });

    socket.on('user-deleted', (deletedUserId) => {
      setSosList((prev) => prev.filter((sos) => String(sos.userId) !== deletedUserId));
    });

    socket.on('sos-list-updated', (updatedList) => {
      if (Array.isArray(updatedList)) {
        setSosList(normalizeSOSList(updatedList));
      }
    });

    socket.on('sos-reassignment-timeout', () => {
      fetchSOS();
      fetchNgoBases();
    });

    return () => {
      socket.off('new-sos');
      socket.off('sos-updated');
      socket.off('sos-assigned');
      socket.off('sos-status-updated');
      socket.off('new-alert');
      socket.off('sos-list-updated');
      socket.off('user-deleted');
      socket.off('sos-reassignment-timeout');
    };
  }, []);

  const acceptSOS = async (sosId) => {
    setAssignError('');
    try {
      const res = await api.post(`/sos/${sosId}/assign`);
      const updated = res.data?.sos;
      if (updated) {
        setSosList((prev) => prev.map((s) => (s._id === sosId ? updated : s)));
      } else {
        setSosList((prev) =>
          prev.map((s) =>
            s._id === sosId ? { ...s, status: 'assigned', assignedTo: user?.id } : s
          )
        );
      }
      setSelected(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to assign. Try again.';
      setAssignError(msg);
    }
  };

  const updateStatus = async (sosId, status) => {
    try {
      const res = await api.post(`/sos/${sosId}/status`, { status });
      const updated = res.data?.sos;
      if (updated) {
        setSosList((prev) => prev.map((s) => (s._id === sosId ? updated : s)));
      } else {
        setSosList((prev) => prev.map((s) => (s._id === sosId ? { ...s, status } : s)));
      }
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const passBusySos = async (sosId) => {
    setAssignError('');
    if (!window.confirm(t('ngo.passBusyConfirm'))) return;
    try {
      const res = await api.post(`/sos/${sosId}/pass-busy`);
      const updated = res.data?.sos;
      if (updated) {
        setSosList((prev) => upsertSOS(prev, updated));
      }
      setSelected(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not release SOS.';
      setAssignError(msg);
    }
  };

  const myUid = user?.id != null ? String(user.id) : '';

  const preparedNgoMarkers = useMemo(() => {
    const withCoords = ngoBases.filter(
      (n) =>
        n.location?.lat != null &&
        n.location?.lng != null &&
        Number.isFinite(Number(n.location.lat)) &&
        Number.isFinite(Number(n.location.lng))
    );
    const bucket = new Map();
    for (const n of withCoords) {
      const lat0 = Number(n.location.lat);
      const lng0 = Number(n.location.lng);
      const key = `${lat0.toFixed(5)}_${lng0.toFixed(5)}`;
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(n);
    }
    const out = [];
    for (const group of bucket.values()) {
      group.forEach((n, idx) => {
        const lat0 = Number(n.location.lat);
        const lng0 = Number(n.location.lng);
        const step = 0.00012;
        const lat = lat0 + step * idx * 0.85;
        const lng = lng0 + step * idx * 1.05;
        const mine = myUid && String(n._id) === myUid;
        const label = n.ngoName || n.name || 'NGO';
        out.push({
          id: String(n._id),
          lat,
          lng,
          lat0,
          lng0,
          label,
          mine,
          n,
        });
      });
    }
    return out;
  }, [ngoBases, myUid]);

  const mapBounds = useMemo(() => {
    const pts = [];
    sosList.forEach((s) => {
      if (s.location?.lat != null && s.location?.lng != null) {
        pts.push(L.latLng(s.location.lat, s.location.lng));
      }
    });
    ngoBases.forEach((n) => {
      if (n.location?.lat != null && n.location?.lng != null) {
        pts.push(L.latLng(n.location.lat, n.location.lng));
      }
    });
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [sosList, ngoBases]);

  const mySosList = useMemo(
    () => sosList.filter((s) => assignedToId(s) === myUid && myUid),
    [sosList, myUid]
  );

  const panelSosList = sosScope === 'mine' ? mySosList : sosList;

  const counts = {
    total: sosList.length,
    mineActive: mySosList.filter((s) => s.status !== 'resolved').length,
    pending: sosList.filter((s) => s.status === 'pending').length,
    red: sosList.filter((s) => s.priority === 'red' && s.status !== 'resolved').length,
    resolved: sosList.filter((s) => s.status === 'resolved').length
  };

  const filtered =
    filter === 'all'
      ? panelSosList
      : panelSosList.filter((s) => s.priority === filter || s.status === filter);

  const redPendingCount = sosList.filter(
    (s) => s.priority === 'red' && s.status === 'pending'
  ).length;
  const yellowPendingCount = sosList.filter(
    (s) => s.priority === 'yellow' && s.status === 'pending'
  ).length;

  const isLocked = (priority) => {
    if (priority === 'yellow') return redPendingCount > 0;
    if (priority === 'green') return redPendingCount > 0 || yellowPendingCount > 0;
    return false;
  };

  return (
    <div className="app-dashboard">
      <header className="dash-header">
        <h2>🚑 {t('dashboard.ngoTitle')}</h2>
        <div className="dash-header-actions">
          <ThemeToggle />
          <LanguageSwitcher compact />
          {user?.name && <span className="user-pill">{user.name}</span>}
          <button type="button" className="btn btn-ghost btn-xs" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <div className="dash-main">
        <div className="dash-stat-grid">
          {[
            { label: t('ngo.statMine'), value: counts.mineActive, color: '#6366f1' },
            { label: t('ngo.statNetwork'), value: counts.total, color: '#3b82f6' },
            { label: t('ngo.statPending'), value: counts.pending, color: '#f59e0b' },
            { label: t('ngo.statCritical'), value: counts.red, color: '#ef4444' },
            { label: t('ngo.statResolved'), value: counts.resolved, color: '#10b981' },
          ].map((card) => (
            <div
              key={card.label}
              className="stat-card"
              style={{ '--card-accent': card.color }}
            >
              <p className="stat-card-label">{card.label}</p>
              <p className="stat-card-value">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="dash-two-col">
          <div className="dash-panel dash-map-wrap">
            <div className="dash-panel-header">
              <h3>🗺️ Live Rescue Map</h3>
            </div>
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                fontSize: '0.8rem',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>
                {t('ngo.baseLocationTitle')}
              </p>
              <p style={{ margin: '0 0 0.65rem', lineHeight: 1.45 }}>{t('ngo.baseLocationDesc')}</p>
              <button type="button" className="btn btn-secondary btn-xs" onClick={saveMyBaseFromGps}>
                {t('ngo.saveBaseGps')}
              </button>
              {baseHint && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#6ee7b7' }}>{baseHint}</p>
              )}
              {ngoBasesLoaded && ngoBases.length === 0 && (
                <p style={{ margin: '0.65rem 0 0', fontSize: '0.72rem', lineHeight: 1.45, color: '#94a3b8' }}>
                  {t('ngo.mapNoBasesYet')}
                </p>
              )}
            </div>
            <MapContainer
              center={mapCenter}
              zoom={5}
              style={{ height: '100%', width: '100%', flex: 1, minHeight: 400 }}
            >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {mapBounds ? <MapFitBounds bounds={mapBounds} /> : null}

            {translatedAlerts.map(alert =>
              alert.location?.lat && alert.location?.lng ? (
                <Circle
                  key={alert._id}
                  center={[alert.location.lat, alert.location.lng]}
                  radius={alert.radius || 5000}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: '6 4'
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>⚠️ {t('alert.mapDanger')}</strong><br />
                      {t('alert.type')}: <b>{alert._tr?.type ?? alert.type}</b><br />
                      {t('alert.severity')}: <b>{alert._tr?.severity ?? alert.severity}</b><br />
                      {t('alert.region')}: {alert._tr?.region ?? alert.region}<br />
                      <span style={{ fontSize: 12 }}>{alert._tr?.message ?? alert.message}</span>
                    </div>
                  </Popup>
                </Circle>
              ) : null
            )}

            {preparedNgoMarkers.map((row) => (
              <Marker
                key={row.id}
                position={[row.lat, row.lng]}
                icon={createNgoHouseIcon(row.label, row.mine)}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#0ea5e9', marginBottom: 4 }}>
                      {t('ngo.mapBaseLabel')}
                    </div>
                    <strong>
                      {row.label}
                      {row.mine ? ` · ${t('ngo.mapYourCase')}` : ''}
                    </strong>
                    <p style={{ fontSize: 12, margin: '6px 0 0' }}>
                      {row.lat0.toFixed(5)}, {row.lng0.toFixed(5)}
                    </p>
                    <p style={{ fontSize: 10, margin: '8px 0 0', opacity: 0.85 }}>{t('ngo.mapBaseHint')}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {sosList.map((sos) => {
              const mine = myUid && assignedToId(sos) === myUid;
              const stroke = mine ? '#6366f1' : sos.status === 'resolved' ? '#10b981' : sos.priority === 'red' ? '#ef4444' : PRIORITY_COLORS[sos.priority];
              return sos.location?.lat && sos.location?.lng ? (
                <CircleMarker
                  key={sos._id}
                  center={[sos.location.lat, sos.location.lng]}
                  radius={mine ? 14 : 12}
                  pathOptions={{
                    weight: mine ? 3 : 2,
                    color: stroke,
                    fillColor:
                      sos.status === 'resolved'
                        ? '#10b981'
                        : sos.priority === 'red'
                          ? '#ef4444'
                          : PRIORITY_COLORS[sos.priority],
                    fillOpacity: 0.85,
                  }}
                  eventHandlers={{ click: () => setSelected(sos) }}
                >
                  <Popup>
                    <div style={{ minWidth: 170 }}>
                      {mine && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>
                          {t('ngo.mapYourCase')}
                        </div>
                      )}
                      <strong>{sos.name}</strong><br />
                      {t('ngo.popupPriority')}:{' '}
                      <span
                        style={{
                          color: PRIORITY_COLORS[sos.priority] || '#ef4444',
                          fontWeight: 700,
                        }}
                      >
                        {sos.priority?.toUpperCase()}
                      </span>
                      <br />
                      {t('ngo.popupScores')}: P {sos.priorityScore ?? '—'} · T {sos.trustScore ?? '—'}
                      <br />
                      Status:{' '}
                      <span
                        style={{
                          color: STATUS_COLORS[sos.status],
                          fontWeight: 600,
                        }}
                      >
                        {sos.status}
                      </span>
                      <br />
                      {sos.message && (
                        <span style={{ fontSize: 12 }}>
                          {t('ngo.popupNote')}: {sos.message}
                        </span>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null;
            })}
          </MapContainer>
        </div>

        <div className="dash-panel" style={{ minHeight: 400, height: 'min(560px, 62vh)' }}>
          <div className="dash-panel-header">
            <h3>🚨 {t('ngo.sosPanelTitle')}</h3>
            <div className="filter-pills" style={{ marginBottom: 6 }}>
              <button
                type="button"
                className={`filter-pill${sosScope === 'mine' ? ' is-active' : ''}`}
                onClick={() => setSosScope('mine')}
              >
                {t('ngo.viewMine')}
              </button>
              <button
                type="button"
                className={`filter-pill${sosScope === 'all' ? ' is-active' : ''}`}
                onClick={() => setSosScope('all')}
              >
                {t('ngo.viewAll')}
              </button>
            </div>
            <div className="filter-pills">
              {['all', 'pending', 'red', 'yellow', 'green', 'assigned'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-pill${filter === f ? ' is-active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="sos-list-scroll">
            {assignError && (
              <div
                style={{
                  background: 'rgba(127, 29, 29, 0.45)',
                  border: '1px solid rgba(248, 113, 113, 0.45)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.85rem',
                  margin: '0 0 0.5rem',
                  fontSize: '0.75rem',
                  color: '#fecaca',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <span>⚠️ {assignError}</span>
                <button
                  type="button"
                  className="chat-close"
                  onClick={() => setAssignError('')}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}

            {loading ? (
              <p className="empty-hint" style={{ textAlign: 'center', padding: '1.5rem' }}>
                Loading…
              </p>
            ) : panelSosList.length === 0 ? (
              <p className="empty-hint" style={{ textAlign: 'center', padding: '1.5rem' }}>
                {sosScope === 'mine'
                  ? t('ngo.emptyMine')
                  : t('ngo.emptyAll')}
              </p>
            ) : filter !== 'all' ? (
              filtered.length === 0 ? (
                <p className="empty-hint" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  No results for this filter
                </p>
              ) : (
                filtered.map((sos) => (
                  <SOSCard
                    key={sos._id}
                    sos={sos}
                    currentUserId={myUid}
                    selected={selected}
                    setSelected={setSelected}
                    acceptSOS={acceptSOS}
                    updateStatus={updateStatus}
                    passBusySos={passBusySos}
                    locked={false}
                  />
                ))
              )
            ) : (
              PRIORITY_SECTIONS.map((section) => {
                const group = panelSosList.filter((s) => s.priority === section.priority);
                if (group.length === 0) return null;

                const locked = isLocked(section.priority);

                return (
                  <div key={section.priority} style={{ marginBottom: 12 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: 6,
                      background: section.color + '11',
                      borderRadius: 6,
                      borderLeft: `3px solid ${section.color}`
                    }}>
                      <div>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: section.color
                        }}>
                          {section.label}
                        </span>
                        <span style={{
                          fontSize: 10,
                          color: '#64748b',
                          marginLeft: 6
                        }}>
                          {section.sub} · {group.length} victim{group.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {locked && (
                        <span style={{
                          fontSize: 10,
                          color: '#ef4444',
                          background: '#ef444422',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          🔒 Locked
                        </span>
                      )}
                    </div>

                    {group.map((sos) => (
                      <SOSCard
                        key={sos._id}
                        sos={sos}
                        currentUserId={myUid}
                        selected={selected}
                        setSelected={setSelected}
                        acceptSOS={acceptSOS}
                        updateStatus={updateStatus}
                        passBusySos={passBusySos}
                        locked={locked}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
        </div>

        <div className="dash-legend">
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Map legend</span>
          {Object.entries(PRIORITY_COLORS).map(([key, color]) => (
            <div key={key} className="dash-legend-item">
              <span className="dash-legend-dot" style={{ background: color }} />
              <span style={{ textTransform: 'capitalize' }}>{key} priority</span>
            </div>
          ))}
          <div className="dash-legend-item">
            <span
              className="dash-legend-dot"
              style={{
                background: 'rgba(248, 113, 113, 0.25)',
                border: '2px dashed #f87171',
              }}
            />
            <span>Danger zone</span>
          </div>
          <div className="dash-legend-item">
            <span
              className="dash-legend-dot"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '3px solid #6366f1',
                background: 'rgba(239,68,68,0.35)',
              }}
            />
            <span>{t('ngo.legendMyCase')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SOSCard({
  sos,
  currentUserId,
  selected,
  setSelected,
  acceptSOS,
  updateStatus,
  passBusySos,
  locked,
}) {
  const { t } = useTranslation();
  const isSelected = selected?._id === sos._id;
  const assignee = sos.assignedTo;
  const assigneeLabel =
    assignee && typeof assignee === 'object'
      ? assignee.ngoName || assignee.name
      : null;

  const assignId = assignedToId(sos);
  const isMine = Boolean(currentUserId && assignId === currentUserId);
  const canClaim = sos.status === 'pending' && !assignId;
  const readOnly = !isMine && !canClaim;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!locked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setSelected(isSelected ? null : sos);
        }
      }}
      className={`sos-card-ui${locked ? ' is-locked' : ''}${readOnly ? ' sos-card-ui--readonly' : ''}`}
      onClick={() => !locked && setSelected(isSelected ? null : sos)}
      style={{
        background:
          sos.status === 'resolved'
            ? 'rgba(16,185,129,0.12)'
            : sos.priority === 'yellow'
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(239,68,68,0.12)',
        border: `1px solid ${isSelected ? PRIORITY_COLORS[sos.priority] : 'var(--border)'}`,
        borderLeft: `4px solid ${sos.status === 'resolved' ? '#10b981' : sos.priority === 'yellow' ? '#f59e0b' : '#ef4444'}`,
        marginBottom: 8,
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{sos.name}</span>
        <span style={{
          background: `${PRIORITY_COLORS[sos.priority]}22`,
          color: PRIORITY_COLORS[sos.priority],
          padding: '2px 8px', borderRadius: 20,
          fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          {sos.priority}
        </span>
      </div>

      {assigneeLabel && (
        <div
          style={{
            fontSize: 11,
            color: '#a5b4fc',
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          {t('ngo.assignedTeam', { name: assigneeLabel })}
          {sos.autoAssigned ? ` · ${t('ngo.autoAssigned')}` : ''}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            background: 'rgba(148,163,184,0.2)',
            color: '#e2e8f0',
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          {t('ngo.priorityScore', { defaultValue: 'Urgency' })}: {sos.priorityScore ?? '—'}
        </span>
        <span
          style={{
            background: 'rgba(148,163,184,0.2)',
            color: '#e2e8f0',
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          {t('ngo.trustScore', { defaultValue: 'Trust' })}: {sos.trustScore ?? '—'}
        </span>
        {sos.triggerCount > 1 && (
          <span
            style={{
              background: 'rgba(251,191,36,0.15)',
              color: '#fcd34d',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {t('ngo.signals', { defaultValue: 'Signals' })}: ×{sos.triggerCount}
          </span>
        )}
        {sos.suspicious && (
          <span
            style={{
              background: 'rgba(245,158,11,0.2)',
              color: '#fdba74',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {t('ngo.flagSuspicious', { defaultValue: 'Review: suspicious' })}
          </span>
        )}
        {sos.unverifiedCritical && (
          <span
            style={{
              background: 'rgba(239,68,68,0.2)',
              color: '#fecaca',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {t('ngo.flagUnverified', { defaultValue: 'Unverified critical' })}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#64748b', fontSize: 12 }}>
          📍 {sos.location?.lat?.toFixed(4)}, {sos.location?.lng?.toFixed(4)}
        </span>
        <span style={{ color: STATUS_LABELS[sos.status]?.color, fontSize: 11 }}>
          {STATUS_LABELS[sos.status]?.label}
        </span>
      </div>

      <div style={{ color: '#475569', fontSize: 11 }}>
        🕐 {new Date(sos.createdAt).toLocaleTimeString()}
        {sos.message && (
          <span style={{ marginLeft: 8, color: '#64748b' }}>
            · "{sos.message.slice(0, 30)}{sos.message.length > 30 ? '...' : ''}"
          </span>
        )}
      </div>

      {readOnly && (
        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>
          {t('ngo.readOnlyHint')}
        </div>
      )}

      {locked && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>
          🔒 Resolve higher priority victims first
        </div>
      )}

      {isSelected && !locked && (
        <div className="sos-card-actions">
          {readOnly && (
            <p style={{ margin: '0 0 0.5rem', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {t('ngo.readOnlyActions')}
            </p>
          )}
          {canClaim && (
            <button
              type="button"
              className="btn btn-xs btn-success"
              onClick={(e) => {
                e.stopPropagation();
                acceptSOS(sos._id);
              }}
            >
              {t('ngo.claimSos')}
            </button>
          )}
          {isMine && sos.status === 'assigned' && (
            <>
              <button
                type="button"
                className="btn btn-xs btn-violet"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus(sos._id, 'in-progress');
                }}
              >
                {t('ngo.statusInProgress')}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-slate"
                onClick={(e) => {
                  e.stopPropagation();
                  passBusySos(sos._id);
                }}
              >
                {t('ngo.passBusy')}
              </button>
            </>
          )}
          {isMine && sos.status === 'in-progress' && (
            <button
              type="button"
              className="btn btn-xs btn-cyan"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus(sos._id, 'resolved');
              }}
            >
              {t('ngo.statusResolved')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-xs btn-slate"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(null);
            }}
          >
            {t('ngo.closeDetail')}
          </button>
        </div>
      )}
    </div>
  );
}