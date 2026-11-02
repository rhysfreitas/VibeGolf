// The Aerie — course data.
// Each hole lives in its own frame: tee near the origin, play heading roughly -z, units in metres.
//
// islands: { x, z, rx, rz, rot, top, depth, kind, seed, ... }
//   kind     'tee' | 'fairway' | 'rough' | 'green'
//   top      height of the playing surface (m); depth = how far the rock hangs below it
//   green    { x, z, r } putting surface (green islands only); pin: [x, z]
//   bunkers  [[x, z, r], ...]; falls: [angle, ...] waterfalls off the rim; trees: count override
// drops:   penalty drop spots, used when a ball goes into the clouds
// targets: course-management picks shown to the player; { pin: true } aims at the flag
// The course builder will read and write this same shape.

export const COURSE = { name: 'The Aerie' };

export const HOLES = [
  {
    name: 'The Shelf', par: 4, yards: 408,
    blurb: 'The big fairway island straight ahead is the safe play, but it leaves a mid-iron across open sky. Carry about 245 to the shelf on the right and you have a short iron in, with nothing under you if you come up short.',
    tee: [0, -4],
    islands: [
      { x: 0, z: 4, rx: 14, rz: 18, top: 0, depth: 230, kind: 'tee', seed: 1 },
      { x: -6, z: -200, rx: 27, rz: 64, rot: 0.08, top: -7, depth: 320, kind: 'fairway', seed: 2, falls: [3.05] },
      { x: 55, z: -238, rx: 17, rz: 22, rot: -0.35, top: -4, depth: 190, kind: 'fairway', seed: 3 },
      { x: 28, z: -302, rx: 9, rz: 9, top: -10, depth: 110, kind: 'rough', seed: 4, trees: 5 },
      { x: 82, z: -338, rx: 25, rz: 27, top: -2, depth: 270, kind: 'green', seed: 5, green: { x: 82, z: -341, r: 15 }, pin: [86, -347], bunkers: [[66, -331, 4.2]], falls: [0.4] },
    ],
    drops: [[-4, -248], [28, -302], [62, -322]],
    targets: [
      { name: 'Fairway', x: -6, z: -205 },
      { name: 'The shelf', x: 55, z: -236 },
      { name: 'Green', pin: true },
    ],
  },
  {
    name: 'Lantern', par: 3, yards: 171,
    blurb: 'An island green fourteen metres below the tee, so it plays about a club less than the number. Short-left is a bailout ledge. Anything long or right is gone.',
    tee: [0, -4],
    islands: [
      { x: 0, z: 4, rx: 14, rz: 16, top: 0, depth: 220, kind: 'tee', seed: 11 },
      { x: -42, z: -112, rx: 13, rz: 11, top: -9, depth: 140, kind: 'fairway', seed: 12, trees: 3 },
      { x: -8, z: -150, rx: 21, rz: 19, top: -14, depth: 260, kind: 'green', seed: 13, green: { x: -8, z: -151, r: 14 }, pin: [-4, -156], bunkers: [[7, -141, 3.6]], falls: [5.2] },
    ],
    drops: [[-42, -112], [-14, -128]],
    targets: [
      { name: 'Green', pin: true },
      { name: 'Bailout', x: -42, z: -112 },
    ],
  },
  {
    name: 'Long Way Round', par: 5, yards: 538,
    blurb: 'Find the fairway, then decide. The layup island on the left sets up a wedge in three. Going for the green in two takes about 230 yards of carry over nothing, with a small ledge halfway that catches the brave and the short.',
    tee: [0, -4],
    islands: [
      { x: 0, z: 4, rx: 14, rz: 18, top: 0, depth: 230, kind: 'tee', seed: 21 },
      { x: 4, z: -215, rx: 30, rz: 62, rot: -0.05, top: -5, depth: 330, kind: 'fairway', seed: 22, falls: [0.1] },
      { x: 12, z: -342, rx: 10, rz: 11, top: -8, depth: 120, kind: 'rough', seed: 23, trees: 4 },
      { x: -64, z: -372, rx: 26, rz: 30, rot: 0.2, top: 3, depth: 290, kind: 'fairway', seed: 24, falls: [3.4] },
      { x: 18, z: -462, rx: 27, rz: 26, top: 1, depth: 300, kind: 'green', seed: 25, green: { x: 18, z: -465, r: 16 }, pin: [23, -471], bunkers: [[2, -449, 4.4], [35, -481, 3.4]] },
    ],
    drops: [[4, -262], [12, -342], [-64, -372], [16, -436]],
    targets: [
      { name: 'Fairway', x: 4, z: -212 },
      { name: 'Layup island', x: -62, z: -372 },
      { name: 'Go for it', pin: true },
    ],
  },
];
