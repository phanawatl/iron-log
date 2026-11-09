// State: defaults, persistence in localStorage, backup export/import.
import { ymd, weekStartOf } from './logic.js';

const KEY = 'ironlog.v1';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// equip: KB | DB | BW. unit: reps | sec. side: text shown after the rep count ('' / 'ข้าง' / 'ทิศ').
export const DEFAULT_EXERCISES = [
  { id: 'goblet-squat', name: 'Goblet Squat', equip: 'DB', unit: 'reps', side: '', anim: 'squat' },
  { id: 'db-ohp', name: 'DB Overhead Press', equip: 'DB', unit: 'reps', side: '', anim: 'press' },
  { id: 'db-row', name: 'DB Bent-over Row', equip: 'DB', unit: 'reps', side: '', anim: 'row' },
  { id: 'kb-swing', name: 'KB Swing', equip: 'KB', unit: 'reps', side: '', anim: 'swing' },
  { id: 'db-rdl', name: 'DB Romanian Deadlift', equip: 'DB', unit: 'reps', side: '', anim: 'rdl' },
  { id: 'db-lunge', name: 'DB Reverse Lunge', equip: 'DB', unit: 'reps', side: 'ข้าง', anim: 'lunge' },
  { id: 'db-floor-press', name: 'DB Floor Press', equip: 'DB', unit: 'reps', side: '', anim: 'floorpress' },
  { id: 'kb-halo', name: 'KB Halo', equip: 'KB', unit: 'reps', side: 'ทิศ', anim: 'halo' },
  { id: 'plank', name: 'Plank', equip: 'BW', unit: 'sec', side: '', anim: 'plank' },
  { id: 'kb-goblet-squat', name: 'KB Goblet Squat', equip: 'KB', unit: 'reps', side: '', anim: 'squat' },
  { id: 'kb-deadlift', name: 'KB Deadlift', equip: 'KB', unit: 'reps', side: '', anim: 'rdl' },
  { id: 'kb-press', name: 'KB One-arm Press', equip: 'KB', unit: 'reps', side: 'ข้าง', anim: 'press' },
  { id: 'db-curl', name: 'DB Biceps Curl', equip: 'DB', unit: 'reps', side: '', anim: 'curl' },
  { id: 'db-lateral', name: 'DB Lateral Raise', equip: 'DB', unit: 'reps', side: '', anim: 'lateral' },
  { id: 'db-carry', name: "DB Farmer's Carry", equip: 'DB', unit: 'sec', side: '', anim: 'carry' },
  { id: 'push-up', name: 'Push-up', equip: 'BW', unit: 'reps', side: '', anim: 'pushup' },
];

const item = (exId, weight, min, max, rest = 75) => ({ exId, sets: 3, min, max, weight, rest });

export function defaultState(today = ymd()) {
  return {
    version: 1,
    createdAt: today,
    startWeek: weekStartOf(today),
    settings: { quota: 3 },
    equipment: { KB: [5], DB: [5, 10], BW: [] },
    exercises: DEFAULT_EXERCISES.map((e) => ({ ...e })),
    templates: [
      {
        id: 'A',
        name: 'Template A',
        items: [
          item('goblet-squat', 10, 8, 12, 90),
          item('db-ohp', 5, 8, 12),
          item('db-row', 10, 8, 12),
          item('kb-swing', 5, 15, 20, 60),
        ],
      },
      {
        id: 'B',
        name: 'Template B',
        items: [
          item('db-rdl', 10, 8, 12, 90),
          item('db-lunge', 5, 8, 12),
          item('db-floor-press', 10, 8, 12),
          item('kb-halo', 5, 8, 12, 60),
          item('plank', 0, 30, 60, 60),
        ],
      },
    ],
    nextTpl: 0,
    sessions: [],
    skips: [],
    graces: [],
    misses: {},
    lastBackup: null,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('load failed', e);
  }
  const s = defaultState();
  save(s);
  return s;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('save failed', e);
    return false;
  }
}

export function validateImport(obj) {
  const need = ['startWeek', 'settings', 'equipment', 'exercises', 'templates', 'sessions', 'graces', 'misses'];
  return obj && typeof obj === 'object' && need.every((k) => k in obj);
}

export function backupFile(state) {
  const name = `iron-log-backup-${ymd()}.json`;
  return new File([JSON.stringify(state, null, 1)], name, { type: 'application/json' });
}

export function daysSinceBackup(state, today = ymd()) {
  const from = state.lastBackup ? state.lastBackup.slice(0, 10) : state.createdAt;
  return Math.round((new Date(today) - new Date(from)) / 86400000);
}
