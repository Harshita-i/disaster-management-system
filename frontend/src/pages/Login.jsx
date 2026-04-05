// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

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
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#1e293b',
        padding: '2rem',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        border: '1px solid #334155'
      }}>
        {/* Title */}
        <h1 style={{ color: '#f1f5f9', textAlign: 'center', marginBottom: 4 }}>
          🚨 DisasterAlert
        </h1>
        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: 24 }}>
          {isRegister ? 'Create your account' : 'Sign in to continue'}
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: '#7f1d1d',
            color: '#fca5a5',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14
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
              style={inputStyle}
            />
          )}

          <input
            name="email"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          {isRegister && (
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              style={inputStyle}
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
              style={inputStyle}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 8
            }}
          >
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        {/* Toggle */}
        <p style={{ color: '#64748b', textAlign: 'center', marginTop: 20, fontSize: 14 }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <span
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ color: '#3b82f6', cursor: 'pointer' }}
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
  padding: '11px 14px',
  marginBottom: 12,
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  boxSizing: 'border-box'
};