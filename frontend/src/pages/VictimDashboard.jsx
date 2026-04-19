import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import socket from '../utils/socket';
import SafetyChatbot from '../components/SafetyChatbot';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { getSpeechLocale, transcriptMatchesSos } from '../i18n/speechLocales';
import { useTranslatedAlerts } from '../hooks/useTranslatedAlerts';
import './victim-theme.css';

/** Fresh GPS each tap; generous timeout for repeat triggers */
const GEO_SOS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

export default function VictimDashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sosStatus, setSosStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [mySos, setMySos] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const translatedAlerts = useTranslatedAlerts(alerts, i18n.language);
  const [isListening, setIsListening] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  /** When true, we keep voice listening (auto-start on login, optional auto-restart after keyword SOS). */
  const voiceArmedRef = useRef(false);
  const initVoiceSOSRef = useRef(() => {});

  const stopVoiceSOS = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    setShowTranscript(false);
  };

  const initVoiceSOS = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechLocale(i18n.language);

    recognition.onstart = () => {
      setIsListening(true);
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

      if (transcriptMatchesSos(fullTranscript, i18n.language)) {
        voiceArmedRef.current = false;
        stopVoiceSOS();
        setTimeout(() => triggerSOSVoice(fullTranscript), 100);
      }
    };

    recognition.onerror = (event) => {
      console.error('Voice error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        voiceArmedRef.current = false;
        alert(t('victim.micDenied'));
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!voiceArmedRef.current) return;
      window.setTimeout(() => {
        if (!voiceArmedRef.current) return;
        if (recognitionRef.current) return;
        initVoiceSOSRef.current();
      }, 200);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn('Speech start:', e);
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  useLayoutEffect(() => {
    initVoiceSOSRef.current = initVoiceSOS;
  });

  const toggleVoiceSOS = () => {
    if (isListening || recognitionRef.current) {
      voiceArmedRef.current = false;
      stopVoiceSOS();
    } else {
      voiceArmedRef.current = true;
      initVoiceSOS();
    }
  };

  const fetchMyStatus = async () => {
    try {
      const res = await api.get('/sos/my');
      if (res.data?.status != null) {
        setSosStatus(res.data.status);
        setMySos(res.data._id ? res.data : null);
      } else {
        setSosStatus(null);
        setMySos(null);
      }
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

  const applySosFeedback = (sos, voiceMsg, isVoice) => {
    setSosStatus(sos?.status || 'pending');
    setMySos(sos?._id ? sos : null);
    const repeatChannel =
      Number(sos?.manualTriggerCount) > 1 || Number(sos?.voiceTriggerCount) > 1;
    if (sos?.priority === 'red' && repeatChannel) {
      setMessage(t('victim.escalated'));
    } else if (isVoice) {
      setMessage(t('victim.voiceSent', { msg: voiceMsg }));
    } else {
      setMessage(t('victim.manualSent'));
    }
  };

  const triggerSOSVoice = (voiceMsg) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await api.post('/sos', {
            lat,
            lng,
            message: `Voice SOS: ${voiceMsg}`,
            source: 'voice',
          });
          const sos = res.data?.sos;
          applySosFeedback(sos, voiceMsg, true);
          voiceArmedRef.current = true;
          window.setTimeout(() => initVoiceSOSRef.current(), 900);
        } catch (err) {
          console.error('Send error:', err);
          setMessage(t('victim.voiceFailed'));
          voiceArmedRef.current = true;
          window.setTimeout(() => initVoiceSOSRef.current(), 600);
        }
      },
      () => {
        alert(t('victim.enableGpsSos'));
        voiceArmedRef.current = true;
        window.setTimeout(() => initVoiceSOSRef.current(), 600);
      },
      GEO_SOS
    );
  };

  const triggerSOS = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await api.post('/sos', { lat, lng, source: 'manual' });
          const sos = res.data?.sos;
          applySosFeedback(sos, '', false);
        } catch (err) {
          console.error(err);
          setMessage(t('victim.voiceFailed'));
        }
      },
      () => {
        alert(t('victim.enableGps'));
      },
      GEO_SOS
    );
  };

  useEffect(() => {
    socket.on('sos-update', (data) => {
      setSosStatus(data.status);
      if (data.message) setMessage(data.message);
      fetchMyStatus();
    });

    socket.on('new-alert', (alert) => {
      setAlerts((prev) => [alert, ...prev]);
      // New danger zone may bump our open SOS from yellow → red
      fetchMyStatus();
    });

    fetchMyStatus();
    fetchAlerts();

    return () => {
      socket.off('sos-update');
      socket.off('new-alert');
      voiceArmedRef.current = false;
      stopVoiceSOS();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only listeners; fetchMyStatus is stable enough
  }, []);

  /** Auto-start voice listen when the victim session is active (login / first open). */
  useEffect(() => {
    if (!user?.id) return undefined;
    voiceArmedRef.current = true;
    const t = window.setTimeout(() => initVoiceSOSRef.current(), 700);
    return () => {
      window.clearTimeout(t);
      voiceArmedRef.current = false;
      stopVoiceSOS();
    };
  }, [user?.id]);

  const prevSpeechLangRef = useRef(null);
  useEffect(() => {
    if (prevSpeechLangRef.current === null) {
      prevSpeechLangRef.current = i18n.language;
      return undefined;
    }
    if (prevSpeechLangRef.current === i18n.language) return undefined;
    prevSpeechLangRef.current = i18n.language;
    if (!voiceArmedRef.current) return undefined;
    if (!recognitionRef.current) return undefined;
    stopVoiceSOS();
    const timer = window.setTimeout(() => {
      if (voiceArmedRef.current) initVoiceSOSRef.current();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [i18n.language]);

  const statusColor = {
    pending: '#fbbf24',
    assigned: '#38bdf8',
    'in-progress': '#a78bfa',
    resolved: '#34d399',
  };

  const displayName = user?.name?.trim() || 'there';

  return (
    <div className="vx">
      <div className="vx-bg" aria-hidden />
      <div className="vx-gridlines" aria-hidden />

      <nav className="vx-nav">
        <div className="vx-brand">
          <span className="vx-brand-mark" aria-hidden>
            ◎
          </span>
          <span>{t('login.brand')}</span>
        </div>
        <div className="vx-nav-actions">
          <ThemeToggle />
          <LanguageSwitcher compact />
          <button type="button" className="btn btn-ghost btn-xs" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </nav>

      <main className="vx-main">
        <p className="vx-kicker">{t('victim.kicker')}</p>
        <h1 className="vx-title">{t('victim.welcome', { name: displayName })}</h1>
        <p className="vx-lead">{t('victim.intro')}</p>

        <div className="vx-bento">
          <article className="vx-panel vx-panel--panic">
            <p className="vx-panel-h">{t('victim.manualSos')}</p>
            <h2 className="vx-panel-title">{t('victim.cardManualTitle')}</h2>
            <p className="vx-panel-desc">{t('victim.cardManualDesc')}</p>
            <div className="vx-panic-wrap">
              <div className="vx-panic-ring">
                <button type="button" className="vx-btn-panic" onClick={triggerSOS}>
                  {t('victim.sos')}
                </button>
              </div>
            </div>
          </article>

          <article className="vx-panel vx-panel--voice">
            <p className="vx-panel-h">{t('victim.voiceSos')}</p>
            <h2 className="vx-panel-title">{t('victim.cardVoiceTitle')}</h2>
            <p className="vx-panel-desc">{t('victim.cardVoiceDesc')}</p>
            <div className="vx-panic-wrap">
              <button
                type="button"
                className={`vx-btn-voice${isListening ? ' is-live' : ''}`}
                onClick={toggleVoiceSOS}
                disabled={!user}
                title={isListening ? t('victim.micTitleStop') : t('victim.micTitleStart')}
              >
                {isListening && <span className="vx-rec" aria-hidden />}
                <span aria-hidden>🎤</span>
              </button>
              <p className={`vx-voice-meta${isListening ? ' is-live' : ''}`}>
                {isListening ? `● ${t('victim.voiceActive')}` : t('victim.micTitleStart')}
              </p>
              {showTranscript && transcript && (
                <div className="vx-transcript">
                  {t('victim.heard')}: &ldquo;{transcript}&rdquo;
                </div>
              )}
            </div>
          </article>
        </div>

        {mySos?.assignedTo?.location?.lat != null &&
          mySos?.assignedTo?.location?.lng != null && (
            <div className="vx-team-loc" style={{ marginBottom: '1rem' }}>
              <p className="vx-team-loc-label">{t('victim.assignedTeamLocation')}</p>
              <p className="vx-team-loc-coords">
                {Number(mySos.assignedTo.location.lat).toFixed(5)},{' '}
                {Number(mySos.assignedTo.location.lng).toFixed(5)}
              </p>
              <p className="vx-team-loc-name">
                {mySos.assignedTo.ngoName || mySos.assignedTo.name}
              </p>
            </div>
          )}

        {sosStatus && (
          <div
            className="vx-status"
            style={{
              borderColor: statusColor[sosStatus],
              boxShadow: `0 0 0 1px ${statusColor[sosStatus]}33, 0 20px 50px ${statusColor[sosStatus]}18`,
            }}
          >
            <p className="vx-status-label">{t('victim.rescueStatus')}</p>
            <p className="vx-status-value" style={{ color: statusColor[sosStatus] }}>
              {sosStatus?.replace('-', ' ').toUpperCase()}
            </p>
            {message && <p className="vx-status-msg">{message}</p>}
          </div>
        )}

        <section className="vx-alerts">
          <h3>{t('victim.alertsTitle')}</h3>
          {alerts.length === 0 ? (
            <p className="empty-hint">{t('victim.noAlerts')}</p>
          ) : (
            <div className="vx-alert-list">
              {translatedAlerts.map((alert) => {
                const sev =
                  alert.severity === 'critical'
                    ? '#f87171'
                    : alert.severity === 'high'
                      ? '#fbbf24'
                      : '#38bdf8';
                const tr = alert._tr || {};
                return (
                  <div
                    key={alert._id}
                    className="vx-alert"
                    style={{ borderLeftColor: sev }}
                  >
                    <div className="vx-alert-top">
                      <span className="vx-alert-type">
                        {tr.type ?? alert.type} — {tr.region ?? alert.region}
                      </span>
                      <span
                        className="vx-badge"
                        style={{ background: `${sev}22`, color: sev }}
                      >
                        {tr.severity ?? alert.severity}
                      </span>
                    </div>
                    <p className="vx-alert-body">{tr.message ?? alert.message}</p>
                    <p className="vx-alert-time">{new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <SafetyChatbot />
    </div>
  );
}
