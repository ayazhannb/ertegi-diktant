// Progress: stats, charts, badges, completed tales.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { ProgressData, User } from '../types';
import { useUser } from '../UserContext';
import { WeeklyBars, AccuracyBars } from '../components/Charts';
import StarRating from '../components/StarRating';
import EmptyState from '../components/EmptyState';
import { levelFor } from '../lib/check';

export default function ProgressPage() {
  const { user } = useUser();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    api.get<ProgressData>('/progress').then(setData).catch(() => { /* ignore */ });
  }, []);

  if (!user) return null;
  const lvl = levelFor(user.xp);

  return (
    <div>
      <h1>📈 Менің жетістігім</h1>

      <div className="stat-grid mt">
        <div className="stat"><div className="num">🔥 {user.streak}</div><div className="lbl">Күнделікті серия</div></div>
        <div className="stat"><div className="num">{lvl.emoji} {lvl.name}</div><div className="lbl">{user.xp} XP{lvl.next ? ` → ${lvl.next}: ${lvl.nextXp}` : ''}</div></div>
        <div className="stat"><div className="num">{data?.completed.length ?? 0}</div><div className="lbl">Аяқталған ертегі</div></div>
        <div className="stat"><div className="num">📖 {data?.learned ?? 0}/{data?.dictCount ?? 0}</div><div className="lbl">Ұйренілген сөз</div></div>
      </div>

      <div className="card mt">
        <h3>Деңгей прогресі</h3>
        <div className="pbar pbar-sky"><div style={{ width: `${lvl.progress}%` }} /></div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {lvl.next ? `«${lvl.next}» атағына ${Math.max(0, (lvl.nextXp || 0) - user.xp)} XP қалды` : 'Ең жоғарғы атақты алдың! 👑'}
        </p>
      </div>

      <div className="row mt" style={{ alignItems: 'stretch' }}>
        <div className="card">
          <h3>Аптадағы белсенділік</h3>
          {data ? <WeeklyBars data={data.weekly} /> : <p className="muted">Жүктелуде…</p>}
        </div>
        <div className="card">
          <h3>Нақтылық пайызы</h3>
          {data && data.completed.length > 0 ? (
            <AccuracyBars items={data.completed.slice(0, 6).map((c) => ({ title: c.title, value: c.accuracy }))} />
          ) : (
            <p className="muted">Әліге ештеңе аяқталмады. Алғашқы ертегіңді таңда! 🎬</p>
          )}
        </div>
      </div>

      <div className="card mt">
        <h3>🏅 Марапаттар</h3>
        <div className="tales-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {user.badges.map((b) => (
            <div key={b.code} className="center" style={{
              padding: '0.9rem 0.5rem', borderRadius: 16,
              background: b.earnedAt ? 'var(--gold-soft)' : 'var(--surface-2)',
              border: `2px ${b.earnedAt ? 'solid var(--gold)' : 'dashed var(--line)'}`,
              opacity: b.earnedAt ? 1 : 0.6,
            }}>
              <div style={{ fontSize: '2rem' }}>{b.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: '0.92rem' }}>{b.name}</div>
              <div className="small muted">{b.desc}</div>
              {b.earnedAt && <span className="badge-pill" style={{ marginTop: 6 }}>алынды ✓</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card mt">
        <h3>✅ Аяқталған ертегілер</h3>
        {!data || data.completed.length === 0 ? (
          <EmptyState emoji="🎬" title="Әліге еш нәрсе жоқ" text="Кітапханадан ертегі таңдап, бірге бастайық!"
            action={<Link to="/" className="btn btn-gold">📚 Кітапхана</Link>} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Ертегі</th><th>Жұлдыз</th><th>Ұпай</th><th>Нақтылық</th><th>Күні</th></tr></thead>
              <tbody>
                {data.completed.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 800 }}>{c.title}</td>
                    <td><StarRating value={c.stars} size="1rem" /></td>
                    <td>{c.score}</td>
                    <td>{c.accuracy}%</td>
                    <td className="muted">{(c.finished_at || '').replace('T', ' ').slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
