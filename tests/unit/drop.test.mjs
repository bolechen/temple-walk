import test from 'node:test';import assert from 'node:assert/strict';
import './dom-stub.mjs';import * as THREE from '../../app/vendor/three/build/three.module.js';
import { buildSite,createWalker } from '../../app/src/site.js';
import { findDrop,dropPose } from '../../app/src/drop.js';
const M=new Proxy({}, {get(t,k){return k==='plaster'||k==='interior'?()=>t[k]||=new THREE.MeshBasicMaterial():t[k]||=new THREE.MeshBasicMaterial();}});
const site=buildSite(M),w=createWalker(site);
test('reproduced 0.45m tea porch blocker has a deliberate drop route',()=>{
 assert.equal(w.heightAt(-13.5,11),.45);assert.equal(w.blocked(-13.3,11),true);
 const plan=findDrop(w,site.walk.drops,-13.5,11,1,0);assert.ok(plan);assert.equal(plan.from[1],.45);assert.equal(plan.to[1],0);assert.equal(w.blocked(plan.to[0],plan.to[2]),false);
});
test('railed main hall, wrong facing, indoors and ordinary ground do not offer a jump',()=>{
 assert.equal(findDrop(w,site.walk.drops,5,-4.1,0,1),null);
 assert.equal(findDrop(w,site.walk.drops,-13.5,11,-1,0),null);
 assert.equal(findDrop(w,site.walk.drops,0,20,0,-1),null);
 w.setRoom({y:-100,x0:-10,x1:10,z0:-10,z1:10,solids:[]});assert.equal(findDrop(w,site.walk.drops,0,0,0,1),null);w.setRoom(null);
});
test('obstructed or unstable landing is rejected',()=>{
 const edge=[{a:[-2,0],b:[2,0],normal:[0,1],top:.45}];
 for(const blocked of [true,false]){const walker={room:null,heightAt:(x,z)=>z<0?.45:blocked?0:x===0?0:.2,blocked:()=>blocked};assert.equal(findDrop(walker,edge,0,-.3,0,1),null);}
});
test('hop arc clears the back foot before it descends through the platform edge',()=>{
 for(const height of [.3,.45,.9,1.26,1.5])for(const back of [.25,.45,.64]){
  const walker={room:null,heightAt:(x,z)=>z<0?height:0,blocked:()=>false};
  const plan=findDrop(walker,[{a:[-2,0],b:[2,0],normal:[0,1],top:height}],0,-back,0,1);assert.ok(plan);
  for(let i=0;i<=200;i++){const p=dropPose(plan,plan.duration*i/200);assert.ok(p.y>=-1e-9);if(p.z<.3)assert.ok(p.y>=height-1e-8,'body descends while its trailing foot still overlaps the ledge');}
  const p=dropPose(plan,plan.duration+1);assert.deepEqual([p.x,p.y,p.z,p.done],[...plan.to,true]);
 }
});
test('large drops have no route',()=>{
 const walker={room:null,heightAt:(x,z)=>z<0?2.4:0,blocked:()=>false};assert.equal(findDrop(walker,[{a:[-2,0],b:[2,0],normal:[0,1],top:2.4}],0,-.3,0,1),null);
});
test('landing body clearance includes diagonal corners',()=>{
 const walker={room:null,heightAt:(x,z)=>z<0?.45:0,blocked:(x,z)=>x>.15&&z>1.05};
 assert.equal(findDrop(walker,[{a:[-2,0],b:[2,0],normal:[0,1],top:.45}],0,-.3,0,1),null);
});
