// Library: hero, resume card, filters, tale grid.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { TaleListItem } from '../types';
import { useUser } from '../UserContext';
import Mascot from '../components/Mascot';
import StarRating from '../components/StarRating';
import EmptyState from '../components/EmptyState';
import { fmtDuration } from '../lib/check';
import { sounds } from '../lib/sound';

const LEVEL_NAMES: Record<number, string> = { 1: '1-деңгей · оңай', 2: '2-деңгей · орта', 3: '3-деңгей · қызық' };

export default function LibraryPage() {
  const { user } = useUser();
  const [tales, setTales] = useState<TaleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get<{ tales: TaleListItem[] }>('/tales');
        if (alive) setTales(r.tales);
      } catch (e: any) {
        if (alive) setError(e.message || 'Жүктелмеді');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const cats = useMemo(() => Array.from(new Set(tales.map((t) => t.category))), [tales]);
  const filtered = useMemo(() => tales.filter((t) =>
    (!level || t.level === Number(level)) &&
    (!category || t.category === category) &&
    (!q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()))
  ), [tales, level, category, q]);

  const resumeTale = tales.find((t) => t.resume);

  return (
    <div>
      {/* hero */}
      <section className="card card-pad-lg pop-in orn-bg" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="grow">
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>
            Сәлем, {user?.name.split(' ')[0]}! {user?.level.emoji}
          </h1>
          <p className="muted" style={{ fontSize: '1.02rem' }}>
            Ертегіні таңда, сөйлемді тыңда, естігеніңді жаз — қазақша жазу осылай ойынға айналады!
          </p>
          <div className="flex" style={{ gap: '0.5rem' }}>
            <span className="badge-pill">🔥 {user?.streak || 0} күндік серия</span>
            <span className="badge-pill">⭐ {user?.xp || 0} XP · {user?.level.name}</span>
          </div>
        </div>
        <Mascot mood="happy" size="medium" />
      </section>

      {/* resume */}
      {resumeTale && (
        <section className="card mt pop-in" style={{ borderColor: 'var(--gold)', borderWidth: 3 }}>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div className="grow">
              <span className="badge-pill mb">⏯ Жалғастыру</span>
              <h3 style={{ margin: '0.4rem 0 0' }}>{resumeTale.title}</h3>
              <p className="muted small" style={{ margin: 0 }}>
                {resumeTale.resume!.segment + 1}/{resumeTale.resume!.count} бөліктен жалғасасың
              </p>
            </div>
            <Link to={`/lesson/${resumeTale.id}`} className="btn btn-gold" onClick={() => sounds.click()}>Жалғастыру →</Link>
          </div>
        </section>
      )}

      {/* filters */}
      <section className="mt">
        <div className="flex" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 200 }}>
            <label className="small" htmlFor="search" style={{ fontWeight: 800 }}>Іздеу</label>
            <input id="search" className="input" placeholder="Ертегі атауы…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <span className="small" style={{ fontWeight: 800, display: 'block', marginBottom: 4 }}>Деңгей</span>
            <div className="flex" style={{ gap: '0.4rem' }}>
              <button className={`chip ${level === '' ? 'active' : ''}`} onClick={() => setLevel('')}>Барлығы</button>
              {[1, 2, 3].map((l) => (
                <button key={l} className={`chip ${level === String(l) ? 'active' : ''}`} onClick={() => setLevel(String(l))}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="small" style={{ fontWeight: 800, display: 'block', marginBottom: 4 }}>Санат</span>
            <select className="input" style={{ width: 'auto', minWidth: 190 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Санат">
              <option value="">Барлық санат</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* grid */}
      {loading ? (
        <div className="center" style={{ padding: '3rem' }}><span className="spin" style={{ fontSize: '2rem' }}>🦊</span></div>
      ) : error ? (
        <EmptyState emoji="📡" title="Жүктелмей қалды" text={error} />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🔍" title="Ештеңе табылмады" text="Сүзгілерді өзгертіп, қайта көріп көр." />
      ) : (
        <div className="tales-grid">
          {filtered.map((t) => (
            <article className="tale-card pop-in" key={t.id}>
              <div className="tale-thumb">
                <img src={t.thumbnail} alt={t.title} loading="lazy" />
                {t.isHomework && <span className="hw">📚 Үй тапсырма</span>}
                <span className="dur">⏱ {fmtDuration(t.duration)}</span>
              </div>
              <div className="tale-body">
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`chip chip-level chip-l${t.level}`}>{LEVEL_NAMES[t.level]}</span>
                  {t.best && <StarRating value={t.best.stars} size="1rem" />}
                </div>
                <h3 className="tale-title">{t.title}</h3>
                <div className="tale-meta">
                  <span>{t.category}</span>·<span>{t.ageMin}–{t.ageMax} жас</span>·<span>{t.segmentCount} бөлік</span>
                </div>
                <p className="tale-desc">{t.description}</p>
                {t.resume ? (
                  <Link to={`/lesson/${t.id}`} className="btn btn-gold" onClick={() => sounds.click()}>
                    ⏯ Жалғастыру ({t.resume.segment + 1}/{t.resume.count})
                  </Link>
                ) : (
                  <Link to={`/lesson/${t.id}`} className="btn btn-primary" onClick={() => sounds.click()}>
                    {t.best ? '↺ Қайта оқу' : '▶ Оқуды бастау'}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
