// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const injectedStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes signalPath {
    0% { left: 18%; background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.35); }
    49% { left: 82%; background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.35); }
    50% { left: 82%; background: #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); }
    99% { left: 18%; background: #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); }
    100% { left: 18%; background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.35); }
  }

  @keyframes nodePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .login-shell {
    min-height: 100vh;
    background: radial-gradient(circle at 20% 20%, rgba(245, 158, 11, 0.15), transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.12), transparent 50%),
      linear-gradient(135deg, var(--bg-primary) 0%, #f8f4e8 50%, #fffaf0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    animation: fadeIn 0.8s ease forwards;
  }


  .network-panel {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .network-track {
    position: absolute;
    height: 1px;
    background: rgba(148, 163, 184, 0.3);
    border-radius: 999px;
    top: 50%;
    transform: translateY(-50%);
  }

  .network-track-left {
    left: 18%;
    width: 20%;
  }

  .network-track-right {
    right: 18%;
    width: 20%;
  }

  .signal-dot {
    position: absolute;
    top: 50%;
    left: 18%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: #ef4444;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);
    animation: signalPath 4s linear infinite;
  }

  .node-wrapper {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: auto;
  }

  .node {
    width: 86px;
    height: 86px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.09);
    border: 4px solid rgba(255, 255, 255, 0.9);
    position: relative;
    transition: transform 0.28s ease, box-shadow 0.28s ease;
    background-clip: padding-box;
  }

  .node.red {
    background: rgba(220, 38, 38, 0.9);
    border-color: rgba(248, 113, 113, 0.95);
  }

  .node.green {
    background: rgba(5, 150, 105, 0.9);
    border-color: rgba(6, 214, 160, 0.95);
  }

  .node-icon {
    font-size: 28px;
  }

  .node-label {
    margin-top: 10px;
    color: #000000;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    text-shadow: 0 1px 3px rgba(255, 255, 255, 0.35);
  }

  .node-tooltip {
    position: absolute;
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.92);
    color: white;
    font-size: 11px;
    padding: 6px 10px;
    border-radius: 999px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;
  }

  .node-wrapper:hover .node-tooltip {
    opacity: 1;
  }

  .node.red:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 22px 48px rgba(239, 68, 68, 0.2);
  }

  .node.green:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 22px 48px rgba(16, 185, 129, 0.2);
  }

  .node-pulse {
    position: absolute;
    inset: -10px;
    border-radius: 999px;
    border: 2px solid rgba(239, 68, 68, 0.25);
    animation: ripple 0.6s ease-out;
    pointer-events: none;
  }

  .login-card {
    position: relative;
    width: min(420px, calc(100% - 32px));
    background: white;
    border-radius: 28px;
    padding: 3rem 2.5rem;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
    z-index: 2;
    backdrop-filter: blur(8px);
    animation: slideUp 0.6s ease-out both;
    opacity: 0;
  }

  .login-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 30px 80px rgba(15, 23, 42, 0.16);
  }

  .login-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #111827;
    margin-bottom: 8px;
    font-size: 28px;
    font-weight: 700;
  }

  .login-subtitle {
    text-align: center;
    color: #64748b;
    margin-bottom: 32px;
    font-size: 14px;
  }

  .input-field {
    width: 100%;
    padding: 14px 16px;
    margin: 0 auto 14px;
    border-radius: 14px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    color: #0f172a;
    font-size: 14px;
    outline: none;
    transition: all 0.28s ease;
    display: block;
    max-width: 100%;
    box-sizing: border-box;
  }

  .input-field:focus {
    border-color: #ef4444;
    background: white;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08);
    transform: translateY(-1px);
  }

  .submit-button {
    width: 100%;
    padding: 14px 0;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    font-size: 15px;
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transition: transform 0.28s ease, box-shadow 0.28s ease, opacity 0.28s ease;
    position: relative;
    overflow: hidden;
  }

  .submit-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(220, 38, 38, 0.28);
  }

  .submit-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .button-ripple {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    pointer-events: none;
    animation: ripple 0.55s ease-out;
  }

  .toggle-text {
    color: #64748b;
    text-align: center;
    margin-top: 26px;
    font-size: 14px;
  }

  .toggle-link {
    color: #dc2626;
    font-weight: 700;
    cursor: pointer;
    transition: color 0.2s ease, opacity 0.2s ease;
  }

  .toggle-link:hover {
    color: #b91c1c;
    opacity: 0.92;
  }

  @media (max-width: 768px) {
    .login-card {
      width: calc(100% - 32px);
      padding: 2.2rem 1.6rem;
    }

    .network-track {
      width: 80%;
      left: 10%;
      top: 48%;
    }

    .signal-dot {
      top: 48%;
    }

    .node-wrapper {
      top: 48%;
    }

    .node-wrapper:nth-of-type(1) {
      left: 12% !important;
    }

    .node-wrapper:nth-of-type(2) {
      left: 88% !important;
    }

    .login-title {
      font-size: 24px;
    }

    .login-subtitle {
      margin-bottom: 24px;
      font-size: 13px;
    }

    .input-field {
      padding: 12px 14px;
    }

    .submit-button {
      padding: 13px 0;
    }
  }

  @media (max-width: 480px) {
    .network-panel {
      display: none;
    }

    .login-card {
      width: calc(100% - 24px);
      padding: 1.8rem 1.2rem;
      border-radius: 22px;
    }

    .login-title {
      font-size: 22px;
    }

    .login-subtitle {
      font-size: 13px;
      margin-bottom: 18px;
    }

    .input-field {
      padding: 11px 14px;
      margin-bottom: 12px;
    }

    .submit-button:hover {
      transform: none;
      box-shadow: 0 10px 24px rgba(220, 38, 38, 0.24);
    }

    .login-card:hover {
      transform: none;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
    }
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = injectedStyles;
  document.head.appendChild(style);
}

function NetworkBackground() {
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
        <div className="node-label">SOS</div>
        {hovered === 'civilian' && (
          <div className="node-tooltip">SOS signal detected</div>
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
        <div className="node-label">NGO</div>
        {hovered === 'ngo' && (
          <div className="node-tooltip">Response activated</div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusField, setFocusField] = useState(null);
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
      setError(err.response?.data?.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="login-shell">
      <NetworkBackground />
      <div className="login-card">
        <div className="login-title">
          <span>🚨</span>
          DisasterAlert
        </div>
        <p className="login-subtitle">
          {isRegister ? 'Create your account' : 'Sign in to continue'}
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(254, 226, 226, 0.6)',
              color: '#991b1b',
              borderRadius: 12,
              padding: '12px 14px',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              className="input-field"
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              onFocus={() => setFocusField('name')}
              onBlur={() => setFocusField(null)}
              required
            />
          )}

          <input
            className="input-field"
            name="email"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={handleChange}
            onFocus={() => setFocusField('email')}
            onBlur={() => setFocusField(null)}
            required
          />

          <input
            className="input-field"
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            onFocus={() => setFocusField('password')}
            onBlur={() => setFocusField(null)}
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
              <option value="victim">Victim / Civilian</option>
              <option value="ngo">NGO / Rescue Team</option>
            </select>
          )}

          {isRegister && form.role === 'ngo' && (
            <input
              className="input-field"
              name="ngoName"
              placeholder="NGO / Organisation name"
              value={form.ngoName}
              onChange={handleChange}
              onFocus={() => setFocusField('ngoName')}
              onBlur={() => setFocusField(null)}
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
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="toggle-text">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            className="toggle-link"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
          >
            {isRegister ? 'Login' : 'Register'}
          </span>
        </p>
      </div>
    </div>
  );
}
