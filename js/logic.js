// Pure rules for dates, discipline and progression. No DOM here, so it can be tested in Node.

export const MAX_SETS = 5;
export const BASE_SETS = 3;

export const MISS_CATEGORIES = [
  { id: 'busy', label: 'งานยุ่ง' },
  { id: 'tired', label: 'เหนื่อย' },
  { id: 'sick', label: 'ป่วย / เจ็บ' },
  { id: 'forgot', label: 'ลืม' },
  { id: 'lazy', label: 'ขี้เกียจ' },
  { id: 'other', label: 'อื่นๆ' },
];

// ---------- dates (local time, 'YYYY-MM-DD' strings) ----------

export function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// Weeks start on Monday.
export function weekStartOf(s) {
  const d = parseYmd(s);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(s, -dow);
}

export function weekDays(ws) {
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

// ---------- weeks & discipline ----------

export function completedSessions(state) {
  return state.sessions.filter((s) => s.completedAt);
}

export function weekSummary(state, ws, today) {
  const we = addDays(ws, 6);
  const done = completedSessions(state).filter((s) => s.date >= ws && s.date <= we).length;
  const grace = state.graces.includes(ws);
  const quota = state.settings.quota;
  let status;
  if (ws < state.startWeek) status = 'before';
  else if (done >= quota) status = 'done';
  else if (ws === weekStartOf(today)) status = grace ? 'grace' : 'current';
  else if (ws > weekStartOf(today)) status = 'future';
  else status = grace ? 'grace' : 'missed';
  return { ws, done, quota, grace, status };
}

// Consecutive weeks with the quota met. Grace weeks are skipped over.
// The current week counts only once it is done; an unfinished current week does not break it.
export function streak(state, today) {
  let count = 0;
  let ws = weekStartOf(today);
  const cur = weekSummary(state, ws, today);
  if (cur.status === 'done') count++;
  ws = addDays(ws, -7);
  for (;;) {
    const w = weekSummary(state, ws, today);
    if (w.status === 'done') count++;
    else if (w.status === 'grace') { /* neutral */ }
    else break;
    ws = addDays(ws, -7);
  }
  return count;
}

// Past missed weeks that still need a written reason, oldest first.
export function pendingMisses(state, today) {
  const out = [];
  const cur = weekStartOf(today);
  for (let ws = state.startWeek; ws < cur; ws = addDays(ws, 7)) {
    const w = weekSummary(state, ws, today);
    if (w.status === 'missed' && !state.misses[ws]) out.push(w);
  }
  return out;
}

export function urgency(state, today) {
  const ws = weekStartOf(today);
  const w = weekSummary(state, ws, today);
  const daysLeft = 7 - Math.round((parseYmd(today) - parseYmd(ws)) / 86400000); // includes today
  const remaining = Math.max(0, w.quota - w.done);
  const doneToday = completedSessions(state).some((s) => s.date === today);
  // Days still usable: if already trained today, today is spent.
  const usable = daysLeft - (doneToday ? 1 : 0);
  const level = remaining === 0 ? 'ok' : w.grace ? 'grace' : remaining >= usable ? 'red' : remaining === usable - 1 ? 'amber' : 'calm';
  return { ...w, daysLeft, remaining, usable, level };
}

export function graceCheck(state, today) {
  const ws = weekStartOf(today);
  if (state.graces.includes(ws)) return { ok: false, why: 'สัปดาห์นี้ใช้ใบผ่อนผันแล้ว' };
  const month = ws.slice(0, 7);
  const used = state.graces.find((g) => g.slice(0, 7) === month);
  if (used) return { ok: false, why: `เดือนนี้ใช้ใบผ่อนผันไปแล้ว (สัปดาห์ ${used})` };
  const w = weekSummary(state, ws, today);
  if (w.status === 'done') return { ok: false, why: 'สัปดาห์นี้ทำครบแล้ว ไม่ต้องใช้' };
  return { ok: true, ws };
}

// ---------- templates & sessions ----------

export function nextTemplate(state) {
  if (!state.templates.length) return null;
  return state.templates[state.nextTpl % state.templates.length];
}

export function activeSession(state, today) {
  return state.sessions.find((s) => !s.completedAt && s.date === today) || null;
}

function lastEntryFor(state, tplId, exId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const s = state.sessions[i];
    if (s.tplId !== tplId) continue;
    const e = s.items.find((it) => it.exId === exId);
    if (e && e.done.some((r) => r != null)) return e;
  }
  return null;
}

