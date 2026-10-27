// End-to-end API smoke test: node tools/api-test.mjs
// Requires a running server (http://localhost:4000).
const BASE = process.env.API_BASE || 'http://localhost:4000';
let passed = 0;
let failed = 0;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

// 1. health
const h = await api('/api/health');
check('health', h.status === 200 && h.json.ok);

// 2. login student
const login = await api('/api/auth/login', { method: 'POST', body: { username: 'aybota', password: 'Aybota2026!' } });
check('student login', login.status === 200 && login.json.token, JSON.stringify(login.json));
const studentLogin = login.json.token;

// 3. guest
const guest = await api('/api/auth/guest', { method: 'POST', body: {} });
check('guest mode', guest.status === 200 && guest.json.user.role === 'guest');

// 4. register (fresh user → idempotent test runs)
const reg = await api('/api/auth/register', { method: 'POST', body: { name: 'Тест Бала', username: `test_${Date.now() % 100000}`, password: 'Test1234', avatar: 'bear' } });
check('register', reg.status === 200 && reg.json.user.role === 'student');
const student = reg.json.token;

// 5. tales list
const tales = await api('/api/tales', { token: student });
check('tales list ≥ 6', tales.status === 200 && tales.json.tales.length >= 6, `got ${tales.json?.tales?.length}`);
const tale = tales.json.tales[0];

// 6. tale detail with segments
const detail = await api(`/api/tales/${tale.id}`, { token: student });
check('tale segments', detail.status === 200 && detail.json.segments.length > 5);
check('segment times valid', detail.json.segments.every((s) => s.end_sec > s.start_sec && s.text.length > 3));

// 7. start attempt
const start = await api(`/api/attempts/tales/${tale.id}/start`, { method: 'POST', token: student, body: {} });
check('start attempt', start.status === 200 && start.json.attempt.id > 0);
const attemptId = start.json.attempt.id;

// 8. progress
const prog = await api(`/api/attempts/${attemptId}/progress`, { method: 'POST', token: student, body: { segment: 2 } });
check('save progress', prog.status === 200);

// 9. finish attempt (simulated answers)
const segs = detail.json.segments;
const answers = segs.map((s, i) => {
  const words = s.text.trim().split(/\s+/);
  return { segment_pos: i, attempts: 1, status: 'correct', hint_level: 0, words_total: words.length, words_correct: words.length, words_wrong: [] };
});
const finish = await api(`/api/attempts/${attemptId}/finish`, { method: 'POST', token: student, body: { answers, letterErrors: {} } });
check('finish attempt', finish.status === 200 && finish.json.stars >= 1, JSON.stringify(finish.json));
check('accuracy 100', finish.json.accuracy === 100);
check('new badge first_tale', Array.isArray(finish.json.newBadges) && finish.json.newBadges.some((b) => b.code === 'first_tale'));

// 10. progress page data
const p = await api('/api/progress', { token: student });
check('progress data', p.status === 200 && p.json.completed.length >= 1 && p.json.weekly.length === 7);

// 11. dictionary (wrong word)
const detail2 = await api(`/api/tales/${tales.json.tales[1].id}`, { token: student });
const start2 = await api(`/api/attempts/tales/${tales.json.tales[1].id}/start`, { method: 'POST', token: student, body: {} });
const segs2 = detail2.json.segments;
const answers2 = segs2.map((s, i) => {
  const words = s.text.trim().split(/\s+/);
  const wrong = i === 0 ? [words[0]] : [];
  return { segment_pos: i, attempts: wrong.length ? 2 : 1, status: 'correct', hint_level: 0, words_total: words.length, words_correct: words.length - wrong.length, words_wrong: wrong, example: s.text };
});
const finish2 = await api(`/api/attempts/${start2.json.attempt.id}/finish`, { method: 'POST', token: student, body: { answers: answers2, letterErrors: { 'қ/к': 1 } } });
check('finish #2', finish2.status === 200);
const dict = await api('/api/dictionary', { token: student });
check('dictionary word saved', dict.status === 200 && dict.json.words.length >= 1);
const dw = dict.json.words[0];
const learn = await api(`/api/dictionary/${dw.id}/learn`, { method: 'POST', token: student, body: {} });
check('mark learned', learn.status === 200);

// 12. teacher flows
const tlogin = await api('/api/auth/login', { method: 'POST', body: { username: 'gulessar', password: 'Gulesar2026!' } });
check('teacher login', tlogin.status === 200);
const teacher = tlogin.json.token;
const cls = await api('/api/teacher/classes', { token: teacher });
check('teacher classes', cls.status === 200 && cls.json.classes.length >= 1);
const clsId = cls.json.classes[0].id;
const clsDetail = await api(`/api/teacher/classes/${clsId}`, { token: teacher });
check('class members', clsDetail.status === 200 && clsDetail.json.members.length >= 3);
const hw = await api('/api/teacher/homework', { method: 'POST', token: teacher, body: { class_id: clsId, tale_id: tale.id } });
check('assign homework', hw.status === 200);
const an = await api(`/api/teacher/classes/${clsId}/analytics`, { token: teacher });
check('class analytics', an.status === 200 && Array.isArray(an.json.topWords));

// 13. RBAC: student cannot access teacher routes
const forbidden = await api('/api/teacher/classes', { token: student });
check('RBAC blocks student', forbidden.status === 403);

// 14. admin flows
const alogin = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'Admin2026!' } });
check('admin login', alogin.status === 200);
const admin = alogin.json.token;
const split = await api(`/api/admin/tales/${tale.id}/split`, { method: 'POST', token: admin, body: { text: 'Бір қыз болды. Ол орманға барды. Қасқыр шықты!' } });
check('sentence split', split.status === 200 && split.json.sentences.length === 3, JSON.stringify(split.json));
const yt = await api('/api/admin/yt-info', { method: 'POST', token: admin, body: { url: 'https://www.youtube.com/watch?v=' + tale.youtubeId } });
check('youtube metadata proxy', yt.status === 200 && yt.json.title.length > 0);
const adminTales = await api('/api/admin/tales', { token: admin });
check('admin tales', adminTales.status === 200 && adminTales.json.tales.length >= 6);
const teacherBlocked = await api('/api/admin/tales', { token: teacher });
check('RBAC blocks teacher from admin', teacherBlocked.status === 403);

// 15. settings persistence
const patch = await api('/api/auth/me', { method: 'PATCH', token: student, body: { settings: { theme: 'dark', textSize: 'lg', sound: true } } });
check('settings saved', patch.status === 200 && patch.json.user.settings.theme === 'dark');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
