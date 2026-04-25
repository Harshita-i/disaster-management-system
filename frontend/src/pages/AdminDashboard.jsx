// // src/pages/AdminDashboard.jsx
// import { useState, useEffect } from 'react';
// import { useTranslation } from 'react-i18next';
// import {
//   LineChart, Line, BarChart, Bar,
//   XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
// } from 'recharts';
// import { useAuth } from '../context/AuthContext';
// import api from '../utils/api';
// import socket from '../utils/socket';
// import LanguageSwitcher from '../components/LanguageSwitcher';
// import ThemeToggle from '../components/ThemeToggle';
// import { useTranslatedAlerts } from '../hooks/useTranslatedAlerts';

// export default function AdminDashboard() {
//   const { t, i18n } = useTranslation();
//   const { user, logout } = useAuth();

//   const [activeTab, setActiveTab] = useState('overview');

//   const [sosList, setSosList] = useState([]);
//   const [users, setUsers] = useState([]);
//   const [alerts, setAlerts] = useState([]);
//   const [floodPredictions, setFloodPredictions] = useState([]);
//   const translatedAlerts = useTranslatedAlerts(alerts, i18n.language);
//   const [earthquakePredictions, setEarthquakePredictions] = useState([]);
//   const [loading, setLoading] = useState(true);


//   const [alertForm, setAlertForm] = useState({
//     type: 'earthquake',
//     region: '',
//     message: '',
//     severity: 'moderate',
//     lat: '',
//     lng: '',
//     radius: ''
//   });

//   useEffect(() => {
//     fetchAll();
// <<<<<<< HEAD
//     socket.on('new-sos', (sos) => setSosList((prev) => [sos, ...prev]));
//     socket.on('sos-list-updated', (updatedList) => {
//       if (Array.isArray(updatedList)) setSosList(updatedList);
//     });
//     socket.on('sos-updated', ({ sos }) => {
//       if (!sos?._id) return;
//       setSosList((prev) => {
//         const i = prev.findIndex((s) => String(s._id) === String(sos._id));
//         if (i === -1) return [sos, ...prev];
//         const next = [...prev];
//         next[i] = sos;
//         return next;
//       });
//     });
//     socket.on('sos-reassignment-timeout', () => fetchAll());
//     socket.on('user-deleted', () => fetchAll());
//     return () => {
//       socket.off('new-sos');
//       socket.off('sos-list-updated');
//       socket.off('sos-updated');
//       socket.off('sos-reassignment-timeout');
//       socket.off('user-deleted');
// =======
//     fetchPredictions();

//     socket.on('new-sos', (sos) => {
//       setSosList((prev) => [sos, ...prev]);
//     });

//     socket.on('new-alert', (alert) => {
//       setAlerts((prev) =>
//         prev.some((item) => String(item._id) === String(alert._id))
//           ? prev
//           : [alert, ...prev]
//       );
//     });

//     return () => {
//       socket.off('new-sos');
//       socket.off('new-alert');
// >>>>>>> main
//     };
//   }, []);

//   const fetchAll = async () => {
//     try {
//       const sosRes = await api.get('/sos');
//       const userRes = await api.get('/users');
//       const alertRes = await api.get('/alerts');

//       setSosList(sosRes.data || []);
//       setUsers(userRes.data || []);
//       setAlerts(alertRes.data || []);
//     } catch (err) {
//       console.error('FETCH ERROR:', err.response?.data || err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /*const fetchPredictions = async () => {
//     try {
//       setFloodPredictions([]);

//       const eqRes = await fetch('https://YOUR_SERVER_HOST/predictions');
//       const eqData = await eqRes.json();

//       setEarthquakePredictions(eqData.predictions || []);
//     } catch (err) {
//       console.error('Prediction fetch failed:', err);
//     }
//   }; */

//   const fetchPredictions = async () => {
//   try {
//     const floodRes = await fetch('https://YOUR_SERVER_HOST/predictions');
//     const floodData = await floodRes.json();
//     setFloodPredictions(floodData.predictions || floodData || []);

//     const eqRes = await fetch('https://YOUR_SERVER_HOST/predictions');
//     const eqData = await eqRes.json();
//     setEarthquakePredictions(eqData.predictions || eqData || []);
//   } catch (err) {
//     console.error('Prediction fetch failed:', err);
//   }
// };

//   const approveNGO = async (userId) => {
//     try {
//       await api.patch(`/users/${userId}/approve`);
//       setUsers((prev) =>
//         prev.map((u) => (u._id === userId ? { ...u, approved: true } : u))
//       );
//     } catch (err) {
//       alert('Failed to approve');
//     }
//   };

//   const blockUser = async (userId) => {
//     try {
//       await api.patch(`/users/${userId}/block`);
//       setUsers((prev) =>
//         prev.map((u) => (u._id === userId ? { ...u, blocked: true } : u))
//       );
//     } catch (err) {
//       alert('Failed to block');
//     }
//   };

// <<<<<<< HEAD
//   const deleteUser = async (userId) => {
//     if (!window.confirm('Delete this user permanently? SOS records will also be cleared.')) return;
//     try {
//       await api.delete(`/users/${userId}`);
//       setUsers(prev => prev.filter(u => u._id !== userId));
//     } catch (err) {
//       const msg = err.response?.data?.message || err.message || 'Failed to delete user';
//       alert(msg);
//     }
//   };

//   // ── ALERT ACTIONS ─────────────────────────────────────
// =======
// >>>>>>> main
//   const createAlert = async () => {
//     if (!alertForm.region || !alertForm.message) {
//       alert('Please fill region and message');
//       return;
//     }

//     try {
//       const payload = {
//         type: alertForm.type,
//         severity: alertForm.severity,
//         region: alertForm.region,
//         message: alertForm.message,
//         radius: alertForm.radius ? parseInt(alertForm.radius) : 100000,
//         ...(alertForm.lat && alertForm.lng && {
//           location: {
//             lat: parseFloat(alertForm.lat),
//             lng: parseFloat(alertForm.lng)
//           }
//         })
//       };

//       const res = await api.post('/alerts', payload);
//       setAlerts((prev) => [res.data.alert, ...prev]);

//       setAlertForm({
//         type: 'earthquake',
//         region: '',
//         message: '',
//         severity: 'moderate',
//         lat: '',
//         lng: '',
//         radius: ''
//       });

//       setActiveTab('alerts');
//     } catch (err) {
//       console.error(err.response?.data || err.message);
//       alert('Failed to create alert');
//     }
//   };

//   const prefillAlertFromPrediction = (prediction) => {
//     const isFlood =
//       prediction.risk_score !== undefined ||
//       prediction.rainfall_mm !== undefined ||
//       prediction.river_level_m !== undefined;

//     if (isFlood) {
//       const score = Number(prediction.risk_score || 0);

//       const severity =
//         score > 0.85
//           ? 'critical'
//           : score > 0.65
//             ? 'high'
//             : score > 0.45
//               ? 'moderate'
//               : 'low';

//       const regionValue = prediction.region || 'Flood Risk Zone';

//       const message =
//         `Flood alert for ${regionValue}. ` +
//         `Risk score: ${score.toFixed(2)}. ` +
//         `Rainfall: ${Number(prediction.rainfall_mm || 0).toFixed(1)} mm. ` +
//         `River level: ${Number(prediction.river_level_m || 0).toFixed(2)} m.`;

