// Login / registration / guest entry.
import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../api';
import { useUser } from '../UserContext';
import Logo from '../components/Logo';
import Mascot from '../components/Mascot';
import AvatarPicker from '../components/AvatarPicker';
import { sounds } from '../lib/sound';

export default function AuthPage() {
  const { login, user } = useUser();
  const nav = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('fox');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (loc.state as any)?.from || '/';

  if (user) { nav('/'); return null; }

  const finish = (u: any, token: string) => {
    login(u, token);
    nav(from);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'login') {
        const r = await auth.login(username, password);
        sounds.complete();
        finish(r.user, r.token);
      } else {
        if (!name.trim()) throw new Error('Атыңды жазып шық');
        const r = await auth.register(name, username, password, avatar);
        sounds.complete();
        finish(r.user, r.token);
      }
    } catch (err: any) {
      setError(err.message || 'Қате шықты, қайталап көр');
      sounds.wrong();
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await auth.guest();
      sounds.complete();
      finish(r.user, r.token);
    } catch (err: any) {
      setError(err.message || 'Қонақ ретінде кіре алмадық');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center" style={{ maxWidth: 460, margin: '0 auto', paddingTop: '1rem' }}>
      <div className="orn-strip mb" />
      <div style={{ marginBottom: '0.5rem' }}><Logo /></div>
      <p className="muted" style={{ marginTop: 0 }}>
        Ертегі тыңдап, қазақша жазуды үйрен! 🎧✏️
      </p>
      <Mascot mood="happy" size="medium" />

      <div className="card card-pad-lg pop-in" style={{ textAlign: 'left' }}>
        <div className="flex" style={{ marginBottom: '1rem', gap: 0.4 }}>
          <button className={`chip ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }} type="button">Кіру</button>
          <button className={`chip ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }} type="button">Тіркелу</button>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <form onSubmit={submit}>
          {tab === 'register' && (
            <div className="field">
              <label htmlFor="f-name">Атың</label>
              <input id="f-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Мысалы: Аябота" autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="f-user">Логин</label>
            <input id="f-user" className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="Латын әріптері, 3–20 таңба" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="f-pass">Құпия сөз</label>
            <input id="f-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Кемінде 6 таңба" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required />
          </div>
          {tab === 'register' && (
            <div className="field">
              <label>Өзіңе ұнаған суретті таңда</label>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
          )}
          <button className="btn btn-primary btn-big btn-block" disabled={busy} type="submit">
            {busy ? 'Күтілуде…' : tab === 'login' ? '🚪 Кіру' : '🎒 Тіркелу'}
          </button>
        </form>

        <hr className="divider" />
        <button className="btn btn-gold btn-block" onClick={guest} disabled={busy} type="button">
          👤 Қонақ ретінде кіру
        </button>
        <p className="small muted center mt">Қонақ режимі — шаттау үшін ғана, деректер сақталмайды деп қара.</p>
      </div>
      <div className="orn-strip mt" />
    </div>
  );
}
