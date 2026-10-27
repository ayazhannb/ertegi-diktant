// Lesson page: YouTube IFrame player + interactive dictation engine.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../api';
import type { FinishResult, TaleDetail } from '../types';
import { useUser } from '../UserContext';
import Mascot from '../components/Mascot';
import KazakhKeyboard from '../components/KazakhKeyboard';
import StarRating from '../components/StarRating';
import EmptyState from '../components/EmptyState';
import {
  checkAnswer, fmtDuration, HINT_COSTS, liveScore, MAX_ATTEMPTS, MAX_SKIPS,
  segmentScore, starsFor, type AnswerRecord, type CheckResult,
} from '../lib/check';
import { sounds } from '../lib/sound';
import { speak, stopSpeaking } from '../lib/tts';

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

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

type Phase = 'intro' | 'playing' | 'writing' | 'feedback' | 'finishing' | 'finished';

function wrongWordsFrom(res: CheckResult): string[] {
  const out: string[] = [];
  for (const t of res.tokens) {
    if (t.kind === 'wrong' || t.kind === 'missing') out.push(t.correct || t.child);
  }
  return out;
}

function letterErrorsFrom(res: CheckResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of res.letterHints) {
    const pair = `${h.found}/${h.expected}`;
    out[pair] = (out[pair] || 0) + 1;
  }
  return out;
}

