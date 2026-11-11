// The feel-tag row under the range readout: after a recorded shot, tap how it felt (optional).
// Tags go into the session record (src/recorder.js); a second tap on the same tag clears it.
import { recorder, FEELS, FEEL_NAMES } from '../recorder.js';

export function createFeelRow({ parent }) {
  const row = document.createElement('div');
  row.className = 'feel glass'; row.hidden = true; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'How did it feel?');
  row.innerHTML = `<span class="lbl">Feel</span>${FEELS.map(f => `<button type="button" data-f="${f}" aria-pressed="false">${FEEL_NAMES[f]}</button>`).join('')}`;
  parent.appendChild(row);
  let id = null;
  const render = () => { const rec = id && recorder.get(id); for (const b of row.querySelectorAll('button')) b.setAttribute('aria-pressed', String(!!rec && rec.feel === b.dataset.f)); };
  row.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !id) return;
    e.stopPropagation();
    const rec = recorder.get(id); recorder.tag(id, rec && rec.feel === b.dataset.f ? null : b.dataset.f); render();
  });
  row.addEventListener('pointerdown', e => e.stopPropagation());
  return {
    show(recId) { id = recId; row.hidden = false; render(); },
    hide() { row.hidden = true; },
    get el() { return row; },
  };
}
