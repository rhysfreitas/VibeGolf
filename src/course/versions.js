// A course's rolls: something rolled once a round, like the pins, that changes how some holes play (Emerald Bay's
// tide; later the Labyrinth's doors). Pure: no DOM, no Three.js.
//
// COURSE.rolls = [{ id, name, options: [{ id, name, sea? }] }]: each roll and its options. An option with `sea` sets
// the sea level for every hole (metres, in the course's world heights; a hole's field is in its own frame, so the
// hole gets sea - frame.base): ground below it plays as water (terrain.js).
// hole.versionBy = a roll's id; hole.versions = [{ id (an option's id), note, targets, yards, tipsYards? }]: the hole
// as it plays with that option. A hole without versions plays the same whatever was rolled.

// one option per roll, at random (rand is any 0..1 generator, so tests can pin it)
export function rollPicks(rolls, rand = Math.random) {
  const out = {};
  for (const r of rolls || []) out[r.id] = r.options[Math.min(r.options.length - 1, Math.floor(rand() * r.options.length))].id;
  return out;
}

// picks that name a real option for every roll (a saved round's, say), else null
export function checkPicks(rolls, picks) {
  if (!rolls || !rolls.length) return {};
  if (!picks || typeof picks !== 'object') return null;
  const out = {};
  for (const r of rolls) { if (!r.options.some(o => o.id === picks[r.id])) return null; out[r.id] = picks[r.id]; }
  return out;
}

const optionOf = (rolls, picks, id) => { const r = (rolls || []).find(q => q.id === id); return r ? r.options.find(o => o.id === picks[id]) || r.options[0] : null; };

// The holes as they play with these picks: each versioned hole gets its version's targets, yards, tips yards and note
// (hole.version, hole.versionNote); every hole gets the sea level of any roll that sets one (hole.sea, in its frame).
// Changes the hole objects in place, so the rest of the game reads them as usual.
export function applyPicks(course, holes, picks) {
  const rolls = course.rolls || [];
  let sea = null;
  for (const r of rolls) { const o = optionOf(rolls, picks, r.id); if (o && Number.isFinite(o.sea)) sea = o.sea; }
  for (const h of holes) {
    h.sea = sea === null ? undefined : sea - ((h.frame && h.frame.base) || 0);
    if (!h.versions || !h.versionBy) continue;
    const o = optionOf(rolls, picks, h.versionBy), v = h.versions.find(q => q.id === (o && o.id)) || h.versions[0];
    h.version = v.id; h.versionNote = v.note || '';
    if (v.targets) h.targets = v.targets;
    if (v.yards) h.yards = v.yards;
    if (h.tips && v.tipsYards) h.tips = { ...h.tips, yards: v.tipsYards };
  }
  return holes;
}

// "High tide" for the scorecard and the setup screen: each roll's option by name
export function picksLabel(rolls, picks) {
  return (rolls || []).map(r => (optionOf(rolls, picks, r.id) || {}).name).filter(Boolean).join(' · ');
}
