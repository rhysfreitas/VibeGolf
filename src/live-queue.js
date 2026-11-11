// A real swing that arrives a moment before the game is ready for it (the last ball still rolling, the
// landing view, the next player's banner) is held and played as soon as the game is ready, instead of
// being lost. Pure: no DOM. One shot is held at most (a newer one replaces it), and only for `maxAge` ms:
// a swing made long before the game was ready wasn't meant for the shot that follows.
//
//   const q = createLiveQueue({ ready: () => phase === 'aim', canHold: () => phase !== 'setup', play: shot => launch(shot) });
//   launchMonitor.addEventListener('shot', e => q.push(e.detail));   // 'played' | 'held' | 'dropped'
//   ...when the game becomes ready: q.flush();                       // true when it played the held shot
export function createLiveQueue({ ready, play, canHold = () => true, maxAge = 6000, now = () => Date.now(), onHold = null, onDrop = null }) {
  let held = null;
  return {
    push(shot) {
      if (ready()) { held = null; play(shot); return 'played'; }
      if (!canHold()) { if (onDrop) onDrop(shot, 'not-playing'); return 'dropped'; }
      held = { shot, at: now() };
      if (onHold) onHold(shot);
      return 'held';
    },
    flush() {
      if (!held || !ready()) return false;
      const h = held; held = null;
      if (now() - h.at > maxAge) { if (onDrop) onDrop(h.shot, 'too-early'); return false; }
      play(h.shot);
      return true;
    },
    clear() { held = null; },
    get pending() { return held ? held.shot : null; },
  };
}
