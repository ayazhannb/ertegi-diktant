import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './UserContext';
import Header from './components/Header';
import Onboarding from './components/Onboarding';
import AuthPage from './pages/AuthPage';
import LibraryPage from './pages/LibraryPage';
import LessonPage from './pages/LessonPage';
import ProgressPage from './pages/ProgressPage';
import DictionaryPage from './pages/DictionaryPage';
import SettingsPage from './pages/SettingsPage';
import TeacherPage from './pages/TeacherPage';
import AdminPage from './pages/AdminPage';
import NotFound from './pages/NotFound';

function OfflineBanner() {
  if (typeof navigator !== 'undefined' && navigator.onLine) return null;
  return <div className="offline-banner">📡 Интернет байланысы жоқ. Қалпына келгенде жалғастыра аласың.</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const loc = useLocation();
  if (loading) return <div className="page center" style={{ paddingTop: '4rem' }}><span className="spin" style={{ fontSize: '2rem' }}>🦊</span></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const loc = useLocation();
  const inLesson = loc.pathname.startsWith('/lesson');
  return (
    <div className="app-shell">
      <OfflineBanner />
      <Header showHome={!inLesson} />
      <main className={`page ${inLesson ? 'page-wide' : ''}`}>
        {children}
      </main>
      <Onboarding />
      {user && !inLesson && <footer className="center muted small" style={{ padding: '1rem 0 2rem' }}>
        <div className="orn-strip mb" style={{ width: '50%', margin: '0 auto 0.8rem' }} />
        Ертегі диктант · Қазақ тілін дамытуға арналған IT-жоба
      </footer>}
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Shell><AuthPage /></Shell>} />
          <Route path="/" element={<RequireAuth><Shell><LibraryPage /></Shell></RequireAuth>} />
          <Route path="/lesson/:taleId" element={<RequireAuth><Shell><LessonPage /></Shell></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><Shell><ProgressPage /></Shell></RequireAuth>} />
          <Route path="/dictionary" element={<RequireAuth><Shell><DictionaryPage /></Shell></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Shell><SettingsPage /></Shell></RequireAuth>} />
          <Route path="/teacher" element={<RequireAuth><Shell><TeacherPage /></Shell></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><Shell><AdminPage /></Shell></RequireAuth>} />
          <Route path="*" element={<Shell><NotFound /></Shell>} />
        </Routes>
      </HashRouter>
    </UserProvider>
  );
}
