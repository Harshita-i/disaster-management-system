import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';

export default function VictimDashboard() {
  const { user, logout } = useAuth();
  const [sosStatus, setSosStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [alerts, setAlerts] = useState([]);

  // Listen for status updates & alerts
  useEffect(() => {
    socket.on('sos-update', (data) => {
      setSosStatus(data.status);
      if (data.message) setMessage(data.message);
    });

    socket.on('new-alert', (alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    fetchMyStatus();
    fetchAlerts();

    return () => {
      socket.off('sos-update');
      socket.off('new-alert');
    };
  }, []);

  // Victim SOS status from /api/sos/my
  const fetchMyStatus = async () => {
    try {
      const res = await api.get('/sos/my');
      if (res.data?.status) {
        setSosStatus(res.data.status);
      }
    } catch (err) {
      console.error('Failed to fetch SOS status:', err);
    }
  };

  // Alerts from /api/alerts
  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  // Victim triggers SOS to /api/sos
  const triggerSOS = async () => {
    setSending(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          await api.post('/sos', { lat, lng });
          setSosStatus('pending');
          setMessage('SOS sent! Help is on the way.');
          setSending(false);
        },
        () => {
          alert('Could not get location. Please enable GPS.');
          setSending(false);
        }
      );
    } catch (err) {
      alert('Failed to send SOS. Try again.');
      setSending(false);
    }
  };

  const statusColor = {
    pending: '#f59e0b',
    assigned: '#3b82f6',
    'in-progress': '#8b5cf6',
    resolved: '#10b981',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        fontFamily: 'sans-serif',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button
          onClick={logout}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: '1px solid #334155',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <h2 style={{ color: '#94a3b8', marginBottom: 8 }}>
        Welcome, {user?.name}
      </h2>
      <p style={{ color: '#475569', marginBottom: 48 }}>
        Press the button below if you need emergency help
      </p>

      {/* SOS Button */}
      <button
        onClick={triggerSOS}
        disabled={sending || sosStatus === 'pending' || sosStatus === 'assigned'}
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: sending ? '#7f1d1d' : '#dc2626',
          color: 'white',
          fontSize: 32,
          fontWeight: 'bold',
          border: '8px solid #ef4444',
          cursor: sending ? 'not-allowed' : 'pointer',
          boxShadow: '0 0 60px #dc262688',
          transition: 'all 0.2s',
          letterSpacing: 4,
        }}
      >
        {sending ? '...' : 'SOS'}
      </button>

      {/* Rescue Status */}
      {sosStatus && (
        <div
          style={{
            marginTop: 40,
            padding: '16px 32px',
            background: '#1e293b',
            borderRadius: 12,
            border: `1px solid ${statusColor[sosStatus] || '#334155'}`,
            textAlign: 'center',
            width: '100%',
            maxWidth: 400,
          }}
        >
          <h3 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>Rescue Status</h3>
          <p
            style={{
              color: statusColor[sosStatus],
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {sosStatus}
          </p>
          {message && (
            <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
              {message}
            </p>
          )}
        </div>
      )}

      {/* Alerts Panel */}
      <div
        style={{
          marginTop: 40,
          padding: '16px 32px',
          background: '#1e293b',
          borderRadius: 12,
          border: '1px solid #334155',
          width: '100%',
          maxWidth: 600,
        }}
      >
        <h3 style={{ color: '#f1f5f9', margin: '0 0 16px' }}>
          Alerts Panel
        </h3>
        {alerts.length === 0 ? (
          <p style={{ color: '#64748b' }}>No active alerts</p>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {alerts.map((alert) => (
              <div
                key={alert._id}
                style={{
                  background: '#0f172a',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                  border: '1px solid #334155',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, textTransform: 'capitalize' }}
                  >
                    🌊 {alert.type} — {alert.region}
                  </span>
                  <span
                    style={{
                      background:
                        alert.severity === 'critical'
                          ? '#ef444422'
                          : alert.severity === 'high'
                          ? '#f59e0b22'
                          : '#3b82f622',
                      color:
                        alert.severity === 'critical'
                          ? '#ef4444'
                          : alert.severity === 'high'
                          ? '#f59e0b'
                          : '#3b82f6',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p
                  style={{
                    color: '#94a3b8',
                    fontSize: 13,
                    margin: 0,
                  }}
                >
                  {alert.message}
                </p>
                <p
                  style={{
                    color: '#475569',
                    fontSize: 11,
                    margin: '8px 0 0',
                  }}
                >
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}