export function targetsFor(state, tplId, item) {
  const prev = lastEntryFor(state, tplId, item.exId);
  return Array.from({ length: item.sets }, (_, i) => {
    const r = prev && prev.weight === item.weight ? prev.done[i] : null;
    return r == null ? item.min : Math.min(item.max, Math.max(item.min, r + 1));
  });
}

export function newSession(state, today, tpl, uid) {
  return {
    id: uid,
    date: today,
    tplId: tpl.id,
    tplName: tpl.name,
    startedAt: new Date().toISOString(),
    completedAt: null,
    items: tpl.items.map((it) => ({
      exId: it.exId,
      weight: it.weight,
      rest: it.rest,
      target: targetsFor(state, tpl.id, it),
      done: Array(it.sets).fill(null),
    })),
  };
}

export function sessionComplete(session) {
  return session.items.every((it) => it.done.every((r) => r != null));
}

// Double progression for one template item, given what was done this session.
export function progress(item, entry, weights) {
  const allTop = entry.done.length >= item.sets && entry.done.every((r) => r != null && r >= item.max);
  if (!allTop) return { item, note: null };
  if (item.sets < MAX_SETS) {
    return { item: { ...item, sets: item.sets + 1 }, note: `เพิ่มเป็น ${item.sets + 1} เซ็ต` };
  }
  const heavier = (weights || []).filter((w) => w > (item.weight || 0)).sort((a, b) => a - b)[0];
  if (heavier != null) {
    return {
      item: { ...item, sets: BASE_SETS, weight: heavier },
      note: `ขึ้นน้ำหนักเป็น ${heavier} kg (เริ่มใหม่ ${BASE_SETS} × ${item.min})`,
    };
  }
  return { item, note: 'ถึงขีดสุดของอุปกรณ์แล้ว: เปลี่ยนเป็นท่าที่ยากขึ้น (ข้างเดียว / ช้าลง / เกร็งค้าง) หรือซื้อน้ำหนักเพิ่ม' };
}

// Marks the session complete, advances rotation, applies progression. Returns notes per exercise.
export function completeSession(state, session) {
  session.completedAt = new Date().toISOString();
  const tpl = state.templates.find((t) => t.id === session.tplId);
  const notes = [];
  if (tpl) {
    const idx = state.templates.indexOf(tpl);
    state.nextTpl = (idx + 1) % state.templates.length;
    tpl.items = tpl.items.map((it) => {
      const entry = session.items.find((e) => e.exId === it.exId);
      if (!entry || entry.weight !== it.weight) return it;
      const ex = state.exercises.find((x) => x.id === it.exId);
      const weights = ex ? state.equipment[ex.equip] : [];
      const r = progress(it, entry, weights);
      if (r.note) notes.push({ exId: it.exId, note: r.note });
      return r.item;
    });
  }
  session.notes = notes;
  return notes;
}

export function skipTemplate(state, today) {
  const tpl = nextTemplate(state);
  if (!tpl) return;
  state.skips.push({ date: today, tplId: tpl.id, tplName: tpl.name });
  state.nextTpl = (state.templates.indexOf(tpl) + 1) % state.templates.length;
}

// Abandoned sessions from earlier days: never counted, kept for history.
export function staleSessions(state, today) {
  return state.sessions.filter((s) => !s.completedAt && s.date < today);
}

// ---------- history ----------

export function exerciseHistory(state, exId) {
  const out = [];
  for (const s of completedSessions(state)) {
    const e = s.items.find((it) => it.exId === exId);
    if (!e) continue;
    const reps = e.done.reduce((a, r) => a + (r || 0), 0);
    const volume = e.weight ? reps * e.weight : reps;
    out.push({ date: s.date, weight: e.weight, sets: e.done.length, reps, volume });
  }
  return out;
}

export function missStats(state) {
  const counts = {};
  for (const m of Object.values(state.misses)) counts[m.cat] = (counts[m.cat] || 0) + 1;
  return MISS_CATEGORIES.map((c) => ({ ...c, n: counts[c.id] || 0 })).filter((c) => c.n);
}
