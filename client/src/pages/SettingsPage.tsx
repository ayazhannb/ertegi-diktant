// Settings: theme, text size, dyslexia mode, sound, default speed, profile.
import { useState } from 'react';
import { useUser } from '../UserContext';
import AvatarPicker from '../components/AvatarPicker';
import { sounds } from '../lib/sound';

export default function SettingsPage() {
  const { user, patchMe } = useUser();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || 'fox');
  if (!user) return null;
  const s = user.settings;

  const save = async (patch: Record<string, unknown>) => {
    await patchMe({ ...patch, settings: { ...s, ...(patch.settings || {}) } });
    setSaved(true);
    sounds.click();
    setTimeout(() => setSaved(false), 1500);
  };

  const quick = (key: string, value: unknown) => {
    const ns = { ...s, [key]: value };
    save({ settings: ns });
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>🎛 Баяндалма</h1>

      {saved && <div className="form-ok" role="status">✓ Сақталды</div>}

      <div className="card mt">
        <h3>Профиль</h3>
        <div className="field">
          <label htmlFor="s-name">Атың</label>
          <div className="row">
            <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="auto"><button className="btn btn-primary" onClick={() => save({ name })}>Сақтау</button></div>
          </div>
        </div>
        <div className="field">
          <label>Аватар</label>
          <AvatarPicker value={avatar} onChange={(a) => { setAvatar(a); save({ avatar: a }); }} />
        </div>
      </div>

      <div className="card mt">
        <h3>Көрініс</h3>
        <div className="field">
          <label>Түс режимы</label>
          <div className="flex">
            <button className={`chip ${s.theme !== 'dark' ? 'active' : ''}`} onClick={() => quick('theme', 'light')}>☀️ Ашық</button>
            <button className={`chip ${s.theme === 'dark' ? 'active' : ''}`} onClick={() => quick('theme', 'dark')}>🌙 Қараңғы</button>
          </div>
        </div>
        <div className="field">
          <label>Мәтін өлшемі</label>
          <div className="flex">
            <button className={`chip ${s.textSize === 'sm' ? 'active' : ''}`} onClick={() => quick('textSize', 'sm')}>Кіші</button>
            <button className={`chip ${(s.textSize || 'md') === 'md' ? 'active' : ''}`} onClick={() => quick('textSize', 'md')}>Орта</button>
            <button className={`chip ${s.textSize === 'lg' ? 'active' : ''}`} onClick={() => quick('textSize', 'lg')}>Үлкен</button>
          </div>
        </div>
        <div className="field">
          <label>Оқуға ыңғайлы қаріп (дизлексия режимі)</label>
          <div className="flex">
            <button className={`chip ${s.dyslexia ? 'active' : ''}`} onClick={() => quick('dyslexia', true)} aria-pressed={!!s.dyslexia}>Кең қаріп + аралық</button>
            <button className={`chip ${!s.dyslexia ? 'active' : ''}`} onClick={() => quick('dyslexia', false)}>Қалыпты</button>
          </div>
        </div>
      </div>

      <div className="card mt">
        <h3>Дыбыс және бейне</h3>
        <div className="field">
          <label>Дыбыс эффектілері</label>
          <div className="flex">
            <button className={`chip ${s.sound !== false ? 'active' : ''}`} onClick={() => quick('sound', true)}>🔊 Қосу</button>
            <button className={`chip ${s.sound === false ? 'active' : ''}`} onClick={() => quick('sound', false)}>🔇 Өшіру</button>
          </div>
        </div>
        <div className="field">
          <label>Бейне жылдамдығы</label>
          <div className="flex">
            <button className={`chip {(s.defaultSpeed || 1) === 1 ? 'active' : ''}`} onClick={() => quick('defaultSpeed', 1)}>🐇 Қалыпты (1x)</button>
            <button className={`chip ${s.defaultSpeed === 0.75 ? 'active' : ''}`} onClick={() => quick('defaultSpeed', 0.75)}>🐢 Баяу (0.75x)</button>
          </div>
        </div>
      </div>

      <p className="small muted">
        Деректерің бұл құрылғыда және серверде қауіпсіз сақталады. Кез келген уақытта «Шығу» түймесімен шолғыштан шыға аласың.
      </p>
    </div>
  );
}
