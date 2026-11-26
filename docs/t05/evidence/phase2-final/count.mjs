// run with the checkout as the working directory: copy it there as count-tmp.mjs and `node count-tmp.mjs`
const { buildSite } = await import("./app/levels/t05/site.js");
const { mergeStatic } = await import("./app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M); site.root.updateMatrixWorld(true);
const r = mergeStatic(site.root, [30, -32, -95, -1e9]);
const by = {}; let tris = 0;
site.root.traverse((o) => { if (o.isMesh) { const n = o.material.name || o.material.type; (by[n] ??= { n: 0, tris: 0 }); by[n].n++; const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; by[n].tris += Math.round(t); tris += t; } });
console.log(JSON.stringify({ totalGroups: r.after, tris: Math.round(tris), by }));
