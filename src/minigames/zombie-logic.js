// Zombie Siege rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// Frame: tee at the origin, aim down -z, x right, metres. Zombies walk toward the fence (+z).
// Design: docs/MINIGAMES.md §2. Difficulty only changes the blast radius; zombies walk at a steady pace.

export const YD = 0.9144;
export const FENCE_Z = -14;            // ≈15 yd in front of the tee
export const SPAWN_Z = [-275, -255];   // edge of the cornfield, ≈280–300 yd
export const FIELD_X = 52;             // zombies spawn within ±this
// The field funnels in toward the fence so no zombie is ever at an angle you can't hit from the tee:
// its half-width is the full FIELD_X out deep, narrowing to stay within TAPER_DEG of straight ahead
// (never narrower than FENCE_HALF). Each zombie keeps its lane: 90% right stays 90% right.
export const TAPER_DEG = 32, FENCE_HALF = 12;
export const fieldHalf = z => Math.max(FENCE_HALF, Math.min(FIELD_X, Math.tan(TAPER_DEG * Math.PI / 180) * -z));
export const GRAVEYARD = { x: [-48, -28], z: [-250, -238] }; // a family plot in front of the corn: some walkers climb out of it
export const DIRECT_YD = 2;            // landing this close to a zombie is a DIRECT HIT
export const CHAIN_YD = 8;             // a bloater's burst radius
export const FENCE_HP = 100;
export const WAVE_TIMEOUT = 65;         // the next wave comes after this many seconds even if some survive

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', blastYd: 20, note: '20 yd blast radius. Big booms, forgiving aim.' },
  { id: 'normal', label: 'Normal', blastYd: 12, note: '12 yd blast radius.' },
  { id: 'hard', label: 'Hard', blastYd: 7, note: '7 yd blast radius. Land it close.' },
  { id: 'nightmare', label: 'Nightmare', blastYd: 4, note: '4 yd blast radius. Every shot has to be a dart.' },
];

// speed m/s, hp, damage to the fence per second while attacking (bloaters burst once instead)
export const TYPES = {
  walker:  { name: 'Walker', speed: 1.95, hp: 1, dps: 1.2, points: 50, scale: 1 },
  pack:    { name: 'Pack', speed: 1.8, hp: 1, dps: 1.2, points: 50, scale: 1 },
  tank:    { name: 'Tank', speed: 1.3, hp: 2, dps: 3.5, points: 200, hitPoints: 25, scale: 1.45 },
  bloater: { name: 'Bloater', speed: 1.55, hp: 1, dps: 0, burst: 14, points: 100, scale: 1.2 },
};

export const POINTS = { double: 100, triple: 250, massacre: 600, wavePer: 100, perSecond: 2, crate: 75 };

export const CHALLENGES = [
  { id: 'massacre', text: 'Get a MASSACRE (5+ in one blast)', key: 'massacres', goal: 1 },
  { id: 'wave5', text: 'Reach wave 5', key: 'wave', goal: 5 },
  { id: 'wave8', text: 'Reach wave 8', key: 'wave', goal: 8, only: ['easy', 'normal'] },
  { id: 'chain', text: 'Pop a bloater chain', key: 'chains', goal: 1 },
  { id: 'direct3', text: 'Land 3 direct hits', key: 'directHits', goal: 3 },
  { id: 'kills30', text: 'Take down 30 zombies', key: 'kills', goal: 30 },
  { id: 'crates2', text: 'Grab 2 supply crates', key: 'crates', goal: 2 },
  { id: 'triple', text: 'Get a TRIPLE', key: 'triples', goal: 1 },
];

export function multiKill(n) {
  if (n >= 5) return { word: 'MASSACRE', bonus: POINTS.massacre };
  if (n >= 3) return { word: 'TRIPLE', bonus: POINTS.triple };
  if (n === 2) return { word: 'DOUBLE', bonus: POINTS.double };
  return null;
}

