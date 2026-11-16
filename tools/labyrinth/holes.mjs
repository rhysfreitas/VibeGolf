// The Labyrinth, plan book round 1: the nine holes on the maze in world.mjs. The concept, skeleton (par 35:
// 5 4 4 4 3 4 3 3 5), routing and hole cards were approved by Rhys on 15 November 2026 (claude/labyrinth-layout.md);
// round 0 settled how walls and doors play (claude/status-labyrinth.md). This file draws them: real fairway outlines
// from the forms, green shapes and contour, the four tee sets and the Keystone tips spot, hazards, targets, words.
//
// Everything is in the world frame (X east, Z south, metres). A tee or a target is [s, off] along the hole's line
// (off + to the right) or { xy: [x, y north] }. The Elbow (3) and the Two Doors (7) have two versions: the hole is
// version A, and `versions` holds what B changes (its line, green, bunkers, targets, tees).
import { at, project, lengthOf, headingAt, YD } from './geo.mjs';
import { LW, P, STONES, STUBS6 } from './world.mjs';

export const COURSE = {
  id: 'labyrinth', name: 'The Labyrinth', theme: 'maze', altFt: 1200, wallSoak: 0.45,
  signature: { time: 'evening', light: 'a low sun from the west-south-west: wall tops gold, the floors in shade, shafts through gaps and doorways', wind: 'calm', weather: 'clear', temp: 'mild' },
  teeSets: [
    { id: 'tower', name: 'Tower', color: '#6b4a2f', minDrive: 260 },
    { id: 'rampart', name: 'Rampart', color: '#b08a3e', minDrive: 230 },
    { id: 'gate', name: 'Gate', color: '#3f6a5a', minDrive: 200 },
    { id: 'court', name: 'Court', color: '#e6dfcc', minDrive: 0 },
  ],
  tipsSet: { id: 'keystone', name: 'Keystone', color: '#45474d', minDrive: 290 },
  // two holes have two versions; which one is played is rolled each round like the pins (Rhys, 16 November 2026),
  // one mechanism with Emerald Bay's tide (COURSE.rolls, hole.versions)
  rolls: { doors: { values: ['A', 'B'], holes: [3, 7], label: 'Doors' } },
  card: {
    hook: 'A maze the size of a town, built by nobody knows who: colossal walls of weathered stone 10 to 60 m high, hung with ivy, trees in the cracks; vast, ancient and quiet; nothing moves while you play. Two logics: walls play (a ball into one drops at its foot about half the time, into ivy most of the time; a leaning wall banks a long approach back onto the 2nd green) and the doors change (on the 3rd and the 7th a different way is open each round, shown before you tee off).',
    skeleton: 'Par 35: 5 4 4 4 3 4 3 3 5. Through the maze: in at the gate in the south wall (1), two corridors (2, 3), the flooded chamber (4), the tower in the central court (5), a garden (6), two par 3s (7, 8), and out along the top of the outer wall and down through the breach (9). Opens and closes with a par 5; the drop par 3 is the 8th.',
    classics: 'Cape (3: over a broken wall), Long (9), Hog\'s Back (4: the crowned causeway), Short (7: a wedge into a doorway). Set pieces: the chute (1: the gate) and the wall (2: the leaning end wall, banked off on purpose).',
    decisions: 'Three, three types: bite off what you dare (3, over the Elbow\'s low walls), the long way round (4, the causeway or the stones), go or lay up (9, over the rubble at the breach\'s head). One in the last two holes.',
    landmarks: 'The tower, 120 m (over the walls from 1, 2 and 4; the reveal from the 5th tee, its foot behind the green; from 6, 8 and 9). The lit wall tops on every hole. The whole maze from the 8th tee.',
    rhythm: 'A gentle par 5 through the gate; the long corridor; the Elbow; the cistern and the tower as the middle; a short garden hole; two par 3s; the long way out into the open. Par 3s 135, 175, 205; par 4s 330, 380, 420, 455; par 5s 520 and 585.',
    forms: 'Six fairways, six forms: 1 hourglass (the gate the waist), 2 strip (a corridor), 3 hook (round the Elbow\'s fallen corner), 4 double (the causeway and the stones), 6 scalloped (wall stubs biting in), 9 broken (the rubble at the breach\'s head).',
    heights: '1 half-pipe (the forecourt\'s banks), 2 level with a kick bank at the end wall, 3 level (a corridor), 4 hog\'s back (the causeway), 5 level across a dry moat (par 3), 6 table top (bold: a 7 m terrace face), 7 uphill to a shelf (par 3), 8 the drop (the only one: 28 m off a wall top), 9 stepped (bold: down the breach, 31 m).',
    dials: '1 scale: doors 40 m high; 2 bend: dead straight between 60 m walls (past real golf); 3 bend: a true right angle; 4 one hazard\'s scale: a flooded chamber 250 m across; 5 green size (760 m²); 6 length (330 yd); 7 a second green; 8 height (a tee on a wall top, 28 m up); 9 length (585 yd).',
    newBorrowed: 'New to the register: doors that change the hole each round; a true corridor hole; a right-angle dogleg; a bank shot off a wall on purpose; a fairway along a wall top; a finish that leaves the place. Borrowed (two): something to play through (the gate), a tee shot off a height (8). No waterfall, bridge, punchbowl or climb to the clubhouse.',
    doors: 'The 3rd turns left or right at its corner; the 7th\'s green is in the left doorway or the right one. The round rolls them like the pins; the setup screen\'s card, the scorecard and the corner map show which. A shut door is a slab; the shut leg on the 3rd is a penalty area (a stroke and a drop).',
  },
};
export const BACK = 'tower', FRONT = 'court', SETS = ['tower', 'rampart', 'gate', 'court'];

