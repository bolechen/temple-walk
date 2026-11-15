import '../../tests/unit/dom-stub.mjs';
import * as THREE from '../../app/vendor/three/build/three.module.js';
import {createMonk} from '../../app/src/monk.js';
import fs from 'node:fs';
const out=process.argv[2]||'tools/out/edge-audit';fs.mkdirSync(out,{recursive:true});
const scan=JSON.parse(fs.readFileSync(out+'/scan.json'));
const rows=[];
for(const c of scan.columns){let max=0,sample;const q={tea:1,chan:3,yaoshi:1,dahui:3}[c.id]||0;
const monk=createMonk();const at=c.reachableAlongPorch.at,base=c.reachableAlongPorch.support;
monk.group.position.set(at[0],base,at[1]);monk.group.rotation.y=Math.PI+q*Math.PI/2;
for(let k=0;k<60;k++){monk.update(1/30,Number(process.env.EDGE_SPEED??2.1),false,k/30,()=>base,{heightAt:()=>base,stairs:false});monk.group.updateMatrixWorld(true);
monk.group.traverse(o=>{if(!o.isMesh||!o.visible)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.y<base+.32||v.y>base+2.0)continue;const d=Math.hypot(v.x-c.column[0],v.z-c.column[1]);const depth=({tea:.19,chan:.19,yaoshi:.19,dahui:.19}[c.id]||.24)-d;if(depth>max){max=depth;sample={point:v.toArray(),phase:k/30}}}});
}rows.push({id:c.id,at,base,shaftConservativeRadius:['tea','chan','yaoshi','dahui'].includes(c.id)?.19:.24,maxVertexInsideShaft:max,sample});}
fs.writeFileSync(out+'/contacts.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
