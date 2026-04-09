// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const animations = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes softPulse {
    0%, 100% {
      filter: drop-shadow(0 0 2px #dc2626);
    }
    50% {
      filter: drop-shadow(0 0 12px #dc2626);
    }
  }

  @keyframes ngoRespond {
    0%, 80% {
      filter: drop-shadow(0 0 0px #10b981);
    }
    90%, 100% {
      filter: drop-shadow(0 0 12px #10b981);
    }
  }

  @keyframes lineSignal {
    0%, 100% {
      stroke: #cbd5e1;
      stroke-width: 0.3;
      opacity: 0.4;
    }
    30%, 70% {
      stroke: #ef4444;
      stroke-width: 0.5;
      opacity: 0.8;
    }
  }

  @keyframes lineResponse {
    0%, 100% {
      stroke: #cbd5e1;
      stroke-width: 0.3;
      opacity: 0.4;
    }
    80%, 95% {
      stroke: #10b981;
      stroke-width: 0.5;
      opacity: 0.8;
    }
  }

  @keyframes cardHover {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(-4px);
    }
  }

  @keyframes ripple {
    from {
      r: 0;
      opacity: 0.8;
    }
    to {
      r: 60;
      opacity: 0;
    }
  }

  svg.network-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.7;
    filter: blur(0.5px);
  }
`;

// Inject animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animations;
  document.head.appendChild(style);
}

// Network Background Animation Component
function NetworkAnimation() {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [ripples, setRipples] = useState([]);

  const nodes = [
    { id: 'civilian', x: 20, y: 60, label: 'Civilian SOS', color: '#dc2626' },
    { id: 'helper', x: 80, y: 40, label: 'NGO Response', color: '#10b981' }
  ];

  const connections = [
    { from: 0, to: 1 } // civilian to NGO
  ];

  const handleNodeClick = (nodeId, x, y) => {
    const newRipple = { id: Date.now(), x, y };
    setRipples([...ripples, newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);
  };

  // Create a signal that travels along a path
  const SignalDot = ({ fromNode, toNode, delay, connIdx }) => {
    const distance = Math.sqrt(
      Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2)
    );
    
    return (
      <g key={`signal-${connIdx}`}>
        {/* Animated signal dot */}
        <animateMotion
          dur={`${distance * 0.5}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        >
          <circle
            cx={fromNode.x}
            cy={fromNode.y}
            r="1.2"
            fill="#ef4444"
            opacity="0.9"
            style={{
              filter: 'drop-shadow(0 0 2px #ef4444)',
              animation: `signalTravel ${distance * 0.5}s ease-in-out infinite`
            }}
          />
          <mpath href={`#path-${connIdx}`} />
        </animateMotion>
      </g>
    );
  };

  // Calculate total animation cycle
  const totalCycle = 7; // Total duration before restart

  return (
    <svg
      className="network-background"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.05 }} />
          <stop offset="100%" style={{ stopColor: '#f0f9ff', stopOpacity: 0.05 }} />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Path definitions for animateMotion */}
        {connections.map((conn, idx) => {
          const fromNode = nodes[conn.from];
          const toNode = nodes[conn.to];
          return (
            <path
              key={`path-def-${idx}`}
              id={`path-${idx}`}
              d={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
            />
          );
        })}
      </defs>

      {/* Background */}
      <rect width="100" height="100" fill="url(#bgGradient)" />

      {/* Connection Lines with animation */}
      {connections.map((conn, idx) => {
        const fromNode = nodes[conn.from];
        const toNode = nodes[conn.to];

        return (
          <g key={`line-group-${idx}`}>
            {/* Signal line from civilian to NGO (red animation) */}
            <line
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke="#cbd5e1"
              strokeWidth="0.3"
              opacity="0.4"
              style={{
                animation: `lineSignal 4s ease-in-out infinite`,
              }}
            />

            {/* Response line back (green animation) */}
            <line
              x1={toNode.x}
              y1={toNode.y}
              x2={fromNode.x}
              y2={fromNode.y}
              stroke="#cbd5e1"
              strokeWidth="0.3"
              opacity="0.4"
              style={{
                animation: `lineResponse 4s ease-in-out infinite`,
              }}
            />

            {/* Moving signal dot */}
            <g>
              <animateMotion dur="4s" repeatCount="indefinite">
                <circle
                  cx={fromNode.x}
                  cy={fromNode.y}
                  r="1"
                  fill="#ef4444"
                  opacity="0.8"
                  style={{
                    filter: 'drop-shadow(0 0 3px #ef4444)',
                  }}
                />
                <mpath href={`#path-${idx}`} />
              </animateMotion>
            </g>
          </g>
        );
      })}

      {/* Nodes - Interactive */}
      {nodes.map((node, idx) => (
        <g key={`node-${idx}`}>
          {/* Hover text background */}
          {hoveredNode === node.id && (
            <g>
              <rect
                x={node.x - 25}
                y={node.y - 20}
                width="50"
                height="14"
                fill="#1f2937"
                rx="4"
                opacity="0.9"
              />
              <text
                x={node.x}
                y={node.y - 9}
                textAnchor="middle"
                fill="white"
                fontSize="3"
                fontWeight="500"
              >
                {idx === 0 ? 'SOS Sent' : 'Help Sent'}
              </text>
            </g>
          )}

          {/* Node Circle - Interactive */}
          <g
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => handleNodeClick(node.id, node.x, node.y)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r="4.5"
              fill={node.color}
              opacity="0.9"
              style={{
                animation: idx === 0 ? 'softPulse 3s ease-in-out infinite' : 
                           idx === 1 ? 'ngoRespond 4s ease-in-out infinite' : 'none',
                transition: 'all 0.3s ease',
                filter: hoveredNode === node.id ? `drop-shadow(0 0 8px ${node.color})` : `drop-shadow(0 0 3px ${node.color})`,
              }}
            />

            {/* Outer glow ring */}
            <circle
              cx={node.x}
              cy={node.y}
              r="6"
              fill="none"
              stroke={node.color}
              strokeWidth="0.3"
              opacity={hoveredNode === node.id ? 0.6 : 0.2}
              style={{
                transition: 'all 0.3s ease',
              }}
            />
          </g>

          {/* Ripple effect on click */}
          {ripples.map((ripple) => (
            <circle
              key={ripple.id}
              cx={node.x}
              cy={node.y}
              r="0"
              fill="none"
              stroke={node.color}
              strokeWidth="0.5"
              opacity="0.6"
              style={{
                animation: `ripple 0.6s ease-out`,
                pointerEvents: 'none'
              }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [form, setForm] = useState({
    name:     '',
    email:    '',
    password: '',
    role:     'victim',
    ngoName:  ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
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
          email:    form.email,
          password: form.password
        });
        login(res.data.token, res.data.user);
        // Redirect based on role
        const role = res.data.user.role;
        if (role === 'victim') navigate('/victim');
        if (role === 'ngo')    navigate('/ngo');
        if (role === 'admin')  navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      animation: 'fadeIn 0.8s ease-in',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Network Animation Background */}
      <NetworkAnimation />

      {/* Decorative background elements */}
      <div style={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 300,
        height: 300,
        background: 'rgba(220, 38, 38, 0.08)',
        borderRadius: '50%',
        animation: 'pulse 4s ease-in-out infinite'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 400,
        height: 400,
        background: 'rgba(59, 130, 246, 0.08)',
        borderRadius: '50%',
        animation: 'pulse 5s ease-in-out infinite 0.5s'
      }}></div>

      <div style={{
        background: 'white',
        padding: '3rem 2.5rem',
        borderRadius: 20,
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        animation: 'slideUp 0.6s ease-out',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Title */}
        <h1 style={{
          color: '#1f2937',
          textAlign: 'center',
          marginBottom: 8,
          fontSize: 28,
          fontWeight: 700,
          animation: 'slideUp 0.6s ease-out 0.1s both'
        }}>
          🚨 DisasterAlert
        </h1>
        <p style={{
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: 32,
          fontSize: 14,
          animation: 'slideUp 0.6s ease-out 0.2s both'
        }}>
          {isRegister ? 'Create your account' : 'Sign in to continue'}
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.1)',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 14,
            border: '1px solid rgba(220, 38, 38, 0.2)',
            animation: 'slideUp 0.4s ease-out'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              required
              style={{
                ...inputStyle,
                animation: 'slideUp 0.6s ease-out 0.2s both'
              }}
            />
          )}

          <input
            name="email"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={handleChange}
            required
            style={{
              ...inputStyle,
              animation: 'slideUp 0.6s ease-out 0.3s both'
            }}
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={{
              ...inputStyle,
              animation: 'slideUp 0.6s ease-out 0.4s both'
            }}
          />

          {isRegister && (
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              style={{
                ...inputStyle,
                animation: 'slideUp 0.6s ease-out 0.5s both'
              }}
            >
              <option value="victim">Victim / Civilian</option>
              <option value="ngo">NGO / Rescue Team</option>
            </select>
          )}

          {isRegister && form.role === 'ngo' && (
            <input
              name="ngoName"
              placeholder="NGO / Organisation name"
              value={form.ngoName}
              onChange={handleChange}
              style={{
                ...inputStyle,
                animation: 'slideUp 0.6s ease-out 0.6s both'
              }}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#fca5a5' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 20,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideUp 0.6s ease-out 0.5s both',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(220, 38, 38, 0.3)',
              transform: loading ? 'scale(0.98)' : 'scale(1)',
              ':hover': {
                background: '#b91c1c'
              }
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = '#b91c1c';
                e.target.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.4)';
                e.target.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.background = '#dc2626';
                e.target.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.3)';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        {/* Toggle */}
        <p style={{
          color: '#9ca3af',
          textAlign: 'center',
          marginTop: 24,
          fontSize: 14,
          animation: 'slideUp 0.6s ease-out 0.6s both'
        }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <span
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{
              color: '#dc2626',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.target.style.color = '#b91c1c';
              e.target.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#dc2626';
              e.target.style.textDecoration = 'none';
            }}
          >
            {isRegister ? 'Login' : 'Register'}
          </span>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  marginBottom: 14,
  background: '#f9fafb',
  border: '1.5px solid #e5e7eb',
  borderRadius: 10,
  color: '#1f2937',
  fontSize: 14,
  boxSizing: 'border-box',
  transition: 'all 0.3s ease',
  outline: 'none',
  ':focus': {
    borderColor: '#dc2626',
    background: '#ffffff',
    boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)'
  }
};