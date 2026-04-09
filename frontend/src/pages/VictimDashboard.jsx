import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import SafetyChatbot from '../components/SafetyChatbot'; 

export default function VictimDashboard() {
  const { user, logout } = useAuth();
  const [sosStatus, setSosStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [alerts, setAlerts] = useState([]);
  // Voice SOS states
  const [isListening, setIsListening] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

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
    // Auto-start voice SOS after login
    setTimeout(() => initVoiceSOS(), 1500);

    return () => {
      socket.off('sos-update');
      socket.off('new-alert');
      stopVoiceSOS();
    };
  }, []);

  const initVoiceSOS = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('Voice SOS continuous listening started...');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const fullTranscript = (finalTranscript + interimTranscript).trim();
      if (fullTranscript) {
        setTranscript(fullTranscript);
        setShowTranscript(true);
      }

      // Keyword detection - moderate yellow, backend handles red for danger zone
      const keywords = ['help', 'sos', 'danger'];
      if (keywords.some((keyword) => fullTranscript.toLowerCase().includes(keyword))) {
        console.log('*** SOS KEYWORDS DETECTED (moderate):', fullTranscript.toUpperCase());
        stopVoiceSOS(); // STOP recording
        setTimeout(() => triggerSOSVoice(fullTranscript), 100);
      }
    };

    recognition.onerror = (event) => {
      console.error('Voice error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Enable in browser settings.');
      }
      // No auto-restart - stay off
    };

    recognition.onend = () => {
      console.log('Voice session ended');
      setIsListening(false);
      // NO AUTO-RESTART - listen continuously until keyword found or toggle stop
      // Will restart only if toggled or error recovery
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceSOS = () => {
    console.log('Stopping voice SOS');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    setShowTranscript(false);
  };

  const toggleVoiceSOS = () => {
    if (isListening) {
      stopVoiceSOS();
    } else {
      initVoiceSOS();
    }
  };

  const fetchMyStatus = async () => {
    try {
      const res = await api.get('/sos/my');
      if (res.data) setSosStatus(res.data.status);
    } catch (err) {
      console.error('Status fetch error:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data || []);
    } catch (err) {
      console.error('Alerts fetch error:', err);
    }
  };

  const triggerSOSVoice = async (voiceMsg) => {
    setSending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await api.post('/sos', { lat, lng, message: `Voice SOS: ${voiceMsg}` });
          setSosStatus('pending');
          setMessage(`Voice SOS sent for "${voiceMsg}". Rangers notified!`);
          console.log('Voice SOS sent successfully');
        } catch (err) {
          console.error('Send error:', err);
          setMessage('Voice SOS failed - try manual button');
        } finally {
          setSending(false);
        }
      },
      () => {
        alert('Enable GPS for SOS');
        setSending(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const triggerSOS = async () => {
    setSending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        await api.post('/sos', { lat, lng });
        setSosStatus('pending');
        setMessage('Manual SOS sent!');
        setSending(false);
      },
      () => {
        alert('Enable GPS');
        setSending(false);
      }
    );
  };

  const statusColor = {
    pending: '#f59e0b', // yellow moderate
    assigned: '#3b82f6',
    'in-progress': '#8b5cf6',
    resolved: '#10b981' // green
  };

  return (
<div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'sans-serif', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button onClick={logout} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      <h2 style={{ color: '#94a3b8', marginBottom: 8 }}>Welcome, {user?.name}</h2>
      <p style={{ color: '#475569', marginBottom: 40 }}>Emergency buttons below. Voice SOS auto-listens continuously for "help", "SOS", "danger".</p>

      {/* SOS Buttons SIDE-BY-SIDE */}
      <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Manual SOS - RED */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={triggerSOS}
            disabled={sending}
            style={{
              width: 200, height: 200, borderRadius: '50%',
              background: sending ? '#7f1d1d' : '#dc2626', color: 'white',
              fontSize: 32, fontWeight: 'bold', border: '8px solid #ef4444',
              cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? '0 0 30px #7f1d1d88' : '0 0 60px #dc262688',
              transition: 'all 0.2s', letterSpacing: 4, userSelect: 'none'
            }}
          >
            {sending ? 'SENDING...' : 'SOS'}
          </button>
          <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 12, fontWeight: 500 }}>Manual SOS</div>
        </div>

        {/* Voice SOS - GREEN MIC */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={toggleVoiceSOS}
            disabled={!user || sending}
            style={{
              width: 160, height: 160, borderRadius: '50%',
              background: isListening ? '#059669' : '#16a34a', color: 'white',
              fontSize: 52, fontWeight: 'bold', border: `8px solid ${isListening ? '#10b981' : '#22c55e'}`,
              cursor: 'pointer', boxShadow: isListening ? '0 0 60px #10b981cc' : '0 0 40px #22c55e88',
              transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
              animation: isListening ? 'pulse-mic 1.8s infinite' : 'none'
            }}
            title={isListening ? 'Listening... Say HELP, SOS or DANGER' : 'Click or auto-start Voice SOS'}
          >
            {isListening && <div style={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, background: '#ef4444', borderRadius: '50%', animation: 'blink 1s infinite' }}></div>}
            🎤
          </button>
          <div style={{ color: isListening ? '#10b981' : '#94a3b8', fontSize: 14, marginTop: 12, fontWeight: isListening ? 'bold' : 500 }}>
            {isListening ? '🔴 VOICE SOS ACTIVE' : 'Voice SOS'}
          </div>
          {showTranscript && transcript && (
            <div style={{ color: '#f8fafc', fontSize: 12, marginTop: 6, padding: '4px 8px', background: 'rgba(16,185,129,0.2)', borderRadius: 6, maxWidth: 200, fontStyle: 'italic' }}>
              heard: "{transcript}"
            </div>
          )}
        </div>
      </div>

      {/* Status & Alerts */}
      {sosStatus && (
        <div style={{ marginTop: 40, padding: '20px 32px', background: '#1e293b', borderRadius: 16, border: `3px solid ${statusColor[sosStatus]}`, textAlign: 'center', width: '100%', maxWidth: 420, boxShadow: `0 10px 30px ${statusColor[sosStatus]}22` }}>
          <h3 style={{ color: '#f1f5f9', margin: '0 0 12px', fontSize: 20 }}>Rescue Status</h3>
          <p style={{ color: statusColor[sosStatus], fontSize: 24, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: 3 }}>
            {sosStatus?.toUpperCase()}
          </p>
          {message && <p style={{ color: '#94a3b8', marginTop: 12, fontSize: 14, lineHeight: 1.4 }}>{message}</p>}
        </div>
      )}

      <div style={{ marginTop: 40, padding: '20px 32px', background: '#1e293b', borderRadius: 12, border: '1px solid #334155', width: '100%', maxWidth: 600 }}>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 20px' }}>📢 Alerts</h3>
        {alerts.length === 0 ? (
          <p style={{ color: '#64748b' }}>No active disaster alerts</p>
        ) : (
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {alerts.map((alert) => (
              <div key={alert._id} style={{ background: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 12, borderLeft: `4px solid ${alert.severity === 'critical' ? '#ef4444' : alert.severity === 'high' ? '#f59e0b' : '#3b82f6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>🌊 {alert.type} - {alert.region}</span>
                  <span style={{
                    background: alert.severity === 'critical' ? '#ef444422' : alert.severity === 'high' ? '#f59e0b22' : '#3b82f622',
                    color: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'high' ? '#f59e0b' : '#3b82f6',
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700
                  }}>
                    {alert.severity?.toUpperCase()}
                  </span>
                </div>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>{alert.message}</p>
                <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <SafetyChatbot />
      <style>{`
        @keyframes pulse-mic {
          0%, 100% { box-shadow: 0 0 40px #10b98188; }
          50% { box-shadow: 0 0 70px #10b981dd; }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

