// The registered indoor views in the CommonJS shape that tools/inside.cjs takes (Node tools import app/src/*.js
// directly, but CommonJS cannot import an ES module synchronously). The rooms stand sixty metres apart, and each
// hall's views are written relative to its centre line in app/levels/t00/hall-views.js; the unit tests hold this list to
// the built plan, so a new hall cannot silently go without a camera.
const { execFileSync } = require("child_process"), path = require("path");
const top = path.join(__dirname, "..");
const read = () => execFileSync(process.execPath, ["--input-type=module", "-e", `
import "./tests/unit/dom-stub.mjs";
import * as THREE from "three";
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const { buildSite } = await import("./app/src/site.js");
const { buildInteriors } = await import("./app/src/interior.js");
const { HALL_VIEWS } = await import("./app/levels/t00/hall-views.js");
const site = buildSite(M), rooms = buildInteriors(M, site.halls);
const absent = HALL_VIEWS.filter((v) => !rooms.rooms[v.hall]);
if (absent.length) throw new Error("no room for " + absent.map((v) => v.hall).join(","));
console.log(JSON.stringify(HALL_VIEWS.map((v) => ({ ...v, abs: [v.abs[0] + rooms.rooms[v.hall].room.cx, ...v.abs.slice(1)] }))));
`], { cwd: top, encoding: "utf8" });
module.exports = JSON.parse(read());
