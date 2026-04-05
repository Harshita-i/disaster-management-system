// App.jsx — role-gated routing
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import VictimDashboard from './pages/VictimDashboard';
import NGODashboard    from './pages/NGODashboard';
import AdminDashboard  from './pages/AdminDashboard';
import Login from './pages/Login';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}