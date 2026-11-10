// node tools/review/pick.mjs <course> <hole> <view> <px> <py> [<px> <py> ...]
// What's at a pixel of a review render? Rebuilds the view (tee | land | green, as views.mjs renders it at
// 1280x720, or a pose written x,y,z:lx,ly,lz:fov in the hole's frame) and casts a ray through each pixel.
// Prints the first things it meets (mesh, material, colour, texture, instance), what the hole's terrain
// says is there (surface, rock), or "background" when the ray reaches the sky or nothing at all.
// Use it on anything odd in a render: a white patch, a slab over a tee, a floating plane.
import { createTerrain } from '../../src/course/terrain.js';
import { openCourse, loadCourse, viewPoses, goHole, setPose } from './page.mjs';
const [course, hs, view, ...px] = process.argv.slice(2);
if (!course || !hs || !view || px.length < 2) { console.log('usage: pick.mjs <course> <hole> <tee|land|green|x,y,z:lx,ly,lz:fov> <px> <py> ...'); process.exit(1); }
const { HOLES, COURSE } = await loadCourse(course);
const n = +hs, h = HOLES[n - 1], T = createTerrain(h);
const pose = viewPoses(h, T, COURSE)[view] || (() => { const [p, l, f] = view.split(':'); return { pos: p.split(',').map(Number), look: l.split(',').map(Number), fov: +(f || 60) }; })();
const { browser, page: pg, errs } = await openCourse(course, { width: 1280, height: 720, clean: true });
await goHole(pg, n); await setPose(pg, pose);
const pts = []; for (let i = 0; i + 1 < px.length; i += 2) pts.push([+px[i], +px[i + 1]]);
const res = await pg.evaluate(({ P, pts }) => {
  const cam = new THREE.PerspectiveCamera(P.fov, 1280 / 720, 0.05, 20000); cam.position.set(...P.pos); cam.lookAt(...P.look); cam.updateMatrixWorld();
  const ms = []; __scene.traverseVisible(o => { if (o.isMesh) ms.push(o); });
  const rc = new THREE.Raycaster(), path = o => { const a = []; for (let q = o; q && q !== __scene; q = q.parent) a.push(q.name || q.type); return a.join(' < '); };
  return pts.map(([x, y]) => {
    rc.setFromCamera(new THREE.Vector2(x / 640 - 1, 1 - y / 360), cam);
    const hits = rc.intersectObjects(ms, false).filter(hh => hh.distance < 15000).slice(0, 3);
    return { x, y, hits: hits.map(hh => { const o = hh.object, m = Array.isArray(o.material) ? o.material[0] : o.material, C = o.geometry.attributes.color;
      return { d: +hh.distance.toFixed(1), at: hh.point.toArray().map(v => +v.toFixed(1)), mesh: `${o.type}#${o.id}`, path: path(o), mat: m.type, col: m.color && m.color.getHexString(),
        vcol: C && hh.face ? [0, 1, 2].map(i => +C.array[hh.face.a * C.itemSize + i].toFixed(2)) : undefined, map: !!m.map, uv: hh.uv && hh.uv.toArray().map(v => +v.toFixed(3)),
        alphaTest: m.alphaTest || undefined, transparent: m.transparent || undefined, opacity: m.transparent ? m.opacity : undefined, instance: hh.instanceId, renderOrder: o.renderOrder || undefined, bigSky: o.scale.x > 1000 || hh.distance > 4000 || undefined }; }) };
  });
}, { P: pose, pts });
for (const r of res) {
  console.log(`pixel ${r.x},${r.y}:`);
  if (!r.hits.length || r.hits[0].bigSky) console.log('  background (sky or nothing): if this is below the horizon, there is a hole in the world here');
  for (const hh of r.hits) {
    const [x, y, z] = hh.at, g = T.groundAt(x, z), s = T.surfaceAt(x, z), rock = T.solidAt(x, y - 0.05, z);
    console.log(`  ${hh.d} m ${hh.mesh} (${hh.path}) ${hh.mat} col ${hh.col}${hh.vcol ? ' vertex ' + hh.vcol : ''}${hh.map ? ' textured uv ' + hh.uv : ''}${hh.instance !== undefined ? ' instance ' + hh.instance : ''}${hh.transparent ? ' transparent ' + hh.opacity : ''}${hh.alphaTest ? ' alphaTest' : ''}${hh.renderOrder ? ' order ' + hh.renderOrder : ''}`);
    console.log(`     at [${hh.at}]  terrain: ground ${g === null ? 'none (open air)' : g.toFixed(2)}, surface ${s}${rock ? ', inside rock' + (rock.soak ? ' (soak ' + rock.soak + ')' : '') : ''}${g !== null && y > g + 0.6 ? ', ' + (y - g).toFixed(1) + ' m above the ground' : ''}`);
  }
}
if (errs.length) console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
