// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import LanguageSwitcher from '../components/LanguageSwitcher';

function NetworkBackground() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);
  const [pulse, setPulse] = useState(false);

  const handleClick = () => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="network-panel">
      <div className="network-track network-track-left" />
      <div className="network-track network-track-right" />
      <div
        className="node-wrapper"
        style={{ left: '18%' }}
        onMouseEnter={() => setHovered('civilian')}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="node red" onClick={handleClick}>
          <div className="node-icon">🚨</div>
          {pulse && <span className="node-pulse" />}
        </div>
        <div className="node-label">{t('networkBg.labelSos')}</div>
        {hovered === 'civilian' && (
          <div className="node-tooltip">{t('networkBg.tooltipSos')}</div>
        )}
      </div>

      <div className="signal-dot" />

      <div
        className="node-wrapper"
        style={{ right: '18%' }}
        onMouseEnter={() => setHovered('ngo')}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="node green">
          <div className="node-icon">🛡️</div>
        </div>
        <div className="node-label">{t('networkBg.labelNgo')}</div>
        {hovered === 'ngo' && (
          <div className="node-tooltip">{t('networkBg.tooltipNgo')}</div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buttonRipples, setButtonRipples] = useState([]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'victim',
    ngoName: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleButtonClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rippleId = Date.now();
    setButtonRipples((prev) => [...prev, { id: rippleId, x, y }]);
    window.setTimeout(() => {
      setButtonRipples((prev) => prev.filter((item) => item.id !== rippleId));
    }, 550);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const res = await api.post('/auth/register', form);
        login(res.data.token, res.data.user);
      } else {
        const res = await api.post('/auth/login', {
          email: form.email,
          password: form.password,
        });
        login(res.data.token, res.data.user);
        const role = res.data.user.role;
        if (role === 'victim') navigate('/victim');
        if (role === 'ngo') navigate('/ngo');
        if (role === 'admin') navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || t('login.errorGeneric'));
    }
    setLoading(false);
  };

  return (
    <div className="login-shell">
      <div className="login-lang">
        <LanguageSwitcher variant="light" />
      </div>
      <NetworkBackground />
      <div className="login-card">
        <div className="login-title">
          <span>🚨</span>
          {t('login.brand')}
        </div>
        <p className="login-subtitle">
          {isRegister ? t('login.subtitleRegister') : t('login.subtitleLogin')}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              className="input-field"
              name="name"
              placeholder={t('login.placeholderName')}
              value={form.name}
              onChange={handleChange}
              required
            />
          )}

          <input
            className="input-field"
            name="email"
            type="email"
            placeholder={t('login.placeholderEmail')}
            value={form.email}
            onChange={handleChange}
            required
          />

          <input
            className="input-field"
            name="password"
            type="password"
            placeholder={t('login.placeholderPassword')}
            value={form.password}
            onChange={handleChange}
            required
          />

          {isRegister && (
            <select
              className="input-field"
              name="role"
              value={form.role}
              onChange={handleChange}
              required
            >
              <option value="victim">{t('login.roleVictim')}</option>
              <option value="ngo">{t('login.roleNgo')}</option>
            </select>
          )}

          {isRegister && form.role === 'ngo' && (
            <input
              className="input-field"
              name="ngoName"
              placeholder={t('login.placeholderNgoName')}
              value={form.ngoName}
              onChange={handleChange}
            />
          )}

          <button
            className="submit-button"
            type="submit"
            disabled={loading}
            onMouseDown={handleButtonClick}
          >
            {buttonRipples.map((ripple) => (
              <span
                key={ripple.id}
                className="button-ripple"
                style={{ left: ripple.x, top: ripple.y, transform: 'translate(-50%, -50%)' }}
              />
            ))}
            {loading ? t('login.pleaseWait') : isRegister ? t('login.register') : t('login.login')}
          </button>
        </form>

        <p className="toggle-text">
          {isRegister ? t('login.toggleHasAccount') : t('login.toggleNoAccount')}{' '}
          <span
            className="toggle-link"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
          >
            {isRegister ? t('login.toggleLogin') : t('login.toggleRegister')}
          </span>
        </p>
      </div>
    </div>
  );
}