const ptOf = (L, v) => Array.isArray(v) ? at(L, v[0], v[1] || 0) : v.xy ? P(v.xy) : at(L, v, 0);
const sand = (where, rx, rz = rx, rot = 0) => ({ where, rx, rz, rot });
// fairway circles given in the world (the 4th's stones) as lobes along the line
const circles = (L, list) => ({ lobes: list.map(([X, Z, r]) => { const p = project(L, X, Z); return [p.s, p.off, r, r, 0]; }), join: 2, wob: 2 });

function build(n, key, def) {
  const L = LW[key], len = lengthOf(L), pin = L.at(-1);
  // card yards: a par 3 straight to the pin; otherwise along the line, a tee off it (or behind it) joining the line
  // 150 m on (where its drive comes down)
  const card = T => { if (def.par === 3) return Math.hypot(T[0] - pin[0], T[1] - pin[1]); const s = Math.min(len, Math.max(0, project(L, ...T).s) + 150), J = at(L, s); return Math.hypot(T[0] - J[0], T[1] - J[1]) + len - s; };
  const teePts = {}, yards = {};
  for (const k of SETS) { teePts[k] = ptOf(L, def.tees[k]); yards[k] = Math.round(card(teePts[k]) / YD / 5) * 5; }
  let tips = null;
  if (def.tips) { const t = ptOf(L, def.tips); tips = { tee: t, yards: Math.round(card(t) / YD / 5) * 5 }; }
  const bunkers = (def.bunkers || []).map(b => { const c = Array.isArray(b.where) ? at(L, b.where[0], b.where[1]) : P(b.where.xy); return { at: c, rx: b.rx, rz: b.rz, rot: b.rot }; });
  const targets = (def.targets || []).map(t => ({ name: t.name, at: ptOf(L, t.at), bold: !!t.bold, second: !!t.second }));
  const plants = (def.plants || []).map(t => ({ ...t, at: at(L, t.s, t.off) }));
  return { ...def, n, key, line: L, len, pin, teePts, yards, tips, bunkers, targets, plants, head: headingAt(L, len - 1) };
}
function hole(n, key, def) {
  const h = build(n, key, def);
  if (def.versions) { h.verName = def.verName || 'Left'; h.versions = def.versions.map(v => ({ ...build(n, v.key || key, { ...def, ...v, name: def.name, versions: undefined }), id: v.id, verName: v.name })); }
  return h;
}

