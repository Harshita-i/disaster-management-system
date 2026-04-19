// src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { useTranslatedAlerts } from '../hooks/useTranslatedAlerts';

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sosList, setSosList]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const translatedAlerts = useTranslatedAlerts(alerts, i18n.language);
  const [loading, setLoading]     = useState(true);

  const [alertForm, setAlertForm] = useState({
    type: 'flood', region: '', message: '',
    severity: 'moderate', lat: '', lng: '', radius: ''
  });

  useEffect(() => {
    fetchAll();
    socket.on('new-sos', (sos) => setSosList((prev) => [sos, ...prev]));
    socket.on('sos-list-updated', (updatedList) => {
      if (Array.isArray(updatedList)) setSosList(updatedList);
    });
    socket.on('sos-updated', ({ sos }) => {
      if (!sos?._id) return;
      setSosList((prev) => {
        const i = prev.findIndex((s) => String(s._id) === String(sos._id));
        if (i === -1) return [sos, ...prev];
        const next = [...prev];
        next[i] = sos;
        return next;
      });
    });
    socket.on('sos-reassignment-timeout', () => fetchAll());
    socket.on('user-deleted', () => fetchAll());
    return () => {
      socket.off('new-sos');
      socket.off('sos-list-updated');
      socket.off('sos-updated');
      socket.off('sos-reassignment-timeout');
      socket.off('user-deleted');
    };
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

  const deleteUser = async (userId) => {
    if (!window.confirm('Delete this user permanently? SOS records will also be cleared.')) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete user';
      alert(msg);
    }
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
    <div className="app-dashboard">
      <header className="dash-header">
        <h2>🛠️ {t('dashboard.adminTitle')}</h2>
        <div className="dash-header-actions">
          <ThemeToggle />
          <LanguageSwitcher compact />
          {user?.name && <span className="user-pill">{user.name}</span>}
          <button type="button" className="btn btn-ghost btn-xs" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`admin-tab${activeTab === tab ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="dash-main">

        {/* ── OVERVIEW TAB ────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            <div className="dash-stat-grid" style={{ marginBottom: '1.5rem' }}>
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="stat-card"
                  style={{ '--card-accent': k.color, textAlign: 'center' }}
                >
                  <p className="stat-card-label">{k.label}</p>
                  <p className="stat-card-value">{k.value}</p>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Recent SOS Requests</h3>
              {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
              ) : sosList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No SOS requests yet</p>
              ) : (
                sosList.slice(0, 5).map(sos => (
                  <div key={sos._id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 0',
                    borderBottom: '1px solid var(--border-strong)'
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{sos.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 12 }}>
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
          <div className="data-table-wrap">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>👥 User Management</h3>
            </div>
            {loading ? (
              <p className="empty-hint" style={{ padding: '1.25rem' }}>Loading…</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>{u.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                      <td>
                        <Badge
                          color={u.role === 'admin' ? '#8b5cf6' : u.role === 'ngo' ? '#3b82f6' : '#10b981'}
                          text={u.role}
                        />
                      </td>
                      <td>
                        {u.blocked
                          ? <Badge color="#ef4444" text="Blocked" />
                          : u.role === 'ngo' && !u.approved
                            ? <Badge color="#f59e0b" text="Pending" />
                            : <Badge color="#10b981" text="Active" />
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {u.role === 'ngo' && !u.approved && !u.blocked && (
                            <button type="button" className="btn btn-xs btn-success" onClick={() => approveNGO(u._id)}>
                              Approve
                            </button>
                          )}
                          {!u.blocked && u.role !== 'admin' && (
                            <button type="button" className="btn btn-xs btn-danger" onClick={() => blockUser(u._id)}>
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
          <div className="chart-grid">
            <div className="chart-card">
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>⚠️ Create Alert</h3>

              <select
                className="form-control"
                value={alertForm.type}
                onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })}
              >
                {['flood', 'earthquake', 'cyclone', 'fire', 'tsunami', 'landslide'].map((ty) => (
                  <option key={ty} value={ty}>
                    {ty.charAt(0).toUpperCase() + ty.slice(1)}
                  </option>
                ))}
              </select>

              <select
                className="form-control"
                value={alertForm.severity}
                onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>

              <input
                className="form-control"
                placeholder="Affected region (e.g. Hyderabad, Telangana)"
                value={alertForm.region}
                onChange={(e) => setAlertForm({ ...alertForm, region: e.target.value })}
              />

              <textarea
                className="form-control"
                placeholder="Alert message / evacuation instructions..."
                value={alertForm.message}
                onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                rows={3}
              />

              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                📍 Danger zone on map (optional)
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  className="form-control"
                  style={{ marginBottom: 0 }}
                  placeholder="Latitude (e.g. 17.3850)"
                  value={alertForm.lat}
                  onChange={(e) => setAlertForm({ ...alertForm, lat: e.target.value })}
                  type="number"
                  step="any"
                />
                <input
                  className="form-control"
                  style={{ marginBottom: 0 }}
                  placeholder="Longitude (e.g. 78.4867)"
                  value={alertForm.lng}
                  onChange={(e) => setAlertForm({ ...alertForm, lng: e.target.value })}
                  type="number"
                  step="any"
                />
              </div>

              <input
                className="form-control"
                style={{ marginTop: '0.5rem' }}
                placeholder="Danger zone radius in meters (e.g. 10000)"
                value={alertForm.radius}
                onChange={(e) => setAlertForm({ ...alertForm, radius: e.target.value })}
                type="number"
              />

              <button type="button" className="btn btn-danger" style={{ width: '100%', marginTop: '0.35rem', padding: '0.65rem' }} onClick={createAlert}>
                Broadcast Alert
              </button>
            </div>

            {/* Alert List */}
            <div style={{
              background: 'var(--surface-elevated)', borderRadius: 12,
              border: '1px solid var(--border-strong)', padding: 20,
              maxHeight: 600, overflowY: 'auto'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📋 Active Alerts</h3>
              {alerts.length === 0
                ? <p style={{ color: 'var(--text-muted)' }}>No alerts yet</p>
                : translatedAlerts.map(a => (
                  <div key={a._id} style={{
                    background: 'var(--surface)', borderRadius: 8,
                    padding: 12, marginBottom: 10,
                    border: '1px solid var(--border-strong)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {a.type === 'flood' ? '🌊' :
                         a.type === 'earthquake' ? '🌍' :
                         a.type === 'cyclone' ? '🌀' :
                         a.type === 'fire' ? '🔥' :
                         a.type === 'tsunami' ? '🌊' : '⚠️'} {a._tr?.type ?? a.type} — {a._tr?.region ?? a.region}
                      </span>
                      <Badge
                        color={
                          a.severity === 'critical' ? '#ef4444' :
                          a.severity === 'high'     ? '#f59e0b' : '#3b82f6'
                        }
                        text={a._tr?.severity ?? a.severity}
                      />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 8px' }}>
                      {a._tr?.message ?? a.message}
                    </p>
                    {a.location?.lat && (
                      <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 6px' }}>
                        📍 {a.location.lat}, {a.location.lng} — radius: {a.radius}m
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                      <button type="button" className="btn btn-xs btn-danger" onClick={() => deleteAlert(a._id)}>
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
          <div className="chart-grid">
            <div className="chart-card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📈 SOS Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sosPerDay}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📊 SOS by Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
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
                  <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>👥 User Roles</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: 'Victims', count: users.filter(u => u.role === 'victim').length },
                  { name: 'NGOs',    count: users.filter(u => u.role === 'ngo').length },
                  { name: 'Admins',  count: users.filter(u => u.role === 'admin').length }
                ]}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
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
