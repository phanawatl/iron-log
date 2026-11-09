import * as L from './logic.js';
import { load, save, uid, backupFile, validateImport, daysSinceBackup, defaultState } from './store.js';
import { figureSVG, ANIMS } from './anim.js';

let state = load();
let tab = 'home';
let editingTpl = null; // template id open in the editor
let chartEx = null;

const $view = document.getElementById('view');
const $modal = document.getElementById('modal');
const $timer = document.getElementById('timer');

const today = () => L.ymd();
const persist = () => { if (!save(state)) toast('บันทึกไม่สำเร็จ: พื้นที่ในเครื่องเต็ม?'); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const exById = (id) => state.exercises.find((e) => e.id === id) || { id, name: id, equip: 'BW', unit: 'reps', side: '', anim: 'curl' };
const unitLabel = (ex) => (ex.unit === 'sec' ? 'วิ' : 'ครั้ง');
const DAY_TH = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dshort = (s) => { const d = L.parseYmd(s); return `${d.getDate()} ${MONTH_TH[d.getMonth()]}`; };
const wtLabel = (w, ex) => (ex.equip === 'BW' ? 'ตัวเปล่า' : `${w} kg`);

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------------- modal ----------------

function openModal(html, { locked = false } = {}) {
  $modal.innerHTML = `<div class="modal-wrap" ${locked ? '' : 'data-action="close-modal"'}><div class="modal" role="dialog">${html}</div></div>`;
}
function closeModal() { $modal.innerHTML = ''; }

// ---------------- render ----------------

function render() {
  const t = today();
  const active = L.activeSession(state, t);
  document.body.classList.toggle('working', tab === 'workout' && !!active);
  if (tab === 'workout' && !active) tab = 'home';
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'home') $view.innerHTML = homeView(t);
  else if (tab === 'workout') $view.innerHTML = workoutView(active);
  else if (tab === 'history') { $view.innerHTML = historyView(t); drawChart(); }
  else if (tab === 'settings') $view.innerHTML = editingTpl ? templateEditor() : settingsView();
  if (tab !== 'workout') stopTimer();
  enforceMissReasons(t);
}

// A missed week must be explained before the app can be used.
function enforceMissReasons(t) {
  const pending = L.pendingMisses(state, t);
  if (!pending.length) return;
  const w = pending[0];
  openModal(`
    <h2>สัปดาห์ ${dshort(w.ws)} – ${dshort(L.addDays(w.ws, 6))} ไม่ถึงเป้า</h2>
    <p class="muted">เล่นไป ${w.done} จาก ${w.quota} ครั้ง ทำให้ streak รีเซ็ต บอกเหตุผลก่อนใช้งานต่อ</p>
    <label class="f">หมวด</label>
    <div class="chips" id="miss-cats">
      ${L.MISS_CATEGORIES.map((c) => `<button class="chip" data-action="miss-cat" data-cat="${c.id}">${c.label}</button>`).join('')}
    </div>
    <label class="f" for="miss-text">เกิดอะไรขึ้น (อย่างน้อย 1 ประโยค)</label>
    <textarea id="miss-text" placeholder="เช่น ประชุมลากยาวถึงสามทุ่มสามวันติด"></textarea>
    <div class="actions"><button class="btn primary" data-action="miss-save" data-ws="${w.ws}">บันทึก</button></div>
  `, { locked: true });
}

// ---------------- home ----------------