export const HOLES = [
  // 1. THE GATE: across the outer forecourt (its grassed banks feed a loose drive in), between doors 40 m high at
  // 290 yd, and on into the first court; a big green under the first inner wall
  hole(1, 1, { name: 'The Gate', par: 5, shape: 'Dogleg left (39°) through the inner gate',
    tees: { tower: 0, rampart: [22, 11], gate: [50, -30], court: [88, 36] }, tips: [-27, 0],
    // an hourglass: wide in the forecourt where drives land, the waist through the gate, wide again in the first court
    fw: [{ e: [[56, 13, 13], [100, 24, 27], [160, 32, 34], [205, 33, 32], [236, 27, 26], [246, 15, 15], [252, 12, 13], [266, 11, 12], [284, 12, 13], [305, 20, 18], [345, 27, 24], [395, 25, 23], [432, 17, 15], [458, 11, 11]], wob: 3 }],
    green: { lobes: [[0, 0, 13.5, 15, -12], [-7, -9, 8, 7, 0], [6, 9, 7, 6, 0]], contour: [{ fall: 15, pct: 1.8 }, { tier: [0, 7], up: 180, h: 0.4, w: 3 }] },
    bunkers: [sand([222, -38], 17, 9, 12), sand([458, -18], 6, 4, 30), sand([480, 17], 5, 3.6, -20)],
    targets: [{ name: 'Short of the gate', at: [232, -4] }, { name: 'Through the gate', at: [345, 0] }],
    words: {
      story: 'The gate: in through the outer wall, across the forecourt and between doors 40 m high.',
      plays: 'From the tee just inside the outer gate the forecourt opens out between grassed banks that feed a loose drive back to the middle. Ahead stands the inner gate, two towers 50 m high with doors 40 m high standing open, 290 yd away. The drive stays short of it; the second goes through the gate (the opening is 36 m wide) into the first court, and the third finds a big green under the court\'s north wall, which is the 2nd hole\'s corridor. A gentle start: no penalty ground anywhere.',
      safe: 'Driver into the forecourt (240 m), a mid iron through the gate (100-140 m on), a short iron to the green.',
      bold: null,
      miss: 'Off the tee: the forecourt\'s banks feed it back; left, a long fairway bunker. Through the gate: a ball that hits a tower or the gate wall drops at its foot (rubble) on the forecourt side, about half the time, otherwise it comes back. At the green: sand short left and long right; the wall 25 m behind the pin. The safe miss is short.',
    },
    card: { type: 'Original (a gentle par 5 opener)', form: 'Hourglass', feature: 'The inner gate: two towers 50 m high, doors 40 m high standing open into the first court', job: 'A frame from the tee, an obstacle for the second (the chute); the forecourt\'s banks a helper',
      decision: 'None: one clear line', miss: 'Small: the banks, then rough. Medium: the long fairway bunker (left) or the forecourt walls\' rubble. Big: none (no penalty ground). At the green: short',
      view: 'In front the forecourt and its banks; in the middle the gate and its towers; beyond, the first court\'s walls and the tower over the gate wall', ground: 'Half-pipe: the forecourt\'s banks rise 6 m either side of the fairway and feed a loose drive in; the first court nearly level',
      height: 'Half-pipe', dial: 'Scale: doors 40 m high', shots: { tee: 'Driver as hard as you like', approach: 'A mid iron through the gate, then a short iron' }, hazard: 'In the centre: the gate (the waist)', surround: 'Sand short left and long right; the wall behind' } }),

  // 2. THE LONG CORRIDOR: 455 yd dead straight between walls 60 m high and 62 m apart; the end wall leans in over the
  // green and a long approach banks off it down onto the green
  hole(2, 2, { name: 'The Long Corridor', par: 4, shape: 'Dead straight between 60 m walls',
    tees: { tower: 0, rampart: 18, gate: 55, court: 100 }, tips: [-27, 0],
    // a strip: 50 m of fairway, 6 m of rough each side, the walls (in the corridor there is no room for anything else)
    fw: [{ e: [[122, 22, 22], [150, 25, 25], [260, 25, 25], [330, 24, 25], [396, 22, 22], [402, 18, 18]], wob: 1.5 }],
    green: { blend: 2.5, lobes: [[0, 0, 12, 16, 0], [3, -7, 7, 6, 0]], contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-9, -8], [9, -6]], h: 0.3, w: 3 }] },
    bunkers: [],
    targets: [{ name: 'The corridor', at: [250, 0] }],
    words: {
      story: 'The long corridor: dead straight between walls 60 m high, to a green under a wall that leans in over it.',
      plays: 'A corridor 62 m wide between walls 60 m high, dead straight for 455 yd. The floor is in shade; the low sun lights the top of the left wall in a gold band that falls toward the green, and the end wall glows at the far end. Two stretches of the left wall have fallen to 14 m, and the tower stands over them, from the tee and again from the landing area. The end wall leans in 12° over the back of the green, and a mown bank 5 m high runs from the green up to its foot: a long approach that comes down on the bank or hits the wall rolls back onto the green.',
      safe: 'Driver down the middle (250 m), a long iron or a hybrid at the green; long is fine.',
      bold: null,
      miss: 'Either side: 6 m of rough, then the wall. A drive into a wall drops at its foot in rubble (45% on bare stone, 80% in ivy) or comes back; nothing is lost. Over the fallen stretches on the left (14 m): the next court, found, a recovery back over. At the green: the bank and the wall behind feed a long ball back; short is a run-up along the floor. The safe miss is long.',
    },
    card: { type: 'Original (a corridor; the wall)', form: 'Strip', feature: 'The corridor\'s walls; the end wall leaning in over a 5 m kick bank', job: 'The walls a frame and a hazard (rubble at their foot); the end wall and bank a helper (they bank a long approach back)',
      decision: 'None: one line, dead straight', miss: 'Small: rough either side. Medium: the wall\'s foot (rubble). Big: over a fallen stretch on the left into the next court (found). At the green: long',
      view: 'Two walls and a slot of sky: the near walls fill the top of the frame for 170 m; the gold band on the left wall, the tower over the first fallen stretch, the lit end wall 450 m away', ground: 'Level, a corridor: the landing area leans 2.2% to the right; the kick bank 5 m behind the green',
      height: 'Level (a corridor), with a kick bank at the end wall', dial: 'Bend: dead straight between 60 m walls (past real golf)', shots: { tee: 'Dead straight', approach: 'A long iron, long is fine (bank it off the wall)' }, hazard: 'Down both sides: the walls', surround: 'A feeding bank and the wall behind' } }),

  // 3. THE ELBOW: a corridor with a right-angle corner whose inside walls have crumbled to 9-14 m; carry them for a
  // short second, or play to the corner; each round the corridor turns left or right
  hole(3, 3, { name: 'The Elbow', par: 4, formLine: [LW[3][0], at(LW[3], 190, -60), LW[3].at(-1)], shape: 'A right angle, left (this version) or right',
    tees: { tower: 0, rampart: 20, gate: 45, court: 88 }, tips: null,
    // a hook (read against the line it wraps round, over the inside court: formLine): leg 1's corridor, then round the corner and down leg 2; the low walls and the court inside the bend are
    // the hazard the bold line crosses
    fw: [{ e: [[110, 20, 20], [140, 23, 23], [185, 25, 22], [205, 30, 18], [216, 28, 27], [240, 23, 27], [300, 22, 27], [325, 16, 18], [336, 12, 12]], wob: 2 }],
    green: { lobes: [[0, 0, 11.5, 12.5, 15], [-5, 6, 6, 5, 0]], contour: [{ fall: 340, pct: 1.9 }, { bowl: [5, -7], r: 9, h: 0.3 }] },
    bunkers: [sand([326, -15], 5, 3.5, 20)],
    targets: [{ name: 'The corner', at: [196, 2] }, { name: 'Over the broken wall', at: [282, -2], bold: true }],
    versions: [{ id: 'B', name: 'Right', key: '3B', formLine: [LW['3B'][0], at(LW['3B'], 190, 60), LW['3B'].at(-1)],
      green: { lobes: [[0, 0, 11.5, 12.5, -15], [5, 6, 6, 5, 0]], contour: [{ fall: 20, pct: 1.9 }, { bowl: [-5, -7], r: 9, h: 0.3 }] },
      fw: [{ e: [[110, 20, 20], [140, 23, 23], [185, 22, 25], [205, 18, 30], [216, 27, 28], [240, 27, 23], [300, 27, 22], [325, 18, 16], [336, 12, 12]], wob: 2 }],
      bunkers: [sand([326, 15], 5, 3.5, -20)],
      targets: [{ name: 'The corner', at: [196, -2] }, { name: 'Over the broken wall', at: [282, 2], bold: true }] }],
    words: {
      story: 'The Elbow: a corridor with a right-angle corner whose inside walls have crumbled; which way it turns depends on the round.',
      plays: 'A corridor 60 m wide runs 210 m to a right angle. Its side walls stand 58 m for the first 80 m, then crumble to 9-14 m; behind each low wall is a court of rough. At the corner a gate tower stands either side of each leg\'s mouth: one door has slid into its posts, the other is shut, a slab 40 m high. Play to the corner and a mid iron down the open leg (140 m), or carry both low walls and the court with a high drive (212 yd to clear the far one) for a wedge of 55-60 yd. The corner\'s outer wall stops a drive that runs through.',
      safe: 'A 3 wood or a long iron to the corner (195 m), a mid iron down the open leg.',
      bold: 'A high drive over the low walls inside the bend: 212 yd to clear the far one, landing in the open leg about 60 yd from the green. Short: the court (a shot lost, a recovery back over a 12 m wall).',
      miss: 'Off the tee: rough then the walls; a drive that runs through the corner stops at the outer wall. Over the shut leg\'s low wall: a penalty area (a stroke and a drop). At the green: sand short left (short right in the right-hand version); behind it the leg\'s end wall.',
    },
    card: { type: 'Cape (over a wall)', form: 'Hook', feature: 'The crumbled inside corner (low walls, a court behind), the gate towers and doors at the corner', job: 'The low walls the hazard of the decision; the outer wall a helper (stops a runner); the doors frame the open way',
      decision: 'Bite off what you dare: the corner then a mid iron (140 m), or 212 yd over the low walls for a wedge; the bold line gains about 80 yd and costs a shot when short', miss: 'Small: rough. Medium: the walls\' foot, the court behind the low walls. Big: over the shut leg\'s low wall (a penalty area). At the green: short of the end wall',
      view: 'The corridor\'s walls stepping down to the low stretches 80 m out, the gate towers at the corner and the outer corner wall closing the view; the open door\'s mouth on one side', ground: 'Level, a corridor; the court behind the low walls a little higher and rough',
      height: 'Level (a corridor)', dial: 'Bend: a true right angle', shots: { tee: 'A lay-up to a number, or a high carry', approach: 'A mid iron, or a full wedge' }, hazard: 'Diagonal: the low walls and court inside the bend', surround: 'Sand short on the inside; the end wall behind' } }),

  // 4. THE CISTERN: a flooded chamber 250 m across; the crowned causeway curves round to the right and never crosses
  // water; three stepping stones run straight inside the bend
  hole(4, 4, { name: 'The Cistern', par: 4, shape: 'Dogleg right (46°) round a flooded chamber',
    tees: { tower: 0, rampart: 22, gate: 55, court: [96, -27] }, tips: [-27, 0],
    // a double fairway: the causeway (the long way round) and the three stones inside the bend (the short way)
    fw: [{ e: [[104, 20, 20], [150, 22, 22], [190, 27, 22], [212, 30, 22], [232, 26, 24], [270, 22, 22], [330, 18, 18], [360, 13, 13], [372, 10, 10]], wob: 2 },
      circles(LW[4], STONES.map(s => [...P(s.at), s.r - 3]))],
    green: { lobes: [[0, 0, 11, 16, -35], [-4, 8, 6, 5, 0]], contour: [{ fall: 30, pct: 1.7 }, { tier: [0, -7], up: 180, h: 0.45, w: 3 }] },
    bunkers: [],
    targets: [{ name: 'The corner', at: [206, -6] }, { name: 'The second stone', at: { xy: [1000, 560] }, bold: true }],
    words: {
      story: 'The cistern: a flooded chamber, the walls doubled in still water, a causeway round it and three stepping stones across.',
      plays: 'A chamber 250 m across, flooded, its walls doubled in the still water. The causeway (crowned: only its middle holds) runs north along the chamber\'s west wall and curves round to the right to a green on a platform in the far corner; it never crosses water. Inside the bend three stepping stones, each 36-46 m across, run straight at the green: a drive to the second stone is about 40 yd shorter than the causeway\'s corner and comes into the green along its long axis. A low stone kerb along the causeway\'s water side stops a ball that only runs.',
      safe: 'A driver or 3 wood along the causeway to the corner (205 m), a mid iron across the corner of the water.',
      bold: 'A drive of about 225 yd onto the second stone (46 m across), leaving a short iron straight up the green.',
      miss: 'Off the causeway: left, rough and the west wall\'s foot; right, the kerb, then the water (a stroke and a drop). A drive past the corner runs into the rough at the wall\'s foot. Off a stone: water all round. At the green: water short and right; a bank left; the chamber\'s north wall behind.',
    },
    card: { type: 'Hog\'s Back (the causeway)', form: 'Double (the causeway and the stones)', feature: 'The flooded chamber, the crowned causeway, the three stones', job: 'The water the hazard; the stones the bold line\'s landing; the kerb a helper; the west wall a frame',
      decision: 'The long way round: the causeway to the corner and a mid iron, or a drive onto the second stone and a short iron (about 40 yd less and an open green)', miss: 'Small: the causeway\'s shoulders shed a ball to rough. Medium: the wall\'s foot (left). Big: the water (right only). At the green: left',
      view: 'The broken arcade in front, the water and the causeway curving away to the right round it, the stones in the water, the green on its platform in the far corner, the tower over the west wall', ground: 'Hog\'s back: the causeway crowned 2.3 m across its 64 m; the stones and the green\'s platform about level',
      height: 'Hog\'s back', dial: 'One hazard\'s scale: a flooded chamber 250 m across', shots: { tee: 'A fade along the causeway, or a high carry to a stone', approach: 'A mid iron across water, or a short iron' }, hazard: 'Diagonal: the water inside the bend', surround: 'Water short and right; a bank left' } }),

  // 5. THE TOWER COURT: out of a doorway and the tower fills the frame; a mid iron across a dry moat to a big green
  // at the tower's foot; its plinth returns a long ball
  hole(5, 5, { name: 'The Tower Court', par: 3, shape: 'Straight, across a dry moat',
    tees: { tower: { xy: [968, 740] }, rampart: { xy: [957, 747] }, gate: { xy: [946, 754] }, court: { xy: [899, 754] } }, tips: { xy: [996, 740] },
    green: { lobes: [[0, -4, 15, 15.5, 0], [-7, 6, 6.5, 6, 0]], contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-12, 7], [12, 9]], h: 0.35, w: 3.5 }] },
    bunkers: [sand({ xy: [826, 774] }, 5.5, 3.5, 30), sand({ xy: [822, 738] }, 5, 3.4, -30)],
    targets: [],
    words: {
      story: 'The tower court: out of a doorway and the tower fills the frame; a green at its foot.',
      plays: 'From a doorway in the court\'s east wall, across a dry moat 30 m wide and 6 m deep (grass, a pitch out), to a big green at the foot of the tower, 120 m high. The tower\'s stepped plinth runs round its foot just behind the green and returns a long ball; mown banks left and right feed a near miss in. The reveal: the tower is first seen whole from this tee.',
      safe: 'A mid iron to the middle of the green.',
      bold: null,
      miss: 'Short: the moat (a pitch up its bank). Long: the plinth throws it back. Left and right: sand, then banks that feed. The safe miss is long.',
    },
    card: { type: 'Original (the reveal)', form: 'Par 3', feature: 'The tower, its plinth; the dry moat', job: 'The tower a landmark and a frame; the plinth a helper (returns a long ball); the moat a hazard (a pitch out)',
      decision: 'None: one shot', miss: 'Small long: the plinth. Small short: the moat. Left and right: sand, banks that feed. Safe miss: long',
      view: 'The moat at the bottom of the frame, the green, the tower rising out of the top of the frame behind it', ground: 'Level across a dry moat: tee and green at 14 m, the moat 6 m deep between',
      height: 'Level across a dry moat (par 3)', dial: 'Green size: 760 m²', shots: { tee: 'A mid iron, long is fine', approach: '' }, hazard: 'Across: the moat', surround: 'The plinth behind; sand left and right; banks that feed' } }),

  // 6. THE HANGING GARDEN: a chamber gone to woodland; wall stubs bite in from alternate sides; carry the terrace's
  // 7 m face for a flat lie and a chip, or lay up below it for a blind pitch
  hole(6, 6, { name: 'The Hanging Garden', par: 4, shape: 'Dogleg right (33°) up to a terrace',
    reliefLand: 160,
    tees: { tower: 0, rampart: 16, gate: 36, court: [86, 42] }, tips: { xy: [733, 801] },
    // scalloped: the stubs and old trees bite in from alternate sides below the terrace; on top a short fairway
    fw: [{ e: [[56, 15, 15], [84, 25, 24], [125, 27, 28], [168, 27, 26], [182, 22, 22]], wob: 3 }, { bite: [[62, -27, 15, 11, 0], [112, 27, 15, 11, 0], [158, -28, 14, 10, 0]], join: 3, wob: 2 },
      { e: [[206, 20, 20], [222, 24, 23], [262, 22, 22], [282, 15, 15], [290, 11, 11]], wob: 2.5 }],
    green: { lobes: [[0, 0, 10, 12.5, 18], [4, -7, 6, 5, 0]], contour: [{ fall: 330, pct: 2.0 }, { ridge: [[-6, -7], [7, -6]], h: 0.3, w: 3 }] },
    bunkers: [],
    plants: [{ name: 'the great cedar', s: 201, off: -19, r: 13, h: 34, low: 4, marker: true }, { s: 95, off: 38, r: 9, h: 24, low: 5 }, { s: 140, off: -40, r: 10, h: 26, low: 5 }, { s: 30, off: -36, r: 8, h: 20, low: 4 }, { s: 260, off: 34, r: 9, h: 22, low: 4 }],
    targets: [{ name: 'Below the face', at: [160, 0] }, { name: 'On the terrace', at: [232, 0], bold: true }],
    words: {
      story: 'The hanging garden: a chamber gone to woodland, a terrace across it, a great cedar on its lip.',
      plays: 'Out through the fallen corner of the tower court into a chamber gone to woodland: old trees and overgrown wall stubs 3 m high bite into the fairway from alternate sides, so there\'s no straight line. Across it, a terrace face 7 m high, a great cedar on its lip as the marker. Carry the face (about 225 yd to land on top) for a flat lie and a chip to a small green on the terrace, or lay up below it (130 m) and pitch up blind over the face.',
      safe: 'A long iron to the lower fairway (140 m), a blind pitch of 150 m up over the face (aim at the cedar).',
      bold: 'A drive of 225 yd or more onto the terrace, leaving a chip of 60-70 m.',
      miss: 'Below the terrace: a stub or a tree on either side (a stub drops a ball at its foot; a tree knocks it down). A drive that comes up short of the top: the face (rough, 7 m): it stops there or rolls back to its foot. No penalty ground. At the green: off the back, the garden\'s north end; the safe miss is short and right.',
    },
    card: { type: 'Original', form: 'Scalloped', feature: 'The terrace and its cedar; the stubs and old trees below', job: 'The face an obstacle and a lie-setter; the cedar an aim point; the stubs and trees hazards that set the line',
      decision: 'None marked as a decision type, but the hole asks: carry the face or lay up below it (the dial is its length)', miss: 'Small: rough. Medium: the stubs and trees, the face. Big: none (no penalty ground). At the green: short right',
      view: 'The court\'s fallen corner in front, the garden\'s trees and stubs, the terrace face with the cedar on its lip 200 m out; the green on top hidden', ground: 'Table top: a 7 m face over 16 m, 182-198 m along the line; the green on the level top',
      height: 'Table top', dial: 'Length: 330 yd', shots: { tee: 'A draw round the stubs, or a high carry over the face', approach: 'A blind pitch, or a chip' }, hazard: 'Across: the terrace face; scalloped stubs down the sides', surround: 'Rough; the garden\'s north end behind' } }),

  // 7. THE TWO DOORS: a short iron to a green set inside a doorway 30 m wide, walls on three sides; two doorways, two
  // greens about 80° apart, one open each round
  hole(7, 7, { name: 'The Two Doors', par: 3, verName: 'Left', shape: 'Straight, into the left doorway (this version) or the right',
    tees: { tower: { xy: [470, 1064] }, rampart: { xy: [470, 1071] }, gate: { xy: [470, 1078] }, court: { xy: [470, 1085] } }, tips: { xy: [470, 1043] },
    green: { lobes: [[0, 0, 12.5, 11.5, 0], [-5, 5, 5.5, 4.5, 0]], contour: [{ fall: 15, pct: 2.0 }, { tier: [0, -6], up: 180, h: 0.35, w: 3 }] },
    bunkers: [sand({ xy: [360, 1136] }, 6, 3.5, 0), sand({ xy: [410, 1135] }, 5, 3.2, 0)],
    targets: [],
    versions: [{ id: 'B', name: 'Right', key: '7B',
      green: { lobes: [[0, 0, 12.5, 11.5, 0], [5, 5, 5.5, 4.5, 0]], contour: [{ fall: 345, pct: 2.0 }, { tier: [0, -6], up: 180, h: 0.35, w: 3 }] },
      bunkers: [sand({ xy: [520, 1135] }, 5, 3.2, 0), sand({ xy: [570, 1136] }, 6, 3.5, 0)] }],
    words: {
      story: 'The two doors: a short iron into a doorway; two doorways, and only one is open.',
      plays: 'Ahead a great wall with two doorways 30 m wide and 40 m high, about 80° apart from the tee. Inside each, up a flight of grass steps, a green on a shelf with walls on three sides. One door stands open; the other is shut, a slab across the doorway. A short iron uphill into the open one.',
      safe: 'A short iron to the middle of the green.',
      bold: null,
      miss: 'Short: the steps (an uphill chip) and sand either side of them. Long or wide: the alcove\'s walls, which drop most balls at their foot round the green. Into the shut door: it comes back down onto the steps.',
    },
    card: { type: 'Short', form: 'Par 3', feature: 'The two doorways and their doors', job: 'The alcove\'s walls a frame and a backstop; the shut door an obstacle; the steps a lie-setter',
      decision: 'None: one shot (the round picks the door)', miss: 'Small: the steps, sand either side. Long and wide: the alcove\'s walls (they drop a ball at their foot). Safe miss: short',
      view: 'The great wall across the frame, the open doorway with the green on its shelf inside, the other doorway shut', ground: 'Uphill to a shelf: the alcove\'s floor 2.5 m over the forecourt, up grass steps',
      height: 'Uphill to a shelf (par 3)', dial: 'A second green', shots: { tee: 'A high short iron that stops', approach: '' }, hazard: 'All round: the alcove\'s walls', surround: 'Walls on three sides; steps and sand in front' } }),

  // 8. THE PARAPET: up a stair inside the wall to its top: the whole maze below; a long iron dropping 28 m into a
  // sunken court whose banks gather to a big green; a pool front right
  hole(8, 8, { name: 'The Parapet', par: 3, shape: 'Straight, off a wall top',
    tees: { tower: { xy: [420, 1215] }, rampart: { xy: [455, 1222] }, gate: { xy: [486, 1228] }, court: { xy: [520, 1231] } }, tips: { xy: [394, 1214] },
    green: { lobes: [[0, 0, 15, 17, 10], [-9, -9, 8, 7, 0], [7, 9, 7, 6, 0]], contour: [{ fall: 10, pct: 1.7 }, { bowl: [-6, 8], r: 12, h: 0.35 }] },
    bunkers: [sand({ xy: [628, 1253] }, 6, 4, 20)],
    targets: [],
    words: {
      story: 'The parapet: up a stair inside the wall to its top, the whole maze below in the evening light.',
      plays: 'The tee stands at the lip of a wall top 28 m over a sunken court, the whole maze spread out below in the low sun and the tower over it all. A long iron drops onto a big green (820 m²); the court\'s banks gather a near miss toward it. A pool sits front right. The forward tees play from the stair\'s landings down the wall\'s face.',
      safe: 'A long iron (it plays about 20 yd shorter than the card) at the middle of the green.',
      bold: null,
      miss: 'Short right: the pool (a stroke and a drop). Short left: the bank, which feeds. Long: sand, then the court\'s back bank feeding it back. The safe miss is left.',
    },
    card: { type: 'Original (the drop par 3)', form: 'Par 3', feature: 'The wall top; the whole maze below; the sunken court', job: 'The view; the court\'s banks a helper (they gather); the pool a hazard',
      decision: 'None: one shot', miss: 'Short right: the pool. Left and long: banks that feed. Safe miss: left',
      view: 'The wall\'s lip at the bottom of the frame, the green in the court below, the maze beyond to the east and the tower to the south-east', ground: 'The drop: 28 m from the wall top to the court',
      height: 'Drop (the only one)', dial: 'Height: a tee on a wall top, 28 m up', shots: { tee: 'A long iron dropping in', approach: '' }, hazard: 'Front right: the pool', surround: 'Banks that gather; sand long' } }),

  // 9. THE WAY OUT: along the grassed top of the outer wall between parapets, then the breach: a band of rubble at its
  // head, steps down, and a green outside the maze in open sun
  hole(9, 9, { name: 'The Way Out', par: 5, shape: 'Along a wall top, then right (25°) down the breach',
    tees: { tower: 0, rampart: 28, gate: 72, court: 138 }, tips: [-30, 0],
    // broken: the wall top, then the rubble at the breach's head across the fairway, then the steps down to the green
    fw: [{ e: [[148, 11, 11], [200, 12, 12], [222, 24, 24], [292, 24, 24], [306, 14, 14], [352, 13, 13], [366, 11, 11]], wob: 2 },
      { e: [[400, 14, 15], [420, 16, 16], [470, 16, 16], [496, 13, 13], [512, 10, 10]], wob: 2 }],
    green: { lobes: [[0, 0, 13, 16.5, -20], [6, 8, 7, 6, 0]], contour: [{ fall: 20, pct: 1.8 }, { tier: [0, 8], up: 180, h: 0.4, w: 3 }] },
    bunkers: [sand([500, -24], 6, 4, 0), sand([518, 19], 5, 3.4, 0), sand([548, -12], 5.5, 3.6, 0), sand([462, 24], 9, 5, 0), sand([520, -21], 4, 3, 0)],
    targets: [{ name: 'The wall top', at: [245, 0] }, { name: 'Short of the rubble', at: [342, 0] }, { name: 'Down the steps', at: [474, -2], bold: true, second: true }],
    words: {
      story: 'The way out: along the top of the outer wall, then down through the breach to a green outside the maze.',
      plays: 'Up onto the grassed top of the outer wall, 60 m wide, parapets either side, the maze on your right and open country on your left. The wall top sags gently toward the north-east corner, where the wall has fallen outward: a band of rubble across the fairway at the breach\'s head, then two broad steps down the fallen masonry and a green outside the maze in the open sun. Go: a long second over the rubble down onto the steps or the green. Lay up: short of the rubble, leaving about 165 m down the steps.',
      safe: 'Driver along the wall top (245 m), a short iron to short of the rubble, a 7 or 8 iron down the steps (it plays about 20 yd shorter).',
      bold: 'A long second over the rubble (it needs about 150 m in the air) onto the steps, for a pitch; or, for a long hitter, at the green.',
      miss: 'Along the wall top: rough, then the parapets keep a running ball on; a ball that flies a parapet falls to the floor below, inside or outside (found: a shot lost, a way on to the breach\'s foot). The rubble: a hack out. At the green: sand either side and long; the rubble slopes either side of the steps.',
    },
    card: { type: 'Long', form: 'Broken', feature: 'The wall top and its parapets; the breach: its rubble, its steps', job: 'The parapets a helper (they keep a runner on); the rubble a cross hazard; the steps lie-setters',
      decision: 'Go or lay up: over the rubble with the second, or short of it and a short iron down the steps', miss: 'Small: rough on the wall top. Medium: the parapets\' foot; the rubble. Big: over a parapet (found, a shot lost). At the green: sand',
      view: 'The wall top running away between its parapets, the maze in shade on the right, open country on the left; the breach\'s corner 330 m out', ground: 'Stepped: the wall top (52, sagging to 46), the rubble at the breach\'s head, two steps (40, 32) and the green outside at 21',
      height: 'Stepped (down the breach)', dial: 'Length: 585 yd', shots: { tee: 'Driver, straight (the parapets)', approach: 'A long carry over the rubble, or a lay-up to a number' }, hazard: 'Across: the rubble at the breach\'s head', surround: 'Sand either side and long; rubble slopes' } }),
];

// every play of the course: the nine holes and the other version of the two doors' holes
export const PLAYS = HOLES.flatMap(h => [{ ...h, ver: h.versions ? 'A' : null }, ...(h.versions || []).map(v => ({ ...v, ver: v.id }))]);
export const playName = h => h.ver ? `${h.name} (${h.verName})` : h.name;
