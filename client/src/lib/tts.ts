// Text-to-speech helper: prefers a Kazakh voice, falls back gracefully.
let warned = false;

export function speak(text: string, rate = 0.92) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const kk = voices.find((v) => v.lang.toLowerCase().startsWith('kk'));
    if (kk) {
      u.voice = kk;
    } else {
      u.lang = 'kk-KZ';
      if (!warned) {
        warned = true;
        // soft one-time note, non-blocking
      }
    }
    u.rate = rate;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch { /* TTS unavailable — ignore */ }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

export function hasKazakhVoice(): boolean {
  try {
    return window.speechSynthesis?.getVoices().some((v) => v.lang.toLowerCase().startsWith('kk')) ?? false;
  } catch { return false; }
}
