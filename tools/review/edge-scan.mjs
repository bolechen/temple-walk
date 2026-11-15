import '../../tests/unit/dom-stub.mjs';
import * as THREE from 'three';
import {buildSite,createWalker,APPROACH} from '../../app/src/site.js';
import fs from 'node:fs';
const out=process.argv[2]||'tools/out/edge-audit';fs.mkdirSync(out,{recursive:true});
const M=new Proxy({},{get:(t,k)=>k==='plaster'||k==='interior'?()=>t['__'+k]||=new THREE.MeshBasicMaterial():t[k]||=new THREE.MeshBasicMaterial()});
const site=buildSite(M),w=createWalker(site);site.root.updateMatrixWorld(true);
const turn=(x,z,q)=>q===0?[x,z]:q===1?[z,-x]:q===2?[-x,-z]:[-z,x];
const records=[];const cases=[['tea',-16.6,14,1,8,2.4,1],['chan',16.6,14,3,8,2.4,1],['main',0,-14.6,0,14.4,8.6,2.4],['library',0,-49,0,9.4,4.2,1.7],['yaoshi',-17.0,-47,1,5.4,2.4,1],['dahui',16.4,-79.9,3,5.4,2.4,1],['guanyin',0,-80.1,0,9,5,1.6],['lingxiao',0,-131.3,0,7.5,7.5,1.4]];
for(const[id,x,z,q,X,Z,P]of cases){const world=(a,b)=>{const r=turn(a,b,q);return[x+r[0],z+r[1]]};const column=world(X,Z);let final;
 // Walk up to the column from an admissible porch in 1 cm increments.
 for(let d=P-.32;d>=.44;d-=.01){const p=world(X,Z+d);if(w.blocked(...p))break;final={at:p,distanceToColumn:d,support:w.heightAt(...p)};}
 const p=world(X,Z+.45);const near=world(X+.2,Z+.45);records.push({id,column,porchAt:p,blocked:w.blocked(...p),support:w.heightAt(...p),reachableAlongPorch:final,nearColumn:near,nearBlocked:w.blocked(...near)});
}
const ramps=site.walk.ramps.map((r,i)=>({id:i,...r}));
const topDecks=site.walk.decks.filter(d=>d.h>22);
const report={geometry_commit:'3e67700676e20182de846e33c733bdf9bb4e98da',method:'10 mm local porch sweep through actual createWalker; not visual collision proof',columns:records,approach:APPROACH,upperFloorCollisionDecks:topDecks,ramps};
fs.writeFileSync(out+'/scan.json',JSON.stringify(report,null,2));console.log(JSON.stringify({columns:records,upperFloorCollisionDecks:topDecks,ramps:ramps.length},null,2));
