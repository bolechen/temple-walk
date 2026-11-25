// Write the fixed views of a level's handoff (docs/<level>/camera-manifest.json: the prologue's six, docs/t00/) from the plan
// itself, so that the manifest can never disagree with what the page draws.   node tools/cameras.mjs [--level=<id>]
// Which views, and what each shows, is the level's own table (app/levels/<id>/checks.js, `cameras`); the prologue by default.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
import { levelFromCommandLine, levelObject } from "./walk/level-arg.mjs";

const id = levelFromCommandLine(), L = await levelObject(id);
const file = new URL(`../app/levels/${id}/checks.js`, import.meta.url);
const spec = fs.existsSync(file) ? (await import(file.href)).default.cameras : null;
if (!spec) { console.error(`app/levels/${id}/checks.js has no \`cameras\`: the manifest needs the views' labels`); process.exit(1); }
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = L.build(M), walker = L.createWalker(site), EYE = 1.3, r = (v) => +v.toFixed(2);
const what = spec.what;
// A view whose still is taken in third person (a fourth entry { view: "third", eye, pitch }) is drawn from the following eye a few steps behind
// him, at the fixed views' 44°: the manifest gives that eye, as measured in the page, and where he stands. A view the level gives a lens of its own (`site.lens[key]`, app/yard.js) is written at that angle.
const cameras = Object.entries(what).map(([key, [cid, label, composition, how]]) => {
  const [x, z, yaw, pitch] = site.views[key], y = walker.heightAt(x, z) + EYE, d = 10, third = how?.view === "third";
  const [ex, ey, ez] = third ? how.eye : [x, y, z], ep = third ? how.pitch : pitch;
  return { id: cid, label, composition, view: key, url: `?${id === "t00" ? "" : `level=${id}&`}show=${key}&season=summer&time=day&view=${third ? "third" : "first"}&q=high`, position: [r(ex), r(ey), r(ez)],
    target: [r(ex + Math.sin(yaw) * Math.cos(ep) * d), r(ey + Math.sin(ep) * d), r(ez - Math.cos(yaw) * Math.cos(ep) * d)], yaw_rad: r(yaw), pitch_rad: r(pitch),
    ...(third ? { stands_at: [r(x), r(y - EYE), r(z)], eye_pitch_rad: r(ep) } : {}),
    ...(site.closedViews?.includes(key) ? { closed: "先行版暂不适用：大殿门关着，机位在殿内，走不到；开殿时随 HALL_DOORS 恢复（docs/t05/DECISIONS.md「先行版关殿门」）" } : {}),
    fov_degrees: site.lens?.[key]?.[third ? "third" : "first"] ?? (third ? 44 : 52), fov_axis: "vertical", eye_height_m: EYE, resolution: [1920, 1080], locked: true };
});
const first = Object.keys(what)[0], last = Object.keys(what).at(-1);
fs.mkdirSync(new URL(`../docs/${id}/`, import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../docs/${id}/camera-manifest.json`, import.meta.url), JSON.stringify({ scene_id: spec.sceneId, status: "registered_from_project", units: "metres; +y up; north (uphill) is -z; the visitor arrives from +z",
  preset: spec.preset, source: `${id === "t00" ? "app/src/site.js" : `app/levels/${id}/site.js`} \`views.${first}..${last}\`, written by tools/cameras.mjs`, cameras }, null, 1) + "\n");
console.log(cameras.map((c) => `${c.id} ${c.position.join(",")}`).join("\n"));
