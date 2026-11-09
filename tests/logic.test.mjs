// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { defaultState } from '../js/store.js';

const done = (date, tplId = 'A') => ({ id: date + tplId, date, tplId, tplName: tplId, items: [], completedAt: date + 'T10:00:00Z' });

test('week starts on Monday', () => {
  assert.equal(L.weekStartOf('2026-11-09'), '2026-11-09'); // Monday
  assert.equal(L.weekStartOf('2026-11-15'), '2026-11-09'); // Sunday
  assert.equal(L.weekStartOf('2026-11-16'), '2026-11-16');
});

test('streak counts finished weeks, skips grace, breaks on miss', () => {
  const s = defaultState('2026-10-05');
  s.sessions = [
    ...['2026-10-06', '2026-10-07', '2026-10-08'].map((d) => done(d)), // week 10-05 done
    done('2026-10-13'), // week 10-12 missed
    ...['2026-10-20', '2026-10-21', '2026-10-22'].map((d) => done(d)), // 10-19 done
    // 10-26 grace
    ...['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => done(d)), // 11-02 done
  ];
  s.graces = ['2026-10-26'];
  assert.equal(L.streak(s, '2026-11-10'), 2); // current week unfinished does not break
  assert.deepEqual(L.pendingMisses(s, '2026-11-10').map((w) => w.ws), ['2026-10-12']);
  s.sessions.push(done('2026-11-09'), done('2026-11-10'), done('2026-11-11'));
  assert.equal(L.streak(s, '2026-11-11'), 3);
});

test('incomplete sessions do not count', () => {
  const s = defaultState('2026-11-09');
  s.sessions = [done('2026-11-09'), { ...done('2026-11-10'), completedAt: null }];
  assert.equal(L.weekSummary(s, '2026-11-09', '2026-11-11').done, 1);
});

test('urgency goes red when remaining sessions fill the remaining days', () => {
  const s = defaultState('2026-11-09');
  assert.equal(L.urgency(s, '2026-11-11').level, 'calm'); // Wed: 0/3, 5 days left
  assert.equal(L.urgency(s, '2026-11-12').level, 'amber'); // Thu: 0/3, 4 days left, one spare
  assert.equal(L.urgency(s, '2026-11-13').level, 'red'); // Fri: 0/3, 3 days left
  s.sessions = [done('2026-11-13')];
  const u = L.urgency(s, '2026-11-13'); // trained today: 2 left, 2 usable days
  assert.equal(u.usable, 2);
  assert.equal(u.level, 'red');
});

test('grace: once per month, current week only', () => {
  const s = defaultState('2026-11-02');
  assert.equal(L.graceCheck(s, '2026-11-04').ok, true);
  s.graces.push('2026-11-02');
  assert.equal(L.graceCheck(s, '2026-11-04').ok, false);
  assert.equal(L.graceCheck(s, '2026-11-11').ok, false); // same month
  // The month is the month of the week's Monday: the week of Mon 11-30 is still November.
  assert.equal(L.graceCheck(s, '2026-12-01').ok, false);
  assert.equal(L.graceCheck(s, '2026-12-08').ok, true);
});

test('double progression: reps -> sets -> weight -> ceiling', () => {
  const item = { exId: 'x', sets: 3, min: 8, max: 12, weight: 5, rest: 60 };
  const w = [5, 10];
  assert.equal(L.progress(item, { done: [12, 12, 11] }, w).note, null);
  assert.equal(L.progress(item, { done: [12, 12, 12] }, w).item.sets, 4);
  const five = { ...item, sets: 5 };
  const up = L.progress(five, { done: [12, 12, 12, 12, 12] }, w).item;
  assert.deepEqual([up.sets, up.weight], [3, 10]);
  const top = { ...five, weight: 10 };
  const r = L.progress(top, { done: [12, 12, 12, 12, 12] }, w);
  assert.equal(r.item, top);
  assert.match(r.note, /ขีดสุด/);
});

test('targets: last reps + 1, capped, reset when weight changes', () => {
  const s = defaultState('2026-11-09');
  const tpl = s.templates[0];
  const it = tpl.items[0]; // goblet squat 10kg 3x8-12
  assert.deepEqual(L.targetsFor(s, 'A', it), [8, 8, 8]);
  s.sessions.push({ ...done('2026-11-09'), items: [{ exId: it.exId, weight: 10, done: [9, 12, 7] }] });
  assert.deepEqual(L.targetsFor(s, 'A', it), [10, 12, 8]);
  assert.deepEqual(L.targetsFor(s, 'A', { ...it, weight: 5 }), [8, 8, 8]);
});

test('completing a session rotates templates and applies progression', () => {
  const s = defaultState('2026-11-09');
  const sess = L.newSession(s, '2026-11-09', s.templates[0], 'x1');
  sess.items.forEach((e) => { e.done = e.done.map(() => 20); });
  s.sessions.push(sess);
  assert.equal(L.sessionComplete(sess), true);
  const notes = L.completeSession(s, sess);
  assert.equal(s.nextTpl, 1);
  assert.equal(notes.length, 4);
  assert.equal(s.templates[0].items[0].sets, 4);
});

test('skip records and rotates', () => {
  const s = defaultState('2026-11-09');
  L.skipTemplate(s, '2026-11-09');
  assert.equal(s.nextTpl, 1);
  assert.equal(s.skips[0].tplId, 'A');
});
