import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import * as THREE from 'three';
import { stairGeo } from '../../app/src/geo.js';
import { createWalker } from '../../app/src/site.js';
import { buildHall } from '../../app/src/building.js';
import { createMonk } from '../../app/src/monk.js';

function flight(rise, edge = 0, walk) {
  const stair = stairGeo(4, rise), mesh = new THREE.Mesh(stair.geo, new THREE.MeshBasicMaterial());
  mesh.position.z = edge; mesh.updateMatrixWorld(true);
  const walker = createWalker({ walk: walk || { solids: [], decks: [], ramps: [{ x0: -1.7, x1: 1.7, z0: edge - .3, z1: edge + stair.run + .2, base: 0, h: rise, high: [0, edge], low: [0, edge + stair.run] }] } });
  const ray = new THREE.Raycaster();
  return { walker, run: stair.run, visibleHeight(x,z) { ray.set(new THREE.Vector3(x,rise+1,z),new THREE.Vector3(0,-1,0));return ray.intersectObject(mesh)[0]?.point.y ?? 0; } };
}

test('walking height agrees with actual stair geometry including the overhanging tread noses', () => {
  for (const rise of [.45, 1.5, 4, 6]) {
    const f = flight(rise);
    for (let z = .013; z < f.run + .09; z += .027) {
      assert.ok(Math.abs(f.walker.heightAt(0,z)-f.visibleHeight(0,z))<1e-5, `rise=${rise}, z=${z.toFixed(3)}: support ${f.walker.heightAt(0,z)} vs visible ${f.visibleHeight(0,z)}`);
    }
  }
});
test('hall stair collision uses the same top edge and tread spacing as its visible stairs', () => {
  const M = new Proxy({}, { get(t,k) { return k==='plaster'||k==='interior' ? ()=>t[k] ||= new THREE.MeshBasicMaterial() : t[k] ||= new THREE.MeshBasicMaterial(); } });
  const params = { xs: [-2,2], zs: [2,-2], platH: 1.5, platOut: 1.2, steps: 4 };
  const hall = buildHall(M,params), edge = 3.2, f = flight(1.5,edge,hall.walk);
  for (let z=edge+.013;z<edge+f.run-.02;z+=.027) {
    assert.ok(Math.abs(f.walker.heightAt(0,z)-f.visibleHeight(0,z))<1e-5, `hall stair at ${z.toFixed(3)} is below its visible tread`);
  }
});
test('an overlapping lower landing cannot pull feet through a visible tread', () => {
  const stair=stairGeo(4,1.5);
  const walk={solids:[],decks:[{x0:-2,x1:2,z0:stair.run-.1,z1:stair.run+.3,h:0}],ramps:[{x0:-1.7,x1:1.7,z0:-.3,z1:stair.run+.2,h:1.5,base:0,low:[0,stair.run],high:[0,0]}]};
  const f=flight(1.5,0,walk);
  for(let z=stair.run-.09;z<stair.run+.049;z+=.011) assert.ok(Math.abs(f.walker.heightAt(0,z)-f.visibleHeight(0,z))<1e-5);
});
test('animated cloth shoes stay above each supporting tread while ascending, descending and turning', () => {
  const f=flight(4),monk=createMonk(),v=new THREE.Vector3();
  for (const heading of [0,Math.PI/2,Math.PI]) for(let k=0;k<80;k++) {
    const z=.08+k*.041;
    monk.group.position.set(0,f.walker.heightAt(0,z),z);monk.group.rotation.y=heading;
    monk.update(1/30,2.1,false,k/30,f.walker.heightAt,{heightAt:f.walker.eyeAt,stairs:true});
    monk.group.updateMatrixWorld(true);
    // what is drawn, after skinning: every point of the robe and of both shoes
    for(const [mesh,what] of [[monk.parts.robe,'the leaning robe'],[monk.parts.shoes,'a shoe']]) {
      for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
        mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);
        assert.ok(v.y+1e-4>=f.walker.heightAt(v.x,v.z), `heading=${heading.toFixed(2)}, z=${z.toFixed(3)}: ${what} at ${v.y.toFixed(3)} is below the tread at ${f.walker.heightAt(v.x,v.z).toFixed(3)}`);
      }
    }
  }
});

