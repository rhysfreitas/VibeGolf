// The Lost Valley's scenery in world space (x east, -z north): the expedition camp on the ledge, the falls off the
// walls, and the animals. All of it is scenery only, kept well off the lines of play (70 m or more; the herds
// several hundred). Pure data, no DOM.
import { footR, topY, polar, VALLEY, BAYS, CAMP_FALLS, GREAT_FALLS } from './world.mjs';

// the camp: canvas tents, a mess fly, a hut on stilts at the back, the cook fire, crates, the flag; between the
// 1st tee (west) and the 9th green (east), with Camp Falls' pool beside the 9th
export const CAMP = [
  { kind: 'tent', at: [-10, 62], w: 4.2, l: 5.2, h: 2.8, rot: 0.25 }, { kind: 'tent', at: [12, 82], w: 4.2, l: 5.2, h: 2.8, rot: -0.1 },
  { kind: 'tent', at: [40, 70], w: 4.6, l: 6, h: 3, rot: 0.4 }, { kind: 'tent', at: [78, 92], w: 4.2, l: 5.2, h: 2.8, rot: 0.15 },
  { kind: 'fly', at: [58, 46], w: 9, l: 12, h: 3.4, rot: 0.2 },
  { kind: 'hut', at: [112, 112], w: 9, l: 12, h: 4, stilt: 3.2, rot: 0.1 },
  { kind: 'fire', at: [44, 36] }, { kind: 'crates', at: [92, 60] }, { kind: 'crates', at: [-28, 40] },
  { kind: 'flag', at: [24, 30], h: 9 },
];

// the falls: the Great Falls (the 5th) and Camp Falls (the 9th) have their own data in world.mjs; ribbon falls come
// down the walls at the other bays, each from the wall's top to its foot
const at_ = (th, r) => { const a = th * Math.PI / 180; return [VALLEY.c[0] + Math.sin(a) * r, VALLEY.c[1] - Math.cos(a) * r]; };
export const FALLS = [
  { name: 'Great Falls', lip: GREAT_FALLS.lip, foot: GREAT_FALLS.foot, w: GREAT_FALLS.w, big: true },
  { name: 'Camp Falls', lip: CAMP_FALLS.lip, foot: CAMP_FALLS.pool.c, w: 16 },
  ...BAYS.slice(1).map((b, i) => { const r = footR(b.th); return { name: 'falls', lip: at_(b.th, r + 72 + (topY(b.th) - VALLEY.floor - 45) / 6.5), foot: at_(b.th, r + 8), w: 8 + 4 * (i % 2) }; }),
  // two thin threads off the east and west walls, seen from most of the holes
  ...[[78, 7], [205, 6], [282, 6]].map(([th, w]) => { const r = footR(th); return { name: 'falls', lip: at_(th, r + 72 + (topY(th) - VALLEY.floor - 45) / 6.5), foot: at_(th, r + 8), w }; }),
];

// the animals. longneck: a sauropod 26 m long (neck up, grazing or browsing); small: an ornithopod 6 m long,
// drinking; ptero: a pterosaur in flight (y above the sea, span metres), or perched; hunter: the predator,
// 12 m long, one of it, far off at the plain herd's edge. dir: the way it faces (radians, 0 = north, + = east)
export const LIFE = [
  // the plain herd, north-west, seen ahead-left from the 1st tee and across the valley from most holes
  ...[[-150, -1040, 0.6], [-100, -1090, 1.1], [-190, -1120, 2.4], [-60, -1010, 0.2], [-230, -1010, 3.6], [-130, -1180, 1.8], [-20, -1140, 0.9], [-280, -1110, 4.4]]
    .map(([x, z, d], i) => ({ kind: 'longneck', at: [x, z], dir: d, len: 22 + (i * 7) % 8, browse: i % 3 === 0 })),
  // the east meadow herd, across the river from the 4th, and three wading the shallows beside its second leg
  ...[[880, -1250, 4.0], [930, -1320, 3.4], [840, -1340, 4.6], [900, -1180, 3.0]].map(([x, z, d], i) => ({ kind: 'longneck', at: [x, z], dir: d, len: 22 + i * 2 })),
  ...[[452, -1175, 4.3], [468, -1210, 4.5], [446, -1240, 4.1]].map(([x, z, d], i) => ({ kind: 'longneck', at: [x, z], dir: d, len: 24 - i * 2, wade: true })),
  // small plant-eaters drinking at the river's edge below the 4th's first leg
  ...[[432, -994, 1.5], [440, -1006, 1.3], [428, -1016, 1.7], [446, -1022, 1.2], [436, -980, 1.6]].map(([x, z, d]) => ({ kind: 'small', at: [x, z], dir: d, len: 6.5, drink: true })),
  // the hunter, far off at the plain herd's edge, watching
  { kind: 'hunter', at: [-330, -1250], dir: 1.4, len: 12 },
  // pterosaurs: wheeling over the nests above the 9th green, along the north-east wall, over the river
  ...[[330, 120, 520, 0.4], [400, 150, 560, 2.2], [290, 160, 600, 4.1], [440, 110, 590, 5.3], [360, 60, 545, 3.0]].map(([x, z, y, d]) => ({ kind: 'ptero', at: [x, z], y, dir: d, span: 6.5 })),
  ...[[640, -1700, 560, 1.2], [760, -1600, 620, 2.6], [420, -1260, 470, 0.5], [-200, -900, 520, 5.6], [60, -1400, 600, 3.8]].map(([x, z, y, d]) => ({ kind: 'ptero', at: [x, z], y, dir: d, span: 7 })),
  // the nests: on the ledges of the south wall's face above the 9th green and Camp Falls
  ...[[300, 196, 488], [326, 204, 512], [352, 198, 495], [384, 208, 530], [412, 202, 505], [268, 204, 520]].map(([x, z, y]) => ({ kind: 'nest', at: [x, z], y })),
];