function homeView(t) {
  const u = L.urgency(state, t);
  const ws = L.weekStartOf(t);
  const days = L.weekDays(ws);
  const doneDays = new Set(L.completedSessions(state).map((s) => s.date));
  const active = L.activeSession(state, t);
  const next = L.nextTemplate(state);
  const streak = L.streak(state, t);
  const doneToday = doneDays.has(t);

  let msg;
  if (u.level === 'ok') msg = 'สัปดาห์นี้ครบแล้ว เยี่ยม';
  else if (u.level === 'grace') msg = 'สัปดาห์นี้ใช้ใบผ่อนผัน streak ไม่รีเซ็ต';
  else if (u.remaining > u.usable) msg = `เหลือ ${u.usable} วัน แต่ต้องเล่นอีก ${u.remaining} ครั้ง: ไม่ทันแล้ว`;
  else if (u.level === 'red') msg = `ต้องเล่นทุกวันที่เหลือ (${u.remaining} ครั้ง ใน ${u.usable} วัน)`;
  else msg = `เหลือ ${u.remaining} ครั้ง ใน ${u.usable} วัน`;

  const dayCells = days.map((d, i) => {
    const partial = !doneDays.has(d) && state.sessions.some((s) => s.date === d && !s.completedAt);
    const cls = [doneDays.has(d) ? 'done' : '', partial ? 'partial' : '', d === t ? 'today' : '', d < t ? 'past' : ''].join(' ');
    return `<div class="day ${cls}">${DAY_TH[i]}<div class="dot">${doneDays.has(d) ? '✓' : ''}</div></div>`;
  }).join('');

  const backupDays = daysSinceBackup(state, t);
  const hasData = state.sessions.length > 0;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  let startBlock;
  if (!next) startBlock = '<p class="muted">ยังไม่มี template ไปสร้างในหน้าตั้งค่า</p>';
  else if (active) {
    const total = active.items.reduce((a, it) => a + it.done.length, 0);
    const done = active.items.reduce((a, it) => a + it.done.filter((r) => r != null).length, 0);
    startBlock = `
      <h3>${esc(active.tplName)} ค้างอยู่</h3>
      <p class="muted small">ทำไปแล้ว ${done}/${total} เซ็ต ต้องจบก่อนเที่ยงคืนถึงจะนับ</p>
      <button class="btn primary big" data-action="resume">ทำต่อ</button>`;
  } else {
    startBlock = `
      <div class="row between"><h3>ครั้งนี้: ${esc(next.name)}</h3><span class="muted small">${next.items.length} ท่า</span></div>
      <ul class="ex-list">${next.items.map((it) => {
        const ex = exById(it.exId);
        return `<li><span>${esc(ex.name)}</span><span class="muted num">${ex.equip === 'BW' ? '' : it.weight + ' kg · '}${it.sets}×${it.min}–${it.max}${ex.side ? '/' + ex.side : ''}</span></li>`;
      }).join('')}</ul>
      ${doneToday ? '<p class="muted small">วันนี้เล่นไปแล้ว ถ้าเล่นอีกก็นับเพิ่มได้</p>' : ''}
      <button class="btn primary big" data-action="start">เริ่ม ${esc(next.name)}</button>
      <div class="row between" style="margin-top:6px">
        <button class="link" data-action="skip">ข้าม template นี้</button>
      </div>`;
  }

  const gc = L.graceCheck(state, t);
  return `
    <h1>Iron Log</h1>
    ${!standalone ? `<div class="banner info">ยังไม่ได้ติดตั้ง: กดปุ่มแชร์ใน Safari แล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b> ไม่อย่างนั้น Safari อาจลบข้อมูลถ้าไม่ได้เปิดเกิน 7 วัน</div>` : ''}
    ${hasData && backupDays >= 7 ? `<div class="banner">ไม่ได้สำรองข้อมูลมา ${backupDays} วัน <button class="link" data-action="export">สำรองตอนนี้</button></div>` : ''}
    <section class="card quota ${u.level}">
      <div class="row between">
        <div><span class="big num">${u.done}</span> <span class="of">/ ${u.quota}</span></div>
        <div class="streak" style="text-align:right">streak<br><b class="num">${streak}</b> สัปดาห์</div>
      </div>
      <div class="msg">${msg}</div>
      <div class="days">${dayCells}</div>
    </section>
    <section class="card">${startBlock}</section>
    ${u.level !== 'ok' && u.level !== 'grace' ? `
      <section class="card">
        <div class="row between">
          <div><h3>ใบผ่อนผัน</h3><p class="muted small" style="margin:2px 0 0">ป่วย / เจ็บ / เดินทาง: เดือนละ 1 ใบ ต้องใช้ก่อนสัปดาห์จบ</p></div>
          <button class="btn sm" data-action="grace" ${gc.ok ? '' : 'disabled'}>ใช้</button>
        </div>
        ${gc.ok ? '' : `<p class="muted small" style="margin:6px 0 0">${esc(gc.why)}</p>`}
      </section>` : ''}
  `;
}

// ---------------- workout ----------------

function workoutView(s) {
  const total = s.items.reduce((a, it) => a + it.done.length, 0);
  const done = s.items.reduce((a, it) => a + it.done.filter((r) => r != null).length, 0);
  const complete = L.sessionComplete(s);
  // First unfinished set gets the "next" highlight.
  let nextMarked = false;
  const cards = s.items.map((it, i) => {
    const ex = exById(it.exId);
    const tplItem = state.templates.find((t) => t.id === s.tplId)?.items.find((x) => x.exId === it.exId);
    const range = tplItem ? `${tplItem.min}–${tplItem.max}` : '';
    const sets = it.done.map((r, j) => {
      let cls = 'set';
      let label = it.target[j];
      if (r != null) { cls += r >= it.target[j] ? ' done' : ' under'; label = r; }
      else if (!nextMarked) { cls += ' next'; nextMarked = true; }
      return `<button class="${cls}" data-set="${i}:${j}" aria-label="เซ็ต ${j + 1}">${label}</button>`;
    }).join('');
    const allDone = it.done.every((r) => r != null);
    return `
      <section class="card ex-card ${allDone ? 'complete' : ''}">
        <button class="figbox" data-action="show-fig" data-ex="${ex.id}" aria-label="ดูท่า ${esc(ex.name)}">${figureSVG(ex.anim, ex.equip)}</button>
        <div>
          <h3>${esc(ex.name)}</h3>
          <div class="ex-meta">
            ${ex.equip === 'BW' ? '' : `<button class="wt" data-action="weight" data-i="${i}">${it.weight} kg</button> · `}
            ${it.done.length} เซ็ต × ${range} ${unitLabel(ex)}${ex.side ? '/' + ex.side : ''} · พัก ${it.rest} วิ
          </div>
        </div>
        <div class="sets">${sets}</div>
      </section>`;
  }).join('');
  return `
    <div class="wk-head">
      <div class="row between">
        <h1 style="margin:0">${esc(s.tplName)}</h1>
        <button class="btn sm ghost" data-action="leave">พักไว้ก่อน</button>
      </div>
      <div class="progress"><i style="width:${(done / total) * 100}%"></i></div>
      <div class="small muted" style="margin-top:4px">${done}/${total} เซ็ต · แตะ = ทำได้ตามเป้า · แตะค้าง = แก้ตัวเลข</div>
    </div>
    ${cards}
    <button class="btn primary big" data-action="finish" ${complete ? '' : 'disabled'}>${complete ? 'จบการฝึก' : `เหลืออีก ${total - done} เซ็ต`}</button>
  `;
}

