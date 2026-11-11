// node tools/review/forms.mjs
// Draws docs/fairway-forms.svg: the fairway forms in docs/COURSE-DESIGN.md "Fairway forms", each built with the plan
// tools' makeFairway (tools/lostvalley/shapes.mjs: ribbons `e`, free shapes `lobes`, cut-outs `bite`) and named by
// tools/review/alike.mjs, so the picture, the builder and the check agree. The data here is the worked example for
// each form: copy a piece list into a hole's `fw` and adjust.
import fs from 'fs'; import path from 'path';
import { makeFairway } from '../lostvalley/shapes.mjs';
import { signature } from './alike.mjs';
import { REPO } from './page.mjs';

const LINE = [[0, 0], [0, -390]];
export const FORMS = [
  { name: 'Spindle', note: 'The stock shape: narrow, widest where drives land, narrow again. Two a nine at most.', fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 28, 28], [200, 32, 30], [250, 28, 26], [300, 20, 20], [340, 13, 14]], wob: 4 }] },
  { name: 'Hourglass (Bottle)', note: 'Wide short of the pinch, tight beyond it: lay back or thread it.', fw: [{ e: [[60, 26, 26], [120, 34, 34], [180, 30, 30], [215, 11, 11], [245, 11, 12], [285, 28, 30], [340, 22, 22]], wob: 3 }], haz: [[230, -32, 16, 20], [230, 34, 16, 20]] },
  { name: 'Fan', note: 'Opens toward the green: the further you hit it, the more room.', fw: [{ e: [[60, 9, 9], [130, 14, 16], [200, 26, 30], [270, 44, 46], [330, 52, 50], [350, 46, 44]], wob: 4 }] },
  { name: 'Funnel', note: 'Generous off the tee, closing all the way in: the long drive is the hard one.', fw: [{ e: [[60, 46, 44], [120, 48, 46], [190, 34, 32], [260, 20, 18], [340, 9, 9]], wob: 4 }] },
  { name: 'Bowl', note: 'One great basin, as wide as it is long; the ground does the work, not the edges.', fw: [{ lobes: [[190, 0, 105, 82]], wob: 7 }, { e: [[280, 16, 16], [345, 12, 12]], wob: 3 }] },
  { name: 'Hook', note: 'The fairway wraps round the hazard; the line to the green crosses it.', fw: [{ lobes: [[80, -6, 46, 26], [150, -44, 50, 30, -32], [225, -62, 46, 30, -8], [300, -34, 46, 28, 34], [345, -4, 30, 20, 50]], join: 22, wob: 4 }], haz: [[215, 4, 46, 62]] },
  { name: 'Split', note: 'Two lanes round a feature: one shorter or with the angle, one wider.', fw: [{ e: [[60, 16, 16], [120, 26, 26], [165, 34, 34]], wob: 3 }, { e: [[158, 48, -12], [220, 52, -16], [285, 40, -8]], wob: 3 }, { e: [[158, -12, 40], [220, -16, 38], [285, -8, 34]], wob: 3 }, { e: [[278, 26, 24], [345, 14, 14]], wob: 3 }], haz: [[222, 0, 44, 13]] },
  { name: 'Island (doughnut)', note: 'One fairway with a hole in it: a tree, a rock or a pot in the middle.', fw: [{ e: [[60, 18, 18], [130, 34, 34], [210, 44, 42], [280, 34, 32], [345, 16, 16]], wob: 4 }, { bite: [[205, 2, 22, 15]], wob: 2 }] },
  { name: 'Broken', note: 'A cross hazard cuts it in two: lay up short or carry it.', fw: [{ e: [[60, 18, 18], [140, 32, 32], [205, 34, 30]], wob: 4 }, { e: [[250, 30, 34], [300, 28, 28], [345, 14, 14]], wob: 4 }], haz: [[228, 0, 13, 60]] },
  { name: 'Stepping stones', note: 'Islands of fairway through the hazard: pick how many to skip.', fw: [{ lobes: [[95, 0, 44, 30]], wob: 3 }, { lobes: [[185, -22, 32, 26]], wob: 3 }, { lobes: [[260, 16, 30, 24]], wob: 3 }, { lobes: [[335, -2, 30, 22]], wob: 3 }] },
  { name: 'Double (Channel)', note: 'A second fairway out across the hazard that shortens the hole.', fw: [{ e: [[60, 16, 16], [150, 30, 24], [250, 30, 22], [345, 16, 14]], wob: 4 }, { lobes: [[215, 78, 52, 24, 8]], wob: 4 }], haz: [[205, 42, 70, 11]] },
  { name: 'Scalloped', note: 'Hazards bite in from alternate sides: the line weaves.', fw: [{ e: [[60, 30, 30], [120, 42, 42], [300, 42, 42], [345, 24, 24]], wob: 3 }, { bite: [[125, -46, 34, 34], [210, 48, 36, 36], [295, -46, 32, 34]], wob: 2 }] },
];

