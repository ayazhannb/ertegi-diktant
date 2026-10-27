// Admin panel: tale management + segment editor with video marking.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AdminTale } from '../types';
import { useUser } from '../UserContext';
import EmptyState from '../components/EmptyState';
import { fmtDuration } from '../lib/check';
import { sounds } from '../lib/sound';

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }
let ytApiPromise: Promise<any> | null = null;
function loadYT(): Promise<any> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    if (window.YT?.Player) { resolve(window.YT); return; }
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

interface SegRow { start_sec: number; end_sec: number; text: string }

const CATEGORIES = ['Халық ертегісі', 'Аңдар туралы', 'Батырлар туралы', 'Ақыл мен қылық'];

function fmtT(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
}
function parseT(v: string): number {
  const parts = v.trim().split(':');
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  return Number(v) || 0;
}

export default function AdminPage() {
  const { user } = useUser();
  const [tales, setTales] = useState<AdminTale[]>([]);
  const [cats, setCats] = useState<string[]>(CATEGORIES);
  const [editing, setEditing] = useState<AdminTale | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // new tale form
  const [ytUrl, setYtUrl] = useState('');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState(1);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [ageMin, setAgeMin] = useState(7);
  const [ageMax, setAgeMax] = useState(12);
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(0);
  const [fetching, setFetching] = useState(false);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(() => {
    api.get<{ tales: AdminTale[]; categories: string[] }>('/admin/tales').then((r) => {
      setTales(r.tales);
      if (r.categories.length) setCats(r.categories);
    }).catch((e) => setErr(e.message || 'Жүктелмеді'));
  }, []);

  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

  const fetchMeta = async () => {
    setFetching(true); setErr('');
    try {
      const r = await api.post<{ youtubeId: string; title: string; author: string; thumbnail: string; duration: number }>('/admin/yt-info', { url: ytUrl });
      if (r.title && !title) setTitle(r.title);
      if (r.duration) setDuration(r.duration);
      flash(`Бейне табылды: ${r.title || r.youtubeId}`);
    } catch (e: any) {
      setErr(e.message || 'Бейне табылмады');
    } finally { setFetching(false); }
  };

  const createTale = async () => {
    setErr('');
    if (!ytUrl.trim() || !title.trim()) { setErr('YouTube сілтемесі мен атауы қажет'); return; }
    try {
      const r = await api.post<{ id: number }>('/admin/tales', {
        url: ytUrl, title, level, category, age_min: ageMin, age_max: ageMax, description: desc,
      });
      flash('Ертегі қосылды. Енді сегменттерін ретте!');
      setYtUrl(''); setTitle(''); setDesc(''); setDuration(0);
      load();
      const fresh = (await api.get<{ tales: AdminTale[] }>('/admin/tales')).tales.find((t) => t.id === r.id);
      if (fresh) setEditing(fresh);
    } catch (e: any) {
      setErr(e.message || 'Қосылмады');
    }
  };

  const toggleActive = async (t: AdminTale) => {
    await api.patch(`/admin/tales/${t.id}`, { active: t.active ? 0 : 1 });
    load();
  };

  const removeTale = async (t: AdminTale) => {
    if (!window.confirm(`«${t.title}» ертегін өшіреміз бе?`)) return;
    await api.del(`/admin/tales/${t.id}`);
    if (editing?.id === t.id) setEditing(null);
    load();
  };

  return (
    <div>
      <h1>⚙️ Әкімші панельі</h1>
      <p className="muted">Ертегілерді қосу, реттеу және сегменттерін уақытымен белгілеу.</p>
      {msg && <div className="form-ok" role="status">{msg}</div>}
      {err && <div className="form-error" role="alert">{err}</div>}

      <div className="row mt" style={{ alignItems: 'stretch' }}>
        {/* left: new tale */}
        <div className="card" style={{ flex: '0 1 380px' }}>
          <h3>➕ Жаңа ертегі</h3>
          <div className="field">
            <label htmlFor="a-url">YouTube сілтемесі</label>
            <div className="row">
              <input id="a-url" className="input" placeholder="https://www.youtube.com/watch?v=…" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} />
              <div className="auto"><button className="btn" onClick={fetchMeta} disabled={fetching}>{fetching ? '…' : '🔍 Табу'}</button></div>
            </div>
            <p className="hint">Атауы мен ұзақтығы автоматты түрде толтырылады.</p>
          </div>
          <div className="field">
            <label htmlFor="a-title">Атауы</label>
            <input id="a-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Мыс. Қызыл телпек" />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="a-level">Деңгей</label>
              <select id="a-level" className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                <option value={1}>1 (1–2 сынып)</option>
                <option value={2}>2 (3–4 сынып)</option>
                <option value={3}>3 (5–6 сынып)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="a-cat">Санат</label>
              <select id="a-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="a-am">Жасы (ден)</label>
              <input id="a-am" className="input" type="number" min={4} max={18} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="a-ax">Жасы (соңы)</label>
              <input id="a-ax" className="input" type="number" min={4} max={18} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Ұзақтығы (с)</label>
              <input className="input" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="a-desc">Сипаттама</label>
            <textarea id="a-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ертегі туралы қысқаша…" />
          </div>
          <button className="btn btn-gold btn-block" onClick={createTale}>💾 Ертегіні қосу</button>
        </div>

        {/* right: list or editor */}
        <div className="card grow" style={{ minWidth: 320 }}>
          {!editing ? (
            <>
              <h3>Ертегілер ({tales.length})</h3>
              {tales.length === 0 ? (
                <EmptyState emoji="📚" title="Ертегі жоқ" text="Сол жақтан алғашқы ертегіні қос!" />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Атауы</th><th>Деңгей</th><th>Сегмент</th><th>Күйі</th><th></th></tr></thead>
                    <tbody>
                      {tales.map((t) => (
                        <tr key={t.id} style={{ opacity: t.active ? 1 : 0.55 }}>
                          <td><img src={t.thumbnail} alt="" style={{ width: 52, borderRadius: 8, verticalAlign: 'middle', marginRight: 8 }} />{t.title}</td>
                          <td>{t.level}</td>
                          <td>{t.seg_count}</td>
                          <td>{t.active ? <span className="badge-pill">✓ белсенді</span> : <span className="muted">өшірілген</span>}</td>
                          <td>
                            <div className="flex" style={{ gap: 4, justifyContent: 'flex-end' }}>
                              <button className="btn btn-sm" onClick={() => setEditing(t)}>✏️ Сегмент</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t)}>{t.active ? 'Өшіру' : 'Қосу'}</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => removeTale(t)} aria-label="Өшіру">🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <SegmentEditor tale={editing} onDone={() => { setEditing(null); load(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Segment editor ================= */
function SegmentEditor({ tale, onDone }: { tale: AdminTale; onDone: () => void }) {
  const [segs, setSegs] = useState<SegRow[]>([]);
  const [selected, setSelected] = useState(0);
  const [pasteText, setPasteText] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);

  const loadSegs = useCallback(() => {
    api.get<{ segments: SegRow[]; duration: number }>(`/admin/tales/${tale.id}/segments`)
      .then((r) => setSegs(r.segments.map((s) => ({ start_sec: s.start_sec, end_sec: s.end_sec, text: s.text }))))
      .catch((e) => setErr(e.message || 'Жүктелмеді'));
  }, [tale.id]);

  useEffect(() => { loadSegs(); }, [loadSegs]);

  // editor video player
  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;
    let player: any = null;
    (async () => {
      const YT = await loadYT();
      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = '';
      const div = document.createElement('div');
      hostRef.current.appendChild(div);
      player = new YT.Player(div, {
        videoId: tale.youtube_id,
        playerVars: { autoplay: 0, controls: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: { onReady: () => { playerRef.current = player; setYtReady(true); } },
      });
    })();
    return () => { cancelled = true; try { player?.destroy(); } catch { /* ignore */ } };
  }, [tale.youtube_id]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const splitText = async () => {
    try {
      const r = await api.post<{ sentences: string[] }>(`/admin/tales/${tale.id}/split`, { text: pasteText });
      if (r.sentences.length === 0) { setErr('Сөйлем табылмады'); return; }
      const n = r.sentences.length;
      const start0 = 3;
      const end0 = Math.max(tale.duration || 120, start0 + n);
      const step = (end0 - start0) / n;
      const rows: SegRow[] = r.sentences.map((text, i) => ({
        start_sec: Math.round((start0 + i * step) * 10) / 10,
        end_sec: Math.round((start0 + (i + 1) * step) * 10) / 10,
        text,
      }));
      setSegs(rows);
      setPasteText('');
      flash(`${n} сөйлемге бөлінді. Уақыттарды бейне ойнап отырғанда реттеңіз.`);
      sounds.correct();
    } catch (e: any) { setErr(e.message || 'Бөлінбеді'); }
  };

  const update = (i: number, patch: Partial<SegRow>) => {
    setSegs((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  };

  const move = (i: number, dir: -1 | 1) => {
    setSegs((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const splitRow = (i: number) => {
    setSegs((prev) => {
      const s = prev[i];
      const words = s.text.split(/\s+/);
      const mid = Math.max(1, Math.floor(words.length / 2));
      const next = prev.slice();
      next.splice(i, 1,
        { ...s, text: words.slice(0, mid).join(' ') },
        { ...s, text: words.slice(mid).join(' ') },
      );
      return next;
    });
  };

  const addRow = () => {
    setSegs((prev) => {
      const last = prev[prev.length - 1];
      const start = last ? last.end_sec : 0;
      return [...prev, { start_sec: start, end_sec: start + 10, text: '' }];
    });
  };

  const delRow = (i: number) => {
    setSegs((prev) => prev.filter((_, k) => k !== i));
    if (selected >= segs.length - 1) setSelected(Math.max(0, segs.length - 2));
  };

  const currentTime = () => { try { return playerRef.current?.getCurrentTime?.() || 0; } catch { return 0; } };

  const markStart = () => { update(selected, { start_sec: Math.round(currentTime() * 10) / 10 }); flash('Бастау уақыты белгіленді ✓'); };
  const markEnd = () => { update(selected, { end_sec: Math.round(currentTime() * 10) / 10 }); flash('Соңы уақыты белгіленді ✓'); };
  const preview = () => {
    const s = segs[selected];
    if (!s) return;
    playerRef.current?.seekTo(s.start_sec, true);
    playerRef.current?.playVideo();
    flash(`Өзгерту: ${fmtT(s.start_sec)} – ${fmtT(s.end_sec)}`);
  };

  const save = async () => {
    setErr('');
    const valid = segs.filter((s) => s.text.trim() && s.end_sec > s.start_sec);
    if (valid.length === 0) { setErr('Кемінде бір сегмент болуы керек'); return; }
    try {
      await api.post(`/admin/tales/${tale.id}/segments`, { segments: valid });
      setSaved(true);
      flash(`${valid.length} сегмент сақталды ✓`);
      sounds.complete();
      setTimeout(() => { setSaved(false); onDone(); }, 900);
    } catch (e: any) { setErr(e.message || 'Сақталмады'); }
  };

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>✏️ Сегмент редакторы: «{tale.title}»</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Бейнені ойнатып, қажетті жерге тоқтат; «Бастауын/Соңын белгіле» — уақыт автоматты жазылады.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>← Артка</button>
      </div>
      {msg && <div className="form-ok" role="status">{msg}</div>}
      {err && <div className="form-error" role="alert">{err}</div>}

      <div className="mt" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <div className="video-frame" aria-label="Редактор бейнесі">
            <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
          </div>
          <div className="lesson-controls mt">
            <button className="btn btn-sm" disabled={!ytReady} onClick={markStart}>⬅ Бастауын белгіле</button>
            <button className="btn btn-sm btn-gold" disabled={!ytReady} onClick={markEnd}>Соңын белгіле ➡</button>
            <button className="btn btn-sm btn-ghost" disabled={!ytReady} onClick={preview}>▶ Өзгерту</button>
          </div>
          <p className="small muted mt">
            Таңдалған жол: <strong>#{selected + 1}</strong> · {segs[selected] ? `«${segs[selected].text.slice(0, 40)}…»` : '—'}
          </p>
        </div>
        <div>
          <div className="field">
            <label htmlFor="se-paste">Ертегі мәтінін қой (сонымен сөйлемдерге бөледі)</label>
            <div className="row">
              <textarea id="se-paste" className="input" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Осы жерге толық мәтінді жапсыр…" />
            </div>
            <button className="btn btn-sm mt" onClick={splitText}>✂ Сөйлемдерге бөлу</button>
            <p className="hint">Бөлу автоматты, бірақ әр жолды өз қолыңмен тексер.</p>
          </div>
        </div>
      </div>

      <div className="mt" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 420, overflowY: 'auto' }}>
        {segs.map((s, i) => (
          <div key={i} className="row" style={{
            background: i === selected ? 'var(--gold-soft)' : 'var(--surface-2)',
            border: `2px ${i === selected ? 'solid var(--gold)' : 'solid var(--line)'}`,
            borderRadius: 14, padding: '0.5rem', alignItems: 'center',
          }}
            onClick={() => setSelected(i)}>
            <span style={{ fontWeight: 900, minWidth: 26 }}>#{i + 1}</span>
            <input className="input" style={{ width: 86, minWidth: 86, textAlign: 'center' }} value={fmtT(s.start_sec)}
              onChange={(e) => update(i, { start_sec: parseT(e.target.value) })} aria-label={`Жол ${i + 1} бастау`} />
            <input className="input" style={{ width: 86, minWidth: 86, textAlign: 'center' }} value={fmtT(s.end_sec)}
              onChange={(e) => update(i, { end_sec: parseT(e.target.value) })} aria-label={`Жол ${i + 1} соңы`} />
            <textarea className="input" style={{ minHeight: 44 }} value={s.text}
              onChange={(e) => update(i, { text: e.target.value })} aria-label={`Жол ${i + 1} мәтіні`} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); preview(); }} aria-label="Өзгерту">▶</button>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); move(i, -1); }} aria-label="Жоғары">↑</button>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); move(i, 1); }} aria-label="Төмен">↓</button>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); splitRow(i); }} aria-label="Екіге бөлу">✂</button>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); delRow(i); }} aria-label="Өшіру">🗑</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex mt" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={addRow}>+ Жол қосу</button>
        <button className="btn btn-gold btn-big" onClick={save}>{saved ? '✓ Сақталды' : '💾 Сақтау'}</button>
      </div>
    </div>
  );
}
