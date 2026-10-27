// On-screen row of Kazakh special letters. Inserts at the textarea cursor.
import { useRef, useState } from 'react';

const LETTERS = ['ә', 'ғ', 'қ', 'ң', 'ө', 'ұ', 'ү', 'һ', 'і'];

export default function KazakhKeyboard({ onInsert, label = 'Қазақ әріптері' }: {
  onInsert: (ch: string) => void;
  label?: string;
}) {
  const [shift, setShift] = useState(false);
  const last = useRef(Date.now());
  return (
    <div className="kk-keyboard" role="group" aria-label={label}>
      <button
        type="button"
        className="kk-key kk-key-shift"
        aria-label="Үлкен әріп"
        aria-pressed={shift}
        onClick={() => setShift((s) => !s)}
        style={shift ? { background: 'var(--gold)', color: '#4A3200' } : undefined}
      >
        ⇧
      </button>
      {LETTERS.map((l) => (
        <button
          key={l}
          type="button"
          className="kk-key"
          aria-label={`${l} әрпін қосу`}
          onClick={() => {
            onInsert(shift ? l.toUpperCase() : l);
            setShift(false);
            last.current = Date.now();
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
