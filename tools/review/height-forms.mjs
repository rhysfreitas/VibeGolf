// node tools/review/height-forms.mjs
// The height forms on one sheet (docs/height-forms.svg): what the ground can do on a hole besides ramp gently up or
// down. Each is a ground function the check (relief.mjs heightForm) names, so the picture and the measurement agree.
// FORMS is the worked data: { name, par, len, ground(s, off), plays }, s along the line from the tee, off across it.
import fs from 'fs';
import path from 'path';
import { heightForm } from './relief.mjs';
import { REPO } from './page.mjs';

const ss = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const bump = (s, c, w) => Math.exp(-((s - c) ** 2) / (2 * w * w));
const L = 380;
export const FORMS = [
  { name: 'table top', par: 4, len: L, ground: s => 7 * ss((s - 150) / 20) + 1.2 * ss((s - 310) / 60),
    plays: 'A face under a level top. Short of it: a blind second from below. On top: a flat lie and the view. The longest can fly it all.' },
  { name: 'hillside bench', par: 4, len: L, ground: (s, o) => 8 * s / L + 0.09 * o, cross: true,
    plays: 'Cut along a slope, sideways and up, 8–12%. Everything feeds low; the high side has the angle; the ball is above or below your feet.' },
  { name: 'valley carry', par: 4, len: L, ground: s => -9 * bump(s, 110, 38) + 9 * bump(0, 110, 38),
    plays: 'Tee and landing area both high, a deep dip between. The drive that does not carry rolls back to the bottom.' },
  { name: 'stepped', par: 4, len: L, ground: s => 3.5 * ss((s - 120) / 15) + 3.5 * ss((s - 235) / 15),
    plays: 'Two or three levels. The upper one sees the green; the lower is easier to reach and leaves it blind.' },
  { name: 'crest and run', par: 4, len: L, ground: s => 7.5 * bump(s, 150, 40) - 3 * ss((s - 170) / 90),
    plays: 'Carry the crest and the far slope adds 30–40 yd. Land short and the ball stops on the upslope.' },
  { name: "hog's back", par: 4, len: L, ground: (s, o) => 2 * s / L - 1.3 * Math.min(4, (o / 12) ** 2), cross: true,
    plays: 'A crowned fairway that sheds a ball to either side. Only the spine holds.' },
  { name: 'half-pipe', par: 4, len: L, ground: (s, o) => -3 * s / L + 1.6 * Math.min(4, (o / 12) ** 2), cross: true,
    plays: 'A valley fairway whose banks feed a loose drive back to the middle. A helper: good for an opener.' },
  { name: 'perched green', par: 4, len: L, ground: s => 5.5 * ss((s - (L - 42)) / 28),
    plays: 'A green up on a knob behind a steep front. Short rolls back 20 yd; the shot must carry all the way.' },
  { name: 'dip in front', par: 4, len: L, ground: s => -3.8 * bump(s, L - 40, 12),
    plays: 'A deep swale just short of the green. Carry it, or run the ball down and up through it.' },
  { name: 'fall-away', par: 4, len: L, ground: s => -5.5 * ss((s - (L - 110)) / 130) * 1.25,
    plays: 'The ground runs away from you into the green. Land short and let it release; fly it to the flag and it is gone.' },
  { name: 'uphill par 3', par: 3, len: 150, ground: s => 9 * ss((s - 40) / 90),
    plays: 'Up to a shelf where only the flag shows. Club up; short comes back down the bank.' },
  { name: 'par 3 across a gulf', par: 3, len: 165, ground: s => -13 * bump(s, 82, 30) + 13 * bump(0, 82, 30),
    plays: 'Level, tee to green, with nothing between. The eye says drop; the yardage says no.' },
];
const lineOf = f => [[0, 0], [0, -f.len]];
export const formOf = f => heightForm(lineOf(f), (x, z) => f.ground(-z, x), (x, z) => Math.abs(x) < 22 && -z > 40 && -z < f.len - 18, f.par);

