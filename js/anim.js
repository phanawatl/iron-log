// Stick-figure exercise animations, drawn as SVG and animated with SMIL.
// A pose is a set of joint points in a 100x100 box (x right, y down, floor at y=92).
// Each animation is a list of poses; the figure loops through them and back.

const STAND = {
  head: [50, 13], sh: [50, 24], hip: [50, 51],
  knee: [50, 71], ankle: [50, 91], elbow: [50, 37], hand: [50, 49],
};

const HINGE = { hip: [40, 53], knee: [51, 71], ankle: [50, 91], sh: [66, 39], head: [74, 34] };

const P = (over) => ({ ...STAND, ...over });

export const ANIMS = {
  squat: [
    P({ elbow: [55, 36], hand: [57, 27] }),
    P({ head: [52, 36], sh: [48, 46], hip: [38, 70], knee: [58, 74], ankle: [50, 91], elbow: [53, 57], hand: [57, 49] }),
  ],
  press: [
    P({ elbow: [54, 36], hand: [53, 24] }),
    P({ elbow: [51, 11], hand: [51, -2] }),
  ],
  row: [
    { ...HINGE, elbow: [66, 52], hand: [66, 65] },
    { ...HINGE, elbow: [55, 34], hand: [60, 46] },
  ],
  swing: [
    { ...HINGE, elbow: [58, 52], hand: [50, 63] },
    P({ elbow: [62, 28], hand: [75, 30] }),
  ],
  rdl: [
    P({}),
    { ...HINGE, elbow: [66, 52], hand: [66, 65] },
  ],
  lunge: [
    P({ knee2: [50, 71], ankle2: [50, 91] }),
    P({
      head: [46, 30], sh: [46, 41], hip: [46, 67], knee: [65, 71], ankle: [65, 91],
      knee2: [40, 87], ankle2: [22, 89], toe2: [17, 92], elbow: [46, 54], hand: [46, 66],
    }),
  ],
  floorpress: [
    { head: [16, 83], sh: [28, 86], hip: [56, 86], knee: [70, 71], ankle: [80, 91], elbow: [33, 91], hand: [33, 79] },
    { head: [16, 83], sh: [28, 86], hip: [56, 86], knee: [70, 71], ankle: [80, 91], elbow: [29, 74], hand: [29, 61] },
  ],
  halo: [
    P({ elbow: [59, 31], hand: [59, 19] }),
    P({ elbow: [57, 12], hand: [50, 1] }),
    P({ elbow: [44, 22], hand: [39, 12] }),
  ],
  plank: [
    { head: [19, 71], sh: [28, 75], hip: [57, 80], knee: [72, 85], ankle: [86, 89], toe: [88, 92], elbow: [28, 91], hand: [40, 91] },
    { head: [19, 70], sh: [28, 74], hip: [57, 78], knee: [72, 84], ankle: [86, 89], toe: [88, 92], elbow: [28, 91], hand: [40, 91] },
  ],
  pushup: [
    { head: [19, 66], sh: [28, 71], hip: [57, 78], knee: [72, 84], ankle: [86, 89], toe: [88, 92], elbow: [28, 81], hand: [28, 91] },
    { head: [20, 80], sh: [29, 84], hip: [57, 86], knee: [72, 88], ankle: [86, 89], toe: [88, 92], elbow: [39, 82], hand: [28, 91] },
  ],
  curl: [
    P({}),
    P({ elbow: [51, 37], hand: [61, 29] }),
  ],
  lateral: [
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [45, 37], hand: [43, 49], elbow2: [55, 37], hand2: [57, 49], front: true }),
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [38, 25], hand: [26, 25], elbow2: [62, 25], hand2: [74, 25], front: true }),
  ],
  // ---- kettlebell set (v2) ----
  getup: [
    { head: [16, 83], sh: [28, 86], hip: [56, 86], knee: [67, 72], ankle: [77, 91], knee2: [72, 88], ankle2: [88, 90], toe2: [92, 86],
      elbow: [29, 74], hand: [29, 61], elbow2: [37, 90], hand2: [45, 91] },
    { head: [39, 51], sh: [44, 62], hip: [56, 86], knee: [66, 72], ankle: [76, 91], knee2: [72, 88], ankle2: [88, 90], toe2: [92, 86],
      elbow: [44, 49], hand: [44, 36], elbow2: [40, 76], hand2: [36, 90] },
    P({ elbow: [51, 11], hand: [51, -2], elbow2: [50, 37], hand2: [50, 49] }),
  ],
  clean: [
    { ...HINGE, elbow: [64, 52], hand: [62, 65] },
    P({ elbow: [54, 37], hand: [56, 27], bell: [52, 29] }),
  ],
  highpull: [
    { ...HINGE, elbow: [58, 52], hand: [50, 63] },
    P({ elbow: [40, 22], hand: [57, 26] }),
  ],
  windmill: [
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [52, 11], hand: [52, -2], elbow2: [45, 37], hand2: [43, 49], front: true }),
    P({ head: [30, 23], sh: [37, 32], hip: [52, 53], knee: [46, 72], ankle: [44, 91], toe: [40, 92], knee2: [54, 72], ankle2: [56, 91], toe2: [60, 92],
      elbow: [37, 19], hand: [37, 6], elbow2: [34, 45], hand2: [33, 58], front: true }),
  ],
  aroundworld: [
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [43, 40], hand: [50, 53], elbow2: [57, 40], hand2: [50, 53], front: true }),
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [53, 40], hand: [65, 47], elbow2: [61, 38], hand2: [65, 47], front: true }),
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [42, 38], hand: [50, 43], elbow2: [58, 38], hand2: [50, 43], front: true }),
    P({ knee: [46, 71], ankle: [44, 91], toe: [40, 92], knee2: [54, 71], ankle2: [56, 91], toe2: [60, 92],
      elbow: [39, 38], hand: [35, 47], elbow2: [47, 40], hand2: [35, 47], front: true }),
  ],
  figure8: [
    { hip: [42, 55], knee: [52, 71], ankle: [50, 91], sh: [64, 38], head: [71, 31], elbow: [66, 51], hand: [64, 64], knee2: [48, 72], ankle2: [46, 91] },
    { hip: [42, 55], knee: [52, 71], ankle: [50, 91], sh: [64, 38], head: [71, 31], elbow: [58, 52], hand: [47, 66], knee2: [48, 72], ankle2: [46, 91] },
  ],
  carry: [
    P({ knee: [55, 71], ankle: [58, 91], knee2: [46, 71], ankle2: [42, 91] }),
    P({ knee: [46, 71], ankle: [42, 91], knee2: [55, 71], ankle2: [58, 91] }),
  ],
};

