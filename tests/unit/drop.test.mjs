import test from 'node:test';import assert from 'node:assert/strict';
import './dom-stub.mjs';import * as THREE from 'three';
import { buildSite,createWalker } from '../../app/src/site.js';
import { findDrop,dropPose } from '../../app/src/drop.js';
const M=new Proxy({}, {get(t,k){return k==='plaster'||k==='interior'?()=>t[k]||=new THREE.MeshBasicMaterial():t[k]||=new THREE.MeshBasicMaterial();}});
const site=buildSite(M),w=createWalker(site);
test('reproduced 0.45m tea porch blocker has a deliberate drop route',()=>{
 // The tea house's porch edge toward the court (the edge nearest where he comes out of its door), as this walker has it:
 // written, or found in the baked grid (#265). Off the edge, at its foot, he is stopped; from the porch it is hopped down.
 const tea=site.halls.find((h)=>h.id==='tea'),mid=(e)=>[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2];
 const edge=w.drops.filter((e)=>Math.abs(e.top-.45)<.02).sort((p,q)=>Math.hypot(...mid(p).map((v,i)=>v-tea.out[i]))-Math.hypot(...mid(q).map((v,i)=>v-tea.out[i])))[0];assert.ok(edge,'no porch edge by the tea house');
 const [nx,nz]=edge.normal,[mx,mz]=[edge.a[0]+(edge.b[0]-edge.a[0])*.3,edge.a[1]+(edge.b[1]-edge.a[1])*.3],x=mx-nx*.3,z=mz-nz*.3;
 assert.ok(Math.abs(w.heightAt(x,z)-.45)<.006);assert.equal(w.blocked(mx+nx*.1,mz+nz*.1),true);
 const plan=findDrop(w,w.drops,x,z,nx,nz);assert.ok(plan);assert.ok(Math.abs(plan.from[1]-.45)<.006);assert.ok(Math.abs(plan.to[1])<.006);assert.equal(w.blocked(plan.to[0],plan.to[2]),false);
});
test('railed main hall, wrong facing, indoors and ordinary ground do not offer a jump',()=>{
 assert.equal(findDrop(w,w.drops,5,-4.1,0,1),null);
 assert.equal(findDrop(w,w.drops,-12.9,11,-1,0),null);
 assert.equal(findDrop(w,w.drops,0,20,0,-1),null);
 w.setRoom({y:-100,x0:-10,x1:10,z0:-10,z1:10,solids:[]});assert.equal(findDrop(w,w.drops,0,0,0,1),null);w.setRoom(null);
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
 // 0.9 m out a corner of what blocks is within a quarter of a metre: he does not come down there, but nearer, where it is clear (#274).
 const plan=findDrop(walker,[{a:[-2,0],b:[2,0],normal:[0,1],top:.45}],0,-.3,0,1);
 assert.ok(plan&&plan.to[2]<0.9-1e-9&&!walker.blocked(plan.to[0],plan.to[2]));
 // and where nowhere out to 0.6 m is clear, there is no hop
 const shut={room:null,heightAt:(x,z)=>z<0?.45:0,blocked:(x,z)=>z>0.5};
 assert.equal(findDrop(shut,[{a:[-2,0],b:[2,0],normal:[0,1],top:.45}],0,-.3,0,1),null);
});

