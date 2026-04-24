// src/App.jsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import VictimDashboard from './pages/VictimDashboard';
import NGODashboard from './pages/NGODashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
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
            <div className="page-denied">
              <h1>403</h1>
              <p>Access denied. You do not have permission to view this page.</p>
            </div>
          }/>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}