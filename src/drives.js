// Recent driver distances (total yards), shared by the range and the courses so a round can
// suggest a tee set. Device-local; a failing localStorage just means no suggestion.
const KEY = 'vibegolf.drives.v1', MAX = 30;

export function recentDrives() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(n => n > 40 && n < 420) : []; } catch (e) { return []; }
}
export function recordDrive(totalYd) {
  if (!(totalYd > 40 && totalYd < 420)) return;
  try { const a = recentDrives(); a.push(Math.round(totalYd)); localStorage.setItem(KEY, JSON.stringify(a.slice(-MAX))); } catch (e) { /* storage off */ }
}
