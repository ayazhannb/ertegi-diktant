// Dictionary: personal word bank + mini practice game.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { DictWord } from '../types';
import { useUser } from '../UserContext';
import EmptyState from '../components/EmptyState';
import { sounds } from '../lib/sound';
import { speak } from '../lib/tts';
import { LETTER_CONFUSIONS, tokenize, diffWords } from '../lib/check';

export default function DictionaryPage() {
  const { refresh } = useUser();
  const [words, setWords] = useState<DictWord[]>([]);
  const [loaded, setLoaded] = useState(false);
  // mini-game state
  const [gameWord, setGameWord] = useState<DictWord | null>(null);
  const [gameTyped, setGameTyped] = useState('');
  const [gameTries, setGameTries] = useState(0);
  const [gameMsg, setGameMsg] = useState<'' | 'ok' | 'no'>('');

  const load = () => api.get<{ words: DictWord[] }>('/dictionary').then((r) => {
    setWords(r.words);
    setLoaded(true);
  }).catch(() => setLoaded(true));

  useEffect(() => { load(); }, []);

  const activeWords = useMemo(() => words.filter((w) => !w.learned), [words]);

  const startGame = (w: DictWord) => {
    setGameWord(w);
    setGameTyped('');
    setGameTries(0);
    setGameMsg('');
    speak(w.word);
    sounds.click();
  };

  const gameCheck = () => {
    if (!gameWord) return;
    const typedWords = tokenize(gameTyped, 2);
    const target = tokenize(gameWord.word, 2);
    const tokens = diffWords(typedWords, target);
    const ok = tokens.length === 1 && tokens[0].kind === 'ok';
    if (ok) {
      setGameMsg('ok');
      sounds.correct();
      api.post(`/dictionary/${gameWord.id}/practice`, { ok: true }).catch(() => { /* ignore */ });
      setTimeout(() => {
        setGameWord(null);
        load();
        refresh().catch(() => { /* ignore */ });
      }, 900);
    } else {
      setGameTries((t) => t + 1);
      setGameMsg('no');
      sounds.wrong();
    }
  };

  const confusionFor = (w: string) => {
    const pair = LETTER_CONFUSIONS.find(([a, b]) => w.includes(a) && w.includes(b)) ||
      LETTER_CONFUSIONS.find(([a]) => w.includes(a) && w.includes(a === 'қ' ? 'к' : a === 'ғ' ? 'г' : a === 'ә' ? 'а' : a === 'ө' ? 'о' : a === 'ұ' ? 'у' : a === 'ү' ? 'у' : a === 'ң' ? 'н' : a === 'і' ? 'и' : a === 'һ' ? 'х' : ''));
    return pair;
  };

  return (
    <div>
      <h1>📖 Менің сөздігім</h1>
      <p className="muted">Мұнда қатесін жасаған сөздерің жиналады. Оқyp, жазyp, оларды үйрен! (Басып оқу үшін 🔊 түймесін бас.)</p>

      {loaded && words.length === 0 && (
        <EmptyState emoji="🌱" title="Сөздік әзірге бос" text="Ертегі жазған сайын қателескен сөздерің осы жерге жиналады." />
      )}

      <div className="card" style={{ border: '3px solid var(--gold)' }}>
        <h3>🎮 Сөздік ойыны</h3>
        {!gameWord ? (
          activeWords.length > 0 ? (
            <>
              <p className="muted">Сөзді басып, оны тыңдап, естігеніңді жаз.</p>
              <div className="flex">
                {activeWords.slice(0, 10).map((w) => (
                  <button key={w.id} className="btn btn-ghost" onClick={() => startGame(w)}>
                    🔊 {w.word}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Ойнауға сөз жоқ — барлығын үйрендің! 🎉</p>
          )
        ) : (
          <div className="pop-in">
            <div className="flex" style={{ marginBottom: '0.6rem' }}>
              <button className="btn" onClick={() => speak(gameWord.word)} aria-label="Қайта оқу">🔁 Оқу</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setGameWord(null)}>✕ Жабу</button>
            </div>
            <p style={{ fontSize: '1.2rem' }}>Бұл сөзді жаз: <strong>?</strong></p>
            <div className="row">
              <input
                className="input"
                value={gameTyped}
                onChange={(e) => setGameTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && gameCheck()}
                placeholder="Сөзді осында…"
                autoFocus
                aria-label="Сөзді жазу"
              />
              <div className="auto"><button className="btn btn-green" onClick={gameCheck}>Тексеру</button></div>
            </div>
            {gameMsg === 'ok' && <p className="form-ok" style={{ marginTop: '0.6rem' }}>🎉 Дұрыс! +5 XP</p>}
            {gameMsg === 'no' && (
              <p className="form-error" style={{ marginTop: '0.6rem' }}>
                {gameTries >= 2
                  ? <>Қайта тыңдап көр. Жауабы: <strong>{gameWord.word}</strong></>
                  : <>Тағы тыңдап, қайта көр. Кеңес: сөзде «{confusionFor(gameWord.word)?.[0] || gameWord.word[0]}» бар болуы мүмкін.</>}
              </p>
            )}
          </div>
        )}
      </div>

      {words.length > 0 && (
        <div className="card mt">
          <h3>Жаттығу сөздері ({activeWords.length})</h3>
          <div className="tales-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {words.map((w) => (
              <div key={w.id} className="card" style={{ borderColor: w.learned ? 'var(--green)' : 'var(--line)', opacity: w.learned ? 0.7 : 1 }}>
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '1.15rem' }}>{w.word}</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => speak(w.word)} aria-label={`${w.word} сөзін оқу`}>🔊</button>
                </div>
                {w.example && <p className="small muted" style={{ margin: '0.4rem 0' }}>{w.example}</p>}
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="small muted">{w.times_wrong} рет қате</span>
                  {w.learned ? (
                    <span className="badge-pill">✓ үйренілді</span>
                  ) : (
                    <button className="btn btn-gold btn-sm" onClick={() => startGame(w)}>Ойнау</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
