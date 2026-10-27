import type { ReactNode } from 'react';

export default function EmptyState({ emoji, title, text, action }: {
  emoji: string; title: string; text?: string; action?: ReactNode;
}) {
  return (
    <div className="card center pop-in" style={{ padding: '2rem 1.2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{emoji}</div>
      <h3>{title}</h3>
      {text && <p className="muted" style={{ marginBottom: '0.5rem' }}>{text}</p>}
      {action}
    </div>
  );
}
