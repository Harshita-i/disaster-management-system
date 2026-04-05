// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import VictimDashboard from './pages/VictimDashboard';
import NGODashboard from './pages/NGODashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          <Route path="/victim" element={
            <ProtectedRoute allowedRoles={['victim']}>
              <VictimDashboard />
            </ProtectedRoute>
          }/>

          <Route path="/ngo" element={
            <ProtectedRoute allowedRoles={['ngo']}>
              <NGODashboard />
            </ProtectedRoute>
          }/>

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }/>

          <Route path="/unauthorized" element={
            <div style={{ color: 'white', padding: 40, background: '#0f172a', minHeight: '100vh' }}>
              <h1>403 - Access Denied</h1>
              <p>You don't have permission to view this page.</p>
            </div>
          }/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}