import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from '../i18n/config';
import socket from '../utils/socket';
import { translateStrings } from '../utils/dynamicTranslate';
import { showMultilingualNewAlert } from '../utils/alertNotifications';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const token = localStorage.getItem('token');
    const saved  = localStorage.getItem('user');
    if (token && saved) setUser(JSON.parse(saved));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join', { role: user.role });

    const onNewAlert = (alert) => {
      void showMultilingualNewAlert(alert, translateStrings);
    };

    socket.on('new-alert', onNewAlert);
    return () => {
      socket.off('new-alert', onNewAlert);
    };
  }, [user]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    socket.disconnect();
  };

  /** Shallow merge into session user (e.g. after PATCH /users/me/location). */
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);