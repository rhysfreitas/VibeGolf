// The Lost Valley's scenery in world space (x east, -z north): the expedition camp on its knoll on the floor, the
// falls off the walls, and the animals. All of it is scenery only, kept well off the lines of play (70 m or more;
// the herds several hundred). Pure data, no DOM.
import { footR, topY, polar, VALLEY, BAYS, NEST_FALLS, GREAT_FALLS } from './world.mjs';

// the camp: canvas tents, a mess fly, a hut on stilts at the back, the cook fire, crates, the flag; on the knoll
// behind and left of the 1st tee
export const CAMP = [
  { kind: 'tent', at: [-118, -1190], w: 4.2, l: 5.2, h: 2.8, rot: 1.8 }, { kind: 'tent', at: [-136, -1172], w: 4.2, l: 5.2, h: 2.8, rot: 1.4 },
  { kind: 'tent', at: [-150, -1202], w: 4.6, l: 6, h: 3, rot: 1.9 }, { kind: 'tent', at: [-104, -1214], w: 4.2, l: 5.2, h: 2.8, rot: 1.65 },
  { kind: 'fly', at: [-100, -1180], w: 9, l: 12, h: 3.4, rot: 1.7 },
  { kind: 'hut', at: [-172, -1186], w: 9, l: 12, h: 4, stilt: 3.2, rot: 1.6 },
  { kind: 'fire', at: [-112, -1168] }, { kind: 'crates', at: [-140, -1220] }, { kind: 'crates', at: [-92, -1196] },
  { kind: 'flag', at: [-88, -1172], h: 9 },
];

// the falls: the Great Falls (behind the 9th green) and Nest Falls (behind the 6th green) have their own data in
// world.mjs; ribbon falls come down the walls at the other bays, each from the wall's top to its foot
const at_ = (th, r) => { const a = th * Math.PI / 180; return [VALLEY.c[0] + Math.sin(a) * r, VALLEY.c[1] - Math.cos(a) * r]; };
export const FALLS = [
  { name: 'Great Falls', lip: GREAT_FALLS.lip, foot: GREAT_FALLS.foot, w: GREAT_FALLS.w, big: true },
  { name: 'Nest Falls', lip: NEST_FALLS.lip, foot: NEST_FALLS.pool.c, w: 16 },
  // its stream spills off the bluff's lip in a cascade to the floor, where the creek begins
  { name: 'Nest Falls cascade', lip: NEST_FALLS.cascade.top, foot: NEST_FALLS.cascade.foot, w: 5, fixed: true },
  ...BAYS.slice(1, 5).map((b, i) => { const r = footR(b.th); return { name: 'falls', lip: at_(b.th, r + 72 + (topY(b.th) - VALLEY.floor - 45) / 6.5), foot: at_(b.th, r + 8), w: 8 + 4 * (i % 2) }; }),
  // two thin threads off the east and west walls, seen from most of the holes
  ...[[62, 7], [205, 6], [282, 6]].map(([th, w]) => { const r = footR(th); return { name: 'falls', lip: at_(th, r + 72 + (topY(th) - VALLEY.floor - 45) / 6.5), foot: at_(th, r + 8), w }; }),
];

// the animals. longneck: a sauropod 26 m long (neck up, grazing or browsing); small: an ornithopod 6 m long,
// drinking; ptero: a pterosaur in flight (y above the sea, span metres), or perched; hunter: the predator,
// 12 m long, one of it, far off at the plain herd's edge. dir: the way it faces (radians, 0 = north, + = east)
export const LIFE = [
  // the plain herd, on the open floor south of the 5th, seen from the 4th and 5th and from the ledge
  ...[[100, -170, 0.6], [150, -220, 1.1], [60, -250, 2.4], [190, -140, 0.2], [20, -140, 3.6], [120, -310, 1.8], [230, -270, 0.9], [-30, -240, 4.4]]
    .map(([x, z, d], i) => ({ kind: 'longneck', at: [x, z], dir: d, len: 22 + (i * 7) % 8, browse: i % 3 === 0 })),
  // the east meadow herd, across the river from the 4th, and three wading the shallows beside its second leg
  ...[[880, -1250, 4.0], [930, -1320, 3.4], [840, -1340, 4.6], [900, -1180, 3.0]].map(([x, z, d], i) => ({ kind: 'longneck', at: [x, z], dir: d, len: 22 + i * 2 })),
  ...[[452, -1175, 4.3], [468, -1210, 4.5], [446, -1240, 4.1]].map(([x, z, d], i) => ({ kind: 'longneck', at: [x, z], dir: d, len: 24 - i * 2, wade: true })),
  // small plant-eaters drinking at the river's edge below the 4th's first leg
  ...[[432, -994, 1.5], [440, -1006, 1.3], [428, -1016, 1.7], [446, -1022, 1.2], [436, -980, 1.6]].map(([x, z, d]) => ({ kind: 'small', at: [x, z], dir: d, len: 6.5, drink: true })),
  // the hunter, far off at the plain herd's edge, watching
  { kind: 'hunter', at: [-110, -280], dir: 1.4, len: 12 },
  // pterosaurs: wheeling over the nests above the 6th green, along the north-east wall, over the river
  ...[[960, -640, 520, 0.4], [1000, -720, 560, 2.2], [930, -760, 600, 4.1], [1020, -600, 590, 5.3], [900, -690, 545, 3.0]].map(([x, z, y, d]) => ({ kind: 'ptero', at: [x, z], y, dir: d, span: 6.5 })),
  ...[[640, -1700, 560, 1.2], [760, -1600, 620, 2.6], [420, -1260, 470, 0.5], [-200, -900, 520, 5.6], [60, -1400, 600, 3.8]].map(([x, z, y, d]) => ({ kind: 'ptero', at: [x, z], y, dir: d, span: 7 })),
  // the nests: on the ledges of the east wall's face above the 6th green and Nest Falls
  ...[[1084, -640, 488], [1090, -666, 512], [1086, -738, 495], [1096, -760, 530], [1092, -620, 505], [1100, -700, 520]].map(([x, z, y]) => ({ kind: 'nest', at: [x, z], y })),
];