test('surface support does not lift the seated pose out of its cushion', () => {
  const monk=createMonk();
  for(let i=0;i<100;i++) monk.update(1/30,0,'sit',i/30,()=>0);
  assert.ok(monk.group.children[0].position.y<-.3);
  // seated, the legs are folded on the cushion (the seat's top is y = 0 here), not reaching down for a floor
  monk.group.updateMatrixWorld(true);
  for(const s of ['left','right']) assert.ok(monk.bones[s+'Foot'].getWorldPosition(new THREE.Vector3()).y>-0.02,`seated, his ${s} foot reaches below the cushion`);
});

test('sideways and reverse stair flights agree with the visible treads', () => {
  for(const angle of [Math.PI/2,Math.PI]) {
    const rise=1.5,stair=stairGeo(4,rise),mesh=new THREE.Mesh(stair.geo,new THREE.MeshBasicMaterial());mesh.rotation.y=angle;mesh.updateMatrixWorld(true);
    const low=new THREE.Vector3(0,0,stair.run).applyAxisAngle(new THREE.Vector3(0,1,0),angle);
    const w=createWalker({walk:{solids:[],decks:[],ramps:[{x0:Math.min(0,low.x)-1.7,x1:Math.max(0,low.x)+1.7,z0:Math.min(0,low.z)-1.7,z1:Math.max(0,low.z)+1.7,h:rise,high:[0,0],low:[low.x,low.z]}]}});
    const ray=new THREE.Raycaster();
    for(let z=.013;z<stair.run+.049;z+=.027){const v=new THREE.Vector3(0,rise+1,z).applyAxisAngle(new THREE.Vector3(0,1,0),angle);ray.set(v,new THREE.Vector3(0,-1,0));const y=ray.intersectObject(mesh)[0]?.point.y??0;assert.ok(Math.abs(w.heightAt(v.x,v.z)-y)<1e-5);}
  }
});

// ---- The cheeks: the stones that stand along either side of a flight ----
// Every level builds its stairs with stairGeo, at whatever height its platforms and terraces need, so these hold for
// any rise and width and not only for the ones this temple happens to have.
const STEP = { tread: .34, nosing: .05 }, CHEEK_REACH = .55, DEEP = -.4;   // (#272: the pier, the panel and the stone's square foot go 0.4 m into the ground)
const shape = (rise) => { const n = Math.max(1, Math.round(rise / .18)); return { n, sh: rise / n, run: STEP.tread * n }; };
const RISES = [.45, .5, .6, .9, 1.26, 1.5, 2.4, 2.8, 4, 6, 14.8], WIDTHS = [3, 5.2];
const solid = (geo) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.updateMatrixWorld(true); return m; };

