import '../../tests/unit/dom-stub.mjs';
import * as THREE from '../../app/v/build/three.module.js';
import {buildSite,createWalker} from '../../app/src/site.js';
import {createMonk} from '../../app/src/monk.js';
import fs from 'node:fs';
const out=process.argv[2]||'tools/out/edge-audit';fs.mkdirSync(out,{recursive:true});
const M=new Proxy({},{get:(t,k)=>k==='plaster'||k==='interior'?()=>t['__'+k]||=new THREE.MeshBasicMaterial():t[k]||=new THREE.MeshBasicMaterial()});
const s=buildSite(M),w=createWalker(s),rows=[];
for(const localX of[-4.9,4.9]){const x=-16.6+2.4+.52,z=14-localX,y=.45;const monk=createMonk();monk.group.position.set(x,y,z);monk.update(1/30,0,false,0,()=>y);monk.group.updateMatrixWorld(true);let count=0;
monk.group.traverse(o=>{if(!o.isMesh||!o.visible)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(Math.abs(v.x-x)<.26&&Math.abs(v.z-z)<.75&&v.y>y+.31&&v.y<y+.37)count++}});
rows.push({id:'tea-porch-table-'+(localX<0?'south':'north'),at:[x,z],blocked:w.blocked(x,z),support:w.heightAt(x,z),tableTop:y+.37,avatarVerticesInsideTableTopSlab:count,reachablePorchSamples:Array.from({length:9},(_,i)=>{const px=x+.29-i*.03;return{at:[px,z],blocked:w.blocked(px,z)}})});
}
fs.writeFileSync(out+'/props.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