if (process.argv[1] && process.argv[1].endsWith('forms.mjs')) {
  const K = 0.52, PW = 190, PH = 300, COLS = 6, pad = 14, rows = Math.ceil(FORMS.length / COLS);
  const W = COLS * PW + pad * 2, H = rows * PH + 64;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>` +
    `<text x="${pad}" y="26" font-size="17" font-weight="700" fill="#222">Fairway forms</text><text x="${pad}" y="46" font-size="11" fill="#555">Tee at the bottom, green at the top. Grey is the hazard that makes the form. Each is built from the plan tools' pieces (docs/COURSE-DESIGN.md, "Fairway forms").</text>`;
  FORMS.forEach((F, i) => {
    const ox = pad + (i % COLS) * PW + PW / 2, oy = 64 + Math.floor(i / COLS) * PH + PH - 62, fd = makeFairway(LINE, F.fw), sig = signature(LINE, (x, z) => fd(x, z) < 0);
    const X = x => (ox + x * K).toFixed(1), Y = z => (oy + z * K).toFixed(1);
    for (const [s, off, ra, rc] of F.haz || []) svg += `<ellipse cx="${X(off)}" cy="${Y(-s)}" rx="${(rc * K).toFixed(1)}" ry="${(ra * K).toFixed(1)}" fill="#d9d9d9"/>`;
    for (let z = -400; z <= -30; z += 2) { let run = null; for (let x = -130; x <= 132; x += 2) { const inF = x <= 130 && fd(x, z) < 0; if (inF && run === null) run = x; if (!inF && run !== null) { svg += `<rect x="${X(run)}" y="${Y(z)}" width="${((x - run) * K).toFixed(1)}" height="${(2 * K + 0.3).toFixed(1)}" fill="#a9d68c"/>`; run = null; } } }
    svg += `<line x1="${X(0)}" y1="${Y(-12)}" x2="${X(0)}" y2="${Y(-372)}" stroke="#555" stroke-width="0.7" stroke-dasharray="3 3"/><rect x="${X(-5)}" y="${Y(-8)}" width="${(10 * K).toFixed(1)}" height="${(8 * K).toFixed(1)}" fill="#444"/>` +
      `<ellipse cx="${X(0)}" cy="${Y(-384)}" rx="${(13 * K).toFixed(1)}" ry="${(15 * K).toFixed(1)}" fill="#6fbf5a" stroke="#3d7a30" stroke-width="0.8"/>`;
    const tx = pad + (i % COLS) * PW + 6, ty = oy + 20, words = F.note.split(' '), lines = ['']; for (const w of words) { if ((lines.at(-1) + ' ' + w).length > 36) lines.push(w); else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim(); }
    svg += `<text x="${tx}" y="${ty}" font-size="12.5" font-weight="700" fill="#222">${F.name}</text>` + lines.map((l, k) => `<text x="${tx}" y="${ty + 14 + k * 11.5}" font-size="9.5" fill="#444">${l}</text>`).join('');
    console.log(F.name.padEnd(20), 'the check reads it as:', sig ? sig.form : 'no fairway');
  });
  fs.writeFileSync(path.join(REPO, 'docs', 'fairway-forms.svg'), svg + '</svg>');
  console.log('wrote docs/fairway-forms.svg');
}