function setTap(i, j) {
  const s = L.activeSession(state, today());
  if (!s) return;
  const it = s.items[i];
  if (it.done[j] != null) { setEdit(i, j); return; }
  it.done[j] = it.target[j];
  persist();
  render();
  startTimer(it.rest);
}

function setEdit(i, j) {
  const s = L.activeSession(state, today());
  if (!s) return;
  const it = s.items[i];
  const ex = exById(it.exId);
  const v = it.done[j] ?? it.target[j];
  openModal(`
    <h2>${esc(ex.name)}: เซ็ต ${j + 1}</h2>
    <p class="muted small">เป้า ${it.target[j]} ${unitLabel(ex)}</p>
    <div class="stepper">
      <button class="btn" data-action="step" data-d="${ex.unit === 'sec' ? -5 : -1}">−</button>
      <div class="v" id="step-v" data-v="${v}">${v}</div>
      <button class="btn" data-action="step" data-d="${ex.unit === 'sec' ? 5 : 1}">+</button>
    </div>
    <div class="actions">
      <button class="btn" data-action="set-clear" data-set="${i}:${j}">ยังไม่ได้ทำ</button>
      <button class="btn primary" data-action="set-save" data-set="${i}:${j}">บันทึก</button>
    </div>
  `);
}

function finishSession() {
  const s = L.activeSession(state, today());
  if (!s || !L.sessionComplete(s)) return;
  const notes = L.completeSession(state, s);
  persist();
  tab = 'home';
  render();
  const u = L.urgency(state, today());
  openModal(`
    <h2>เสร็จแล้ว ${u.done}/${u.quota} ของสัปดาห์นี้</h2>
    ${notes.length ? `<p class="muted">ครั้งหน้าของ ${esc(s.tplName)}:</p><ul>${notes.map((n) => `<li><b>${esc(exById(n.exId).name)}</b>: ${esc(n.note)}</li>`).join('')}</ul>`
      : '<p class="muted">ครั้งหน้าเป้าจำนวนครั้งของแต่ละเซ็ตจะเพิ่มขึ้นอีก 1</p>'}
    <div class="actions"><button class="btn primary" data-action="close-modal">ตกลง</button></div>
  `);
}

// ---------------- rest timer ----------------

let timer = null;
let audio = null;
let wakeLock = null;

function ensureAudio() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  }
  if (audio && audio.state === 'suspended') audio.resume();
}

function beep() {
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.25, 0.5].forEach((off, k) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = k === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + off);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + off + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18);
    o.connect(g).connect(audio.destination);
    o.start(t0 + off);
    o.stop(t0 + off + 0.2);
  });
}

function startTimer(sec) {
  stopTimer();
  timer = { end: Date.now() + sec * 1000, fired: false, id: setInterval(tickTimer, 250) };
  tickTimer();
}

function stopTimer() {
  if (timer) clearInterval(timer.id);
  timer = null;
  $timer.hidden = true;
}

function tickTimer() {
  if (!timer) return;
  const left = Math.round((timer.end - Date.now()) / 1000);
  $timer.hidden = false;
  $timer.classList.toggle('over', left <= 0);
  const a = Math.abs(left);
  const txt = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  $timer.innerHTML = `<div class="t">${left <= 0 ? 'ไปต่อ ' : 'พัก '}${txt}</div>
    <button class="btn sm" data-action="timer-add">+15</button>
    <button class="btn sm" data-action="timer-stop">ปิด</button>`;
  if (left <= 0 && !timer.fired) {
    timer.fired = true;
    beep();
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
  }
  if (left < -120) stopTimer();
}

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* not supported or denied */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (tab === 'workout') keepAwake(true);
    render(); // the day may have changed while hidden
  }
});

// ---------------- history ----------------

