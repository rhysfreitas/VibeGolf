// Halcyon Ring, routing check (11 November 2026): nine holes inside a ring space station, a pristine garden colony.
// Rhys's picks: R = 5 km; the curve plays as it looks; floor windows are glass and a penalty area (like water: a
// stroke and a drop beside where the ball crossed); the ball flies as on Earth; par 35, 4 3 4 5 3 4 4 5 3; tees
// Zenith, Meridian, Horizon, Nadir, the Kingfisher tips; decisions on 4, 7 and 8; classics Double Plateau (1),
// Eden (2), Road (3), Leven (7), Channel (8); landmarks the spoke, Earth through the rim glass and the clubhouse,
// the reveal the Great Window from the 9th tee; late light with the air handling's spinward breeze.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x right of the line)
// from `legs` ([length, turn in degrees, + = right]); `place` puts it on the floor (world.mjs: X = a east, -Z = s
// north). Each hole carries its hole card (`card`) and the course its course card (`COURSE.card`),
// docs/COURSE-DESIGN.md Part 1. Shapes (fairways, greens, bunkers) come with plan book round 1.
import { lineOf, lengthOf, at, YD } from './geo.mjs';

export const COURSE = {
  id: 'halcyon', name: 'Halcyon Ring', theme: 'ring', altFt: 0,
  signature: { time: 'evening', light: 'late, the mirror band dimming', wind: 'spinward breeze (air handling)', weather: 'clear', temp: 'mild' },
  teeSets: [
    { id: 'zenith', name: 'Zenith', color: '#1f3b5c', minDrive: 260 },
    { id: 'meridian', name: 'Meridian', color: '#c9a24a', minDrive: 230 },
    { id: 'horizon', name: 'Horizon', color: '#e8e4da', minDrive: 200 },
    { id: 'nadir', name: 'Nadir', color: '#8fb3c9', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'kingfisher', name: 'Kingfisher', color: '#1d7fa6', minDrive: 290 },
  ring: { R: 5000, width: 900 },
  card: {
    hook: 'Parkland golf inside a wheel in orbit: lawns, woods, lakes and white villas on terraces, the floor climbing up the ring ahead and behind, Earth through the glass of the rims. Its one rule: a floor window is a penalty area (glass; a ball on it takes a stroke and a drop beside where it crossed). The ball flies as on Earth, and the curve plays as it looks. "Wind" is the air handling\'s steady spinward breeze.',
    skeleton: 'Par 35: 4 3 4 5 3 4 4 5 3, the first par 35, the first with three par 3s and the first par-3 finish. Opens gently up the curve toward the day/night line. The big climbs are the 4th (+25 m to the west terraces) and the 8th (+25 m, the curve itself, up the valley), the big drop the 5th (-22 m off the terraces to the balcony), the drivable par 4 the 7th, the long par 3 the 5th. Finishes across the Great Window to the clubhouse: a par 3 over the signature hazard, a finish no course has used.',
    classics: 'Double Plateau (1), Eden (2), Road (3), Leven (7), Channel (8). All five new to the register.',
    decisions: 'Three, each a different type: bite off the Long Window\'s corner (4), drivable round the spoke (7), go or lay up at the canal (8). One in the last two holes. The rest have one clear line.',
    landmarks: 'The spoke (tees 5, 6 and 7, the 4th\'s second leg): an A-frame foot astride the 7th rising out of the top of the frame to the hub. Earth through the rim glass (tees 2, 3, 5, 7 and 9). The clubhouse, high on the curve ahead (tees 5, 6, 8 and 9, the 4th\'s second leg), played to at the end. The reveal: the 9th tee, up out of the 8th\'s valley, the Great Window spread below with the stars through it.',
    rhythm: 'A gentle opener (a fan, no penalty ground near, the night side climbing ahead). The hardest run is 4 to 7 (the cape over the Long Window and the climb, the long par 3 to the balcony, the long par 4 by the lake, the drivable 7th). The 8th is the breather and a choice, and the 9th finishes on the set piece. Par 4s 310, 380, 430, 455; par 3s 165, 235, 150 (playing about 170, 210, 135); par 5s 545 (a cape and a climb) and 560 (a valley and a canal).',
    newBorrowed: 'New to the register: a par 3 across a floor window; a green on a balcony over the rim glass; a spoke\'s foot as a centre-line hazard; a hole along the day/night line; a canal with a lock across the second shot; a par-3 finish; a curve you can see rise. Borrowed from the over-used list, two: a waterfall (off a villa terrace behind the 6th green) and one bridge (the footbridge over the canal on the 8th).',
    forms: 'Par 4s and 5s: 1 fan, 3 hourglass, 4 hook, 6 scalloped, 7 island (the spoke\'s leg in the fairway), 8 double (the Channel). Six forms, none twice, no plain strips.',
  },
};
export const BACK = 'zenith', FRONT = 'nadir';

function hole(def) {
  const L = lineOf(def.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = { line: L, len, pin: L.at(-1) };
  h.teePts = {}; h.yards = {};
  for (const [k, v] of Object.entries(def.tees)) {
    h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
    h.yards[k] = Math.round((len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  }
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tips = { tee: P(...tp), yards: Math.round((len - tp[0]) / YD / 5) * 5 };
  return { ...def, ...h };
}

const P4 = { zenith: 0, meridian: 18, horizon: [62, 26], nadir: [104, 28] };

export const HOLES = [
  hole({ n: 1, name: 'The Promenade', par: 4, legs: [[225, 0], [122, 20]], place: { at: [236, -560], heading: 180 }, tees: P4, shape: 'Dogleg right',
    card: {
      story: 'Up the curve from the tram stop toward the dusk line: the floor ahead climbs into the night side, its villas lighting up.',
      type: 'Double Plateau', form: 'Fan: narrow between the promenade\'s lime avenue and a sunken lawn, opening past 200 m toward the green',
      feature: 'The double plateau green: two shelves 0.6 m up with a low middle', job: 'Lie-setter for the approach (which shelf, which pin) and a helper: the low middle gathers a near miss',
      decision: 'None: one clear line, down the right half for the open front of the green',
      miss: 'Small: first cut, or the lime avenue\'s grass verge left. Medium: the avenue\'s trees left, a sunken lawn (ha-ha bank) right. Big: the villa gardens beyond the avenue. No penalty ground. Safe miss at the green: short, into the low middle',
      view: 'In front the fan\'s narrow neck and the avenue; in the middle the fairway rising gently with the curve; beyond, the ring floor climbing ahead into the night side, villa lights coming on up the curve. The landing area shows',
      ground: 'Up the curve, about 11 m: the ring floor itself rising ahead (3% where drives land, the green on a terrace cut level into it); the landing area leans 3% left toward the avenue, so the right half has the angle; the contour that matters is a broad swale at 200 m; the double plateau green',
    } }),
  hole({ n: 2, name: 'The Walled Garden', par: 3, legs: [[151, 0]], place: { at: [215, -175], heading: 95 }, tees: { zenith: 0, meridian: 9, horizon: [24, -12], nadir: [44, -14] },
    card: {
      story: 'A villa\'s walled garden on the east terraces, the green on its top lawn under the rim glass.',
      type: 'Eden', form: '-',
      feature: 'The garden wall and its ha-ha', job: 'Frame (the green reads against the white wall and the rim glass); the ha-ha long is the hazard',
      decision: 'None',
      miss: 'Small: the collar, or the green\'s front tilt sending a short ball back off. Medium: the two bunkers short left and short right, the garden\'s clipped yew either side. Big: long, into the ha-ha (a sunken ditch, a hard pitch back up; no penalty). Safe miss: short',
      view: 'In front the lawn falling to a gravel walk; in the middle the green on the garden\'s top lawn, its two bunkers; beyond, the white wall, the terraces stepping up to the rim, and Earth through the rim glass',
      ground: 'Up 7 m onto the terrace; the green tilted 2.5% from back to front (the Eden), bunkers short left and right',
    } }),
  hole({ n: 3, name: 'The Terminator', par: 4, legs: [[240, 0], [153, -20]], place: { at: [400, -90], heading: 270 }, tees: P4, shape: 'Dogleg left',
    card: {
      story: 'Along the line where day meets night: the left of the fairway in the dusk, lit villa gardens beyond; the right in the last light.',
      type: 'Road', form: 'Hourglass: wide off the terrace, pinched at 240 m between the night side\'s garden wall and a sunken lawn, then on to the green',
      feature: 'A villa\'s garden wall at the inside of the corner and another wall hard behind the green', job: 'Obstacle (the drive cuts the corner over the first wall\'s garden or plays out right) and hazard (the wall behind the green bounces a long ball back into the Road bunker)',
      decision: 'None: one clear line, at the pinch; the corner is a bonus, not a choice',
      miss: 'Small: first cut, either side of the pinch. Medium: the garden left (a long hedge, shrubs), the sunken lawn right. Big: beyond the garden wall left. No penalty ground. Safe miss at the green: short right; the deep pot front left and the wall behind',
      view: 'In front the terrace\'s lip and the wide first half; in the middle the pinch between the wall and the lawn, the light changing across it; beyond, the far rim\'s glass with Earth, and the night side to the left climbing the curve',
      ground: 'Off the east terrace, about 10 m down to the floor; the landing area leans 3% right away from the night side; the contour that matters is the pinch\'s crest; the green set at an angle with a deep pot at its front and the villa wall behind',
    } }),
  hole({ n: 4, name: 'The Long Window', par: 5, legs: [[220, 0], [278, 55]], place: { at: [-30, -75], heading: 285 }, tees: P4, shape: 'Dogleg right (cape)',
    card: {
      story: 'A cape round the Long Window: the floor opens on the stars at the inside of the corner, and the hole climbs to the west terraces.',
      type: 'Cape', form: 'Hook: the fairway wraps round the window, its inside edge sloping toward the glass',
      feature: 'The Long Window, 90 m of floor glass along the inside of the first leg', job: 'Hazard (the cape\'s carry, a penalty area) and aim point (its far rim, a white frame)',
      decision: 'Bite off what you dare: carry the window (about 240 yd from the Zenith tee) onto the second leg, 26 yd closer and a second that can reach the green\'s front, or play the left half to the corner (the window 35 yd right of the line) and three shots',
      miss: 'Small: first cut left, or the low inside of the hook. Medium: a stand of planes left of the corner, sand at the corner. Big: the window right (penalty, the bold line only). Safe miss at the green: left',
      view: 'In front the fairway and the window\'s near rim at the right; in the middle the corner and the second leg climbing; beyond, the terraces, and up the curve far ahead, the spoke and the clubhouse',
      ground: 'A climb of about 25 m: the curve (10 m) and the terraces: level to the corner, then two broad steps up the second leg to the terraces\' foot; the landing area leans 3% left, away from the window; the green on the lowest villa terrace with a false front',
    } }),
  hole({ n: 5, name: 'The Balcony', par: 3, legs: [[215, 0]], place: { at: [-395, -435], heading: 0 }, tees: { zenith: 0, meridian: 12, horizon: [32, 14], nadir: [60, 16] },
    card: {
      story: 'Down off the villa terraces to a green on a balcony out over the rim glass, Earth turning beyond it.',
      type: 'Original (a long par 3)', form: '-',
      feature: 'The balcony: a stone platform standing out over the strip of rim glass at the foot of the west wall', job: 'Hazard (left falls off the balcony to the rim walk, a penalty area) and frame (the rim wall\'s glass and Earth behind)',
      decision: 'None',
      miss: 'Small: the collar. Medium: right, the terrace bank, which feeds a ball back toward the green (a helper); short, a grass bank below the balcony. Big: left, off the balcony (penalty). Safe miss: right',
      view: 'From high on the terraces: below, the balcony standing out over the rim glass; to the left the rim wall\'s glass and Earth; ahead, the long lake and up the curve the spoke and the clubhouse',
      ground: 'Down about 22 m: 26 m off the high terrace to the balcony, the curve giving back 4; the green angled left to right, falling 2% toward the terrace bank, with one tier',
    } }),
  hole({ n: 6, name: 'The Lake', par: 4, legs: [[245, 0], [171, 28]], place: { at: [-350, -690], heading: 12 }, tees: P4, shape: 'Dogleg right',
    card: {
      story: 'Along the long lake that curves up the ring at both ends, to a green under a villa terrace\'s waterfall.',
      type: 'Original (a long par 4)', form: 'Scalloped: the lake\'s bays bite in from the left, bunkers from the right, alternating down the hole',
      feature: 'The lake and the waterfall off the villa terrace behind the green', job: 'Hazard (the lake on the left) and frame (the waterfall behind the green); the terrace bank behind is a backstop (helper)',
      decision: 'None: one clear line, weaving between the bays',
      miss: 'Small: first cut, a bay\'s shore grass. Medium: the bunkers right, the shore\'s reeds left. Big: the lake left (penalty, one side only; the right has room). Safe miss at the green: right and long, against the terrace bank',
      view: 'In front a lawn down to the shore; in the middle the fairway weaving between the bays; beyond, the waterfall off the terrace, and the lake curving up the ring into the distance with the spoke above it',
      ground: 'Up the curve about 14 m along the shore (the lake\'s water follows the curve, rising with it) to the green on a terrace below the falls; the landing area leans 4% right, away from the lake; the green falls 2% toward the lake with a spine',
    } }),
  hole({ n: 7, name: 'The Spoke', par: 4, legs: [[283, 0]], place: { at: [-170, -1110], heading: 90 }, tees: { zenith: 0, meridian: 18, horizon: [55, -24], nadir: [92, -26] }, shape: 'Straight',
    card: {
      story: 'Drivable between the spoke\'s legs: its west foot stands in the fairway, the green under the A-frame.',
      type: 'Leven', form: 'Island: one fairway with the spoke\'s west foot as the hole in it',
      feature: 'The spoke\'s west foot, 34 m across, rising out of the top of the frame to the hub', job: 'Obstacle (centre-line) and landmark; from the safe right side it hides the green',
      decision: 'Drivable: left of the foot, along the canal, the green opens (about 280 m to the front, a running shot); right of the foot is wide and safe, but the foot hides the green and leaves a pitch over a bunker',
      miss: 'Small: first cut either side. Medium: right, a plane tree grove; left, the canal\'s grass bank. Big: the canal left (penalty, the bold side only). Safe miss at the green: right',
      view: 'In front the fairway; in the middle the spoke\'s west foot astride it, the canal glinting left; beyond, the green between the legs and Earth through the east rim glass; the foot rises out of the top of the frame',
      ground: 'Off the waterfall terrace about 8 m down to the floor; the landing areas lean 2% toward the canal on the left, 3% right on the safe side; the green on the spoke\'s plinth, its front open on the left',
    } }),
  hole({ n: 8, name: 'The Aqueduct', par: 5, legs: [[270, 0], [242, 20]], place: { at: [160, -1170], heading: 0 }, tees: P4, shape: 'Dogleg right',
    card: {
      story: 'Up a tree-lined valley toward the clubhouse, the canal crossing the second shot through a lock, the aqueduct carrying it on over the valley side.',
      type: 'Channel', form: 'Double: the main fairway up the valley, and a second fairway out across the canal on the right that shortens the hole',
      feature: 'The canal and its lock across the second shot', job: 'Hazard (a penalty area across the second shot) and a lie-setter (the lock\'s stone steps split the far fairway)',
      decision: 'Go or lay up: the canal crosses 460 yd out. Lay up short of it and pitch over, or carry it with the second (about 190 yd from a good drive) to the Channel fairway on the right, leaving a short pitch up to the green',
      miss: 'Small: first cut, the valley\'s lower banks. Medium: the woods up the valley sides. Big: the canal (penalty) on the second shot only. Safe miss at the green: short, below the valley head',
      view: 'In front the valley floor and its woods either side; in the middle the canal\'s line and the footbridge; beyond, up the curve, the clubhouse and the spoke behind you',
      ground: 'A climb of about 25 m, the curve itself: the valley floor rises with the ring (5% where drives land, 10% at the head; the green on a shelf cut level into it); the landing area leans 2% left; the contour that matters is the lock\'s step; the green on the valley head shelf, a back tier',
    } }),
  hole({ n: 9, name: 'The Great Window', par: 3, legs: [[137, 0]], place: { at: [285, -1715], heading: 280 }, tees: { zenith: 0, meridian: 10, horizon: [28, 12], nadir: [50, 14] },
    card: {
      story: 'Up out of the valley onto a terrace, and there below it: the Great Window, stars and Earth through the floor, the clubhouse beyond.',
      type: 'Original (a short par 3 over the signature hazard)', form: '-',
      feature: 'The Great Window, 66 m across the line', job: 'Hazard (the carry, a penalty area; the forward tee carries 55 yd at most) and the reveal',
      decision: 'None: the finish is the set piece, one line',
      miss: 'Small: the collar. Medium: a bunker long left, the clubhouse lawn long. Big: short, the window (penalty). Safe miss: long',
      view: 'From the terrace 14 m up: in front the glass with the stars and Earth turning under it; in the middle the green on the clubhouse lawn; beyond, the clubhouse villa and the ring floor climbing on',
      ground: 'Down about 16 m from the terrace to the green; the green wide and shallow, falling 1.5% toward the window, a ridge across its back',
    } }),
];
