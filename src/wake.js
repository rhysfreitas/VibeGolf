// Keep the screen on while a play page is open: the phone sits beside the R10 untouched between swings,
// and a dimmed or locked screen hides the page and drops the Bluetooth link. The lock is released by the
// browser whenever the page is hidden, so it is asked for again each time the page comes back; browsers
// without the Wake Lock API (or that refuse it, as on low battery) are left alone.
let lock = null, on = false;
async function ask() {
  if (!on || lock || typeof navigator === 'undefined' || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    const l = await navigator.wakeLock.request('screen');
    if (!on) { l.release().catch(() => {}); return; }
    lock = l;
    l.addEventListener('release', () => { if (lock === l) lock = null; });
  } catch (e) { /* refused: nothing to do */ }
}
export function keepAwake() {
  if (on || typeof document === 'undefined') return;
  on = true;
  document.addEventListener('visibilitychange', ask);
  // some browsers only grant it after the first touch
  addEventListener('pointerdown', ask, { passive: true });
  ask();
}
export const wakeState = () => (lock ? 'held' : on ? 'wanted' : 'off');
