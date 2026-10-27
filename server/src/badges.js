// Badge catalogue (static, Kazakh UI strings).
export const BADGES = [
  { code: 'first_tale', emoji: '🌟', name: 'Бірінші ертегі', desc: 'Алғашқы ертегіңді аяқтадың' },
  { code: 'three_tales', emoji: '🏅', name: 'Үш ертегі', desc: '3 ертегі аяқтадың' },
  { code: 'ten_tales', emoji: '👑', name: 'Он ертегі', desc: '10 ертегі аяқтадың' },
  { code: 'perfect_tale', emoji: '💯', name: 'Тамаша диктант', desc: 'Бір ертегіде қате жасамадың' },
  { code: 'q_master', emoji: '🔤', name: 'Қ әрпінің шебері', desc: 'Соңғы 3 ертегіде қ/к қатесін жасамадың' },
  { code: 'streak3', emoji: '🔥', name: '3 күн қатарынан', desc: '3 күн қатарынан оқыдың' },
  { code: 'streak7', emoji: '🌅', name: '7 күн қатарынан', desc: '7 күн қатарынан оқыдың' },
  { code: 'dict5', emoji: '📚', name: 'Сөздік шебері', desc: '5 сөзді сөздіктен үйрендің' },
];

export const LEVELS = [
  { xp: 0, name: 'Жас жазушы', emoji: '✏️' },
  { xp: 100, name: 'Кішкентай ертегіші', emoji: '📖' },
  { xp: 250, name: 'Ертегіші', emoji: '🎨' },
  { xp: 500, name: 'Үздік жазушы', emoji: '🏆' },
  { xp: 1000, name: 'Алтын қалам', emoji: '👑' },
];

export function levelFor(xp) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const progress = next ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100)) : 100;
  return { index: idx, name: cur.name, emoji: cur.emoji, next: next ? next.name : null, nextXp: next ? next.xp : null, progress };
}
