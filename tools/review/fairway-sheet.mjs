// node tools/review/fairway-sheet.mjs out.svg
// Every par 4 and par 5 fairway on the playable courses, straightened along its playing line (width and where the
// middle sits), on one white sheet, named by alike.mjs. Red = a plain strip. For before-and-after proposals.
import { courseFairways } from './alike.mjs';
import fs from 'fs';
const C = [['aerie','The Aerie'],['redmesa','Red Mesa'],['hollowmere','Hollowmere'],['reclaim','The Reclaim'],['rimeholm','Rimeholm']];
const CW = 150, RH = 250, X0 = 20, Y0 = 70; let out = '';
const col = { spindle:'#c0392b', ribbon:'#c0392b', uneven:'#c0392b' };
for (let ci = 0; ci < C.length; ci++) {
  const F = (await courseFairways(C[ci][0])).filter(f => f.sig);
  out += `<text x="${X0}" y="${Y0 + ci*RH - 8}" font-size="17" font-weight="700">${C[ci][1]}</text>`;
  F.forEach((f, i) => {
    const s = f.sig, n = s.w.length, cx = X0 + i*CW + CW/2, top = Y0 + ci*RH + 10, H = 170, sc = 0.9 * s.meanW * (H / s.len);
    // straightened: tee at the bottom, green at the top; lanes ignored (outline of total width about its middle)
    const L = [], R = [];
    for (let k = 0; k < n; k++) { const y = top + H - k/(n-1)*H, c = s.c[k]*sc, w = s.w[k]*sc/2; L.push([cx + c - w, y]); R.push([cx + c + w, y]); }
    const pts = [...L, ...R.reverse()].map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    const plain = col[s.form];
    out += `<polygon points="${pts}" fill="${plain ? '#f3c9c3' : '#bfe3b4'}" stroke="${plain || '#2e7d32'}" stroke-width="1.5"/>`;
    out += `<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top+H}" stroke="#999" stroke-dasharray="3 3" stroke-width="0.7"/>`;
    out += `<text x="${cx}" y="${top+H+16}" font-size="11.5" text-anchor="middle">${f.n} ${f.name}</text><text x="${cx}" y="${top+H+31}" font-size="11.5" text-anchor="middle" fill="${plain || '#2e7d32'}" font-weight="700">${s.form}</text>`;
  });
}
const W = X0*2 + 7*CW, Ht = Y0 + C.length*RH;
fs.writeFileSync(process.argv[2], `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Ht}" font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="${X0}" y="28" font-size="20" font-weight="700">Every par 4 and par 5 fairway, straightened along its playing line (tee at the bottom)</text><text x="${X0}" y="46" font-size="12" fill="#555">Width and where the middle sits against the line. Red = a plain strip (spindle or uneven). Gaps, lanes and islands are not drawn; the label names them.</text>${out}</svg>`);