function historyView(t) {
  const cur = L.weekStartOf(t);
  const weeks = [];
  for (let ws = cur, n = 0; ws >= state.startWeek && n < 26; ws = L.addDays(ws, -7), n++) weeks.push(L.weekSummary(state, ws, t));
  const label = { done: 'ครบ', missed: 'พลาด', grace: 'ผ่อนผัน', current: 'สัปดาห์นี้' };
  const stats = L.missStats(state);
  const maxN = Math.max(1, ...stats.map((s) => s.n));

  const exWithData = state.exercises.filter((e) => L.exerciseHistory(state, e.id).length);
  if (!chartEx || !exWithData.some((e) => e.id === chartEx)) chartEx = exWithData[0]?.id || null;

  const weekCards = weeks.map((w) => {
    const days = L.weekDays(w.ws);
    const ses = state.sessions.filter((s) => s.date >= w.ws && s.date <= days[6]);
    const skips = state.skips.filter((s) => s.date >= w.ws && s.date <= days[6]);
    const done = new Set(ses.filter((s) => s.completedAt).map((s) => s.date));
    const miss = state.misses[w.ws];
    const cat = miss && L.MISS_CATEGORIES.find((c) => c.id === miss.cat);
    return `
      <section class="card week">
        <div class="row between">
          <b>${dshort(w.ws)} – ${dshort(days[6])}</b>
          <span class="row"><span class="num muted">${w.done}/${w.quota}</span><span class="badge ${w.status}">${label[w.status] || ''}</span></span>
        </div>
        <div class="days">${days.map((d, i) => `<div class="day ${done.has(d) ? 'done' : ''} ${d === t ? 'today' : ''}">${DAY_TH[i]}<div class="dot">${done.has(d) ? '✓' : ''}</div></div>`).join('')}</div>
        ${ses.length || skips.length ? `<ul>
          ${ses.map((s) => `<li>${dshort(s.date)} ${esc(s.tplName)}${s.completedAt ? '' : ' (ไม่ครบ, ไม่นับ)'}</li>`).join('')}
          ${skips.map((s) => `<li>${dshort(s.date)} ข้าม ${esc(s.tplName)}</li>`).join('')}
        </ul>` : ''}
        ${miss ? `<div class="reason"><b>${cat ? cat.label : ''}</b>: ${esc(miss.text)}</div>` : ''}
      </section>`;
  }).join('');

  return `
    <h1>ประวัติ</h1>
    <h2>ความก้าวหน้ารายท่า</h2>
    <section class="card">
      ${exWithData.length ? `
        <select data-action="chart-ex">${exWithData.map((e) => `<option value="${e.id}" ${e.id === chartEx ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        <p class="small muted" id="chart-title" style="margin:10px 0 4px"></p>
        <div class="chart" id="chart"></div>
        <div id="chart-table" class="small muted"></div>`
      : '<p class="muted">จบการฝึกครั้งแรกแล้วกราฟจะขึ้นที่นี่</p>'}
    </section>
    ${stats.length ? `<h2>สาเหตุที่พลาด</h2><section class="card bars">
      ${stats.map((s) => `<div class="b"><span>${s.label}</span><i style="width:${(s.n / maxN) * 100}%"></i><span class="num">${s.n}</span></div>`).join('')}
    </section>` : ''}
    <h2>รายสัปดาห์</h2>
    ${weekCards}
  `;
}

function drawChart() {
  const el = document.getElementById('chart');
  if (!el || !chartEx) return;
  const ex = exById(chartEx);
  const data = L.exerciseHistory(state, chartEx);
  const byWeight = ex.equip !== 'BW';
  document.getElementById('chart-title').textContent = byWeight
    ? 'Volume ต่อครั้ง (น้ำหนัก × จำนวนครั้งรวม, kg)'
    : `${ex.unit === 'sec' ? 'วินาที' : 'จำนวนครั้ง'}รวมต่อครั้ง`;
  const W = 340, H = 180, pl = 36, pr = 12, pt = 12, pb = 26;
  const peak = Math.max(1, ...data.map((d) => d.volume));
  const raw = peak / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const maxV = step * 2;
  const x = (i) => (data.length === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (data.length - 1));
  const y = (v) => pt + (H - pt - pb) * (1 - v / maxV);
  const ticks = [0, step, maxV];
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.volume).toFixed(1)}`).join(' ');
  const labelIdx = new Set([0, data.length - 1]);
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}">
      ${ticks.map((v) => `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${[...labelIdx].map((i) => `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${dshort(data[i].date)}</text>`).join('')}
      <line class="xh" id="xh" y1="${pt}" y2="${H - pb}" x1="0" x2="0" visibility="hidden"/>
      ${data.length > 1 ? `<polyline class="ln" points="${pts}"/>` : ''}
      ${data.map((d, i) => `<circle class="pt" data-i="${i}" cx="${x(i)}" cy="${y(d.volume)}" r="4.5"/>`).join('')}
      <rect x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent" id="chart-hit"/>
    </svg>
    <div class="tip" id="tip" hidden></div>`;
  const svg = el.querySelector('svg');
  const tip = el.querySelector('#tip');
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    data.forEach((_, i) => { if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i; });
    const d = data[best];
    const xh = el.querySelector('#xh');
    xh.setAttribute('x1', x(best)); xh.setAttribute('x2', x(best)); xh.removeAttribute('visibility');
    el.querySelectorAll('.pt').forEach((c) => c.classList.toggle('sel', +c.dataset.i === best));
    tip.hidden = false;
    tip.style.left = `${(x(best) / W) * r.width}px`;
    tip.style.top = `${(y(d.volume) / H) * r.height}px`;
    tip.textContent = `${dshort(d.date)} · ${byWeight ? d.weight + ' kg × ' : ''}${d.reps}${ex.unit === 'sec' ? ' วิ' : ' ครั้ง'} (${d.sets} เซ็ต)${byWeight ? ' = ' + d.volume : ''}`;
  };
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; el.querySelector('#xh').setAttribute('visibility', 'hidden'); });
  const last = data.slice(-5).reverse();
  document.getElementById('chart-table').innerHTML = `<table style="width:100%;margin-top:10px;border-collapse:collapse">
    ${last.map((d) => `<tr><td>${dshort(d.date)}</td><td class="num">${byWeight ? d.weight + ' kg' : ''}</td><td class="num">${d.sets} เซ็ต</td><td class="num" style="text-align:right">${d.reps} ${unitLabel(ex)}</td></tr>`).join('')}
  </table>`;
}

