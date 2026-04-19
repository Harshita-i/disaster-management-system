// import { createContext, useContext, useState, useEffect, useCallback } from 'react';
// import i18n from '../i18n/config';
// import socket from '../utils/socket';
// import { translateStrings } from '../utils/dynamicTranslate';
// import { showMultilingualNewAlert } from '../utils/alertNotifications';

// const AuthContext = createContext();

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     // Restore session from localStorage
//     const token = localStorage.getItem('token');
//     const saved  = localStorage.getItem('user');
//     if (token && saved) setUser(JSON.parse(saved));
//     setLoading(false);
//   }, []);

// <<<<<<< HEAD
//   useEffect(() => {
//     if (!user) return undefined;

//     if (!socket.connected) {
//       socket.connect();
//     }
//     socket.emit('join', { role: user.role });

//     const onNewAlert = (alert) => {
//       void showMultilingualNewAlert(alert, translateStrings);
//     };

//     socket.on('new-alert', onNewAlert);
//     return () => {
//       socket.off('new-alert', onNewAlert);
//     };
//   }, [user]);

//   const login = (token, userData) => {
//     localStorage.setItem('token', token);
//     localStorage.setItem('user', JSON.stringify(userData));
//     setUser(userData);
//   };
// =======
//   // const login = (token, userData) => {
//   //   localStorage.setItem('token', token);
//   //   localStorage.setItem('user', JSON.stringify(userData));
//   //   setUser(userData);
//   //   socket.connect();
//   //   socket.on('new-alert', (alert) => {
//   //   alert(`🚨 NEW ALERT: ${alert.type.toUpperCase()} in ${alert.region} — ${alert.message}`);
//   //   });
//   //   socket.emit('join', { role: userData.role });
//   // };

//   const login = (token, userData) => {
//   localStorage.setItem('token', token);
//   localStorage.setItem('user', JSON.stringify(userData));
//   setUser(userData);
//   socket.connect();
//   socket.off('new-alert');
//   socket.on('new-alert', (incomingAlert) => {
//     window.alert(
//       `🚨 NEW ALERT: ${incomingAlert.type.toUpperCase()} in ${incomingAlert.region} — ${incomingAlert.message}`
//     );
//   });
//   socket.emit('join', { role: userData.role });
// };
// // >>>>>>> main

//   const logout = () => {
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//     setUser(null);
//     socket.disconnect();
//   };

//   /** Shallow merge into session user (e.g. after PATCH /users/me/location). */
//   const updateUser = useCallback((partial) => {
//     setUser((prev) => {
//       if (!prev) return prev;
//       const next = { ...prev, ...partial };
//       localStorage.setItem('user', JSON.stringify(next));
//       return next;
//     });
//   }, []);

//   return (
//     <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export const useAuth = () => useContext(AuthContext);


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
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');

    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join', { role: user.role });

    const onNewAlert = async (incomingAlert) => {
      try {
        await showMultilingualNewAlert(incomingAlert, translateStrings);
      } catch (err) {
        console.error('Multilingual alert failed, falling back to window alert:', err);
        window.alert(
          `🚨 NEW ALERT: ${String(incomingAlert?.type || 'alert').toUpperCase()} in ${incomingAlert?.region || 'Unknown Region'} — ${incomingAlert?.message || ''}`
        );
      }
    };

    socket.off('new-alert', onNewAlert);
    socket.on('new-alert', onNewAlert);

    return () => {
      socket.off('new-alert', onNewAlert);
    };
  }, [user]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join', { role: userData.role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    socket.disconnect();
  };

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