// Fill in derived points so every pose has the same keys.
function complete(p) {
  const q = { ...p };
  q.toe = q.toe || [q.ankle[0] + 6, 92];
  q.knee2 = q.knee2 || q.knee;
  q.ankle2 = q.ankle2 || q.ankle;
  q.toe2 = q.toe2 || (q.knee2 === q.knee && q.ankle2 === q.ankle ? q.toe : [q.ankle2[0] + 6, 92]);
  q.elbow2 = q.elbow2 || q.elbow;
  q.hand2 = q.hand2 || q.hand;
  return q;
}

// Where the weight sits: a dumbbell at the hand, a kettlebell hanging past the hand.
function bellAt(p, which) {
  if (p.bell) return p.bell; // e.g. rack position: the bell rests on the forearm
  const [ex, ey] = which === 2 ? p.elbow2 : p.elbow;
  const [hx, hy] = which === 2 ? p.hand2 : p.hand;
  const dx = hx - ex, dy = hy - ey;
  const len = Math.hypot(dx, dy) || 1;
  return [hx + (dx / len) * 5, hy + (dy / len) * 5];
}

const fmt = (n) => Math.round(n * 10) / 10;

function animAttr(name, values, dur) {
  if (values.every((v) => v === values[0])) return '';
  const vals = [...values, values[0]];
  const times = vals.map((_, i) => fmt(i / (vals.length - 1))).join(';');
  const splines = vals.slice(1).map(() => '0.45 0 0.55 1').join(';');
  return `<animate attributeName="${name}" values="${vals.join(';')}" keyTimes="${times}" calcMode="spline" keySplines="${splines}" dur="${dur}s" repeatCount="indefinite"/>`;
}

function line(poses, a, b, cls, dur) {
  const x1 = poses.map((p) => p[a][0]), y1 = poses.map((p) => p[a][1]);
  const x2 = poses.map((p) => p[b][0]), y2 = poses.map((p) => p[b][1]);
  return `<line class="${cls}" x1="${x1[0]}" y1="${y1[0]}" x2="${x2[0]}" y2="${y2[0]}">` +
    animAttr('x1', x1, dur) + animAttr('y1', y1, dur) + animAttr('x2', x2, dur) + animAttr('y2', y2, dur) +
    '</line>';
}

function circle(poses, pointsOf, r, cls, dur) {
  const pts = poses.map(pointsOf);
  const cx = pts.map((p) => fmt(p[0])), cy = pts.map((p) => fmt(p[1]));
  return `<circle class="${cls}" r="${r}" cx="${cx[0]}" cy="${cy[0]}">` +
    animAttr('cx', cx, dur) + animAttr('cy', cy, dur) + '</circle>';
}

// Slower loops for multi-step movements.
const DURATION = { getup: 6, aroundworld: 3.4, windmill: 3.4 };

export function figureSVG(animKey, equip = 'BW', dur = 2.6) {
  dur = DURATION[animKey] || dur;
  const raw = ANIMS[animKey] || ANIMS.curl;
  const poses = raw.map(complete);
  const front = !!raw[0].front;
  const far = front ? 'limb' : 'limb far';
  let s = `<svg class="fig" viewBox="0 -8 100 104" role="img" aria-hidden="true">`;
  s += '<line class="floor" x1="2" y1="92" x2="98" y2="92"/>';
  // Far-side limbs first so the near side draws on top.
  s += line(poses, 'hip', 'knee2', far, dur) + line(poses, 'knee2', 'ankle2', far, dur) + line(poses, 'ankle2', 'toe2', far, dur);
  s += line(poses, 'sh', 'elbow2', far, dur) + line(poses, 'elbow2', 'hand2', far, dur);
  s += line(poses, 'sh', 'hip', 'limb torso', dur);
  s += line(poses, 'hip', 'knee', 'limb', dur) + line(poses, 'knee', 'ankle', 'limb', dur) + line(poses, 'ankle', 'toe', 'limb', dur);
  s += line(poses, 'sh', 'elbow', 'limb', dur) + line(poses, 'elbow', 'hand', 'limb', dur);
  s += circle(poses, (p) => p.head, 6, 'head', dur);
  if (equip === 'DB') {
    s += circle(poses, (p) => p.hand, 3.6, 'bell', dur);
    if (front) s += circle(poses, (p) => p.hand2, 3.6, 'bell', dur);
  } else if (equip === 'KB') {
    s += circle(poses, (p) => bellAt(p, 1), 4.4, 'bell kb', dur);
  }
  return s + '</svg>';
}
