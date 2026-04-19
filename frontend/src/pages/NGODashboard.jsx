import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import LanguageSwitcher from '../components/LanguageSwitcher';
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

const ngoBaseIcon = L.divIcon({
  className: 'map-marker-ngo',
  html:
    '<div class="map-marker-ngo-inner"><span class="map-marker-ngo-glyph">🛡</span><span class="map-marker-ngo-tag">NGO</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -20],
});

export default function NGODashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sosList, setSosList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const translatedAlerts = useTranslatedAlerts(alerts, i18n.language);
  const [ngoBases, setNgoBases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [assignError, setAssignError] = useState('');

  const mapCenter = useMemo(() => [20.5937, 78.9629], []);

  const fetchNgoBases = async () => {
    try {
      const res = await api.get('/users/ngo-bases');
      setNgoBases(res.data || []);
    } catch (e) {
      console.error('NGO bases fetch failed:', e);
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

  useEffect(() => {
    if (user?.role !== 'ngo') return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api
          .patch('/users/me/location', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
          .then(() => fetchNgoBases())
          .catch(() => {});
      },
      () => {},
      { maximumAge: 600000, timeout: 20000 }
    );
  }, [user?.role, user?.id]);

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

    socket.on('sos-assigned', ({ sosId }) => {
      setSosList((prev) =>
        prev.map((s) => (s._id === sosId ? { ...s, status: 'assigned', assignedTo: user?.id } : s))
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
      setSosList(normalizeSOSList(updatedList));
    });

    return () => {
      socket.off('new-sos');
      socket.off('sos-updated');
      socket.off('sos-assigned');
      socket.off('sos-status-updated');
      socket.off('new-alert');
      socket.off('sos-list-updated');
      socket.off('user-deleted');
    };
  }, []);

  const acceptSOS = async (sosId) => {
    setAssignError('');
    try {
      await api.post(`/sos/${sosId}/assign`);
      setSosList((prev) =>
        prev.map((s) =>
          s._id === sosId
            ? { ...s, status: 'assigned', assignedTo: user?.id }
            : s
        )
      );
      setSelected(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to assign. Try again.';
      setAssignError(msg);
    }
  };

  const updateStatus = async (sosId, status) => {
    try {
      await api.post(`/sos/${sosId}/status`, { status });
      setSosList((prev) =>
        prev.map((s) => (s._id === sosId ? { ...s, status } : s))
      );
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const counts = {
    total: sosList.length,
    pending: sosList.filter((s) => s.status === 'pending').length,
    red: sosList.filter((s) => s.priority === 'red' && s.status !== 'resolved').length,
    resolved: sosList.filter((s) => s.status === 'resolved').length
  };

  const filtered =
    filter === 'all'
      ? sosList
      : sosList.filter((s) => s.priority === filter || s.status === filter);

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
            { label: 'Total SOS', value: counts.total, color: '#3b82f6' },
            { label: 'Pending', value: counts.pending, color: '#f59e0b' },
            { label: 'Critical', value: counts.red, color: '#ef4444' },
            { label: 'Resolved', value: counts.resolved, color: '#10b981' },
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
            <MapContainer
              center={mapCenter}
              zoom={5}
              style={{ height: '100%', width: '100%', flex: 1, minHeight: 400 }}
            >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />

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

            {ngoBases.map((ngo) =>
              ngo.location?.lat != null && ngo.location?.lng != null ? (
                <Marker
                  key={`ngo-base-${ngo._id}`}
                  position={[ngo.location.lat, ngo.location.lng]}
                  icon={ngoBaseIcon}
                >
                  <Popup>
                    <div style={{ minWidth: 168 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: '#6366f1',
                          marginBottom: 6,
                          textTransform: 'uppercase',
                        }}
                      >
                        Responder base
                      </div>
                      <strong style={{ fontSize: 14 }}>{ngo.ngoName || ngo.name}</strong>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Approved NGO · not a distress signal
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}

            {sosList.map(sos =>
              sos.location?.lat && sos.location?.lng ? (
                <CircleMarker
                  key={sos._id}
                  center={[sos.location.lat, sos.location.lng]}
                  radius={12}
                  fillColor={
                    sos.status === 'resolved'
                      ? '#10b981'
                      : sos.priority === 'red'
                      ? '#ef4444'
                      : PRIORITY_COLORS[sos.priority]
                  }
                  color={
                    sos.status === 'resolved'
                      ? '#10b981'
                      : sos.priority === 'red'
                      ? '#ef4444'
                      : PRIORITY_COLORS[sos.priority]
                  }
                  fillOpacity={0.85}
                  eventHandlers={{ click: () => setSelected(sos) }}
                >
                  <Popup>
                    <div style={{ minWidth: 170 }}>
                      <strong>{sos.name}</strong><br />
                      Priority: <span style={{
                        color: PRIORITY_COLORS[sos.priority] || '#ef4444',
                        fontWeight: 700
                      }}>
                        {sos.priority?.toUpperCase()}
                      </span><br />
                      Status: <span style={{
                        color: STATUS_COLORS[sos.status],
                        fontWeight: 600
                      }}>
                        {sos.status}
                      </span><br />
                      {sos.message && <span style={{ fontSize: 12 }}>Note: {sos.message}</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null
            )}
          </MapContainer>
        </div>

        <div className="dash-panel" style={{ minHeight: 400, height: 'min(560px, 62vh)' }}>
          <div className="dash-panel-header">
            <h3>🚨 SOS Requests</h3>
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
            ) : sosList.length === 0 ? (
              <p className="empty-hint" style={{ textAlign: 'center', padding: '1.5rem' }}>
                No SOS requests yet
              </p>
            ) : filter !== 'all' ? (
              filtered.length === 0 ? (
                <p className="empty-hint" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  No results for this filter
                </p>
              ) : (
                filtered.map(sos => (
                  <SOSCard
                    key={sos._id}
                    sos={sos}
                    selected={selected}
                    setSelected={setSelected}
                    acceptSOS={acceptSOS}
                    updateStatus={updateStatus}
                    locked={false}
                  />
                ))
              )
            ) : (
              PRIORITY_SECTIONS.map(section => {
                const group = sosList.filter(s => s.priority === section.priority);
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

                    {group.map(sos => (
                      <SOSCard
                        key={sos._id}
                        sos={sos}
                        selected={selected}
                        setSelected={setSelected}
                        acceptSOS={acceptSOS}
                        updateStatus={updateStatus}
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
              className="dash-legend-ngo"
              title="NGO base"
            />
            <span>NGO base (responder)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SOSCard({ sos, selected, setSelected, acceptSOS, updateStatus, locked }) {
  const isSelected = selected?._id === sos._id;

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
      className={`sos-card-ui${locked ? ' is-locked' : ''}`}
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

      {locked && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>
          🔒 Resolve higher priority victims first
        </div>
      )}

      {isSelected && !locked && (
        <div className="sos-card-actions">
          {sos.status === 'pending' && (
            <button
              type="button"
              className="btn btn-xs btn-success"
              onClick={(e) => {
                e.stopPropagation();
                acceptSOS(sos._id);
              }}
            >
              Accept
            </button>
          )}
          {sos.status === 'assigned' && (
            <button
              type="button"
              className="btn btn-xs btn-violet"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus(sos._id, 'in-progress');
              }}
            >
              In progress
            </button>
          )}
          {sos.status === 'in-progress' && (
            <button
              type="button"
              className="btn btn-xs btn-cyan"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus(sos._id, 'resolved');
              }}
            >
              Resolved
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
            Close
          </button>
        </div>
      )}
    </div>
  );
}