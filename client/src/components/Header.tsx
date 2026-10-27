// Top navigation bar.
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useUser } from '../UserContext';
import { sounds } from '../lib/sound';

const AVATAR_EMOJI: Record<string, string> = { fox: '🦊', bear: '🐻', bird: '🐦', cat: '🐱', horse: '🐴', sun: '🌞' };

export default function Header({ showHome = true }: { showHome?: boolean }) {
  const { user, logout } = useUser();
  const nav = useNavigate();
  if (!user) return null;
  const isStaff = user.role === 'teacher' || user.role === 'admin';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {showHome && (
          <NavLink to="/" className="logo-link" aria-label="Басты бет">
            <Logo small />
          </NavLink>
        )}
        <nav aria-label="Негізгі мәзір">
          <NavLink to="/" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => sounds.click()}>
            📚 Кітапхана
          </NavLink>
          <NavLink to="/progress" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => sounds.click()}>
            📈 Жетістік
          </NavLink>
          <NavLink to="/dictionary" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => sounds.click()}>
            📖 Сөздік
          </NavLink>
          {isStaff && (
            <NavLink to="/teacher" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => sounds.click()}>
              🍎 Мұғалім
            </NavLink>
          )}
          {user.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => sounds.click()}>
              ⚙️ Әкімші
            </NavLink>
          )}
          <NavLink to="/settings" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => sounds.click()}>
            🎛 Баяндалма
          </NavLink>
        </nav>
        <span className="user-chip" title={user.level.name}>
          <span aria-hidden>{AVATAR_EMOJI[user.avatar] || '🦊'}</span>
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={logout} aria-label="Шығу">Шығу</button>
      </div>
    </header>
  );
}
