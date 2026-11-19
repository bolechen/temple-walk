import test from 'node:test';import assert from 'node:assert/strict';
import './dom-stub.mjs';import * as THREE from 'three';import {createWalker} from '../../app/src/site.js';import {createMonk} from '../../app/src/monk.js';import {stairGeo,STAIR} from '../../app/src/geo.js';
const V=STAIR.tread*STAIR.hurry;   // the fastest he goes on a flight (Shift)
function sample(dt,descending){
 const rise=4,run=stairGeo(4,rise).run,w=createWalker({walk:{solids:[],decks:[],ramps:[{x0:-1.7,x1:1.7,z0:-.3,z1:run+.3,h:rise,low:[0,run],high:[0,0]}]}}),monk=createMonk();let last=null,max=0;
 for(let i=0;i<Math.round(2.5/dt);i++){
  const z=descending?.1+i*V*dt:run-.2-i*V*dt;const y=w.heightAt(0,z);monk.group.position.set(0,y,z);monk.group.rotation.y=descending?0:Math.PI;   // he faces the way he walks: +z going down this flight (its foot is at +z), -z going up
  monk.update(dt,V,false,i*dt,w.heightAt,{heightAt:w.eyeAt,stairs:true});monk.group.updateMatrixWorld(true);
  const bodyY=monk.group.position.y+monk.group.children[0].position.y;
  if(last!==null&&i>10)max=Math.max(max,Math.abs(bodyY-last));last=bodyY;assert.ok(monk.group.position.y>=y-1e-6,'physical support must stay on the tread');
 }
 return max;
}
for(const descending of [false,true])for(const dt of [1/60,1/30,1/20])test(`${descending?'down':'up'} stairs at ${Math.round(1/dt)}Hz have no whole-step body pop`,t=>{
 const max=sample(dt,descending);t.diagnostic(`max body delta: ${max.toFixed(5)} m/frame`);assert.ok(max<1.5*dt+0.008,`body moves ${max.toFixed(4)}m in one frame instead of following a continuous rise`);
});
test('a deliberate hop does not snap the feet or torso back onto the floor',()=>{
 const monk=createMonk();monk.group.position.y=.8;const point=monk.group.position.clone();
 monk.update(1/30,0,'hop',0,()=>0,{heightAt:()=>0,stairs:false});monk.group.updateMatrixWorld(true);
 assert.ok(Math.abs(monk.group.children[0].position.y)<.02,'hop torso was damped toward the floor');
 const shoes=monk.parts.shoes,v=new THREE.Vector3();
 for(let i=0;i<shoes.geometry.attributes.position.count;i++){shoes.getVertexPosition(i,v).applyMatrix4(shoes.matrixWorld);assert.ok(v.y>.7,'foot was glued to the floor during a hop');}
});