// ---------------- settings ----------------

function settingsView() {
  const animOpts = Object.keys(ANIMS);
  return `
    <h1>ตั้งค่า</h1>
    <section class="card">
      <div class="row between"><h3>โควตาต่อสัปดาห์</h3>
        <div class="row"><button class="btn sm" data-action="quota" data-d="-1">−</button><b class="num" style="font-size:22px;min-width:24px;text-align:center">${state.settings.quota}</b><button class="btn sm" data-action="quota" data-d="1">+</button></div>
      </div>
    </section>

    <h2>Template (วนตามลำดับ)</h2>
    ${state.templates.map((t, i) => `
      <section class="card">
        <div class="row between">
          <div><h3>${esc(t.name)} ${i === state.nextTpl % state.templates.length ? '<span class="badge current">ครั้งถัดไป</span>' : ''}</h3>
          <p class="small muted" style="margin:2px 0 0">${t.items.map((it) => esc(exById(it.exId).name)).join(', ') || 'ยังไม่มีท่า'}</p></div>
          <button class="btn sm" data-action="edit-tpl" data-id="${t.id}">แก้</button>
        </div>
        ${i !== state.nextTpl % state.templates.length ? `<button class="link small" data-action="set-next" data-i="${i}">ให้เป็นครั้งถัดไป</button>` : ''}
      </section>`).join('')}
    <button class="btn" data-action="add-tpl">+ เพิ่ม template</button>

    <h2>อุปกรณ์ (kg)</h2>
    <section class="card">
      <label class="f" for="eq-KB">Kettlebell</label>
      <input type="text" inputmode="decimal" id="eq-KB" data-action="equip" data-k="KB" value="${state.equipment.KB.join(', ')}">
      <label class="f" for="eq-DB">Dumbbell (น้ำหนักต่อข้าง)</label>
      <input type="text" inputmode="decimal" id="eq-DB" data-action="equip" data-k="DB" value="${state.equipment.DB.join(', ')}">
      <p class="small muted">คั่นด้วยจุลภาค ใช้เป็นตัวเลือกน้ำหนักและขั้นถัดไปของ progression</p>
    </section>

    <h2>คลังท่า</h2>
    <section class="card">
      ${state.exercises.map((e) => `
        <div class="lib-row">
          <button class="figbox" data-action="show-fig" data-ex="${e.id}">${figureSVG(e.anim, e.equip)}</button>
          <div><b>${esc(e.name)}</b><div class="small muted">${e.equip} · ${e.unit === 'sec' ? 'วินาที' : 'ครั้ง'}${e.side ? ' / ' + e.side : ''}</div></div>
          ${state.templates.some((t) => t.items.some((it) => it.exId === e.id)) ? '' : `<button class="btn sm ghost danger" data-action="del-ex" data-id="${e.id}">ลบ</button>`}
        </div>`).join('')}
      <h3 style="margin-top:16px">เพิ่มท่า</h3>
      <label class="f" for="nx-name">ชื่อ</label><input type="text" id="nx-name" placeholder="เช่น KB Clean">
      <div class="grid4" style="grid-template-columns:1fr 1fr">
        <div><label class="f" for="nx-equip">อุปกรณ์</label><select id="nx-equip"><option>KB</option><option>DB</option><option value="BW">ตัวเปล่า</option></select></div>
        <div><label class="f" for="nx-unit">นับเป็น</label><select id="nx-unit"><option value="reps">ครั้ง</option><option value="sec">วินาที</option></select></div>
        <div><label class="f" for="nx-side">ต่อ</label><select id="nx-side"><option value="">–</option><option>ข้าง</option><option>ทิศ</option></select></div>
        <div><label class="f" for="nx-anim">ภาพท่า</label><select id="nx-anim">${animOpts.map((a) => `<option>${a}</option>`).join('')}</select></div>
      </div>
      <button class="btn" style="margin-top:12px" data-action="add-ex">เพิ่มท่า</button>
    </section>

    <h2>ข้อมูล</h2>
    <section class="card stack">
      <p class="small muted" style="margin:0">ข้อมูลอยู่ในเครื่องนี้เท่านั้น สำรองล่าสุด: ${state.lastBackup ? dshort(state.lastBackup) : 'ยังไม่เคย'}</p>
      <button class="btn" data-action="export">สำรองข้อมูล (export)</button>
      <label class="btn" for="import-file">นำเข้าข้อมูล (import)</label>
      <input type="file" id="import-file" accept="application/json,.json" hidden data-action="import">
      <button class="btn ghost danger" data-action="reset">ล้างข้อมูลทั้งหมด</button>
    </section>

    <h2>การเตือนบน iPhone</h2>
    <section class="card small">
      <p style="margin-top:0">Web app ส่งการแจ้งเตือนตามเวลาเองไม่ได้ ให้ตั้งใน <b>Reminders</b>:</p>
      <ol style="padding-left:18px;margin:0">
        <li>สร้างรายการ "ออกกำลังกาย" ตั้งเวลาเตือนที่สะดวก และให้ทำซ้ำทุกวัน</li>
        <li>ในช่อง URL ใส่ <code>${esc(location.origin + location.pathname)}</code></li>
        <li>พอเตือนแล้วแตะลิงก์ app จะเปิดหน้าตัวทวงถามทันที</li>
      </ol>
    </section>
    <p class="small muted" style="text-align:center">Iron Log · เริ่มนับตั้งแต่สัปดาห์ ${dshort(state.startWeek)}</p>
  `;
}