/* ---------- waves ---------- */
let nextId = 1;
function spawnOne(type, x, z, rand, extra = {}) {
  const T = TYPES[type];
  return { id: nextId++, type, x, z, hp: T.hp, speed: T.speed * (0.92 + rand() * 0.16), alive: true, state: 'walk', wob: rand() * 6.28, delay: 0, ...extra };
}
// Wave n: more walkers each wave, packs from wave 2, bloaters from 2, tanks from 3; every 3rd wave is a horde.
export function waveSpawns(n, rand = Math.random) {
  const horde = n % 3 === 0, k = horde ? 1.6 : 1;
  const list = [];
  const at = () => [(rand() * 2 - 1) * FIELD_X, SPAWN_Z[0] + rand() * (SPAWN_Z[1] - SPAWN_Z[0])];
  const walkers = Math.round((3 + 2 * n) * k), packs = n >= 2 ? Math.round((n >= 5 ? 2 : 1) * k) : 0;
  const tanks = n >= 3 ? Math.round(Math.floor((n - 1) / 2) * k) : 0, bloaters = n >= 2 ? Math.round(Math.ceil(n / 2) * k) : 0;
  const spread = 24; // seconds over which a wave walks out of the corn (a real swing comes every ~20 s)
  // tuned for a ~3½ minute run on Normal at a real swing every ~20 s (was ~5½ with slower walkers)
  const grave = () => [GRAVEYARD.x[0] + rand() * (GRAVEYARD.x[1] - GRAVEYARD.x[0]), GRAVEYARD.z[0] + rand() * (GRAVEYARD.z[1] - GRAVEYARD.z[0])];
  for (let i = 0; i < walkers; i++) {
    const fromGrave = rand() < 0.25, [x, z] = fromGrave ? grave() : at();
    list.push(spawnOne('walker', x, z, rand, { delay: rand() * spread, grave: fromGrave }));
  }
  for (let p = 0; p < packs; p++) {
    const [x, z] = at(), size = 5 + Math.floor(rand() * 2), d = rand() * spread, pid = nextId;
    for (let i = 0; i < size; i++) list.push(spawnOne('pack', x + (rand() - 0.5) * 9, z + (rand() - 0.5) * 9, rand, { delay: d, pack: pid, speed: TYPES.pack.speed }));
  }
  for (let i = 0; i < tanks; i++) { const [x, z] = at(); list.push(spawnOne('tank', x, z, rand, { delay: rand() * spread })); }
  for (let i = 0; i < bloaters; i++) { const [x, z] = at(); list.push(spawnOne('bloater', x, z, rand, { delay: rand() * spread })); }
  return list;
}

/* ---------- movement and fence damage ---------- */
// Advances every zombie; returns { damage, bursts: [zombie ids that burst at the fence] }.
export function stepZombies(zs, dt, { frozen = false } = {}) {
  let damage = 0; const bursts = [];
  for (const z of zs) {
    if (!z.alive) continue;
    if (z.delay > 0) { z.delay -= dt; continue; }
    if (frozen) continue;
    if (z.state === 'walk') {
      z.wob += dt;
      const lane = z.x / fieldHalf(z.z);                                 // keep its share of the field's width
      z.z += z.speed * dt;
      z.x = lane * fieldHalf(z.z) + Math.sin(z.wob * 0.7 + z.id) * 0.25 * dt; // and shamble a little side to side
      z.x = Math.max(-FIELD_X - 6, Math.min(FIELD_X + 6, z.x));
      if (z.z >= FENCE_Z - 1) {
        z.z = FENCE_Z - 1;
        if (z.type === 'bloater') { z.alive = false; z.burstAtFence = true; damage += TYPES.bloater.burst; bursts.push(z.id); }
        else z.state = 'attack';
      }
    } else if (z.state === 'attack') damage += TYPES[z.type].dps * dt;
  }
  return { damage, bursts };
}
export const active = zs => zs.filter(z => z.alive && z.delay <= 0);

