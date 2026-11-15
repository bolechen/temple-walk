// A level's registered indoor views in the CommonJS shape that tools/inside.cjs takes (Node tools import app/*.js
// directly, but CommonJS cannot import an ES module synchronously). Each level that has rooms keeps its own table at
// app/levels/<level>/hall-views.js, written relative to each room's centre line; here the room's real offset (rooms
// stand sixty metres apart in the order of site.halls) is added from the built plan. The unit tests hold every
// level's table to that plan, so a new hall cannot silently go without a camera.
//   require("./hall-views.cjs").views("t00")   the jobs for one level
//   require("./hall-views.cjs").levels()       the levels that have a table
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const top = path.join(__dirname, ".."), dir = path.join(top, "app", "levels");
const DEFAULT = "t00";

function levels() {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "hall-views.js"))).map((d) => d.name).sort();
}

// The level's own table, checked before anything is built: a name that is not a plain folder name, or a level
// without a table, is refused with the list of those that have one.
function tableOf(level = DEFAULT) {
  const have = levels();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(level) || !have.includes(level)) throw new Error(`no indoor views for level "${level}"; levels with app/levels/<level>/hall-views.js: ${have.join(", ") || "none"}`);
  return "./" + path.posix.join("app", "levels", level, "hall-views.js");
}

// The plan the page builds is still the prologue's (app/src/site.js); a later level that brings its own plan will say
// so here. Until then every table is checked against the rooms that plan builds.
function views(level = DEFAULT) {
  const table = tableOf(level);
  const json = execFileSync(process.execPath, ["--input-type=module", "-e", `
import "./tests/unit/dom-stub.mjs";
import * as THREE from "three";
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const { buildSite } = await import("./app/src/site.js");
const { buildInteriors } = await import("./app/src/interior.js");
const { HALL_VIEWS } = await import(${JSON.stringify(table)});
const site = buildSite(M), rooms = buildInteriors(M, site.halls);
const absent = HALL_VIEWS.filter((v) => !rooms.rooms[v.hall]);
if (absent.length) throw new Error("no room for " + absent.map((v) => v.hall).join(","));
console.log(JSON.stringify(HALL_VIEWS.map((v) => ({ ...v, abs: [v.abs[0] + rooms.rooms[v.hall].room.cx, ...v.abs.slice(1)] }))));
`], { cwd: top, encoding: "utf8" });
  return JSON.parse(json);
}

module.exports = { views, levels, tableOf, DEFAULT };
