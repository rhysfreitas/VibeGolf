// Remembers the window's size, place, display and full screen between runs. A saved place that no longer
// lands on a display (the projector unplugged) falls back to a centred window on the main one.
'use strict';
const DEFAULT = { width: 1280, height: 800 };

function visible(b, displays) {
  return displays.some(d => {
    const a = d.workArea;
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return w >= 200 && h >= 120;
  });
}

function restore(saved, displays) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const b = s.bounds;
  const ok = b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width >= 400 && b.height >= 300 && visible(b, displays);
  return { bounds: ok ? b : { ...DEFAULT }, maximized: !!(ok && s.maximized), fullscreen: !!(ok && s.fullscreen) };
}

module.exports = { restore, visible, DEFAULT };