test("too short to step onto a stool, he hops up onto it with his own jump and comes down on its top", async () => {
  const { seatHop, dropPose } = await import("../../app/src/drop.js");
  const from = [0, 0, 0], to = [0.6, 0.44, 0.1], plan = seatHop(from, to, 3.0, 9.8);
  const start = dropPose(plan, 0), end = dropPose(plan, plan.duration);
  assert.deepEqual([start.x, start.y, start.z], from, "he takes off where he stood");
  assert.ok(end.done && Math.abs(end.x - to[0]) < 1e-9 && Math.abs(end.y - to[1]) < 1e-9 && Math.abs(end.z - to[2]) < 1e-9, "he comes down on the seat's top, at its middle");
  let apex = -Infinity, low = Infinity; for (let t = 0; t <= plan.duration; t += plan.duration / 50) { const p = dropPose(plan, t); apex = Math.max(apex, p.y); low = Math.min(low, p.y); }
  assert.ok(apex > to[1] && apex < to[1] + 0.15, `over the seat's top, not far over it (apex ${apex.toFixed(3)} m)`);
  assert.ok(low >= -1e-9, "never below where he took off");
  assert.ok(plan.duration > 0.25 && plan.duration < 0.6, `a hop, not a float (${plan.duration.toFixed(2)} s)`);
  assert.ok(plan.lift >= 3.0 && plan.lift < 3.15, `a stool at a grown man's height takes about his own jump (${plan.lift.toFixed(2)} m/s)`);
  assert.ok(seatHop(from, [0.6, 0.6, 0], 3.0, 9.8).lift > 3.0, "a higher seat asks a harder jump");
});

test("getting up from a stool or bench, he hops lightly down onto the floor instead of dropping in one frame", async () => {
  const { seatHopOff, dropPose } = await import("../../app/src/drop.js");
  const from = [0.6, 0.44, 0.1], to = [0, 0, 0], plan = seatHopOff(from, to);
  const start = dropPose(plan, 0), end = dropPose(plan, plan.duration);
  assert.deepEqual([start.x, start.y, start.z], from, "he leaves from the seat's top");
  assert.ok(end.done && Math.abs(end.x - to[0]) < 1e-9 && Math.abs(end.y - to[1]) < 1e-9 && Math.abs(end.z - to[2]) < 1e-9, "he lands cleanly on the floor beside it");
  let apex = -Infinity, low = Infinity;
  for (let t = 0; t <= plan.duration; t += plan.duration / 50) { const p = dropPose(plan, t); apex = Math.max(apex, p.y); low = Math.min(low, p.y); }
  assert.ok(apex > from[1] && apex < from[1] + 0.08, `a light push off the edge, not a high bounce (apex ${apex.toFixed(3)} m)`);
  assert.ok(low >= -1e-9, "never dips below the floor");
  assert.ok(plan.duration > 0.25 && plan.duration < 0.5, `snappy dismount (${plan.duration.toFixed(2)} s)`);
});

test("getting up from a seat, he comes down off its front, and round its side when what stands before it is in the way", async () => {
  const { seatExit } = await import("../../app/src/drop.js");
  const seat = [0, 0], face = 0;   // on it he faces +z
  const open = { heightAt: () => 0, blocked: () => false };
  assert.deepEqual(seatExit(open, seat, face, [0, -0.4]), [0, 0.55], "the front is taken first, and the nearer ground out from it");
  // A table before the stool (0.39 m from its middle, as at the tea house): the front is shut, the sides open.
  const table = { heightAt: () => 0, blocked: (x, z) => z > 0.2 && Math.abs(x) < 0.5 };
  const side = seatExit(table, seat, face, [0, -0.4]);
  assert.ok(side && side[1] > 0 && Math.abs(side[0]) > 0.3, `he should get down round the side, never over the back of the stool (${side})`);
  assert.ok(Math.hypot(side[0], side[1]) > 0.5, "and a step out from the seat's middle");
  // Ground lower than the seat's own floor (a step down beside it) is not where he comes down.
  const step = { heightAt: (x, z) => (z > 0.3 ? -0.3 : 0), blocked: () => false };
  const beside = seatExit(step, seat, face, [0, -0.4]);
  assert.ok(beside && beside[1] <= 0.3 && Math.abs(step.heightAt(beside[0], beside[1])) < 1e-9, `the floor he sat from, not the step down (${beside})`);
  // Nowhere before or beside it clear: no answer, and the caller keeps where he stood.
  assert.equal(seatExit({ heightAt: () => 0, blocked: () => true }, seat, face, [0, -0.4]), null);
});
