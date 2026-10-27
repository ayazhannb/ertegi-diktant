// Teacher panel: classes, members, homework, analytics.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Analytics, ClassDetail, TeacherClass } from '../types';
import { useUser } from '../UserContext';
import { LetterBars } from '../components/Charts';
import EmptyState from '../components/EmptyState';
import { sounds } from '../lib/sound';

const AVATAR_EMOJI: Record<string, string> = { fox: '🦊', bear: '🐻', bird: '🐦', cat: '🐱', horse: '🐴', sun: '🌞' };

export default function TeacherPage() {
  const { user } = useUser();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [newClass, setNewClass] = useState('');
  const [newMember, setNewMember] = useState('');
  const [taleId, setTaleId] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  const [tales, setTales] = useState<{ id: number; title: string }[]>([]);
  const [msg, setMsg] = useState('');

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const loadClasses = useCallback(() => {
    api.get<{ classes: TeacherClass[] }>('/teacher/classes').then((r) => setClasses(r.classes)).catch(() => { /* ignore */ });
  }, []);

  const loadDetail = useCallback((id: number) => {
    api.get<ClassDetail>(`/teacher/classes/${id}`).then(setDetail).catch(() => setDetail(null));
    api.get<Analytics>(`/teacher/classes/${id}/analytics`).then(setAnalytics).catch(() => setAnalytics(null));
  }, []);

  useEffect(() => {
    if (isTeacher) loadClasses();
    api.get('/tales').then((r: any) => setTales((r.tales || []).map((t: any) => ({ id: t.id, title: t.title })))).catch(() => { /* ignore */ });
  }, [isTeacher]);

  useEffect(() => { if (sel != null) loadDetail(sel); }, [sel, loadDetail]);

  if (!user) return null;
  if (!isTeacher) {
    return <EmptyState emoji="🔒" title="Бұл бөлім мұғалімдерге ғана" text="Мұғалім немесе әкімші ретінде кір." />;
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const createClass = async () => {
    if (!newClass.trim()) return;
    const r = await api.post<{ id: number }>('/teacher/classes', { name: newClass });
    setNewClass('');
    loadClasses();
    setSel(r.id);
    sounds.correct();
  };

  const addMember = async () => {
    if (sel == null || !newMember.trim()) return;
    try {
      await api.post(`/teacher/classes/${sel}/add`, { username: newMember });
      setNewMember('');
      flash('Оқушы қосылды ✓');
      loadDetail(sel);
    } catch (e: any) { flash(e.message || 'Қосылмады'); }
  };

  const removeMember = async (uid: number) => {
    if (sel == null) return;
    await api.del(`/teacher/classes/${sel}/members/${uid}`);
    loadDetail(sel);
  };

  const assignHw = async () => {
    if (sel == null || !taleId) return;
    await api.post('/teacher/homework', { class_id: sel, tale_id: Number(taleId), due_date: dueDate });
    flash('Үй тапсырма тағайындалды ✓');
    loadDetail(sel);
    sounds.correct();
  };

  const removeHw = async (id: number) => {
    if (sel == null) return;
    await api.del(`/teacher/homework/${id}`);
    loadDetail(sel);
  };

  return (
    <div>
      <h1>🍎 Мұғалім панельі</h1>
      {msg && <div className="form-ok" role="status">{msg}</div>}

      <div className="row mt" style={{ alignItems: 'stretch' }}>
        <div className="card" style={{ flex: '0 1 320px' }}>
          <h3>Сыныптар</h3>
          <div className="field">
            <div className="row">
              <input className="input" placeholder="Жаңа сынып атауы, мыс. 4-Б" value={newClass} onChange={(e) => setNewClass(e.target.value)} />
              <div className="auto"><button className="btn btn-primary" onClick={createClass}>+ Қосу</button></div>
            </div>
          </div>
          <div className="flex" style={{ flexDirection: 'column', gap: '0.4rem' }}>
            {classes.length === 0 && <p className="muted">Әзірге сынып жоқ. Біріншісін құра!</p>}
            {classes.map((c) => (
              <button key={c.id} className={`btn ${sel === c.id ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setSel(c.id)} style={{ justifyContent: 'space-between' }}>
                <span>🏫 {c.name}</span>
                <span className="small">{c.members} оқушы</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card grow" style={{ minWidth: 300 }}>
          {sel == null || !detail ? (
            <EmptyState emoji="👈" title="Сыныпты таңда" text="Сол жақтан сыныпты таңдасаң, оқушылар прогресі осында шығады." />
          ) : (
            <>
              <h3>🏫 {detail.class.name}</h3>
              <div className="field">
                <label>Оқушы қосу (логин арқылы)</label>
                <div className="row">
                  <input className="input" placeholder="мыс. aziz" value={newMember} onChange={(e) => setNewMember(e.target.value.toLowerCase())} />
                  <div className="auto"><button className="btn" onClick={addMember}>+ Қосу</button></div>
                </div>
              </div>
              <div className="table-wrap mb">
                <table className="data">
                  <thead><tr><th>Оқушы</th><th>Ертегі</th><th>Орташа нақтылық</th><th>XP</th><th></th></tr></thead>
                  <tbody>
                    {detail.members.map((m) => (
                      <tr key={m.id}>
                        <td><span aria-hidden>{AVATAR_EMOJI[m.avatar] || '🦊'}</span> <strong>{m.name}</strong> <span className="muted small">@{m.username}</span></td>
                        <td>{m.tales_done}</td>
                        <td>{m.avg_accuracy != null ? `${m.avg_accuracy}%` : '—'}</td>
                        <td>{m.xp}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => removeMember(m.id)} aria-label={`${m.name} оқушысын алу`}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>📚 Үй тапсырма</h3>
              <div className="row mb">
                <select className="input" value={taleId} onChange={(e) => setTaleId(e.target.value)} aria-label="Ертегі таңда">
                  <option value="">Ертегі таңда…</option>
                  {tales.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ maxWidth: 180 }} aria-label="Мерзімі" />
                <div className="auto"><button className="btn btn-gold" onClick={assignHw}>Тағайындау</button></div>
              </div>
              {detail.homework.length > 0 && (
                <div className="flex" style={{ flexDirection: 'column', gap: '0.4rem' }}>
                  {detail.homework.map((h) => (
                    <div key={h.id} className="flex" style={{ justifyContent: 'space-between', background: 'var(--surface-2)', padding: '0.5rem 0.8rem', borderRadius: 12, border: '2px solid var(--line)' }}>
                      <span>📚 {h.title} <span className="muted small">· мерзімі: {h.due_date}</span></span>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeHw(h.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="mt">📊 Сынып талдауы</h3>
              <div className="row">
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <h4 style={{ margin: '0 0 0.6rem' }}>Ең қиын сөздер (10)</h4>
                  {!analytics || analytics.topWords.length === 0 ? <p className="muted small">Әзірге қате деректері жоқ.</p> : (
                    <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                      {analytics.topWords.map((w, i) => (
                        <li key={i} style={{ fontWeight: 800 }}>{w.word} <span className="muted small">— {w.n} рет</span></li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <h4 style={{ margin: '0 0 0.6rem' }}>Әріп қателері</h4>
                  {analytics && analytics.topLetters.length > 0 ? <LetterBars items={analytics.topLetters} /> : <p className="muted small">Әзірге дерек жоқ.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
