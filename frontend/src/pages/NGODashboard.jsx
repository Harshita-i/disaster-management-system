// src/pages/NGODashboard.jsx
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import 'leaflet/dist/leaflet.css';

const PRIORITY_COLORS = {
  red:    '#ef4444',
  yellow: '#f59e0b',
  green:  '#10b981'
};

const STATUS_LABELS = {
  pending:      { label: 'Pending',     color: '#f59e0b' },
  assigned:     { label: 'Assigned',    color: '#3b82f6' },
  'in-progress':{ label: 'In Progress', color: '#8b5cf6' },
  resolved:     { label: 'Resolved',    color: '#10b981' }
};

export default function NGODashboard() {
  const { user, logout } = useAuth();
  const [sosList, setSosList]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  // Fetch all SOS on load
  useEffect(() => {
    fetchSOS();

    // Real-time: new SOS comes in
    socket.on('new-sos', (sos) => {
      setSosList(prev => [sos, ...prev]);
    });

    // Real-time: SOS assigned by someone else — remove from pending
    socket.on('sos-assigned', ({ sosId }) => {
      setSosList(prev =>
        prev.map(s => s._id === sosId ? { ...s, status: 'assigned' } : s)
      );
    });

    return () => {
      socket.off('new-sos');
      socket.off('sos-assigned');
    };
  }, []);

  const fetchSOS = async () => {
    try {
      const res = await api.get('/sos');
      setSosList(res.data);
    } catch (err) {
      console.error('Failed to fetch SOS:', err);
    }
    setLoading(false);
  };

  const acceptSOS = async (sosId) => {
    try {
      await api.post(`/sos/${sosId}/assign`);
      setSosList(prev =>
        prev.map(s => s._id === sosId
          ? { ...s, status: 'assigned', assignedTo: user.id }
          : s
        )
      );
      setSelected(null);
    } catch (err) {
      alert('Failed to assign. Try again.');
    }
  };

  const updateStatus = async (sosId, status) => {
    try {
      await api.post(`/sos/${sosId}/status`, { status });
      setSosList(prev =>
        prev.map(s => s._id === sosId ? { ...s, status } : s)
      );
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const filtered = filter === 'all'
    ? sosList
    : sosList.filter(s => s.priority === filter || s.status === filter);

  const counts = {
    total:    sosList.length,
    pending:  sosList.filter(s => s.status === 'pending').length,
    red:      sosList.filter(s => s.priority === 'red').length,
    resolved: sosList.filter(s => s.status === 'resolved').length
  };

  // Default map center — India
  const mapCenter = [20.5937, 78.9629];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      fontFamily: 'sans-serif',
      color: '#f1f5f9'
    }}>

      {/* ── TOP BAR ───────────────────────────────────── */}
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

      {/* ── KPI CARDS ─────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '16px 24px'
      }}>
        {[
          { label: 'Total SOS',   value: counts.total,    color: '#3b82f6' },
          { label: 'Pending',     value: counts.pending,  color: '#f59e0b' },
          { label: 'Critical',    value: counts.red,      color: '#ef4444' },
          { label: 'Resolved',    value: counts.resolved, color: '#10b981' }
        ].map(card => (
          <div key={card.label} style={{
            background: '#1e293b',
            border: `1px solid ${card.color}33`,
            borderRadius: 12,
            padding: '16px',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>{card.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: card.color }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 16,
        padding: '0 24px 24px'
      }}>

        {/* ── MAP ───────────────────────────────────── */}
        <div style={{
          background: '#1e293b',
          borderRadius: 12,
          border: '1px solid #334155',
          overflow: 'hidden',
          height: 520
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>🗺️ Live Rescue Map</h3>
          </div>

          <MapContainer
            center={mapCenter}
            zoom={5}
            style={{ height: '470px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />

            {sosList.map(sos => (
              sos.location?.lat && sos.location?.lng && (
                <CircleMarker
                  key={sos._id}
                  center={[sos.location.lat, sos.location.lng]}
                  radius={12}
                  fillColor={PRIORITY_COLORS[sos.priority]}
                  color={PRIORITY_COLORS[sos.priority]}
                  fillOpacity={0.8}
                  eventHandlers={{
                    click: () => setSelected(sos)
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>{sos.name}</strong><br />
                      Priority: <span style={{ color: PRIORITY_COLORS[sos.priority], fontWeight: 600 }}>
                        {sos.priority?.toUpperCase()}
                      </span><br />
                      Status: {sos.status}<br />
                      {sos.message && <span>Note: {sos.message}</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            ))}
          </MapContainer>
        </div>

        {/* ── SOS LIST ──────────────────────────────── */}
        <div style={{
          background: '#1e293b',
          borderRadius: 12,
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          height: 520
        }}>
          {/* List header + filter */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🚨 SOS Requests</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'pending', 'red', 'yellow', 'assigned'].map(f => (
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

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
            {loading ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Loading...</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>No SOS requests</p>
            ) : (
              filtered.map(sos => (
                <div
                  key={sos._id}
                  onClick={() => setSelected(selected?._id === sos._id ? null : sos)}
                  style={{
                    background: selected?._id === sos._id ? '#0f172a' : '#0f172a55',
                    border: `1px solid ${selected?._id === sos._id
                      ? PRIORITY_COLORS[sos.priority]
                      : '#334155'}`,
                    borderRadius: 10,
                    padding: '12px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {/* Row 1 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{sos.name}</span>
                    <span style={{
                      background: PRIORITY_COLORS[sos.priority] + '22',
                      color: PRIORITY_COLORS[sos.priority],
                      padding: '2px 8px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {sos.priority}
                    </span>
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: 12 }}>
                      📍 {sos.location?.lat?.toFixed(4)}, {sos.location?.lng?.toFixed(4)}
                    </span>
                    <span style={{
                      color: STATUS_LABELS[sos.status]?.color,
                      fontSize: 11
                    }}>
                      {STATUS_LABELS[sos.status]?.label}
                    </span>
                  </div>

                  {/* Actions — show when selected */}
                  {selected?._id === sos._id && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {sos.status === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); acceptSOS(sos._id); }}
                          style={btnStyle('#16a34a')}
                        >
                          ✅ Accept
                        </button>
                      )}
                      {sos.status === 'assigned' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateStatus(sos._id, 'in-progress'); }}
                          style={btnStyle('#7c3aed')}
                        >
                          🔄 In Progress
                        </button>
                      )}
                      {sos.status === 'in-progress' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateStatus(sos._id, 'resolved'); }}
                          style={btnStyle('#0891b2')}
                        >
                          ✔ Mark Resolved
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(null); }}
                        style={btnStyle('#475569')}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── MAP LEGEND ────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 20,
        padding: '0 24px 24px',
        alignItems: 'center'
      }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>Map legend:</span>
        {Object.entries(PRIORITY_COLORS).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12,
              borderRadius: '50%',
              background: color
            }}/>
            <span style={{ color: '#94a3b8', fontSize: 13, textTransform: 'capitalize' }}>
              {key}
            </span>
          </div>
        ))}
      </div>
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