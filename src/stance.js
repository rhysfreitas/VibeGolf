// "Standing over the ball" camera framing, shared by the range and the course.
// The camera sits a few steps behind the ball at about eye height and pitches so the
// ball lands near the bottom centre of the screen, whatever the screen's shape.

export const STANCE = {
  back: 3.2,      // metres behind the ball
  up: 1.55,       // metres above the ball (roughly eye height when standing behind it)
  fov: 50,        // vertical field of view the framing is solved for
  ballAt: 0.88,   // where the ball sits on screen: 0 = top edge, 1 = bottom edge
};

const MARGIN = 0.12; // radians kept between a tracked ball and the top edge

// ball: THREE.Vector3, dir: unit THREE.Vector3 (horizontal aim direction), vfovDeg: the camera's
// actual vertical fov. Options override STANCE; `keep` is a point (a ball in flight) the view
// pitches up just enough to hold in frame; `groundAt(x, z)` keeps the camera above the ground.
export function stanceView(ball, dir, vfovDeg, opts = {}) {
  const o = { ...STANCE, ...opts };
  const pos = ball.clone().addScaledVector(dir, -o.back);
  pos.y += o.up;
  if (o.groundAt) { const g = o.groundAt(pos.x, pos.z); if (g !== null && g !== undefined) pos.y = Math.max(pos.y, g + 0.5); }
  const half = vfovDeg * Math.PI / 360;
  const alpha = Math.atan2(pos.y - ball.y, o.back);                 // ball's angle below horizontal
  const beta = Math.atan((2 * o.ballAt - 1) * Math.tan(half));      // its wanted angle below the view centre
  let pitch = alpha - beta;                                         // view pitch, positive = looking down
  if (o.keep) {
    const horiz = Math.max(1, (o.keep.x - pos.x) * dir.x + (o.keep.z - pos.z) * dir.z);
    const ang = Math.atan2(o.keep.y - pos.y, horiz);
    const top = half - pitch;
    if (ang > top - MARGIN) pitch -= ang - (top - MARGIN);
  }
  const look = pos.clone().addScaledVector(dir, 100);
  look.y = pos.y - 100 * Math.tan(pitch);
  return { pos, look };
}
