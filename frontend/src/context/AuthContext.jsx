import { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n/config';
import socket from '../utils/socket';
import { translateStrings } from '../utils/dynamicTranslate';

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

    const onNewAlert = async (alert) => {
      const title = i18n.t('alert.browserTitle');
      try {
        const lang = i18n.language;
        const [typeT, regionT, messageT] = await translateStrings(
          [String(alert.type ?? ''), String(alert.region ?? ''), String(alert.message ?? '')],
          lang
        );
        const line = `${String(typeT).toUpperCase()} — ${regionT}\n${messageT}`;
        window.alert(`${title}\n\n${line}`);
      } catch {
        window.alert(
          `${title}\n\n${String(alert.type ?? '').toUpperCase()} — ${alert.region ?? ''}\n${alert.message ?? ''}`
        );
      }
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

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);