// Avatar picker (emoji-based, child-friendly).
export const AVATARS = [
  { id: 'fox', emoji: '🦊', name: 'Түлкі' },
  { id: 'bear', emoji: '🐻', name: 'Аю' },
  { id: 'bird', emoji: '🐦', name: 'Құс' },
  { id: 'cat', emoji: '🐱', name: 'Мысық' },
  { id: 'horse', emoji: '🐴', name: 'Білетүркі' },
  { id: 'sun', emoji: '🌞', name: 'Күн' },
];

export default function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="kk-keyboard" role="radiogroup" aria-label="Аватар таңда">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          aria-label={a.name}
          className="kk-key"
          style={value === a.id
            ? { background: 'var(--sky)', color: '#fff', borderColor: 'var(--sky-deep)' }
            : undefined}
          onClick={() => onChange(a.id)}
        >
          {a.emoji}
        </button>
      ))}
    </div>
  );
}
