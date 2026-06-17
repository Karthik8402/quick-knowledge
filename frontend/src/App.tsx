import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './core/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { authEnabled } from './lib/supabase';
import ChatPage from './features/chat/ChatPage';
import ChunksPage from './features/documents/ChunksPage';
import DocumentsPage from './features/documents/DocumentsPage';
import SettingsPage from './pages/SettingsPage';
import StatusPage from './pages/StatusPage';
import DashboardPage from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';

// New pages
import AnalyticsPage from './pages/AnalyticsPage';
import ModelsPage from './pages/ModelsPage';
import SessionsPage from './pages/SessionsPage';
import ActivityPage from './pages/ActivityPage';
import NotificationsPage from './pages/NotificationsPage';
import HelpPage from './pages/HelpPage';
import AboutPage from './pages/AboutPage';

// Auth Pages
import HomePage from './pages/Home';
import LoginPage from './features/auth/Login';
import RegisterPage from './features/auth/Register';
import ForgotPasswordPage from './features/auth/ForgotPassword';
import ResetPasswordPage from './features/auth/ResetPassword';
import AuthCallbackPage from './features/auth/AuthCallback';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ThemeProvider } from './hooks/useTheme';

import { AppDataProvider } from './hooks/useAppData';

// NOTE: This must never be asynchronous. If authEnabled is ever made async (e.g. fetched from /system/config),
// this top-level const pattern will silently fallback to initial values and bypass ProtectedRoute.
const AUTH_ENABLED = authEnabled;

function DashboardRoutes() {
  const { loading } = useAuth();

  if (AUTH_ENABLED && loading) {
    return <LoadingSpinner />;
  }

  return (
    <AppDataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="chunks" element={<ChunksPage />} />
          <Route path="status" element={<StatusPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </AppDataProvider>
  );
}


function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (AUTH_ENABLED && loading) {
    return <LoadingSpinner />;
  }

  if (!AUTH_ENABLED) {
    return <Outlet />;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function AppContent() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            className: '!bg-surface !text-on-surface !border !border-outline-variant !shadow-md',
            success: { iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-surface)' } },
            error: { iconTheme: { primary: 'var(--color-error)', secondary: 'var(--color-surface)' } },
          }}
        />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/*" element={<DashboardRoutes />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
