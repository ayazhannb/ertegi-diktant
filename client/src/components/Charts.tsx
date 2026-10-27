// Simple SVG charts (no external chart lib): weekly bars + accuracy bars.
export function WeeklyBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', height: 150, padding: '0.5rem 0' }} role="img" aria-label="Апта бойынша белсенділік">
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span className="small" style={{ fontWeight: 800 }}>{d.count || ''}</span>
          <div
            style={{
              width: '70%', maxWidth: 42,
              height: Math.max(6, (d.count / max) * 90),
              background: d.count ? 'linear-gradient(180deg, var(--sky), var(--sky-deep))' : 'var(--line)',
              borderRadius: 10,
              transition: 'height 0.5s',
            }}
          />
          <span className="small muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function AccuracyBars({ items }: { items: { title: string; value: number }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }} role="img" aria-label="Нақтылық пайызы">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span className="small" style={{ fontWeight: 800 }}>{it.title}</span>
            <span className="small" style={{ fontWeight: 900 }}>{it.value}%</span>
          </div>
          <div className="pbar pbar-sky" style={{ height: 10 }}>
            <div style={{ width: `${Math.min(100, it.value)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LetterBars({ items }: { items: { letter: string; n: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span className="small" style={{ fontWeight: 800 }}>{it.letter}</span>
            <span className="small" style={{ fontWeight: 900 }}>{it.n} қате</span>
          </div>
          <div className="pbar" style={{ height: 10 }}>
            <div style={{ width: `${(it.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