/* ---------- blasts ---------- */
// land: {x, z}. Applies damage to `zs` in place and returns what happened.
export function resolveBlast(land, zs, blastYd) {
  const R = blastYd * YD, live = active(zs);
  const dist = z => Math.hypot(z.x - land.x, z.z - land.z);
  let nearest = Infinity; for (const z of live) nearest = Math.min(nearest, dist(z));
  const direct = nearest <= DIRECT_YD * YD;
  const kills = [], wounded = [], chain = [];
  for (const z of live) {
    if (dist(z) > R) continue;
    if (z.type === 'tank' && z.hp > 1 && !(direct && dist(z) <= DIRECT_YD * YD)) { z.hp--; wounded.push(z); continue; }
    z.alive = false; z.hp = 0; kills.push(z);
  }
  // bloaters burst and take out anything nearby, which can set off other bloaters
  const queue = kills.filter(z => z.type === 'bloater');
  while (queue.length) {
    const b = queue.shift();
    for (const z of active(zs)) {
      if (Math.hypot(z.x - b.x, z.z - b.z) > CHAIN_YD * YD) continue;
      z.alive = false; z.hp = 0; kills.push(z); chain.push(z);
      if (z.type === 'bloater') queue.push(z);
    }
  }
  const missYd = kills.length || wounded.length ? 0 : (nearest - R) / YD;
  return { kills, wounded, chain, direct, nearestYd: nearest / YD, missYd };
}

// Points for a blast before the streak multiplier.
export function blastPoints(res) {
  const killPts = res.kills.reduce((a, z) => a + TYPES[z.type].points, 0) + res.wounded.reduce((a, z) => a + (TYPES[z.type].hitPoints || 0), 0);
  const base = res.direct ? killPts * 2 : killPts;
  const multi = multiKill(res.kills.length);
  return { killPts, base: base + (multi ? multi.bonus : 0), multi };
}

/* ---------- crates ---------- */
export const CRATES = {
  repair: { name: 'Fence repair', short: 'Repair', hp: 35 },
  freeze: { name: 'Freeze', short: 'Freeze', seconds: 12 },
  airstrike: { name: 'Airstrike', short: 'Airstrike' },
};
export const crateGrabYd = blastYd => Math.max(5, blastYd * 0.6);
export function makeCrate(rand = Math.random) {
  const kinds = Object.keys(CRATES);
  return { id: nextId++, kind: kinds[Math.floor(rand() * kinds.length)], x: (rand() * 2 - 1) * 34, z: -(80 + rand() * 140) * YD, alive: true };
}
// The airstrike hits whichever of three lanes holds the most zombies.
export const LANES = [[-Infinity, -16], [-16, 16], [16, Infinity]];
export function bestLane(zs) {
  const counts = LANES.map(([a, b]) => active(zs).filter(z => z.x >= a && z.x < b).length);
  return counts.indexOf(Math.max(...counts));
}

/* ---------- aiming help (for simulated Hit / Ideal shot) ---------- */
// Where to aim: zombies about to reach the fence first, otherwise the spot that catches the most in the blast, at their position when the
// ball lands (they keep walking for the ~5 s of flight). Ties go to whoever is closest to the fence.
export function chooseTarget(zs, blastYd, flightTime = 5.5) {
  const live = active(zs).filter(z => z.state === 'walk' || z.state === 'attack');
  if (!live.length) return null;
  const R = blastYd * YD, ahead = z => ({ x: z.x, z: z.state === 'walk' ? Math.min(FENCE_Z - 1, z.z + z.speed * flightTime) : z.z });
  let best = null;
  for (const c of live) {
    const p = ahead(c);
    const n = live.filter(z => { const q = ahead(z); return Math.hypot(q.x - p.x, q.z - p.z) <= R * 0.85; }).length;
    const urgent = p.z > FENCE_Z - 45 ? 10000 : 0; // anything about to reach (or at) the fence comes first
    const score = urgent + n * 1000 + p.z;        // then the biggest group, then whoever is nearer the fence
    if (!best || score > best.score) best = { x: p.x, z: p.z, n, score };
  }
  return best;
}

// The shot solver is shared by every mini game.
export { solveShot } from './aim.js';
