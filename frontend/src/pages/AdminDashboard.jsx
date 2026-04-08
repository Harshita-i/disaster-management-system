// src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sosList, setSosList]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);

  const [alertForm, setAlertForm] = useState({
    type: 'flood', region: '', message: '',
    severity: 'moderate', lat: '', lng: '', radius: ''
  });

  useEffect(() => {
    fetchAll();
    socket.on('new-sos', (sos) => setSosList(prev => [sos, ...prev]));
    return () => socket.off('new-sos');
  }, []);

  const fetchAll = async () => {
    try {
      const [sosRes, userRes, alertRes] = await Promise.all([
        api.get('/sos'),
        api.get('/users'),
        api.get('/alerts')
      ]);
      console.log('SOS:', sosRes.data);
      console.log('Users:', userRes.data);
      console.log('Alerts:', alertRes.data);
      setSosList(sosRes.data);
      setUsers(userRes.data);
      setAlerts(alertRes.data);
    } catch (err) {
      console.error('Fetch failed:', err.response?.data || err.message);
    }
    setLoading(false);
  };

  // ── USER ACTIONS ──────────────────────────────────────
  const approveNGO = async (userId) => {
    try {
      await api.patch(`/users/${userId}/approve`);
      setUsers(prev =>
        prev.map(u => u._id === userId ? { ...u, approved: true } : u)
      );
    } catch (err) { alert('Failed to approve'); }
  };

  const blockUser = async (userId) => {
    try {
      await api.patch(`/users/${userId}/block`);
      setUsers(prev =>
        prev.map(u => u._id === userId ? { ...u, blocked: true } : u)
      );
    } catch (err) { alert('Failed to block'); }
  };

  // ── ALERT ACTIONS ─────────────────────────────────────
  const createAlert = async () => {
    if (!alertForm.region || !alertForm.message) {
      alert('Please fill region and message'); return;
    }
    try {
      const payload = {
        type:     alertForm.type,
        severity: alertForm.severity,
        region:   alertForm.region,
        message:  alertForm.message,
        radius:   alertForm.radius ? parseInt(alertForm.radius) : 5000,
        ...(alertForm.lat && alertForm.lng && {
          location: {
            lat: parseFloat(alertForm.lat),
            lng: parseFloat(alertForm.lng)
          }
        })
      };
      const res = await api.post('/alerts', payload);
      setAlerts(prev => [res.data.alert, ...prev]);
      setAlertForm({
        type: 'flood', region: '', message: '',
        severity: 'moderate', lat: '', lng: '', radius: ''
      });
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert('Failed to create alert');
    }
  };

  const deleteAlert = async (alertId) => {
    try {
      await api.delete(`/alerts/${alertId}`);
      setAlerts(prev => prev.filter(a => a._id !== alertId));
    } catch (err) { alert('Failed to delete'); }
  };

  // ── ANALYTICS DATA ────────────────────────────────────
  const sosPerDay = getLast7Days().map(date => ({
    date,
    count: sosList.filter(s =>
      new Date(s.createdAt).toLocaleDateString() === date
    ).length
  }));

  const priorityData = [
    { name: 'Critical', value: sosList.filter(s => s.priority === 'red').length,    color: '#ef4444' },
    { name: 'Moderate', value: sosList.filter(s => s.priority === 'yellow').length, color: '#f59e0b' },
    { name: 'Safe',     value: sosList.filter(s => s.priority === 'green').length,  color: '#10b981' }
  ];

  const statusData = [
    { name: 'Pending',     count: sosList.filter(s => s.status === 'pending').length },
    { name: 'Assigned',    count: sosList.filter(s => s.status === 'assigned').length },
    { name: 'In Progress', count: sosList.filter(s => s.status === 'in-progress').length },
    { name: 'Resolved',    count: sosList.filter(s => s.status === 'resolved').length }
  ];

  const kpis = [
    { label: 'Total Users',  value: users.length,                                        color: '#3b82f6' },
    { label: 'Active SOS',   value: sosList.filter(s => s.status !== 'resolved').length, color: '#ef4444' },
    { label: 'NGOs',         value: users.filter(u => u.role === 'ngo').length,          color: '#8b5cf6' },
    { label: 'Alerts Sent',  value: alerts.length,                                       color: '#f59e0b' },
    { label: 'Resolved',     value: sosList.filter(s => s.status === 'resolved').length, color: '#10b981' },
    { label: 'Pending NGOs', value: users.filter(u => u.role === 'ngo' && !u.approved).length, color: '#ec4899' }
  ];

  const tabs = ['overview', 'users', 'alerts', 'analytics'];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'sans-serif', color: '#f1f5f9' }}>

      {/* ── TOP BAR ─────────────────────────────────── */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '12px 24px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🛠️ Admin Control Center</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: 14 }}>{user?.name}</span>
          <button onClick={logout} style={btn('#334155')}>Logout</button>
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────── */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '0 24px', display: 'flex', gap: 4
      }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '12px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === tab ? '#3b82f6' : '#64748b',
            cursor: 'pointer', fontSize: 14,
            textTransform: 'capitalize',
            fontWeight: activeTab === tab ? 600 : 400
          }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>

        {/* ── OVERVIEW TAB ────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12, marginBottom: 24
            }}>
              {kpis.map(k => (
                <div key={k.label} style={{
                  background: '#1e293b', border: `1px solid ${k.color}33`,
                  borderRadius: 12, padding: 20, textAlign: 'center'
                }}>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{k.label}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 700, color: k.color }}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            <div style={{
              background: '#1e293b', borderRadius: 12,
              border: '1px solid #334155', padding: 20
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Recent SOS Requests</h3>
              {loading ? (
                <p style={{ color: '#64748b' }}>Loading...</p>
              ) : sosList.length === 0 ? (
                <p style={{ color: '#64748b' }}>No SOS requests yet</p>
              ) : (
                sosList.slice(0, 5).map(sos => (
                  <div key={sos._id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 0',
                    borderBottom: '1px solid #334155'
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{sos.name}</span>
                      <span style={{ color: '#64748b', fontSize: 13, marginLeft: 12 }}>
                        {new Date(sos.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Badge color={priorityColor(sos.priority)} text={sos.priority} />
                      <Badge color={statusColor(sos.status)}     text={sos.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── USERS TAB ───────────────────────────── */}
        {activeTab === 'users' && (
          <div style={{
            background: '#1e293b', borderRadius: 12,
            border: '1px solid #334155', overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>👥 User Management</h3>
            </div>
            {loading ? (
              <p style={{ color: '#64748b', padding: 20 }}>Loading...</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: 12, color: '#64748b', fontWeight: 600
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={td}>{u.name}</td>
                      <td style={{ ...td, color: '#64748b' }}>{u.email}</td>
                      <td style={td}>
                        <Badge
                          color={u.role === 'admin' ? '#8b5cf6' : u.role === 'ngo' ? '#3b82f6' : '#10b981'}
                          text={u.role}
                        />
                      </td>
                      <td style={td}>
                        {u.blocked
                          ? <Badge color="#ef4444" text="Blocked" />
                          : u.role === 'ngo' && !u.approved
                            ? <Badge color="#f59e0b" text="Pending" />
                            : <Badge color="#10b981" text="Active" />
                        }
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {u.role === 'ngo' && !u.approved && !u.blocked && (
                            <button onClick={() => approveNGO(u._id)} style={btn('#16a34a')}>
                              Approve
                            </button>
                          )}
                          {!u.blocked && u.role !== 'admin' && (
                            <button onClick={() => blockUser(u._id)} style={btn('#dc2626')}>
                              Block
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── ALERTS TAB ──────────────────────────── */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Create Alert */}
            <div style={{
              background: '#1e293b', borderRadius: 12,
              border: '1px solid #334155', padding: 20
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>⚠️ Create Alert</h3>

              <select
                value={alertForm.type}
                onChange={e => setAlertForm({ ...alertForm, type: e.target.value })}
                style={input}
              >
                {['flood','earthquake','cyclone','fire','tsunami','landslide'].map(t => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={alertForm.severity}
                onChange={e => setAlertForm({ ...alertForm, severity: e.target.value })}
                style={input}
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>

              <input
                placeholder="Affected region (e.g. Hyderabad, Telangana)"
                value={alertForm.region}
                onChange={e => setAlertForm({ ...alertForm, region: e.target.value })}
                style={input}
              />

              <textarea
                placeholder="Alert message / evacuation instructions..."
                value={alertForm.message}
                onChange={e => setAlertForm({ ...alertForm, message: e.target.value })}
                rows={3}
                style={{ ...input, resize: 'vertical' }}
              />

              {/* Danger zone coordinates */}
              <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px' }}>
                📍 Danger zone on map (optional)
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  placeholder="Latitude (e.g. 17.3850)"
                  value={alertForm.lat}
                  onChange={e => setAlertForm({ ...alertForm, lat: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}
                  type="number"
                  step="any"
                />
                <input
                  placeholder="Longitude (e.g. 78.4867)"
                  value={alertForm.lng}
                  onChange={e => setAlertForm({ ...alertForm, lng: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}
                  type="number"
                  step="any"
                />
              </div>

              <input
                placeholder="Danger zone radius in meters (e.g. 10000)"
                value={alertForm.radius}
                onChange={e => setAlertForm({ ...alertForm, radius: e.target.value })}
                style={{ ...input, marginTop: 8 }}
                type="number"
              />

              <button onClick={createAlert} style={{
                ...btn('#dc2626'),
                width: '100%',
                padding: '12px',
                fontSize: 14,
                marginTop: 4
              }}>
                🔔 Broadcast Alert
              </button>
            </div>

            {/* Alert List */}
            <div style={{
              background: '#1e293b', borderRadius: 12,
              border: '1px solid #334155', padding: 20,
              maxHeight: 600, overflowY: 'auto'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📋 Active Alerts</h3>
              {alerts.length === 0
                ? <p style={{ color: '#64748b' }}>No alerts yet</p>
                : alerts.map(a => (
                  <div key={a._id} style={{
                    background: '#0f172a', borderRadius: 8,
                    padding: 12, marginBottom: 10,
                    border: '1px solid #334155'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {a.type === 'flood' ? '🌊' :
                         a.type === 'earthquake' ? '🌍' :
                         a.type === 'cyclone' ? '🌀' :
                         a.type === 'fire' ? '🔥' :
                         a.type === 'tsunami' ? '🌊' : '⚠️'} {a.type} — {a.region}
                      </span>
                      <Badge
                        color={
                          a.severity === 'critical' ? '#ef4444' :
                          a.severity === 'high'     ? '#f59e0b' : '#3b82f6'
                        }
                        text={a.severity}
                      />
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 8px' }}>
                      {a.message}
                    </p>
                    {a.location?.lat && (
                      <p style={{ color: '#475569', fontSize: 11, margin: '0 0 6px' }}>
                        📍 {a.location.lat}, {a.location.lng} — radius: {a.radius}m
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#475569', fontSize: 11 }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                      <button onClick={() => deleteAlert(a._id)} style={btn('#7f1d1d')}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ───────────────────────── */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📈 SOS Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sosPerDay}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📊 SOS by Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>🔴 Priority Breakdown</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%" cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {priorityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>👥 User Roles</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: 'Victims', count: users.filter(u => u.role === 'victim').length },
                  { name: 'NGOs',    count: users.filter(u => u.role === 'ngo').length },
                  { name: 'Admins',  count: users.filter(u => u.role === 'admin').length }
                ]}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HELPERS ───────────────────────────────────────────────
function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString();
  });
}

function priorityColor(p) {
  return p === 'red' ? '#ef4444' : p === 'yellow' ? '#f59e0b' : '#10b981';
}

function statusColor(s) {
  return s === 'pending' ? '#f59e0b' : s === 'assigned' ? '#3b82f6' :
         s === 'in-progress' ? '#8b5cf6' : '#10b981';
}

function Badge({ color, text }) {
  return (
    <span style={{
      background: color + '22', color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize'
    }}>
      {text}
    </span>
  );
}

const btn = (bg) => ({
  padding: '6px 14px', background: bg, color: 'white',
  border: 'none', borderRadius: 6, fontSize: 12,
  cursor: 'pointer', fontWeight: 500
});

const td = {
  padding: '12px 16px', fontSize: 14,
  background: '#0f172a', color: '#f1f5f9'
};

const input = {
  width: '100%', padding: '10px 12px', marginBottom: 12,
  background: '#0f172a', border: '1px solid #334155',
  borderRadius: 8, color: '#f1f5f9', fontSize: 14,
  boxSizing: 'border-box'
};

const chartCard = {
  background: '#1e293b', borderRadius: 12,
  border: '1px solid #334155', padding: 20
};