export default function LessonPage() {
  const { taleId } = useParams();
  const nav = useNavigate();
  const { user, refresh } = useUser();

  const [tale, setTale] = useState<TaleDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [segIdx, setSegIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [attemptsNow, setAttemptsNow] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintFlash, setHintFlash] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [slow, setSlow] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [finish, setFinish] = useState<FinishResult | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const answersRef = useRef<AnswerRecord[]>([]);
  const attemptIdRef = useRef<number | null>(null);
  const startTsRef = useRef(0);
  const phaseRef = useRef<Phase>('intro');
  const segIdxRef = useRef(0);
  phaseRef.current = phase;
  segIdxRef.current = segIdx;

  const segments = useMemo(() => tale?.segments || [], [tale]);
  const seg = segments[segIdx];
  const level = tale?.tale.level || 1;

  // load tale
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.get<TaleDetail>(`/tales/${taleId}`);
        if (alive) { setTale(d); setSegIdx(0); }
      } catch (e: any) {
        if (alive) setLoadError(e.message || 'Ертегі жүктелмеді');
      }
    })();
    return () => { alive = false; };
  }, [taleId]);

  // create YouTube player when tale loaded
  useEffect(() => {
    if (!tale || !hostRef.current) return;
    let cancelled = false;
    let player: any = null;
    (async () => {
      const YT = await loadYT();
      if (cancelled || !hostRef.current) return;
      const host = hostRef.current;
      host.innerHTML = '';
      const div = document.createElement('div');
      host.appendChild(div);
      player = new YT.Player(div, {
        videoId: tale.tale.youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0, controls: 1, rel: 0, playsinline: 1,
          iv_load_policy: 3, modestbranding: 1, cc_lang_pref: 'kk',
        },
        events: {
          onReady: () => { playerRef.current = player; },
          onError: (e: any) => {
            const code = e?.data;
            if ([2, 5, 100, 101, 150].includes(code)) {
              setPlayerError('Бейне қазір қолжетімді емес. Өкінішке орай, осы ертегіден уақытша алыспай-ақ, кітапханадан басқа ертегіні таңдап көр!');
            }
          },
        },
      });
    })();
    return () => {
      cancelled = true;
      try { player?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [tale]);

  // auto-pause poll while playing
  useEffect(() => {
    if (phase !== 'playing' || !seg) return;
    const iv = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.getCurrentTime) return;
      try {
        const t = p.getCurrentTime() || 0;
        if (t >= seg.end_sec - 0.05) {
          try { p.pauseVideo(); } catch { /* ignore */ }
          setPhase('writing');
          window.setTimeout(() => textRef.current?.focus(), 60);
        }
      } catch { /* player not ready */ }
    }, 200);
    return () => window.clearInterval(iv);
  }, [phase, seg]);

  // hint flash auto-hide
  useEffect(() => {
    if (!hintFlash) return;
    const t = window.setTimeout(() => setHintFlash(false), 3000);
    return () => window.clearTimeout(t);
  }, [hintFlash]);

  const playFrom = (t: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setPlaybackRate(slow ? 0.75 : 1);
      p.seekTo(t, true);
      p.playVideo();
      sounds.click();
    } catch { /* ignore */ }
  };

  const beginSegment = useCallback((idx: number) => {
    const s = segments[idx];
    setSegIdx(idx);
    setTyped('');
    setAttemptsNow(0);
    setHintLevel(0);
    setResult(null);
    setWasCorrect(false);
    setReveal(false);
    setPhase('playing');
    if (s) playFrom(s.start_sec);
    // save resume point
    if (attemptIdRef.current != null) {
      api.post(`/attempts/${attemptIdRef.current}/progress`, { segment: idx }).catch(() => { /* ignore */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, slow]);

  const startLesson = useCallback(async (fromSeg = 0) => {
    if (!tale) return;
    setBusy(true);
    startTsRef.current = Date.now();
    answersRef.current = [];
    // gesture-first: start the video immediately (mobile autoplay rules)
    const s = segments[fromSeg];
    const p = playerRef.current;
    if (p && s) {
      try { p.setPlaybackRate(slow ? 0.75 : 1); p.seekTo(s.start_sec, true); p.playVideo(); } catch { /* ignore */ }
    }
    setPhase('playing');
    setSegIdx(fromSeg);
    try {
      const r = await api.post<{ attempt: { id: number; current_segment: number; segment_count: number } }>(`/attempts/tales/${tale.tale.id}/start`);
      attemptIdRef.current = r.attempt.id;
    } catch {
      attemptIdRef.current = null; // offline: continue without server sync
    }
    setBusy(false);
  }, [tale, segments, slow]);

  const addAnswer = (a: Omit<AnswerRecord, 'pos'>) => {
    answersRef.current = [...answersRef.current.filter((x) => x.pos !== segIdx), { ...a, pos: segIdx }];
  };

  const doCheck = () => {
    if (!seg || !typed.trim()) {
      if (!typed.trim()) { setResult(null); setWasCorrect(false); setPhase('writing'); }
      return;
    }
    stopSpeaking();
    const res = checkAnswer(typed, seg.text, level, attemptsNow);
    if (res.ok) {
      setWasCorrect(true);
      setResult(res);
      setPhase('feedback');
      sounds.correct();
      addAnswer({
        attempts: attemptsNow + 1, status: 'correct', hintLevel,
        wordsTotal: res.totalCount, wordsCorrect: res.correctCount,
        wordsWrong: wrongWordsFrom(res), letterErrors: letterErrorsFrom(res), typedText: typed,
      });
      if (attemptIdRef.current != null) {
        const nxt = Math.min(segIdx + 1, segments.length - 1);
        api.post(`/attempts/${attemptIdRef.current}/progress`, { segment: nxt }).catch(() => { /* ignore */ });
      }
    } else {
      const na = attemptsNow + 1;
      setAttemptsNow(na);
      setResult(res);
      setWasCorrect(false);
      setPhase('feedback');
      if (na >= MAX_ATTEMPTS) {
        setReveal(true);
        setTyped('');
        sounds.wrong();
      } else {
        sounds.wrong();
      }
    }
  };

  const useHint = () => {
    if (hintLevel >= 3 || !seg) return;
    const next = hintLevel + 1;
    setHintLevel(next);
    sounds.hint();
    if (next === 3) setHintFlash(true);
  };

  const skipSeg = () => {
    if (!seg || skipsUsed >= MAX_SKIPS) return;
    setSkipsUsed((s) => s + 1);
    sounds.click();
    addAnswer({
      attempts: attemptsNow + 1, status: 'skipped', hintLevel,
      wordsTotal: seg.text.trim().split(/\s+/).length, wordsCorrect: 0,
      wordsWrong: seg.text.trim().split(/\s+/), letterErrors: {},
    });
    continueNext();
  };

  const continueNext = () => {
    if (segIdx + 1 >= segments.length) void finishLesson();
    else beginSegment(segIdx + 1);
  };

  const finishLesson = async () => {
    setPhase('finishing');
    stopSpeaking();
    setElapsedSec(Math.round((Date.now() - startTsRef.current) / 1000));
    const answers = answersRef.current;
    const letterErrors: Record<string, number> = {};
    for (const a of answers) for (const [k, v] of Object.entries(a.letterErrors)) letterErrors[k] = (letterErrors[k] || 0) + v;
    let res: FinishResult | null = null;
    if (attemptIdRef.current != null) {
      try {
        res = await api.post<FinishResult>(`/attempts/${attemptIdRef.current}/finish`, { answers, letterErrors });
      } catch { /* offline fallback below */ }
    }
    if (!res) {
      // offline fallback: compute locally with the same rules
      const wordsTotal = answers.reduce((s, a) => s + a.wordsTotal, 0);
      const wordsCorrect = answers.reduce((s, a) => s + a.wordsCorrect, 0);
      const accuracy = wordsTotal ? Math.round((wordsCorrect / wordsTotal) * 1000) / 10 : 100;
      const hintsUsed = answers.filter((a) => a.hintLevel > 0).length;
      const stars = starsFor(accuracy, hintsUsed);
      const score = liveScore(answers);
      res = {
        score, accuracy, stars, hintsUsed,
        skipped: answers.filter((a) => a.status === 'skipped').length,
        wordsTotal, wordsCorrect, xpGain: score + stars * 5,
        streak: user?.streak || 0, newBadges: [],
      };
    }
    setFinish(res);
    setPhase('finished');
    sounds.complete();
    const c = confetti as any;
    c({ particleCount: 140, spread: 75, origin: { y: 0.7 }, colors: ['#FFC53D', '#21AED4', '#FF8A4C', '#2FA96B'] });
    window.setTimeout(() => c({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.8 } }), 350);
    window.setTimeout(() => c({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.8 } }), 650);
    refresh().catch(() => { /* ignore */ });
  };

  const retry = () => {
    setFinish(null);
    setSkipsUsed(0);
    setPhase('intro');
    setSegIdx(0);
    answersRef.current = [];
    attemptIdRef.current = null;
  };

  const insertAtCursor = (ch: string) => {
    const el = textRef.current;
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, s) + ch + el.value.slice(e);
    setTyped(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = s + ch.length;
      el.focus();
    });
  };

  // ---------- render ----------
  if (loadError) {
    return (
      <EmptyState emoji="📡" title="Ертегі жүктелмеді" text={loadError}
        action={<Link to="/" className="btn btn-gold mt">📚 Кітапханаға оралу</Link>} />
    );
  }
  if (!tale || !seg) {
    return <div className="center" style={{ padding: '3rem' }}><span className="spin" style={{ fontSize: '2rem' }}>🦊</span></div>;
  }

  const scoreNow = liveScore(answersRef.current);
  const storyDone = answersRef.current
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .filter((a) => a.pos < segIdx || phase === 'finished')
    .map((a) => ({
      text: a.status === 'skipped' ? seg.text : (a.typedText || segments[a.pos]?.text || ''),
      skipped: a.status === 'skipped',
      pos: a.pos,
    }));
  const allStory = phase === 'finished'
    ? answersRef.current.slice().sort((a, b) => a.pos - b.pos).map((a) => ({
      text: a.status === 'skipped' ? segments[a.pos]?.text || '' : (a.typedText || segments[a.pos]?.text || ''),
      skipped: a.status === 'skipped',
      pos: a.pos,
    }))
    : storyDone;

  const hintLines = hintLevel >= 1 ? [
    hintLevel >= 1 ? `Бұл сөйлемде ${seg.text.trim().split(/\s+/).length} сөз бар.` : '',
    hintLevel >= 2 ? `Әріптері: ${seg.text.trim().split(/\s+/).map((w) => w[0] + ' _').join('  ')}` : '',
  ].filter(Boolean) : [];

  const statusBanner = () => {
    switch (phase) {
      case 'playing': return <div className="status-banner status-playing" role="status">🎧 Тыңдап жатырмыз…</div>;
      case 'writing': return <div className="status-banner status-writing" role="status">✏️ Жазу уақыты! Естігеніңді жаз.</div>;
      case 'feedback':
        return wasCorrect
          ? <div className="status-banner status-correct" role="status">🎉 Дұрыс! Тамаша!</div>
          : <div className="status-banner status-wrong" role="status">🤔 Тағы бір рет тыңдап көрейік.</div>;
      default: return null;
    }
  };

  const writingEnabled = phase === 'writing' || (phase === 'feedback' && !wasCorrect);

  return (
    <div className="lesson-grid fade-in">
      {/* left: video + controls + status */}
      <section>
        <div className="flex mb" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>{tale.tale.title}</h2>
            <div className="flex" style={{ gap: '0.4rem', marginTop: 4 }}>
              <span className={`chip chip-level chip-l${level}`}>{level}-деңгей</span>
              <span className="muted small">{fmtDuration(tale.tale.duration)} · {segments.length} бөлік</span>
            </div>
          </div>
          <span className="badge-pill">Бөлік {segIdx + 1}/{segments.length}</span>
        </div>
        <div className="pbar mb" style={{ marginBottom: '0.7rem' }} aria-label="Оқу барысы">
          <div style={{ width: `${phase === 'finished' ? 100 : (segIdx / segments.length) * 100}%` }} />
        </div>

        {playerError ? (
          <div className="card center" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '3rem' }}>😔</div>
            <p style={{ maxWidth: 480, margin: '0.5rem auto' }}>{playerError}</p>
            <Link to="/" className="btn btn-gold">📚 Кітапханаға оралу</Link>
          </div>
        ) : (
          <div className="video-frame" aria-label="Ертегі бейнесі">
            <div ref={hostRef} className="yt-host" />
          </div>
        )}

        <div className="mt">{statusBanner()}</div>

        {/* controls */}
        <div className="lesson-controls mt lesson-bottom" aria-label="Басқару түймелері">
          {phase === 'intro' && (
            <>
              <button className="btn btn-gold btn-big" disabled={busy} onClick={() => startLesson(segIdx)}>
                ▶ Бастау
              </button>
              <Link to="/" className="btn btn-ghost">← Артка</Link>
            </>
          )}
          {phase === 'playing' && (
            <>
              <button className="btn" onClick={() => { try { playerRef.current?.pauseVideo(); } catch { /* */ } sounds.click(); }}>⏸ Тоқтату</button>
              <button className="btn" onClick={() => playFrom(seg.start_sec)}>🔁 Қайта тыңдау</button>
              <button className={`btn ${slow ? 'btn-orange' : 'btn-ghost'}`} aria-pressed={slow} onClick={() => {
                const ns = !slow; setSlow(ns);
                try { playerRef.current?.setPlaybackRate(ns ? 0.75 : 1); } catch { /* */ }
              }}>
                {slow ? '🐇 Қалыпты' : '🐢 Баяу'}
              </button>
            </>
          )}
          {phase === 'writing' && (
            <>
              <button className="btn" onClick={() => playFrom(Math.max(playerRef.current?.getCurrentTime?.() ?? 0, seg.start_sec))}>▶ Тыңдау</button>
              <button className="btn" onClick={() => playFrom(seg.start_sec)}>🔁 Қайта</button>
              <button className={`btn ${slow ? 'btn-orange' : 'btn-ghost'}`} aria-pressed={slow} onClick={() => {
                const ns = !slow; setSlow(ns);
                try { playerRef.current?.setPlaybackRate(ns ? 0.75 : 1); } catch { /* */ }
              }}>{slow ? '🐇 Қалыпты' : '🐢 Баяу'}</button>
              <button className="btn btn-gold" onClick={useHint} disabled={hintLevel >= 3}>💡 Көмек{hintLevel > 0 ? ` (${hintLevel})` : ''}</button>
              <button className="btn btn-green" onClick={doCheck}>✅ Тексеру</button>
              <button className="btn btn-ghost" onClick={skipSeg} disabled={skipsUsed >= MAX_SKIPS} title="Әр ертегіде 3 рет ғана">
                ⏭ Өткізу ({MAX_SKIPS - skipsUsed})
              </button>
            </>
          )}
          {phase === 'feedback' && !wasCorrect && (
            <>
              <button className="btn" onClick={() => { setPhase('writing'); textRef.current?.focus(); }}>✏️ Жазу</button>
              <button className="btn" onClick={() => playFrom(seg.start_sec)}>🔁 Қайта тыңдау</button>
              {!reveal && <button className="btn btn-gold" onClick={useHint} disabled={hintLevel >= 3}>💡 Көмек{hintLevel > 0 ? ` (${hintLevel})` : ''}</button>}
              <button className="btn btn-green" onClick={doCheck}>✅ Тексеру</button>
            </>
          )}
          {phase === 'feedback' && wasCorrect && (
            <button className="btn btn-gold btn-big" onClick={continueNext}>➡ Әрі қарай</button>
          )}
          {phase === 'finishing' && (
            <div className="muted center grow" style={{ padding: '1rem' }}><span className="spin">🦊</span> Есеп жасалуда…</div>
          )}
          {phase === 'finished' && (
            <>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨 Басып алу (PDF)</button>
              <button className="btn" onClick={retry}>↺ Қайта оқу</button>
              <Link to="/" className="btn btn-ghost">📚 Кітапхана</Link>
            </>
          )}
        </div>
      </section>

      {/* right: writing + story */}
      <section>
        {phase === 'intro' && (
          <div className="card card-pad-lg pop-in center">
            <Mascot mood="happy" size="big" />
            <h2>«{tale.tale.title}» ертегісі</h2>
            <p className="muted">{tale.tale.description}</p>
            <p className="small muted">
              {segments.length} бөлік · {fmtDuration(tale.tale.duration)} · {level}-деңгей
              {tale.resume && <span className="badge-pill mt" style={{ display: 'inline-flex', marginTop: 8 }}>⏯ Жалғасуды таңдайсың: {tale.resume.segment + 1}/{tale.resume.count}</span>}
            </p>
            <button
              className="btn btn-gold btn-big"
              disabled={busy}
              onClick={() => startLesson(tale.resume?.segment ?? 0)}
            >
              {tale.resume ? `⏯ Жалғастыру (${tale.resume.segment + 1}/${tale.resume.count})` : '▶ Бастау'}
            </button>
            <p className="small muted mt">
              Кеңес: баяу жылдамдықты (🐢) қоссаң, сөйлемдерді жақсырақ естисің.
            </p>
          </div>
        )}

        {(phase === 'playing' || phase === 'writing' || phase === 'feedback') && (
          <div className="card pop-in" style={{ borderTop: '6px solid var(--gold)' }}>
            <div className="flex" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>✏️ Жазу алаңы</h3>
              <span className="badge-pill">⭐ {scoreNow} ұпай</span>
            </div>

            {phase === 'playing' && (
              <p className="muted" style={{ fontSize: '1.05rem' }}>
                Бейне тоқтағанда, осы жерге жазасыз. Мұқият тыңда! 🎧
              </p>
            )}

            <textarea
              ref={textRef}
              className={`write-area ${phase === 'feedback' && wasCorrect ? 'correct' : ''}`}
              value={typed}
              disabled={!writingEnabled}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && writingEnabled) { e.preventDefault(); doCheck(); } }}
              placeholder={writingEnabled ? 'Естіген сөйлеміңді осында жаз…' : '…'}
              aria-label="Диктант жазу алаңы"
            />

            {phase === 'feedback' && result && (
              <div className="mt" style={{ marginTop: '0.8rem' }}>
                <p className="diff-line" aria-label="Жауапты салыстыру">
                  {result.tokens.map((t, i) => {
                    if (t.kind === 'ok') return <span key={i} className="diff-w diff-ok">{t.child}</span>;
                    if (t.kind === 'extra') return <span key={i} className="diff-w diff-extra">{t.child}</span>;
                    if (t.kind === 'missing') return (
                      <span key={i} className="diff-w diff-missing">
                        {reveal || wasCorrect ? <span className="reveal-word">{t.correct}</span> : '▢▢'}
                      </span>
                    );
                    // wrong
                    const show = reveal || wasCorrect || attemptsNow >= 2;
                    return (
                      <span key={i} className="diff-w diff-wrong">
                        {t.child}
                        {show && t.correct && <span className="reveal-word"> → {t.correct}</span>}
                      </span>
                    );
                  })}
                </p>
                {result.letterHints.length > 0 && !wasCorrect && (
                  <div className="hint-box mt" style={{ marginTop: '0.6rem' }}>
                    💡 {result.letterHints.slice(0, 2).map((h, i) => (
                      <span key={i}>Мұнда «{h.expected}» әрпі керек сияқты.</span>
                    ))}
                  </div>
                )}
                {reveal && !wasCorrect && (
                  <div className="hint-box mt" style={{ marginTop: '0.6rem' }}>
                    📖 Мына сөйлемді жазып шық:
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, marginTop: 4 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: 8 }}
                        onClick={() => speak(seg.text)}
                        aria-label="Сөйлемді оқу"
                      >🔊</button>
                      <span style={{ marginLeft: 8 }}>{seg.text}</span>
                    </div>
                  </div>
                )}
                {!wasCorrect && !reveal && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Күту: {MAX_ATTEMPTS - attemptsNow} рет қалды. Қатесің — ештеңе, бірге қайта көрейік!
                  </p>
                )}
              </div>
            )}

            {hintLines.length > 0 && (
              <div className="hint-box mt" style={{ marginTop: '0.6rem' }}>
                {hintLines.map((l, i) => <div key={i}>{i === 0 ? '💡' : '🔤'} {l}</div>)}
              </div>
            )}

            {writingEnabled && (
              <div className="mt" style={{ marginTop: '0.8rem' }}>
                <p className="small muted" style={{ margin: '0 0 0.4rem' }}>Қазақ әріптері (басып қой):</p>
                <KazakhKeyboard onInsert={insertAtCursor} />
              </div>
            )}
          </div>
        )}

        {/* story so far */}
        {phase !== 'intro' && allStory.length > 0 && (
          <div className="card mt" style={{ marginTop: '1rem', borderTop: '6px solid var(--sky)' }}>
            <h3 style={{ margin: '0 0 0.6rem' }}>📜 Менің жазған ертегім</h3>
            <div className="story-panel">
              {allStory.map((s) => (
                <p key={s.pos} className={`story-sent ${s.skipped ? 'skipped' : 'done'} ${s.pos === segIdx && phase !== 'finished' ? 'current' : ''}`}>
                  {s.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* finished screen */}
        {phase === 'finished' && finish && (
          <div className="card card-pad-lg mt pop-in finish-hero" style={{ marginTop: '1rem' }}>
            <Mascot mood="celebrate" size="big" />
            <h2>Ертегі аяқталды! 🎉</h2>
            <div className="big-stars"><StarRating value={finish.stars} size="3rem" /></div>
            <div className="stat-grid mt">
              <div className="stat"><div className="num">{finish.score}</div><div className="lbl">Ұпай</div></div>
              <div className="stat"><div className="num">{finish.accuracy}%</div><div className="lbl">Нақтылық</div></div>
              <div className="stat"><div className="num">{fmtDuration(elapsedSec)}</div><div className="lbl">Уақыт</div></div>
              <div className="stat"><div className="num">+{finish.xpGain}</div><div className="lbl">XP</div></div>
              <div className="stat"><div className="num">{finish.hintsUsed}</div><div className="lbl">Көмек</div></div>
            </div>
            {finish.newBadges.length > 0 && (
              <div className="flex center mt" style={{ justifyContent: 'center', marginTop: '1rem' }}>
                {finish.newBadges.map((b) => (
                  <span key={b.code} className="badge-pill pop-in" style={{ fontSize: '1rem' }}>{b.emoji} {b.name}</span>
                ))}
              </div>
            )}
            <div className="mt" style={{ textAlign: 'left', marginTop: '1.2rem' }}>
              <h3>Менің жазған ертегім</h3>
              {allStory.map((s) => (
                <p key={s.pos} className={`story-sent ${s.skipped ? 'skipped' : 'done'}`}>{s.text}</p>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* hint flash overlay */}
      {hintFlash && seg && (
        <div className="hint-flash" role="status" aria-label="Сөйлем көрсетілуде">
          <div className="box">{seg.text}</div>
        </div>
      )}

      {/* print area (PDF) */}
      <div id="print-area" aria-hidden>
        <h1>«{tale.tale.title}» — Менің жазған ертегім</h1>
        <div className="p-meta">
          Жазған: {user?.name} · {new Date().toLocaleDateString('kk-KZ')} · Нақтылық: {finish?.accuracy ?? 0}% · Жұлдыз: {finish?.stars ?? 0}/3
        </div>
        {(phase === 'finished' ? allStory : []).map((s) => (
          <p key={s.pos} className={`p-sent ${s.skipped ? 'skip' : ''}`}>{s.text}</p>
        ))}
        <div className="p-sign"><span>Қолы: ______________</span><span>Күні: ______________</span></div>
      </div>
    </div>
  );
}