//       setAlertForm({
//         type: 'flood',
//         region: regionValue,
//         message,
//         severity,
//         lat: prediction.lat ? String(prediction.lat) : '',
//         lng: prediction.lng ? String(prediction.lng) : '',
//         radius: score > 0.85 ? '100000' : '50000'
//       });
//     } else {
//       const score = Number(prediction.alert_confidence || 0);

//       const severity =
//         score > 0.85
//           ? 'critical'
//           : score > 0.65
//             ? 'high'
//             : score > 0.45
//               ? 'moderate'
//               : 'low';

//       const regionValue =
//         prediction.region || prediction.predicted_zone || 'Earthquake Risk Zone';

//       const message =
//         `Earthquake alert for ${regionValue}. ` +
//         `Confidence: ${score.toFixed(2)}. ` +
//         `Predicted magnitude: ${Number(prediction.predicted_next_magnitude || 0).toFixed(2)}. ` +
//         `Zone: ${prediction.predicted_zone || 'N/A'}. ` +
//         `Estimated next event time: ${prediction.estimated_next_event_time || 'N/A'}.`;

//       setAlertForm({
//         type: 'earthquake',
//         region: regionValue,
//         message,
//         severity,
//         lat: prediction.lat ? String(prediction.lat) : '',
//         lng: prediction.lng ? String(prediction.lng) : '',
//         radius: score > 0.85 ? '100000' : '50000'
//       });
//     }

//     setActiveTab('alerts');
//   };

//   const deleteAlert = async (alertId) => {
//     try {
//       await api.delete(`/alerts/${alertId}`);
//       setAlerts((prev) => prev.filter((a) => a._id !== alertId));
//     } catch (err) {
//       alert('Failed to delete');
//     }
//   };

//   const sosPerDay = getLast7Days().map((date) => ({
//     date,
//     count: sosList.filter(
//       (s) => new Date(s.createdAt).toLocaleDateString() === date
//     ).length
//   }));

//   const priorityData = [
//     {
//       name: 'Critical',
//       value: sosList.filter((s) => s.priority === 'red').length,
//       color: '#ef4444'
//     },
//     {
//       name: 'Moderate',
//       value: sosList.filter((s) => s.priority === 'yellow').length,
//       color: '#f59e0b'
//     },
//     {
//       name: 'Safe',
//       value: sosList.filter((s) => s.priority === 'green').length,
//       color: '#10b981'
//     }
//   ];

//   const statusData = [
//     { name: 'Pending', count: sosList.filter((s) => s.status === 'pending').length },
//     { name: 'Assigned', count: sosList.filter((s) => s.status === 'assigned').length },
//     { name: 'In Progress', count: sosList.filter((s) => s.status === 'in-progress').length },
//     { name: 'Resolved', count: sosList.filter((s) => s.status === 'resolved').length }
//   ];

//   const kpis = [
//     { label: 'Total Users', value: users.length, color: '#3b82f6' },
//     {
//       label: 'Active SOS',
//       value: sosList.filter((s) => s.status !== 'resolved').length,
//       color: '#ef4444'
//     },
//     {
//       label: 'NGOs',
//       value: users.filter((u) => u.role === 'ngo').length,
//       color: '#8b5cf6'
//     },
//     {
//       label: 'Alerts Sent',
//       value: alerts.length,
//       color: '#f59e0b'
//     },
//     {
//       label: 'Resolved',
//       value: sosList.filter((s) => s.status === 'resolved').length,
//       color: '#10b981'
//     },
//     {
//       label: 'Pending NGOs',
//       value: users.filter((u) => u.role === 'ngo' && !u.approved).length,
//       color: '#ec4899'
//     }
//   ];

//   const tabs = ['overview', 'predictions', 'users', 'alerts', 'analytics'];

//   return (
// <<<<<<< HEAD
//     <div className="app-dashboard">
//       <header className="dash-header">
//         <h2>🛠️ {t('dashboard.adminTitle')}</h2>
//         <div className="dash-header-actions">
//           <ThemeToggle />
//           <LanguageSwitcher compact />
//           {user?.name && <span className="user-pill">{user.name}</span>}
//           <button type="button" className="btn btn-ghost btn-xs" onClick={logout}>
//             {t('common.logout')}
//           </button>
// =======
//     <div
//       style={{
//         minHeight: '100vh',
//         background: '#0f172a',
//         fontFamily: 'sans-serif',
//         color: '#f1f5f9'
//       }}
//     >
//       <div
//         style={{
//           background: '#1e293b',
//           borderBottom: '1px solid #334155',
//           padding: '12px 24px',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between'
//         }}
//       >
//         <h2 style={{ margin: 0, fontSize: 18 }}>🛠️ Disaster Admin Control Center</h2>
//         <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
//           <span style={{ color: '#64748b', fontSize: 14 }}>{user?.name}</span>
//           <button onClick={logout} style={btn('#334155')}>Logout</button>
// >>>>>>> main
//         </div>
//       </header>

// <<<<<<< HEAD
//       <nav className="admin-tabs">
//         {tabs.map((tab) => (
//           <button
//             key={tab}
//             type="button"
//             className={`admin-tab${activeTab === tab ? ' is-active' : ''}`}
//             onClick={() => setActiveTab(tab)}
// =======
//       <div
//         style={{
//           background: '#1e293b',
//           borderBottom: '1px solid #334155',
//           padding: '0 24px',
//           display: 'flex',
//           gap: 4
//         }}
//       >
//         {tabs.map((tab) => (
//           <button
//             key={tab}
//             onClick={() => setActiveTab(tab)}
//             style={{
//               padding: '12px 20px',
//               background: 'transparent',
//               border: 'none',
//               borderBottom:
//                 activeTab === tab
//                   ? '2px solid #3b82f6'
//                   : '2px solid transparent',
//               color: activeTab === tab ? '#3b82f6' : '#64748b',
//               cursor: 'pointer',
//               fontSize: 14,
//               textTransform: 'capitalize',
//               fontWeight: activeTab === tab ? 600 : 400
//             }}
// >>>>>>> main
//           >
//             {tab}
//           </button>
//         ))}
//       </nav>

// <<<<<<< HEAD
//       <div className="dash-main">

//         {/* ── OVERVIEW TAB ────────────────────────── */}
//         {activeTab === 'overview' && (
//           <div>
//             <div className="dash-stat-grid" style={{ marginBottom: '1.5rem' }}>
//               {kpis.map((k) => (
//                 <div
//                   key={k.label}
//                   className="stat-card"
//                   style={{ '--card-accent': k.color, textAlign: 'center' }}
//                 >
//                   <p className="stat-card-label">{k.label}</p>
//                   <p className="stat-card-value">{k.value}</p>
// =======
//       <div style={{ padding: 24 }}>
//         {activeTab === 'overview' && (
//           <div>
//             <div
//               style={{
//                 display: 'grid',
//                 gridTemplateColumns: 'repeat(3, 1fr)',
//                 gap: 12,
//                 marginBottom: 24
//               }}
//             >
//               {kpis.map((k) => (
//                 <div
//                   key={k.label}
//                   style={{
//                     background: '#1e293b',
//                     border: `1px solid ${k.color}33`,
//                     borderRadius: 12,
//                     padding: 20,
//                     textAlign: 'center'
//                   }}
//                 >
//                   <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{k.label}</p>
//                   <p
//                     style={{
//                       margin: '6px 0 0',
//                       fontSize: 32,
//                       fontWeight: 700,
//                       color: k.color
//                     }}
//                   >
//                     {k.value}
//                   </p>
// >>>>>>> main
//                 </div>
//               ))}
//             </div>

