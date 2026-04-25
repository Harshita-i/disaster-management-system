// utils/api.js
import axios from 'axios';

const configuredApiBaseURL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const apiBaseURL = configuredApiBaseURL
  ? (() => {
      const normalized = configuredApiBaseURL.replace(/\/+$/, '');
      return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    })()
  : `${window.location.protocol}//${window.location.hostname}:5001/api`;

const api = axios.create({ baseURL: apiBaseURL });

// Auto-attach JWT to every outgoing request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      // App uses HashRouter in production; keep redirect route-safe for both.
      window.location.href = window.location.pathname.includes('#') ? '#/login' : '/#/login';
    }
    return Promise.reject(err);
  }
);

export default api;