// Adaptive resolution: when frames run long (a night course on a phone), draw fewer pixels instead of
// dropping frames, and step back up when there is room again. The governor is pure (frame times in, a new
// pixel ratio out); attachAdaptiveRes wires it to a Three.js renderer.
//
// Frames are vsynced, so a fast phone never shows "spare" time: after a quiet spell the governor tries one
// step up, and if that makes frames long again it steps back and waits twice as long before the next try.
export function createResGovernor({ max, min = Math.min(max, 1.25), slowMs = 24, fastMs = 18.5, window = 40, down = 0.85, up = 1.12 } = {}) {
  let ratio = max, acc = 0, n = 0, calm = 0, wait = 6, sinceUp = 99, skip = 0;
  return {
    get ratio() { return ratio; },
    // one frame's time in ms; returns the new ratio when it changes, else null
    sample(ms) {
      if (!(ms > 0)) return null;
      if (ms > 200) { skip = 20; acc = 0; n = 0; return null; }   // a stall (a hole being built, the tab coming back), not the frame rate
      if (skip > 0) { skip--; return null; }
      acc += ms; if (++n < window) return null;
      const avg = acc / n; acc = 0; n = 0; sinceUp++;
      let next = ratio;
      if (avg > slowMs) {
        if (ratio > min) next = Math.max(min, ratio * down);
        if (sinceUp <= 3) wait = Math.min(48, wait * 2);          // the last step up was too much: try again later
        calm = 0;
      } else if (avg < fastMs && ratio < max) {
        if (++calm >= wait) { next = Math.min(max, ratio * up); calm = 0; sinceUp = 0; }
      } else calm = 0;
      if (Math.abs(next - ratio) < 0.01) return null;
      ratio = next; return ratio;
    },
  };
}

// renderer: THREE.WebGLRenderer; scene: its scene (fat-line widths are in device pixels, so they are rescaled);
// onChange(): the page's own resize (line resolutions, render targets). Call the returned tick(ms) once a frame.
export function attachAdaptiveRes(renderer, scene, onChange) {
  const gov = createResGovernor({ max: renderer.getPixelRatio() });
  return {
    get ratio() { return gov.ratio; },
    tick(ms) {
      const before = renderer.getPixelRatio(), next = gov.sample(ms);
      if (next === null) return;
      renderer.setPixelRatio(next);
      const k = next / before;
      scene.traverse(o => { const m = o.material; if (m && m.isLineMaterial) m.linewidth *= k; });
      if (onChange) onChange(next);
    },
  };
}
