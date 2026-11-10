// node tools/review/seethrough.mjs <course> [holes...] [--only=tee,land,green]
// Holes in the world: renders each review view with the sky, the clouds and the fog off and a magenta
// background, then counts the magenta pixels whose ray points below the horizon (you are looking down
// and see past the ground: a gap in the playfield, a missing wall, a chasm with no floor). Pixels within
// 3 degrees of the horizon are counted apart as the far edge (where the world's ground ends; the fog
// normally hides it). Views with any get a mask, tools/review/out/<course>_v<n>_<view>_gaps.png: gaps
// in red, the far edge in orange, over the view.
// pick.mjs tells you what's around a gap. Not for the Aerie: open sky below the islands is the design.
// About a minute a view.
import fs from 'fs';
import { createTerrain } from '../../src/course/terrain.js';
import { openCourse, loadCourse, OUT, viewPoses, goHole, setPose } from './page.mjs';
const args = process.argv.slice(2), course = args[0] || 'reclaim';
const only = (args.find(a => a.startsWith('--only=')) || '--only=tee,land,green').slice(7).split(',');
const { HOLES, COURSE } = await loadCourse(course);
let holes = args.slice(1).filter(a => !a.startsWith('--')).map(Number);
if (!holes.length) holes = HOLES.map((_, i) => i + 1);
const W = 960, H = 540;
const { browser, page: pg, errs } = await openCourse(course, { width: W, height: H, clean: true });
let total = 0;
for (const n of holes) {
  const h = HOLES[n - 1], P = viewPoses(h, createTerrain(h), COURSE);
  await goHole(pg, n);
  for (const v of only) {
    await setPose(pg, P[v]);
    const r = await pg.evaluate(({ P, W, H }) => {
      const S = __scene, hid = [], bg = S.background, fog = S.fog;
      S.traverse(o => { if (!o.isMesh || !o.visible) return; const m = o.material;
        if (o.scale.x > 1000 || o.renderOrder < 0 || (m && m.uniforms && (m.uniforms.sunPosition || m.uniforms.uCov))) { hid.push(o); o.visible = false; } });
      S.background = new THREE.Color(1, 0, 1); S.fog = null;
      const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      __advance(1 / 60, 1);
      const w = gl.drawingBufferWidth, hgt = gl.drawingBufferHeight, px = new Uint8Array(w * hgt * 4);
      gl.readPixels(0, 0, w, hgt, gl.RGBA, gl.UNSIGNED_BYTE, px);
      S.background = bg; S.fog = fog; for (const o of hid) o.visible = true;
      // rays through each pixel, from the same pose
      const cam = new THREE.PerspectiveCamera(P.fov, W / H, 0.05, 20000); cam.position.set(...P.pos); cam.lookAt(...P.look); cam.updateMatrixWorld();
      const dir = new THREE.Vector3(), out = document.createElement('canvas'); out.width = w; out.height = hgt;
      const g2 = out.getContext('2d'), img = g2.createImageData(w, hgt); let gaps = 0, edge = 0;
      for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
        const i = ((hgt - 1 - y) * w + x) * 4, o = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
        const mag = r > 230 && g < 30 && b > 230;
        let down = false, far = false;
        if (mag) { dir.set((x + 0.5) / w * 2 - 1, 1 - (y + 0.5) / hgt * 2, 0.5).unproject(cam).sub(cam.position).normalize(); down = dir.y < -0.052; far = !down && dir.y < -0.01; }
        const L = (r * 0.3 + g * 0.59 + b * 0.11) * 0.55 + 100;
        if (mag && down) { gaps++; img.data[o] = 230; img.data[o + 1] = 20; img.data[o + 2] = 20; }
        else if (mag && far) { edge++; img.data[o] = 245; img.data[o + 1] = 150; img.data[o + 2] = 30; }
        else if (mag) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 245; }
        else { img.data[o] = img.data[o + 1] = img.data[o + 2] = L; }
        img.data[o + 3] = 255;
      }
      g2.putImageData(img, 0, 0);
      __advance(1 / 60, 1);
      return { gaps, edge, share: gaps / (w * hgt), png: gaps + edge ? out.toDataURL('image/png').split(',')[1] : null };
    }, { P: P[v], W, H });
    total += r.gaps;
    const f = `${OUT}/${course}_v${n}_${v}_gaps.png`;
    if (r.png) fs.writeFileSync(f, Buffer.from(r.png, 'base64')); else if (fs.existsSync(f)) fs.unlinkSync(f);
    console.log(`hole ${n} ${h.name} ${v}: ${r.gaps ? `${r.gaps} px (${(r.share * 100).toFixed(2)}%) see through below the horizon` : 'nothing to see through'}${r.edge ? `, far edge ${r.edge} px` : ''}${r.png ? ' -> ' + f : ''}`);
  }
}
console.log(total ? `gaps found: ${total} px in all` : 'no gaps', errs.length ? 'errors ' + JSON.stringify(errs.slice(0, 5)) : '');
await browser.close();