// <<<<<<< HEAD
//             <div className="chart-card">
//               <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Recent SOS Requests</h3>
// =======
//             <div
//               style={{
//                 background: '#1e293b',
//                 borderRadius: 12,
//                 border: '1px solid #334155',
//                 padding: 20
//               }}
//             >
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Recent SOS Requests</h3>
// >>>>>>> main
//               {loading ? (
//                 <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
//               ) : sosList.length === 0 ? (
//                 <p style={{ color: 'var(--text-muted)' }}>No SOS requests yet</p>
//               ) : (
// <<<<<<< HEAD
//                 sosList.slice(0, 5).map(sos => (
//                   <div key={sos._id} style={{
//                     display: 'flex', justifyContent: 'space-between',
//                     alignItems: 'center', padding: '10px 0',
//                     borderBottom: '1px solid var(--border-strong)'
//                   }}>
// =======
//                 sosList.slice(0, 5).map((sos) => (
//                   <div
//                     key={sos._id}
//                     style={{
//                       display: 'flex',
//                       justifyContent: 'space-between',
//                       alignItems: 'center',
//                       padding: '10px 0',
//                       borderBottom: '1px solid #334155'
//                     }}
//                   >
// >>>>>>> main
//                     <div>
//                       <span style={{ fontWeight: 600 }}>{sos.name}</span>
//                       <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 12 }}>
//                         {new Date(sos.createdAt).toLocaleString()}
//                       </span>
//                     </div>
//                     <div style={{ display: 'flex', gap: 8 }}>
//                       <Badge color={priorityColor(sos.priority)} text={sos.priority} />
//                       <Badge color={statusColor(sos.status)} text={sos.status} />
//                     </div>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         )}

//         {activeTab === 'predictions' && (
//           <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
//             <div style={chartCard}>
//               <div
//                 style={{
//                   display: 'flex',
//                   justifyContent: 'space-between',
//                   alignItems: 'center',
//                   marginBottom: 16
//                 }}
//               >
//                 <h3 style={{ margin: 0, fontSize: 15 }}>🧠 ML Predictions</h3>
//                 <button onClick={fetchPredictions} style={btn('#334155')}>
//                   Refresh
//                 </button>
//               </div>

//               <h4 style={{ marginBottom: 10 }}>🌊 Flood Predictions</h4>

//               {floodPredictions.length === 0 ? (
//                 <p style={{ color: '#64748b' }}>No flood predictions</p>
//               ) : (
//                 floodPredictions.map((p, i) => (
//                   <div
//                     key={`${p.region || 'flood'}-${i}`}
//                     style={{
//                       background: '#0f172a',
//                       borderRadius: 10,
//                       padding: 12,
//                       marginBottom: 8,
//                       border: `1px solid ${
//                         p.risk_score > 0.85 ? '#ef4444'
//                         : p.risk_score > 0.65 ? '#f59e0b'
//                         : '#334155'
//                       }`
//                     }}
//                   >
//                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                       <div>
//                         <b>{p.region}</b>
//                         <div style={{ fontSize: 12, color: '#64748b' }}>
//                           Rainfall: {p.rainfall_mm} mm | River: {p.river_level_m} m
//                         </div>
//                       </div>

//                       <Badge
//                         color={p.risk_score > 0.85 ? '#ef4444' : '#10b981'}
//                         text={`score ${Number(p.risk_score || 0).toFixed(2)}`}
//                       />
//                     </div>

//                     <button
//                       onClick={() => prefillAlertFromPrediction(p)}
//                       style={{ ...btn('#3b82f6'), marginTop: 8 }}
//                     >
//                       Prefill Alert
//                     </button>
//                   </div>
//                 ))
//               )}

//               <h4 style={{ marginTop: 20, marginBottom: 10 }}>🌍 Earthquake Predictions</h4>

//               {earthquakePredictions.length === 0 ? (
//                 <p style={{ color: '#64748b' }}>No earthquake predictions</p>
//               ) : (
//                 earthquakePredictions.map((p, i) => {
//                   const score = Number(p.alert_confidence || 0);

//                   return (
//                     <div
//                       key={`${p.region || p.predicted_zone || 'earthquake'}-${i}`}
//                       style={{
//                         background: '#0f172a',
//                         borderRadius: 10,
//                         padding: 12,
//                         marginBottom: 8,
//                         border: `1px solid ${
//                           score > 0.85 ? '#ef4444'
//                           : score > 0.65 ? '#f59e0b'
//                           : '#334155'
//                         }`
//                       }}
//                     >
//                       <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                         <div>
//                           <b>{p.region || p.predicted_zone}</b>
//                           <div style={{ fontSize: 12, color: '#64748b' }}>
//                             Magnitude: {Number(p.predicted_next_magnitude || 0).toFixed(2)}
//                           </div>
//                         </div>

//                         <Badge
//                           color={score > 0.85 ? '#ef4444' : '#10b981'}
//                           text={`score ${score.toFixed(2)}`}
//                         />
//                       </div>

//                       <button
//                         onClick={() => prefillAlertFromPrediction(p)}
//                         style={{ ...btn('#3b82f6'), marginTop: 8 }}
//                       >
//                         Prefill Alert
//                       </button>
//                     </div>
//                   );
//                 })
//               )}
//             </div>

//             <div style={chartCard}>
//               <h3 style={{ marginBottom: 10 }}>Hybrid System</h3>
//               <p style={{ color: '#94a3b8', fontSize: 13 }}>
//                 Flood and earthquake predictions are combined here. Admin verifies and sends alerts.
//               </p>
//             </div>
//           </div>
//         )}

