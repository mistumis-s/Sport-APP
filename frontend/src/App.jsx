import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PlayerHome from './pages/player/PlayerHome';
import WellnessForm from './pages/player/WellnessForm';
import RPEForm from './pages/player/RPEForm';
import PlayerEvolution from './pages/player/PlayerEvolution';
import CoachDashboard from './pages/coach/CoachDashboard';
import SessionCreate from './pages/coach/SessionCreate';
import PlayerDetail from './pages/coach/PlayerDetail';
import PlayersList from './pages/coach/PlayersList';
import TeamRoster from './pages/coach/TeamRoster';
import AdminProvisioning from './pages/AdminProvisioning';
import ChangePassword from './pages/ChangePassword';
import Navbar from './components/Navbar';

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  if (user.role === 'coach' && user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function PasswordRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'coach') return <Navigate to="/" replace />;
  return <ChangePassword />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100">
      {user && !user.must_change_password && <Navbar />}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={user ? <Navigate to={user.role === 'coach' ? (user.must_change_password ? '/change-password' : '/coach') : '/player'} replace /> : <Login />} />
          <Route path="/admin" element={<AdminProvisioning />} />
          <Route path="/change-password" element={<PasswordRoute />} />
          <Route path="/player" element={<ProtectedRoute role="player"><PlayerHome /></ProtectedRoute>} />
          <Route path="/player/wellness" element={<ProtectedRoute role="player"><WellnessForm /></ProtectedRoute>} />
          <Route path="/player/rpe" element={<ProtectedRoute role="player"><RPEForm /></ProtectedRoute>} />
          <Route path="/player/evolution" element={<ProtectedRoute role="player"><PlayerEvolution /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute role="coach"><CoachDashboard /></ProtectedRoute>} />
          <Route path="/coach/session/new" element={<ProtectedRoute role="coach"><SessionCreate /></ProtectedRoute>} />
          <Route path="/coach/players" element={<ProtectedRoute role="coach"><PlayersList /></ProtectedRoute>} />
          <Route path="/coach/roster" element={<ProtectedRoute role="coach"><TeamRoster /></ProtectedRoute>} />
          <Route path="/coach/player/:id" element={<ProtectedRoute role="coach"><PlayerDetail /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