if (process.argv[1] && process.argv[1].endsWith('height-forms.mjs')) {
  const CW = 330, CH = 188, cols = 3, rows = Math.ceil(FORMS.length / cols), W = cols * CW + 30, Ht = rows * CH + 88;
  let out = '';
  FORMS.forEach((f, i) => {
    const x0 = 15 + (i % cols) * CW, y0 = 76 + Math.floor(i / cols) * CH, pw = f.cross ? 190 : 290, ph = 78, base = y0 + 96;
    const ys = []; for (let s = -8; s <= f.len + 22; s += 2) ys.push([s, f.ground(Math.max(0, Math.min(f.len, s)), 0) + (s > f.len ? 0 : 0)]);
    const lo = Math.min(...ys.map(p => p[1])), hi = Math.max(...ys.map(p => p[1])), sc = Math.min(4.2, (ph - 22) / Math.max(4, hi - lo));
    const X = s => x0 + 14 + (s + 8) / (f.len + 30) * pw, Y = y => base - (y - lo) * sc;
    const pts = ys.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
    out += `<rect x="${x0}" y="${y0}" width="${CW - 12}" height="${CH - 12}" rx="6" fill="#fff" stroke="#bbb"/>`;
    out += `<text x="${x0 + 12}" y="${y0 + 22}" font-size="15" font-weight="700">${f.name[0].toUpperCase() + f.name.slice(1)}</text><text x="${x0 + CW - 24}" y="${y0 + 22}" font-size="10.5" text-anchor="end" fill="#666">${formOf(f)?.form === f.name ? 'the check names it' : 'check: ' + formOf(f)?.form}</text>`;
    out += `<polygon points="${X(-8)},${base + 14} ${pts} ${X(f.len + 22)},${base + 14}" fill="#cfe8c4" stroke="#2e7d32" stroke-width="1.6"/>`;
    const ty = Y(f.ground(0, 0)), gy = Y(f.ground(f.len, 0));
    out += `<rect x="${X(0) - 5}" y="${ty - 3}" width="10" height="3" fill="#555"/><text x="${X(0)}" y="${ty - 7}" font-size="9.5" text-anchor="middle" fill="#555">tee</text>`;
    out += `<line x1="${X(f.len)}" y1="${gy}" x2="${X(f.len)}" y2="${gy - 20}" stroke="#333" stroke-width="1.2"/><polygon points="${X(f.len)},${gy - 20} ${X(f.len) + 9},${gy - 16} ${X(f.len)},${gy - 12}" fill="#c0392b"/>`;
    if (f.cross) {
      const cx = x0 + 262, cw = 44, cs = [];
      for (let o = -24; o <= 24; o += 2) cs.push([o, f.ground(230, o) - f.ground(230, 0)]);
      const cl = Math.min(...cs.map(p => p[1])), csc = Math.min(5, 34 / Math.max(2, Math.max(...cs.map(p => p[1])) - cl)), cb = base - 4;
      out += `<polygon points="${cx - cw},${cb + 12} ${cs.map(p => `${(cx + p[0] / 24 * cw).toFixed(1)},${(cb - (p[1] - cl) * csc).toFixed(1)}`).join(' ')} ${cx + cw},${cb + 12}" fill="#e8dcc4" stroke="#8a6d3b" stroke-width="1.4"/><text x="${cx}" y="${y0 + 44}" font-size="9.5" text-anchor="middle" fill="#8a6d3b">across the fairway</text>`;
    }
    const words = f.plays.split(' '); let line = '', ly = y0 + 134;
    for (const w of words) { if ((line + ' ' + w).length > 56) { out += `<text x="${x0 + 12}" y="${ly}" font-size="11" fill="#222">${line.trim()}</text>`; ly += 14; line = w; } else line += ' ' + w; }
    out += `<text x="${x0 + 12}" y="${ly}" font-size="11" fill="#222">${line.trim()}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Ht}" font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="15" y="28" font-size="20" font-weight="700">Height forms: what the ground can do on a hole</text><text x="15" y="46" font-size="12" fill="#555">Side profiles, tee on the left, heights drawn about four times too tall. Each is at its plainest: fit it to the land and pair it with a fairway form.</text><text x="15" y="61" font-size="12" fill="#555">Not drawn: saddle (through a notch between two knolls), reverse camber (a dogleg leaning out of its bend), kick plate (a bank that feeds a green).</text>${out}</svg>`;
  fs.writeFileSync(path.join(REPO, 'docs/height-forms.svg'), svg);
  for (const f of FORMS) console.log(f.name, '->', formOf(f)?.form, formOf(f)?.also.join(','));
}