//         {activeTab === 'users' && (
// <<<<<<< HEAD
//           <div className="data-table-wrap">
//             <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
//               <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>👥 User Management</h3>
// =======
//           <div
//             style={{
//               background: '#1e293b',
//               borderRadius: 12,
//               border: '1px solid #334155',
//               overflow: 'hidden'
//             }}
//           >
//             <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
//               <h3 style={{ margin: 0, fontSize: 15 }}>👥 User Management</h3>
// >>>>>>> main
//             </div>
//             {loading ? (
//               <p className="empty-hint" style={{ padding: '1.25rem' }}>Loading…</p>
//             ) : (
//               <table className="data-table">
//                 <thead>
// <<<<<<< HEAD
//                   <tr>
//                     {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
//                       <th key={h}>{h}</th>
// =======
//                   <tr style={{ background: '#0f172a' }}>
//                     {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
//                       <th
//                         key={h}
//                         style={{
//                           padding: '12px 16px',
//                           textAlign: 'left',
//                           fontSize: 12,
//                           color: '#64748b',
//                           fontWeight: 600
//                         }}
//                       >
//                         {h}
//                       </th>
// >>>>>>> main
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {users.map((u) => (
// <<<<<<< HEAD
//                     <tr key={u._id}>
//                       <td>{u.name}</td>
//                       <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
//                       <td>
// =======
//                     <tr key={u._id} style={{ borderBottom: '1px solid #334155' }}>
//                       <td style={td}>{u.name}</td>
//                       <td style={{ ...td, color: '#64748b' }}>{u.email}</td>
//                       <td style={td}>
// >>>>>>> main
//                         <Badge
//                           color={
//                             u.role === 'admin'
//                               ? '#8b5cf6'
//                               : u.role === 'ngo'
//                                 ? '#3b82f6'
//                                 : '#10b981'
//                           }
//                           text={u.role}
//                         />
//                       </td>
// <<<<<<< HEAD
//                       <td>
//                         {u.blocked
//                           ? <Badge color="#ef4444" text="Blocked" />
//                           : u.role === 'ngo' && !u.approved
//                             ? <Badge color="#f59e0b" text="Pending" />
//                             : <Badge color="#10b981" text="Active" />
//                         }
// =======
//                       <td style={td}>
//                         {u.blocked ? (
//                           <Badge color="#ef4444" text="Blocked" />
//                         ) : u.role === 'ngo' && !u.approved ? (
//                           <Badge color="#f59e0b" text="Pending" />
//                         ) : (
//                           <Badge color="#10b981" text="Active" />
//                         )}
// >>>>>>> main
//                       </td>
//                       <td>
//                         <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
//                           {u.role === 'ngo' && !u.approved && !u.blocked && (
//                             <button type="button" className="btn btn-xs btn-success" onClick={() => approveNGO(u._id)}>
//                               Approve
//                             </button>
//                           )}
//                           {!u.blocked && u.role !== 'admin' && (
//                             <button type="button" className="btn btn-xs btn-danger" onClick={() => blockUser(u._id)}>
//                               Block
//                             </button>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             )}
//           </div>
//         )}

//         {activeTab === 'alerts' && (
// <<<<<<< HEAD
//           <div className="chart-grid">
//             <div className="chart-card">
//               <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>⚠️ Create Alert</h3>
// =======
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
//             <div
//               style={{
//                 background: '#1e293b',
//                 borderRadius: 12,
//                 border: '1px solid #334155',
//                 padding: 20
//               }}
//             >
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>⚠️ Create Disaster Alert</h3>
// >>>>>>> main

//               <select
//                 className="form-control"
//                 value={alertForm.type}
//                 onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })}
// <<<<<<< HEAD
//               >
//                 {['flood', 'earthquake', 'cyclone', 'fire', 'tsunami', 'landslide'].map((ty) => (
//                   <option key={ty} value={ty}>
//                     {ty.charAt(0).toUpperCase() + ty.slice(1)}
//                   </option>
//                 ))}
// =======
//                 style={input}
//               >
//                 <option value="earthquake">Earthquake</option>
//                 <option value="flood">Flood</option>
// >>>>>>> main
//               </select>

//               <select
//                 className="form-control"
//                 value={alertForm.severity}
//                 onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}
// <<<<<<< HEAD
// =======
//                 style={input}
// >>>>>>> main
//               >
//                 <option value="low">Low</option>
//                 <option value="moderate">Moderate</option>
//                 <option value="high">High</option>
//                 <option value="critical">Critical</option>
//               </select>

//               <input
// <<<<<<< HEAD
//                 className="form-control"
//                 placeholder="Affected region (e.g. Hyderabad, Telangana)"
//                 value={alertForm.region}
//                 onChange={(e) => setAlertForm({ ...alertForm, region: e.target.value })}
//               />

//               <textarea
//                 className="form-control"
//                 placeholder="Alert message / evacuation instructions..."
// =======
//                 placeholder="Affected region / predicted zone"
//                 value={alertForm.region}
//                 onChange={(e) => setAlertForm({ ...alertForm, region: e.target.value })}
//                 style={input}
//               />

//               <textarea
//                 placeholder="Disaster alert message..."
// >>>>>>> main
//                 value={alertForm.message}
//                 onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
//                 rows={3}
//               />

// <<<<<<< HEAD
//               <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
//                 📍 Danger zone on map (optional)
// =======
//               <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px' }}>
//                 📍 Danger zone on map
// >>>>>>> main
//               </p>

//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
//                 <input
// <<<<<<< HEAD
//                   className="form-control"
//                   style={{ marginBottom: 0 }}
//                   placeholder="Latitude (e.g. 17.3850)"
//                   value={alertForm.lat}
//                   onChange={(e) => setAlertForm({ ...alertForm, lat: e.target.value })}
// =======
//                   placeholder="Latitude"
//                   value={alertForm.lat}
//                   onChange={(e) => setAlertForm({ ...alertForm, lat: e.target.value })}
//                   style={{ ...input, marginBottom: 0 }}
// >>>>>>> main
//                   type="number"
//                   step="any"
//                 />
//                 <input
// <<<<<<< HEAD
//                   className="form-control"
//                   style={{ marginBottom: 0 }}
//                   placeholder="Longitude (e.g. 78.4867)"
//                   value={alertForm.lng}
//                   onChange={(e) => setAlertForm({ ...alertForm, lng: e.target.value })}
// =======
//                   placeholder="Longitude"
//                   value={alertForm.lng}
//                   onChange={(e) => setAlertForm({ ...alertForm, lng: e.target.value })}
//                   style={{ ...input, marginBottom: 0 }}
// >>>>>>> main
//                   type="number"
//                   step="any"
//                 />
//               </div>

//               <input
// <<<<<<< HEAD
//                 className="form-control"
//                 style={{ marginTop: '0.5rem' }}
//                 placeholder="Danger zone radius in meters (e.g. 10000)"
//                 value={alertForm.radius}
//                 onChange={(e) => setAlertForm({ ...alertForm, radius: e.target.value })}
//                 type="number"
//               />

//               <button type="button" className="btn btn-danger" style={{ width: '100%', marginTop: '0.35rem', padding: '0.65rem' }} onClick={createAlert}>
//                 Broadcast Alert
//               </button>
//             </div>

//             {/* Alert List */}
//             <div style={{
//               background: 'var(--surface-elevated)', borderRadius: 12,
//               border: '1px solid var(--border-strong)', padding: 20,
//               maxHeight: 600, overflowY: 'auto'
//             }}>
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📋 Active Alerts</h3>
//               {alerts.length === 0
//                 ? <p style={{ color: 'var(--text-muted)' }}>No alerts yet</p>
//                 : translatedAlerts.map(a => (
//                   <div key={a._id} style={{
//                     background: 'var(--surface)', borderRadius: 8,
//                     padding: 12, marginBottom: 10,
//                     border: '1px solid var(--border-strong)'
//                   }}>
//                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
//                       <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
//                         {a.type === 'flood' ? '🌊' :
//                          a.type === 'earthquake' ? '🌍' :
//                          a.type === 'cyclone' ? '🌀' :
//                          a.type === 'fire' ? '🔥' :
//                          a.type === 'tsunami' ? '🌊' : '⚠️'} {a._tr?.type ?? a.type} — {a._tr?.region ?? a.region}
// =======
//                 placeholder="Danger zone radius in meters"
//                 value={alertForm.radius}
//                 onChange={(e) => setAlertForm({ ...alertForm, radius: e.target.value })}
//                 style={{ ...input, marginTop: 8 }}
//                 type="number"
//               />

//               <button
//                 onClick={createAlert}
//                 style={{
//                   ...btn('#dc2626'),
//                   width: '100%',
//                   padding: '12px',
//                   fontSize: 14,
//                   marginTop: 4
//                 }}
//               >
//                 🔔 Broadcast Alert
//               </button>
//             </div>

//             <div
//               style={{
//                 background: '#1e293b',
//                 borderRadius: 12,
//                 border: '1px solid #334155',
//                 padding: 20,
//                 maxHeight: 600,
//                 overflowY: 'auto'
//               }}
//             >
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📋 Active Alerts</h3>
//               {alerts.length === 0 ? (
//                 <p style={{ color: '#64748b' }}>No alerts yet</p>
//               ) : (
//                 alerts.map((a) => (
//                   <div
//                     key={a._id}
//                     style={{
//                       background: '#0f172a',
//                       borderRadius: 8,
//                       padding: 12,
//                       marginBottom: 10,
//                       border: '1px solid #334155'
//                     }}
//                   >
//                     <div
//                       style={{
//                         display: 'flex',
//                         justifyContent: 'space-between',
//                         marginBottom: 6
//                       }}
//                     >
//                       <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
//                         {a.type === 'flood' ? '🌊' : '🌍'} {a.type} — {a.region}
// >>>>>>> main
//                       </span>
//                       <Badge
//                         color={
//                           a.severity === 'critical'
//                             ? '#ef4444'
//                             : a.severity === 'high'
//                               ? '#f59e0b'
//                               : a.severity === 'moderate'
//                                 ? '#3b82f6'
//                                 : '#10b981'
//                         }
//                         text={a._tr?.severity ?? a.severity}
//                       />
//                     </div>
// <<<<<<< HEAD
//                     <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 8px' }}>
//                       {a._tr?.message ?? a.message}
// =======

//                     <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 8px' }}>
//                       {a.message}
// >>>>>>> main
//                     </p>

//                     {a.location?.lat && (
//                       <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 6px' }}>
//                         📍 {a.location.lat}, {a.location.lng} — radius: {a.radius}m
//                       </p>
//                     )}
// <<<<<<< HEAD
//                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//                       <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
// =======

//                     <div
//                       style={{
//                         display: 'flex',
//                         justifyContent: 'space-between',
//                         alignItems: 'center'
//                       }}
//                     >
//                       <span style={{ color: '#475569', fontSize: 11 }}>
// >>>>>>> main
//                         {new Date(a.createdAt).toLocaleString()}
//                       </span>
//                       <button type="button" className="btn btn-xs btn-danger" onClick={() => deleteAlert(a._id)}>
//                         Delete
//                       </button>
//                     </div>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         )}

//         {activeTab === 'analytics' && (
// <<<<<<< HEAD
//           <div className="chart-grid">
//             <div className="chart-card">
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📈 SOS Last 7 Days</h3>
//               <ResponsiveContainer width="100%" height={220}>
//                 <LineChart data={sosPerDay}>
//                   <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
//                   <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
//                   <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
//                   <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
// =======
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
//             <div style={chartCard}>
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📈 SOS Last 7 Days</h3>
//               <ResponsiveContainer width="100%" height={220}>
//                 <LineChart data={sosPerDay}>
//                   <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
//                   <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
//                   <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
//                   <Line
//                     type="monotone"
//                     dataKey="count"
//                     stroke="#3b82f6"
//                     strokeWidth={2}
//                     dot={{ fill: '#3b82f6' }}
//                   />
// >>>>>>> main
//                 </LineChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="chart-card">
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📊 SOS by Status</h3>
//               <ResponsiveContainer width="100%" height={220}>
//                 <BarChart data={statusData}>
//                   <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
//                   <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
//                   <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
//                   <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="chart-card">
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>🔴 Priority Breakdown</h3>
//               <ResponsiveContainer width="100%" height={220}>
//                 <PieChart>
//                   <Pie
//                     data={priorityData}
//                     cx="50%"
//                     cy="50%"
//                     outerRadius={80}
//                     dataKey="value"
//                     label={({ name, value }) => `${name}: ${value}`}
//                   >
//                     {priorityData.map((entry, i) => (
//                       <Cell key={i} fill={entry.color} />
//                     ))}
//                   </Pie>
//                   <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="chart-card">
//               <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>👥 User Roles</h3>
//               <ResponsiveContainer width="100%" height={220}>
// <<<<<<< HEAD
//                 <BarChart data={[
//                   { name: 'Victims', count: users.filter(u => u.role === 'victim').length },
//                   { name: 'NGOs',    count: users.filter(u => u.role === 'ngo').length },
//                   { name: 'Admins',  count: users.filter(u => u.role === 'admin').length }
//                 ]}>
//                   <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
//                   <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
//                   <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', color: 'var(--text)' }} />
// =======
//                 <BarChart
//                   data={[
//                     { name: 'Victims', count: users.filter((u) => u.role === 'victim').length },
//                     { name: 'NGOs', count: users.filter((u) => u.role === 'ngo').length },
//                     { name: 'Admins', count: users.filter((u) => u.role === 'admin').length }
//                   ]}
//                 >
//                   <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
//                   <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
//                   <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
// >>>>>>> main
//                   <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// function getLast7Days() {
//   return Array.from({ length: 7 }, (_, i) => {
//     const d = new Date();
//     d.setDate(d.getDate() - (6 - i));
//     return d.toLocaleDateString();
//   });
// }

// function priorityColor(p) {
//   return p === 'red' ? '#ef4444' : p === 'yellow' ? '#f59e0b' : '#10b981';
// }

// function statusColor(s) {
//   return s === 'pending'
//     ? '#f59e0b'
//     : s === 'assigned'
//       ? '#3b82f6'
//       : s === 'in-progress'
//         ? '#8b5cf6'
//         : '#10b981';
// }

// function Badge({ color, text }) {
//   return (
//     <span
//       style={{
//         background: color + '22',
//         color,
//         padding: '3px 10px',
//         borderRadius: 20,
//         fontSize: 11,
//         fontWeight: 600,
//         textTransform: 'capitalize'
//       }}
//     >
//       {text}
//     </span>
//   );
// }
// <<<<<<< HEAD
// =======

// const btn = (bg) => ({
//   padding: '6px 14px',
//   background: bg,
//   color: 'white',
//   border: 'none',
//   borderRadius: 6,
//   fontSize: 12,
//   cursor: 'pointer',
//   fontWeight: 500
// });

// const td = {
//   padding: '12px 16px',
//   fontSize: 14,
//   background: '#0f172a',
//   color: '#f1f5f9'
// };

// const input = {
//   width: '100%',
//   padding: '10px 12px',
//   marginBottom: 12,
//   background: '#0f172a',
//   border: '1px solid #334155',
//   borderRadius: 8,
//   color: '#f1f5f9',
//   fontSize: 14,
//   boxSizing: 'border-box'
// };

// const chartCard = {
//   background: '#1e293b',
//   borderRadius: 12,
//   border: '1px solid #334155',
//   padding: 20
// };
// >>>>>>> main

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
  const [sosList, setSosList] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [floodPredictions, setFloodPredictions] = useState([]);
  const [earthquakePredictions, setEarthquakePredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  const translatedAlerts = useTranslatedAlerts(alerts, i18n.language);
  const floodPredictionURL =
    import.meta.env.VITE_FLOOD_PREDICTION_URL || `${window.location.protocol}//${window.location.hostname}:5002/predictions`;
  const earthquakePredictionURL =
    import.meta.env.VITE_EARTHQUAKE_PREDICTION_URL || `${window.location.protocol}//${window.location.hostname}:5003/predictions`;

  const [alertForm, setAlertForm] = useState({
    type: 'earthquake',
    region: '',
    message: '',
    severity: 'moderate',
    lat: '',
    lng: '',
    radius: ''
  });

  useEffect(() => {
    fetchAll();
    fetchPredictions();

    const handleNewSOS = (sos) => {
      if (!sos?._id) return;
      setSosList((prev) =>
        prev.some((item) => String(item._id) === String(sos._id))
          ? prev.map((item) =>
              String(item._id) === String(sos._id) ? sos : item
            )
          : [sos, ...prev]
      );
    };

    const handleSOSListUpdated = (updatedList) => {
      if (Array.isArray(updatedList)) setSosList(updatedList);
    };

    const handleSOSUpdated = ({ sos }) => {
      if (!sos?._id) return;
      setSosList((prev) => {
        const index = prev.findIndex((item) => String(item._id) === String(sos._id));
        if (index === -1) return [sos, ...prev];
        const next = [...prev];
        next[index] = sos;
        return next;
      });
    };

    const handleNewAlert = (alert) => {
      if (!alert?._id) return;
      setAlerts((prev) =>
        prev.some((item) => String(item._id) === String(alert._id))
          ? prev
          : [alert, ...prev]
      );
    };

    const handleReassignmentTimeout = () => fetchAll();
    const handleUserDeleted = () => fetchAll();

    socket.on('new-sos', handleNewSOS);
    socket.on('sos-list-updated', handleSOSListUpdated);
    socket.on('sos-updated', handleSOSUpdated);
    socket.on('new-alert', handleNewAlert);
    socket.on('sos-reassignment-timeout', handleReassignmentTimeout);
    socket.on('user-deleted', handleUserDeleted);

    return () => {
      socket.off('new-sos', handleNewSOS);
      socket.off('sos-list-updated', handleSOSListUpdated);
      socket.off('sos-updated', handleSOSUpdated);
      socket.off('new-alert', handleNewAlert);
      socket.off('sos-reassignment-timeout', handleReassignmentTimeout);
      socket.off('user-deleted', handleUserDeleted);
    };
  }, []);

  const fetchAll = async () => {
    try {
      const [sosRes, userRes, alertRes] = await Promise.all([
        api.get('/sos'),
        api.get('/users'),
        api.get('/alerts')
      ]);

      setSosList(sosRes.data || []);
      setUsers(userRes.data || []);
      setAlerts(alertRes.data || []);
    } catch (err) {
      console.error('FETCH ERROR:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFloodPredictions = async () => {
    const url = (import.meta.env.VITE_FLOOD_PREDICTION_URL || '').trim() || floodPredictionURL;
    const isHuggingFaceGradio =
      url.includes('hf.space') || url.includes('/run/predict');

    if (!isHuggingFaceGradio) {
      try {
        const floodRes = await fetch(url);
        const floodData = await floodRes.json();
        setFloodPredictions(
          Array.isArray(floodData?.predictions)
            ? floodData.predictions
            : Array.isArray(floodData)
              ? floodData
              : []
        );
      } catch (err) {
        console.error('Flood prediction error:', err);
        setFloodPredictions([]);
      }
      return;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
        })
      });

      const result = await res.json();
      const raw = result?.data?.[0];
      const floodLikely = raw == 1;

      setFloodPredictions([
        {
          region: 'Hugging Face flood model',
          risk_score: floodLikely ? 0.9 : 0.15,
          rainfall_mm: 0,
          river_level_m: 0,
          _hfOutput: raw,
          _hfMessage: floodLikely ? 'Flood Likely 🚨' : 'No Flood ✅'
        }
      ]);
    } catch (err) {
      console.error('Flood prediction error:', err);
      setFloodPredictions([]);
    }
  };

  const fetchPredictions = async () => {
    try {
      await Promise.all([fetchFloodPredictions(), fetch(earthquakePredictionURL).then(async (eqRes) => {
        const eqData = await eqRes.json();
        setEarthquakePredictions(
          Array.isArray(eqData?.predictions)
            ? eqData.predictions
            : Array.isArray(eqData)
              ? eqData
              : []
        );
      })]);
    } catch (err) {
      console.error('Prediction fetch failed:', err);
      setEarthquakePredictions([]);
    }
  };

  const approveNGO = async (userId) => {
    try {
      await api.patch(`/users/${userId}/approve`);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, approved: true } : u))
      );
    } catch (err) {
      alert('Failed to approve');
    }
  };

  const blockUser = async (userId) => {
    try {
      await api.patch(`/users/${userId}/block`);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, blocked: true } : u))
      );
    } catch (err) {
      alert('Failed to block');
    }
  };

  const deleteUser = async (userId) => {
    const confirmed = window.confirm(
      'Delete this user permanently? Associated SOS records may also be removed.'
    );
    if (!confirmed) return;

    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setSosList((prev) => prev.filter((s) => String(s.userId) !== String(userId)));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete user';
      alert(msg);
    }
  };

  const createAlert = async () => {
    if (!alertForm.region || !alertForm.message) {
      alert('Please fill region and message');
      return;
    }

    try {
      const payload = {
        type: alertForm.type,
        severity: alertForm.severity,
        region: alertForm.region,
        message: alertForm.message,
        radius: alertForm.radius ? parseInt(alertForm.radius, 10) : 100000,
        ...(alertForm.lat && alertForm.lng
          ? {
              location: {
                lat: parseFloat(alertForm.lat),
                lng: parseFloat(alertForm.lng)
              }
            }
          : {})
      };

      const res = await api.post('/alerts', payload);
      const createdAlert = res.data?.alert || res.data;

      if (createdAlert) {
        setAlerts((prev) =>
          prev.some((a) => String(a._id) === String(createdAlert._id))
            ? prev
            : [createdAlert, ...prev]
        );
      }

      setAlertForm({
        type: 'earthquake',
        region: '',
        message: '',
        severity: 'moderate',
        lat: '',
        lng: '',
        radius: ''
      });

      setActiveTab('alerts');
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert('Failed to create alert');
    }
  };

  const prefillAlertFromPrediction = (prediction) => {
    const isFlood =
      prediction.risk_score !== undefined ||
      prediction.rainfall_mm !== undefined ||
      prediction.river_level_m !== undefined;

    if (isFlood) {
      const score = Number(prediction.risk_score || 0);

      const severity =
        score > 0.85
          ? 'critical'
          : score > 0.65
            ? 'high'
            : score > 0.45
              ? 'moderate'
              : 'low';

      const regionValue = prediction.region || 'Flood Risk Zone';

      const message =
        `Flood alert for ${regionValue}. ` +
        `Risk score: ${score.toFixed(2)}. ` +
        `Rainfall: ${Number(prediction.rainfall_mm || 0).toFixed(1)} mm. ` +
        `River level: ${Number(prediction.river_level_m || 0).toFixed(2)} m.`;

      setAlertForm({
        type: 'flood',
        region: regionValue,
        message,
        severity,
        lat: prediction.lat ? String(prediction.lat) : '',
        lng: prediction.lng ? String(prediction.lng) : '',
        radius: score > 0.85 ? '100000' : '50000'
      });
    } else {
      const score = Number(prediction.alert_confidence || 0);

      const severity =
        score > 0.85
          ? 'critical'
          : score > 0.65
            ? 'high'
            : score > 0.45
              ? 'moderate'
              : 'low';

      const regionValue =
        prediction.region || prediction.predicted_zone || 'Earthquake Risk Zone';

      const message =
        `Earthquake alert for ${regionValue}. ` +
        `Confidence: ${score.toFixed(2)}. ` +
        `Predicted magnitude: ${Number(prediction.predicted_next_magnitude || 0).toFixed(2)}. ` +
        `Zone: ${prediction.predicted_zone || 'N/A'}. ` +
        `Estimated next event time: ${prediction.estimated_next_event_time || 'N/A'}.`;

      setAlertForm({
        type: 'earthquake',
        region: regionValue,
        message,
        severity,
        lat: prediction.lat ? String(prediction.lat) : '',
        lng: prediction.lng ? String(prediction.lng) : '',
        radius: score > 0.85 ? '100000' : '50000'
      });
    }

    setActiveTab('alerts');
  };

  const deleteAlert = async (alertId) => {
    try {
      await api.delete(`/alerts/${alertId}`);
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const sosPerDay = getLast7Days().map((date) => ({
    date,
    count: sosList.filter(
      (s) => new Date(s.createdAt).toLocaleDateString() === date
    ).length
  }));

  const priorityData = [
    {
      name: 'Critical',
      value: sosList.filter((s) => s.priority === 'red').length,
      color: '#ef4444'
    },
    {
      name: 'Moderate',
      value: sosList.filter((s) => s.priority === 'yellow').length,
      color: '#f59e0b'
    },
    {
      name: 'Safe',
      value: sosList.filter((s) => s.priority === 'green').length,
      color: '#10b981'
    }
  ];

  const statusData = [
    { name: 'Pending', count: sosList.filter((s) => s.status === 'pending').length },
    { name: 'Assigned', count: sosList.filter((s) => s.status === 'assigned').length },
    { name: 'In Progress', count: sosList.filter((s) => s.status === 'in-progress').length },
    { name: 'Resolved', count: sosList.filter((s) => s.status === 'resolved').length }
  ];

  const kpis = [
    { label: 'Total Users', value: users.length, color: '#3b82f6' },
    {
      label: 'Active SOS',
      value: sosList.filter((s) => s.status !== 'resolved').length,
      color: '#ef4444'
    },
    {
      label: 'NGOs',
      value: users.filter((u) => u.role === 'ngo').length,
      color: '#8b5cf6'
    },
    {
      label: 'Alerts Sent',
      value: alerts.length,
      color: '#f59e0b'
    },
    {
      label: 'Resolved',
      value: sosList.filter((s) => s.status === 'resolved').length,
      color: '#10b981'
    },
    {
      label: 'Pending NGOs',
      value: users.filter((u) => u.role === 'ngo' && !u.approved).length,
      color: '#ec4899'
    }
  ];

  const tabs = ['overview', 'predictions', 'users', 'alerts', 'analytics'];

  return (
    <div className="app-dashboard" style={pageShell}>
      <header className="dash-header" style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          🛠️ {t('dashboard.adminTitle', 'Disaster Admin Control Center')}
        </h2>

        <div
          className="dash-header-actions"
          style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <ThemeToggle />
          <LanguageSwitcher compact />
          {user?.name && (
            <span className="user-pill" style={userPill}>
              {user.name}
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={logout}
            style={btn('#334155')}
          >
            {t('common.logout', 'Logout')}
          </button>
        </div>
      </header>

      <nav className="admin-tabs" style={tabsBar}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`admin-tab${activeTab === tab ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{
              ...tabBtn,
              color: activeTab === tab ? '#3b82f6' : '#64748b',
              borderBottom:
                activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="dash-main" style={{ padding: 24 }}>
        {activeTab === 'overview' && (
          <div>
            <div
              className="dash-stat-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 24
              }}
            >
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="stat-card"
                  style={{
                    background: '#1e293b',
                    border: `1px solid ${k.color}33`,
                    borderRadius: 12,
                    padding: 20,
                    textAlign: 'center'
                  }}
                >
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{k.label}</p>
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 32,
                      fontWeight: 700,
                      color: k.color
                    }}
                  >
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="chart-card" style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Recent SOS Requests</h3>
              {loading ? (
                <p style={{ color: '#64748b' }}>Loading...</p>
              ) : sosList.length === 0 ? (
                <p style={{ color: '#64748b' }}>No SOS requests yet</p>
              ) : (
                sosList.slice(0, 5).map((sos) => (
                  <div
                    key={sos._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid #334155'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{sos.name}</span>
                      <span style={{ color: '#64748b', fontSize: 13, marginLeft: 12 }}>
                        {new Date(sos.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Badge color={priorityColor(sos.priority)} text={sos.priority} />
                      <Badge color={statusColor(sos.status)} text={sos.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
            <div style={chartCard}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16
                }}
              >
                <h3 style={{ margin: 0, fontSize: 15 }}>🧠 ML Predictions</h3>
                <button onClick={fetchPredictions} style={btn('#334155')}>
                  Refresh
                </button>
              </div>

              <h4 style={{ marginBottom: 10 }}>🌊 Flood Predictions</h4>

              {floodPredictions.length === 0 ? (
                <p style={{ color: '#64748b' }}>No flood predictions</p>
              ) : (
                floodPredictions.map((p, i) => {
                  const score = Number(p.risk_score || 0);
                  return (
                    <div
                      key={`${p.region || 'flood'}-${i}`}
                      style={{
                        background: '#0f172a',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                        border: `1px solid ${
                          score > 0.85 ? '#ef4444' : score > 0.65 ? '#f59e0b' : '#334155'
                        }`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <b>{p.region || 'Flood Risk Zone'}</b>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {p._hfMessage ? (
                              <span>{p._hfMessage}</span>
                            ) : (
                              <>
                                Rainfall: {p.rainfall_mm} mm | River: {p.river_level_m} m
                              </>
                            )}
                          </div>
                        </div>

                        <Badge
                          color={score > 0.85 ? '#ef4444' : '#10b981'}
                          text={`score ${score.toFixed(2)}`}
                        />
                      </div>

                      <button
                        onClick={() => prefillAlertFromPrediction(p)}
                        style={{ ...btn('#3b82f6'), marginTop: 8 }}
                      >
                        Prefill Alert
                      </button>
                    </div>
                  );
                })
              )}

              <h4 style={{ marginTop: 20, marginBottom: 10 }}>🌍 Earthquake Predictions</h4>

              {earthquakePredictions.length === 0 ? (
                <p style={{ color: '#64748b' }}>No earthquake predictions</p>
              ) : (
                earthquakePredictions.map((p, i) => {
                  const score = Number(p.alert_confidence || 0);

                  return (
                    <div
                      key={`${p.region || p.predicted_zone || 'earthquake'}-${i}`}
                      style={{
                        background: '#0f172a',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                        border: `1px solid ${
                          score > 0.85 ? '#ef4444' : score > 0.65 ? '#f59e0b' : '#334155'
                        }`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <b>{p.region || p.predicted_zone || 'Earthquake Risk Zone'}</b>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Magnitude: {Number(p.predicted_next_magnitude || 0).toFixed(2)}
                          </div>
                        </div>

                        <Badge
                          color={score > 0.85 ? '#ef4444' : '#10b981'}
                          text={`score ${score.toFixed(2)}`}
                        />
                      </div>

                      <button
                        onClick={() => prefillAlertFromPrediction(p)}
                        style={{ ...btn('#3b82f6'), marginTop: 8 }}
                      >
                        Prefill Alert
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={chartCard}>
              <h3 style={{ marginBottom: 10 }}>Hybrid System</h3>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>
                Flood and earthquake predictions are combined here. Admin verifies and sends alerts.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div
            className="data-table-wrap"
            style={{
              background: '#1e293b',
              borderRadius: 12,
              border: '1px solid #334155',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>👥 User Management</h3>
            </div>

            {loading ? (
              <p style={{ padding: '1.25rem', color: '#64748b' }}>Loading…</p>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: 12,
                          color: '#64748b',
                          fontWeight: 600
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={td}>{u.name}</td>
                      <td style={{ ...td, color: '#64748b' }}>{u.email}</td>
                      <td style={td}>
                        <Badge
                          color={
                            u.role === 'admin'
                              ? '#8b5cf6'
                              : u.role === 'ngo'
                                ? '#3b82f6'
                                : '#10b981'
                          }
                          text={u.role}
                        />
                      </td>
                      <td style={td}>
                        {u.blocked ? (
                          <Badge color="#ef4444" text="Blocked" />
                        ) : u.role === 'ngo' && !u.approved ? (
                          <Badge color="#f59e0b" text="Pending" />
                        ) : (
                          <Badge color="#10b981" text="Active" />
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {u.role === 'ngo' && !u.approved && !u.blocked && (
                            <button
                              type="button"
                              className="btn btn-xs btn-success"
                              onClick={() => approveNGO(u._id)}
                              style={btn('#16a34a')}
                            >
                              Approve
                            </button>
                          )}
                          {!u.blocked && u.role !== 'admin' && (
                            <button
                              type="button"
                              className="btn btn-xs btn-danger"
                              onClick={() => blockUser(u._id)}
                              style={btn('#dc2626')}
                            >
                              Block
                            </button>
                          )}
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              className="btn btn-xs btn-danger"
                              onClick={() => deleteUser(u._id)}
                              style={btn('#7f1d1d')}
                            >
                              Delete
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

        {activeTab === 'alerts' && (
          <div
            className="chart-grid"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <div className="chart-card" style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>⚠️ Create Disaster Alert</h3>

              <select
                className="form-control"
                value={alertForm.type}
                onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })}
                style={input}
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
                style={input}
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
                style={input}
              />

              <textarea
                className="form-control"
                placeholder="Alert message / evacuation instructions..."
                value={alertForm.message}
                onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                rows={3}
                style={{ ...input, resize: 'vertical' }}
              />

              <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px' }}>
                📍 Danger zone on map (optional)
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  className="form-control"
                  placeholder="Latitude (e.g. 17.3850)"
                  value={alertForm.lat}
                  onChange={(e) => setAlertForm({ ...alertForm, lat: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}
                  type="number"
                  step="any"
                />
                <input
                  className="form-control"
                  placeholder="Longitude (e.g. 78.4867)"
                  value={alertForm.lng}
                  onChange={(e) => setAlertForm({ ...alertForm, lng: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}
                  type="number"
                  step="any"
                />
              </div>

              <input
                className="form-control"
                placeholder="Danger zone radius in meters (e.g. 10000)"
                value={alertForm.radius}
                onChange={(e) => setAlertForm({ ...alertForm, radius: e.target.value })}
                style={{ ...input, marginTop: 8 }}
                type="number"
              />

              <button
                type="button"
                className="btn btn-danger"
                style={{
                  ...btn('#dc2626'),
                  width: '100%',
                  padding: '12px',
                  fontSize: 14,
                  marginTop: 4
                }}
                onClick={createAlert}
              >
                🔔 Broadcast Alert
              </button>
            </div>

            <div
              style={{
                ...chartCard,
                maxHeight: 600,
                overflowY: 'auto'
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📋 Active Alerts</h3>

              {translatedAlerts.length === 0 ? (
                <p style={{ color: '#64748b' }}>No alerts yet</p>
              ) : (
                translatedAlerts.map((a) => (
                  <div
                    key={a._id}
                    style={{
                      background: '#0f172a',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 10,
                      border: '1px solid #334155'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6
                      }}
                    >
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {getAlertIcon(a.type)} {a._tr?.type ?? a.type} — {a._tr?.region ?? a.region}
                      </span>
                      <Badge
                        color={
                          a.severity === 'critical'
                            ? '#ef4444'
                            : a.severity === 'high'
                              ? '#f59e0b'
                              : a.severity === 'moderate'
                                ? '#3b82f6'
                                : '#10b981'
                        }
                        text={a._tr?.severity ?? a.severity}
                      />
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 8px' }}>
                      {a._tr?.message ?? a.message}
                    </p>

                    {a.location?.lat && (
                      <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 6px' }}>
                        📍 {a.location.lat}, {a.location.lng} — radius: {a.radius}m
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: '#475569', fontSize: 11 }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="btn btn-xs btn-danger"
                        onClick={() => deleteAlert(a._id)}
                        style={btn('#7f1d1d')}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div
            className="chart-grid"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <div className="chart-card" style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📈 SOS Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sosPerDay}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card" style={chartCard}>
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

            <div className="chart-card" style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>🔴 Priority Breakdown</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
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

            <div className="chart-card" style={chartCard}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>👥 User Roles</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'Victims', count: users.filter((u) => u.role === 'victim').length },
                    { name: 'NGOs', count: users.filter((u) => u.role === 'ngo').length },
                    { name: 'Admins', count: users.filter((u) => u.role === 'admin').length }
                  ]}
                >
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
  return s === 'pending'
    ? '#f59e0b'
    : s === 'assigned'
      ? '#3b82f6'
      : s === 'in-progress'
        ? '#8b5cf6'
        : '#10b981';
}

function getAlertIcon(type) {
  switch (type) {
    case 'flood':
      return '🌊';
    case 'earthquake':
      return '🌍';
    case 'cyclone':
      return '🌀';
    case 'fire':
      return '🔥';
    case 'tsunami':
      return '🌊';
    case 'landslide':
      return '⛰️';
    default:
      return '⚠️';
  }
}

function Badge({ color, text }) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize'
      }}
    >
      {text}
    </span>
  );
}

const pageShell = {
  minHeight: '100vh',
  background: '#0f172a',
  fontFamily: 'sans-serif',
  color: '#f1f5f9'
};

const headerStyle = {
  background: '#1e293b',
  borderBottom: '1px solid #334155',
  padding: '12px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const userPill = {
  color: '#64748b',
  fontSize: 14
};

const tabsBar = {
  background: '#1e293b',
  borderBottom: '1px solid #334155',
  padding: '0 24px',
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap'
};

const tabBtn = {
  padding: '12px 20px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  textTransform: 'capitalize',
  fontWeight: 600
};

const btn = (bg) => ({
  padding: '6px 14px',
  background: bg,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 500
});

const td = {
  padding: '12px 16px',
  fontSize: 14,
  background: '#0f172a',
  color: '#f1f5f9',
  verticalAlign: 'top'
};

const input = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: 12,
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  boxSizing: 'border-box'
};

const chartCard = {
  background: '#1e293b',
  borderRadius: 12,
  border: '1px solid #334155',
  padding: 20
};