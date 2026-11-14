import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import * as THREE from '../../app/v/build/three.module.js';
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
  const f=flight(4),monk=createMonk();
  const legs=monk.group.children.filter(o=>o.isGroup&&o!==monk.group.children[0]);
  for (const heading of [0,Math.PI/2,Math.PI]) for(let k=0;k<80;k++) {
    const z=.08+k*.041;
    monk.group.position.set(0,f.walker.heightAt(0,z),z);monk.group.rotation.y=heading;
    monk.update(1/30,2.1,false,k/30,f.walker.heightAt,{heightAt:f.walker.eyeAt,stairs:true});
    monk.group.updateMatrixWorld(true);
    const cloth=monk.group.children[0].children[0],cp=cloth.geometry.attributes.position;
    for(let i=0;i<cp.count;i++) {
      const v=new THREE.Vector3().fromBufferAttribute(cp,i).applyMatrix4(cloth.matrixWorld);
      assert.ok(v.y+1e-4>=f.walker.heightAt(v.x,v.z), 'the leaning robe hem intersects a higher tread');
    }
    for(const leg of legs) {
      const shoe=leg.children[2],p=shoe.geometry.attributes.position;
      for(let i=0;i<p.count;i++) {
        const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(shoe.matrixWorld);
        assert.ok(v.y+1e-4>=f.walker.heightAt(v.x,v.z), `heading=${heading.toFixed(2)}, z=${z.toFixed(3)}: shoe ${v.y.toFixed(3)} below tread ${f.walker.heightAt(v.x,v.z).toFixed(3)}`);
      }
    }
  }
});

test('surface support does not lift the seated pose out of its cushion', () => {
  const monk=createMonk();
  for(let i=0;i<100;i++) monk.update(1/30,0,'sit',i/30,()=>0);
  assert.ok(monk.group.children[0].position.y<-.3);
  assert.ok(monk.group.children.filter(o=>o.isGroup&&o!==monk.group.children[0]).every(o=>!o.visible));
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
