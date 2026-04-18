import { createContext, useContext, useState, useEffect } from 'react';
import socket from '../utils/socket';

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

  // const login = (token, userData) => {
  //   localStorage.setItem('token', token);
  //   localStorage.setItem('user', JSON.stringify(userData));
  //   setUser(userData);
  //   socket.connect();
  //   socket.on('new-alert', (alert) => {
  //   alert(`🚨 NEW ALERT: ${alert.type.toUpperCase()} in ${alert.region} — ${alert.message}`);
  //   });
  //   socket.emit('join', { role: userData.role });
  // };

  const login = (token, userData) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  setUser(userData);
  socket.connect();
  socket.off('new-alert');
  socket.on('new-alert', (incomingAlert) => {
    window.alert(
      `🚨 NEW ALERT: ${incomingAlert.type.toUpperCase()} in ${incomingAlert.region} — ${incomingAlert.message}`
    );
  });
  socket.emit('join', { role: userData.role });
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