test('a flight stays inside the ground its collision is drawn for', () => {
  for (const rise of RISES) for (const w of WIDTHS) {
    const { run } = shape(rise), p = stairGeo(w, rise).geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), at = `rise=${rise}, w=${w}: a point at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
      assert.ok(Math.abs(x) <= w / 2 + CHEEK_REACH + 1e-6, `${at} is wider than the cheek's keep`);
      assert.ok(z >= -1e-6 && z <= run + .06 + 1e-6, `${at} is past the head or the foot of the flight (run ${run.toFixed(2)})`);
      assert.ok(y >= DEEP - 1e-6 && y <= rise + .03, `${at} is deeper in the ground than the cheek's foot goes, or over the platform (${rise})`);
    }
  }
});
test('a cheek stands a little proud of every tread beside it, and no higher', () => {
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  for (const rise of RISES) for (const w of WIDTHS) {
    const { n, sh } = shape(rise), m = solid(stairGeo(w, rise).geo);
    for (const sx of [-1, 1]) for (let i = 0; i < n; i++) {
      const z = STEP.tread * (i + 1) + STEP.nosing - .01, nose = rise - sh * i;
      ray.set(new THREE.Vector3(sx * (w / 2 + .21), rise + 1, z), down);
      const y = ray.intersectObject(m)[0]?.point.y ?? -Infinity;
      assert.ok(y >= nose + .015 && y <= nose + .09, `rise=${rise}, w=${w}, side ${sx}: beside tread ${i} (top ${nose.toFixed(2)}) the cheek stands at ${y.toFixed(3)}`);
    }
  }
});
test('seen from the side a cheek is stone down to the ground: no slot under it, no step end showing', () => {
  const ray = new THREE.Raycaster();
  for (const rise of RISES) for (const w of WIDTHS) {
    const { sh, run } = shape(rise), m = solid(stairGeo(w, rise).geo), k = sh / STEP.tread;
    for (const sx of [-1, 1]) for (let z = .03; z < run; z += Math.max(.07, run / 60)) {
      const top = Math.min(rise, rise + k * (STEP.tread + STEP.nosing - z));   // the line of the tread noses
      for (let y = .03; y < top - .02; y += Math.max(.05, rise / 40)) {
        ray.set(new THREE.Vector3(sx * (w / 2 + 5), y, z), new THREE.Vector3(-sx, 0, 0));
        const hit = ray.intersectObject(m)[0], x = hit ? Math.abs(hit.point.x) : 0;
        assert.ok(x >= w / 2 + .25, `rise=${rise}, w=${w}, side ${sx}: at z=${z.toFixed(2)}, y=${y.toFixed(2)} the eye goes in to ${hit ? (x - w / 2).toFixed(2) + ' m from the treads' : 'nothing at all'}`);
      }
    }
  }
});
test('nothing beside a flight looks up at the sky but the top of its cheek stones', () => {
  // A ledge under the stone catches the light and shows as a pale slit against the shaded side of the flight.
  // (A face buried in the stone is no ledge: only one a visitor standing beside the flight could see counts.)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), ray = new THREE.Raycaster();
  for (const rise of RISES) for (const w of WIDTHS) {
    const { sh } = shape(rise), k = sh / STEP.tread, geo = stairGeo(w, rise).geo, p = geo.attributes.position;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(true);
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      n.subVectors(b, a).cross(c.clone().sub(a)); if (n.length() < 1e-9) continue; n.normalize();
      const at = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
      if (Math.abs(at.x) <= w / 2 + 1e-6 || n.y < .3 || at.y < 0) continue;
      const noses = Math.min(rise, rise + k * (STEP.tread + STEP.nosing - at.z));
      if (at.y >= noses + .01) continue;                                             // the top of the stone itself
      ray.set(at.clone().addScaledVector(n, 1e-3), new THREE.Vector3(Math.sign(at.x), 1, 0).normalize());
      assert.ok(ray.intersectObject(m).length > 0, `rise=${rise}, w=${w}: a face at (${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)}) looks up from under the cheek stone`);
    }
  }
});
test('a flight of two steps has no cheeks, and a flight can be asked for one cheek or none', () => {
  const widest = (geo) => { const p = geo.attributes.position; let lo = 0, hi = 0; for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getX(i)); hi = Math.max(hi, p.getX(i)); } return [lo, hi]; };
  assert.deepEqual(widest(stairGeo(4, .3).geo), [-2, 2]);
  assert.deepEqual(widest(stairGeo(4, 1.5, { sides: [] }).geo), [-2, 2]);
  const [lo, hi] = widest(stairGeo(4, 1.5, { sides: [1] }).geo); assert.equal(lo, -2); assert.ok(hi > 2.3);
});
