// run with the checkout as the working directory and tests/unit/dom-stub.mjs next to it: copy it into the checkout, `node count-tmp.mjs`
import "./tests/unit/dom-stub.mjs"; import * as THREE from "three";
const { buildSite } = await import("./app/levels/t05/site.js");
const { mergeStatic } = await import("./app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M); site.root.updateMatrixWorld(true);
let pre = 0; site.root.traverse((o) => { if (o.isMesh && o.userData.surround) pre++; });
const r = mergeStatic(site.root, [30, -32, -95, -1e9]);
const by = {}; let tris = 0;
site.root.traverse((o) => { if (o.isMesh && /^surround/i.test(o.material.name || "")) { const n = o.material.name; (by[n] ??= { n: 0, tris: 0 }); by[n].n++; const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; by[n].tris += t; tris += t; } });
console.log(JSON.stringify({ premerge: pre, totalGroups: r.after, surroundGroups: Object.values(by).reduce((a, b) => a + b.n, 0), surroundTris: Math.round(tris), by }));
