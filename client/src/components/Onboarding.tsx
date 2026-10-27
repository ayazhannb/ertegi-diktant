// 3-step first-launch tutorial overlay.
import { useState } from 'react';
import Mascot from './Mascot';
import { useUser } from '../UserContext';
import { sounds } from '../lib/sound';

const STEPS = [
  {
    emoji: '👋',
    title: 'Сәлем! Мен — Жұсақ!',
    text: 'Мен — қызық түлкі. Бірге қазақша жазуды үйренеміз: ертегі тыңдап, естігеніңді баспасөзге жазасың.',
  },
  {
    emoji: '🎬',
    title: 'Ертегіні таңда, сөйлемді тыңда',
    text: 'Бейне ойнап тұрғанда мұқият тыңда. Әр сөйлем аяқталғанда бейне өзі тоқтайды — сонымен сенің кезең келеді!',
  },
  {
    emoji: '✏️',
    title: 'Жаз және «Тексеру» басың',
    text: 'Естіген сөйлемді жазып, «Тексеру» түймесін бас. Қате шықса — ештеңе! Бірге қайта тыңдап, қайта жазамыз.',
  },
];

export default function Onboarding() {
  const { user, patchMe } = useUser();
  const [step, setStep] = useState(0);
  if (!user || user.onboardingDone) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const done = async () => {
    sounds.complete();
    try { await patchMe({ onboarding_done: 1 }); } catch { /* ignore */ }
  };

  return (
    <div className="onboard fade-in" role="dialog" aria-modal="true" aria-label="Таныстыру">
      <div className="onboard-card pop-in">
        <Mascot mood={last ? 'celebrate' : 'happy'} size="medium" />
        <div className="center" style={{ fontSize: '1.8rem' }}>{s.emoji}</div>
        <h2>{s.title}</h2>
        <p className="muted" style={{ fontSize: '1.02rem' }}>{s.text}</p>
        <div className="flex" style={{ justifyContent: 'center', marginBottom: '1rem' }} aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i === step ? 'var(--sky)' : 'var(--line)',
            }} />
          ))}
        </div>
        <div className="flex" style={{ justifyContent: 'center', gap: '0.6rem' }}>
          {last ? (
            <button className="btn btn-gold btn-big" onClick={done}>Ойнауға кірейік! 🎉</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={done}>Өткізіп жіберу</button>
              <button className="btn btn-primary" onClick={() => { sounds.click(); setStep(step + 1); }}>Келесі →</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
