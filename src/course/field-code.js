// How a sampled height grid (a hole's `field.h`, Rimeholm's far-glacier map) is packed before base64.
// Ground is smooth, so each cell is stored as its difference from a prediction off its neighbours
// (left + above − above-left; just the left cell on the first row, the one above on the first column, or
// where a neighbour is open air). The differences are small and repeat, so the served (gzipped) course
// module is about half the size it was with plain heights. Pure; the emitters and the game share it.
// -32768 marks open air and is always stored as itself.
const GAP = -32768;
function predicted(q, p, nx) {
  const i = p % nx;
  if (!i) return p >= nx ? q[p - nx] : 0;
  const left = q[p - 1];
  if (p < nx) return left;
  const up = q[p - nx], ul = q[p - nx - 1];
  return left === GAP || up === GAP || ul === GAP ? left : left + up - ul;
}
// heights (Int16Array, row-major, nx wide) -> differences
export function packHeights(q, nx) {
  const d = new Int16Array(q.length);
  for (let p = 0; p < q.length; p++) {
    const v = q[p], pr = predicted(q, p, nx);
    if (v === GAP || pr === GAP) { d[p] = v; continue; }
    d[p] = v - pr;
    if (d[p] === GAP) throw new Error('field-code: a step of exactly 32768 cannot be stored');
  }
  return d;
}
// differences -> heights, in place
export function unpackHeights(d, nx) {
  for (let p = 0; p < d.length; p++) {
    const pr = predicted(d, p, nx);   // every neighbour it reads is already unpacked
    if (d[p] !== GAP && pr !== GAP) d[p] = (pr + d[p]) << 16 >> 16;
  }
  return d;
}