function templateEditor() {
  const t = state.templates.find((x) => x.id === editingTpl);
  if (!t) { editingTpl = null; return settingsView(); }
  const rows = t.items.map((it, i) => {
    const ex = exById(it.exId);
    const weights = state.equipment[ex.equip] || [];
    return `
      <div class="item-row">
        <div class="row between">
          <select data-action="item" data-i="${i}" data-k="exId" style="flex:1">
            ${state.exercises.map((e) => `<option value="${e.id}" ${e.id === it.exId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
          <button class="btn sm ghost" data-action="move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="ขึ้น">↑</button>
          <button class="btn sm ghost" data-action="move" data-i="${i}" data-d="1" ${i === t.items.length - 1 ? 'disabled' : ''} aria-label="ลง">↓</button>
          <button class="btn sm ghost danger" data-action="del-item" data-i="${i}" aria-label="ลบ">✕</button>
        </div>
        <div class="grid4">
          <div><label class="f">เซ็ต</label><input type="number" min="1" max="5" value="${it.sets}" data-action="item" data-i="${i}" data-k="sets"></div>
          <div><label class="f">ต่ำสุด</label><input type="number" min="1" value="${it.min}" data-action="item" data-i="${i}" data-k="min"></div>
          <div><label class="f">สูงสุด</label><input type="number" min="1" value="${it.max}" data-action="item" data-i="${i}" data-k="max"></div>
          <div><label class="f">พัก (วิ)</label><input type="number" min="0" step="15" value="${it.rest}" data-action="item" data-i="${i}" data-k="rest"></div>
        </div>
        ${ex.equip === 'BW' ? '' : `<label class="f">น้ำหนัก</label><div class="chips">${weights.map((w) => `<button class="chip ${w === it.weight ? 'on' : ''}" data-action="item-weight" data-i="${i}" data-w="${w}">${w} kg</button>`).join('')}</div>`}
      </div>`;
  }).join('');
  return `
    <div class="row between"><button class="link" data-action="close-editor">‹ กลับ</button></div>
    <label class="f" for="tpl-name">ชื่อ template</label>
    <input type="text" id="tpl-name" data-action="tpl-name" value="${esc(t.name)}">
    <section class="card" style="margin-top:14px">${rows || '<p class="muted">ยังไม่มีท่า</p>'}</section>
    <button class="btn" data-action="add-item">+ เพิ่มท่า</button>
    <p class="small muted">เปลี่ยนน้ำหนักเองที่นี่จะทำให้เป้าจำนวนครั้งเริ่มใหม่ที่ค่าต่ำสุด</p>
    <button class="btn ghost danger" style="margin-top:24px" data-action="del-tpl">ลบ template นี้</button>
  `;
}

// ---------------- export / import ----------------

async function doExport() {
  const file = backupFile(state);
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Iron Log backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    state.lastBackup = today();
    persist();
    toast('สำรองข้อมูลแล้ว');
    render();
  } catch (e) {
    if (e.name !== 'AbortError') toast('สำรองข้อมูลไม่สำเร็จ');
  }
}

async function doImport(input) {
  const f = input.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!validateImport(obj)) throw new Error('bad');
    if (!confirm('แทนที่ข้อมูลในเครื่องด้วยไฟล์นี้?')) return;
    state = obj;
    persist();
    toast('นำเข้าแล้ว');
    render();
  } catch {
    toast('ไฟล์ไม่ถูกต้อง');
  }
  input.value = '';
}

// ---------------- events ----------------

function clampItem(it) {
  it.sets = Math.min(L.MAX_SETS, Math.max(1, Math.round(it.sets) || 1));
  it.min = Math.max(1, Math.round(it.min) || 1);
  it.max = Math.max(it.min, Math.round(it.max) || it.min);
  it.rest = Math.max(0, Math.round(it.rest) || 0);
}

const actions = {
  'close-modal': (el, ev) => { if (ev.target === el) closeModal(); },
  start: () => {
    const tpl = L.nextTemplate(state);
    if (!tpl) return;
    ensureAudio();
    state.sessions.push(L.newSession(state, today(), tpl, uid()));
    persist();
    tab = 'workout';
    keepAwake(true);
    render();
    window.scrollTo(0, 0);
  },
  resume: () => { ensureAudio(); tab = 'workout'; keepAwake(true); render(); },
  leave: () => { tab = 'home'; keepAwake(false); render(); },
  finish: () => { keepAwake(false); finishSession(); },
  skip: () => {
    const tpl = L.nextTemplate(state);
    if (!confirm(`ข้าม ${tpl.name}? การข้ามจะถูกบันทึกในประวัติ`)) return;
    L.skipTemplate(state, today());
    persist();
    render();
  },
  grace: () => {
    const gc = L.graceCheck(state, today());
    if (!gc.ok) return toast(gc.why);
    if (!confirm('ใช้ใบผ่อนผันสัปดาห์นี้? เดือนนี้จะใช้ไม่ได้อีก')) return;
    state.graces.push(gc.ws);
    persist();
    render();
  },
  'miss-cat': (el) => {
    document.querySelectorAll('#miss-cats .chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  'miss-save': (el) => {
    const cat = document.querySelector('#miss-cats .chip.on')?.dataset.cat;
    const text = document.getElementById('miss-text').value.trim();
    if (!cat) return toast('เลือกหมวดก่อน');
    if (text.length < 8) return toast('เขียนให้เป็นประโยคหน่อย');
    state.misses[el.dataset.ws] = { cat, text, at: new Date().toISOString() };
    persist();
    closeModal();
    render();
  },
  'show-fig': (el) => {
    const ex = exById(el.dataset.ex);
    openModal(`<h2>${esc(ex.name)}</h2><div class="fig-lg">${figureSVG(ex.anim, ex.equip)}</div>
      <div class="actions"><button class="btn" data-action="close-modal">ปิด</button></div>`);
  },
  weight: (el) => {
    const s = L.activeSession(state, today());
    const it = s.items[+el.dataset.i];
    const ex = exById(it.exId);
    openModal(`<h2>น้ำหนัก: ${esc(ex.name)}</h2>
      <p class="muted small">เปลี่ยนเฉพาะครั้งนี้ ถ้าไม่ตรงกับ template ครั้งนี้จะไม่ถูกใช้คำนวณ progression</p>
      <div class="chips">${(state.equipment[ex.equip] || []).map((w) => `<button class="chip ${w === it.weight ? 'on' : ''}" data-action="pick-weight" data-i="${el.dataset.i}" data-w="${w}">${w} kg</button>`).join('')}</div>
      <div class="actions"><button class="btn" data-action="close-modal">ปิด</button></div>`);
  },
  'pick-weight': (el) => {
    const s = L.activeSession(state, today());
    s.items[+el.dataset.i].weight = +el.dataset.w;
    persist();
    closeModal();
    render();
  },
  step: (el) => {
    const v = document.getElementById('step-v');
    const n = Math.max(0, +v.dataset.v + +el.dataset.d);
    v.dataset.v = n;
    v.textContent = n;
  },
  'set-save': (el) => {
    const [i, j] = el.dataset.set.split(':').map(Number);
    const s = L.activeSession(state, today());
    const wasEmpty = s.items[i].done[j] == null;
    s.items[i].done[j] = +document.getElementById('step-v').dataset.v;
    persist();
    closeModal();
    render();
    if (wasEmpty) startTimer(s.items[i].rest);
  },
  'set-clear': (el) => {
    const [i, j] = el.dataset.set.split(':').map(Number);
    L.activeSession(state, today()).items[i].done[j] = null;
    persist();
    closeModal();
    render();
  },
  'timer-add': () => { if (timer) { timer.end = Math.max(timer.end, Date.now()) + 15000; timer.fired = false; tickTimer(); } },
  'timer-stop': () => stopTimer(),
  quota: (el) => {
    state.settings.quota = Math.min(7, Math.max(1, state.settings.quota + +el.dataset.d));
    persist();
    render();
  },
  'edit-tpl': (el) => { editingTpl = el.dataset.id; render(); window.scrollTo(0, 0); },
  'close-editor': () => { editingTpl = null; render(); },
  'set-next': (el) => { state.nextTpl = +el.dataset.i; persist(); render(); },
  'add-tpl': () => {
    const id = uid();
    state.templates.push({ id, name: `Template ${String.fromCharCode(65 + state.templates.length)}`, items: [] });
    persist();
    editingTpl = id;
    render();
  },
  'del-tpl': () => {
    if (!confirm('ลบ template นี้? ประวัติที่เล่นไปแล้วยังอยู่')) return;
    const i = state.templates.findIndex((t) => t.id === editingTpl);
    state.templates.splice(i, 1);
    if (state.nextTpl >= state.templates.length) state.nextTpl = 0;
    editingTpl = null;
    persist();
    render();
  },
  'add-item': () => {
    const t = state.templates.find((x) => x.id === editingTpl);
    const ex = state.exercises[0];
    t.items.push({ exId: ex.id, sets: 3, min: 8, max: 12, weight: (state.equipment[ex.equip] || [0])[0] || 0, rest: 75 });
    persist();
    render();
  },
  'del-item': (el) => {
    const t = state.templates.find((x) => x.id === editingTpl);
    t.items.splice(+el.dataset.i, 1);
    persist();
    render();
  },
  move: (el) => {
    const t = state.templates.find((x) => x.id === editingTpl);
    const i = +el.dataset.i, j = i + +el.dataset.d;
    [t.items[i], t.items[j]] = [t.items[j], t.items[i]];
    persist();
    render();
  },
  'item-weight': (el) => {
    const t = state.templates.find((x) => x.id === editingTpl);
    t.items[+el.dataset.i].weight = +el.dataset.w;
    persist();
    render();
  },
  'add-ex': () => {
    const name = document.getElementById('nx-name').value.trim();
    if (!name) return toast('ใส่ชื่อท่าก่อน');
    state.exercises.push({
      id: uid(), name,
      equip: document.getElementById('nx-equip').value,
      unit: document.getElementById('nx-unit').value,
      side: document.getElementById('nx-side').value,
      anim: document.getElementById('nx-anim').value,
    });
    persist();
    render();
    toast(`เพิ่ม ${name} แล้ว`);
  },
  'del-ex': (el) => {
    if (!confirm('ลบท่านี้จากคลัง?')) return;
    state.exercises = state.exercises.filter((e) => e.id !== el.dataset.id);
    persist();
    render();
  },
  export: () => doExport(),
  reset: () => {
    if (prompt('พิมพ์ ลบ เพื่อยืนยันการล้างข้อมูลทั้งหมด (ย้อนกลับไม่ได้)') !== 'ลบ') return;
    state = defaultState();
    persist();
    tab = 'home';
    render();
  },
};

const changeActions = {
  equip: (el) => {
    const vals = el.value.split(/[,\s]+/).map(Number).filter((n) => n > 0);
    state.equipment[el.dataset.k] = [...new Set(vals)].sort((a, b) => a - b);
    persist();
    render();
  },
  item: (el) => {
    const t = state.templates.find((x) => x.id === editingTpl);
    const it = t.items[+el.dataset.i];
    if (el.dataset.k === 'exId') {
      it.exId = el.value;
      const ex = exById(el.value);
      const ws = state.equipment[ex.equip] || [];
      if (!ws.includes(it.weight)) it.weight = ws[0] || 0;
    } else {
      it[el.dataset.k] = +el.value;
      clampItem(it);
    }
    persist();
    render();
  },
  'tpl-name': (el) => {
    const t = state.templates.find((x) => x.id === editingTpl);
    t.name = el.value.trim() || t.name;
    persist();
  },
  'chart-ex': (el) => { chartEx = el.value; render(); },
  import: (el) => doImport(el),
};

document.addEventListener('click', (ev) => {
  const tabBtn = ev.target.closest('.tabs button');
  if (tabBtn) {
    tab = tabBtn.dataset.tab;
    editingTpl = null;
    if (tab === 'home' && L.activeSession(state, today())) { /* stay on home; resume is offered */ }
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = ev.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const fn = changeActions[el.dataset.action];
  if (fn) fn(el, ev);
});

// Set buttons: tap = hit the target, long press = edit the number.
let press = null;
document.addEventListener('pointerdown', (ev) => {
  ensureAudio();
  const el = ev.target.closest('[data-set]');
  if (!el || el.dataset.action) return;
  const [i, j] = el.dataset.set.split(':').map(Number);
  press = { el, i, j, long: false, x: ev.clientX, y: ev.clientY };
  press.t = setTimeout(() => { if (press) { press.long = true; setEdit(i, j); } }, 450);
});
document.addEventListener('pointermove', (ev) => {
  if (press && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 12) { clearTimeout(press.t); press = null; }
});
document.addEventListener('pointerup', (ev) => {
  if (!press) return;
  clearTimeout(press.t);
  const p = press;
  press = null;
  if (!p.long && ev.target.closest('[data-set]') === p.el) setTap(p.i, p.j);
});
document.addEventListener('pointercancel', () => { if (press) clearTimeout(press.t); press = null; });
document.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-set]')) ev.preventDefault(); });

// Re-render at midnight so the week/day rolls over while the app is open.
let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 60000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

if (L.activeSession(state, today())) tab = 'home';
render();
