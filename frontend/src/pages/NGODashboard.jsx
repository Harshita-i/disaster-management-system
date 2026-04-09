import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
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

export default function NGODashboard() {
  const { user, logout } = useAuth();
  const [sosList, setSosList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    fetchSOS();
    fetchAlerts();

    socket.on('new-sos', (sos) => {
      setSosList((prev) => upsertSOS(prev, sos));
    });

    socket.on('sos-updated', ({ sos }) => {
      if (!sos) return;
      setSosList((prev) => upsertSOS(prev, sos));
    });

    socket.on('sos-assigned', ({ sosId }) => {
      setSosList((prev) =>
        prev.map((s) => (s._id === sosId ? { ...s, status: 'assigned' } : s))
      );
    });

    socket.on('sos-status-updated', ({ sosId, status }) => {
      setSosList((prev) =>
        prev.map((s) => (s._id === sosId ? { ...s, status } : s))
      );
    });

    socket.on('new-alert', (alert) => {
  setAlerts((prev) => {
    const exists = prev.some(a => String(a._id) === String(alert._id));
    if (exists) return prev;
    return [alert, ...prev];
  });
});

    return () => {
      socket.off('new-sos');
      socket.off('sos-updated');
      socket.off('sos-assigned');
      socket.off('sos-status-updated');
      socket.off('new-alert');
    };
  }, []);

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
    setAlerts(res.data); // always full list from DB
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
  }
};

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

  const mapCenter = [20.5937, 78.9629];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      fontFamily: 'sans-serif',
      color: '#f1f5f9'
    }}>
      <div style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🚑 NGO Rescue Dashboard</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: 14 }}>{user?.name}</span>
          <button onClick={logout} style={btnStyle('#334155')}>Logout</button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '16px 24px'
      }}>
        {[
          { label: 'Total SOS', value: counts.total, color: '#3b82f6' },
          { label: 'Pending', value: counts.pending, color: '#f59e0b' },
          { label: 'Critical', value: counts.red, color: '#ef4444' },
          { label: 'Resolved', value: counts.resolved, color: '#10b981' }
        ].map(card => (
          <div key={card.label} style={{
            background: '#1e293b',
            border: `1px solid ${card.color}33`,
            borderRadius: 12,
            padding: 16,
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>{card.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: card.color }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: 16,
        padding: '0 24px 24px'
      }}>
        <div style={{
          background: '#1e293b',
          borderRadius: 12,
          border: '1px solid #334155',
          overflow: 'hidden',
          height: 560
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>🗺️ Live Rescue Map</h3>
          </div>
          <MapContainer
            center={mapCenter}
            zoom={5}
            style={{ height: '510px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />

            {alerts.map(alert =>
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
                      <strong>⚠️ Danger Zone</strong><br />
                      Type: <b>{alert.type}</b><br />
                      Severity: <b>{alert.severity}</b><br />
                      Region: {alert.region}<br />
                      <span style={{ fontSize: 12 }}>{alert.message}</span>
                    </div>
                  </Popup>
                </Circle>
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

        <div style={{
          background: '#1e293b',
          borderRadius: 12,
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          height: 560
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🚨 SOS Requests</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'pending', 'red', 'yellow', 'green', 'assigned'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: 'none',
                    fontSize: 11,
                    cursor: 'pointer',
                    background: filter === f ? '#3b82f6' : '#334155',
                    color: 'white',
                    textTransform: 'capitalize'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
            {assignError && (
              <div style={{
                background: '#7f1d1d',
                border: '1px solid #ef4444',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 8,
                fontSize: 12,
                color: '#fca5a5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <span>⚠️ {assignError}</span>
                <button
                  onClick={() => setAssignError('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    marginLeft: 8
                  }}
                >✕</button>
              </div>
            )}

            {loading ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                Loading...
              </p>
            ) : sosList.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                No SOS requests yet
              </p>
            ) : filter !== 'all' ? (
              filtered.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
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

      <div style={{
        display: 'flex',
        gap: 20,
        padding: '0 24px 24px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>Map legend:</span>
        {Object.entries(PRIORITY_COLORS).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <span style={{ color: '#94a3b8', fontSize: 13, textTransform: 'capitalize' }}>
              {key} priority
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: '#ef444422', border: '2px dashed #ef4444'
          }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Danger zone</span>
        </div>
      </div>
    </div>
  );
}

function SOSCard({ sos, selected, setSelected, acceptSOS, updateStatus, locked }) {
  const isSelected = selected?._id === sos._id;

  return (
    <div
      onClick={() => !locked && setSelected(isSelected ? null : sos)}
      style={{
        background: isSelected ? '#0f172a' : '#0f172a55',
        border: `1px solid ${isSelected ? PRIORITY_COLORS[sos.priority] : '#334155'}`,
        borderLeft: `3px solid ${PRIORITY_COLORS[sos.priority]}`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.5 : 1,
        transition: 'all 0.15s'
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
        <div style={{
          marginTop: 10,
          display: 'flex', gap: 6, flexWrap: 'wrap',
          borderTop: '1px solid #334155',
          paddingTop: 10
        }}>
          {sos.status === 'pending' && (
            <button
              onClick={e => { e.stopPropagation(); acceptSOS(sos._id); }}
              style={btnStyle('#16a34a')}
            >
              ✅ Accept & Assign
            </button>
          )}
          {sos.status === 'assigned' && (
            <button
              onClick={e => { e.stopPropagation(); updateStatus(sos._id, 'in-progress'); }}
              style={btnStyle('#7c3aed')}
            >
              🔄 In Progress
            </button>
          )}
          {sos.status === 'in-progress' && (
            <button
              onClick={e => { e.stopPropagation(); updateStatus(sos._id, 'resolved'); }}
              style={btnStyle('#0891b2')}
            >
              ✔ Mark Resolved
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); }}
            style={btnStyle('#475569')}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg) => ({
  padding: '6px 12px',
  background: bg,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 500
});