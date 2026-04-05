import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';

export default function VictimDashboard() {
  const { user, logout } = useAuth();
  const [sosStatus, setSosStatus] = useState(null);
  const [sending, setSending]     = useState(false);
  const [message, setMessage]     = useState('');

  // Listen for status updates from NGO in real-time
  useEffect(() => {
    socket.on('sos-update', (data) => {
      setSosStatus(data.status);
      setMessage(data.message || '');
    });

    // Fetch existing SOS status on load
    fetchMyStatus();

    return () => socket.off('sos-update');
  }, []);

  const fetchMyStatus = async () => {
    try {
      const res = await api.get('/sos/my');
      if (res.data.status) setSosStatus(res.data.status);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerSOS = async () => {
    setSending(true);
    try {
      // Get GPS location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;

          await api.post('/sos', { lat, lng });
          setSosStatus('pending');
          setMessage('SOS sent! Help is on the way.');
          setSending(false);
        },
        (error) => {
          alert('Could not get location. Please enable GPS.');
          setSending(false);
        }
      );
    } catch (err) {
      alert('Failed to send SOS. Try again.');
      setSending(false);
    }
  };

  // Color based on status
  const statusColor = {
    pending:     '#f59e0b',
    assigned:    '#3b82f6',
    'in-progress': '#8b5cf6',
    resolved:    '#10b981'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0f172a', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{ 
        position: 'absolute', top: 20, right: 20 
      }}>
        <button onClick={logout} style={{ 
          background: 'transparent', 
          color: '#94a3b8', 
          border: '1px solid #334155',
          padding: '8px 16px', 
          borderRadius: 8, 
          cursor: 'pointer' 
        }}>
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
          letterSpacing: 4
        }}
      >
        {sending ? '...' : 'SOS'}
      </button>

      {/* Status */}
      {sosStatus && (
        <div style={{ 
          marginTop: 40, 
          padding: '16px 32px', 
          background: '#1e293b',
          borderRadius: 12,
          border: `1px solid ${statusColor[sosStatus] || '#334155'}`,
          textAlign: 'center'
        }}>
          <p style={{ 
            color: statusColor[sosStatus], 
            fontSize: 18, 
            fontWeight: 600,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: 2
          }}>
            {sosStatus}
          </p>
          {message && (
            <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}