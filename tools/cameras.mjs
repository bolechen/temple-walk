// Write the six fixed views of the T00 handoff (docs/t00/camera-manifest.json) from the plan itself, so that the
// manifest can never disagree with what the page draws.   node tools/cameras.mjs
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "../app/vendor/three/build/three.module.js";
const { buildSite, createWalker } = await import("../app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site), EYE = 1.3, r = (v) => +v.toFixed(2);
const what = {
  cam01: ["CAM-01", "竹林起点", "前景竹干、中景石阶与来路方向"], cam02: ["CAM-02", "石阶转折", "折线台阶、挡墙、近远植被"], cam03: ["CAM-03", "照壁之前", "照壁遮挡山门，通行方向仍可读"],
  cam04: ["CAM-04", "绕壁后的山门正面", "重阁轮廓、入口与两侧构件"], cam05: ["CAM-05", "门内回望", "门框、刚走过的路、竹林"], cam06: ["CAM-06", "第一个院落主视点", "近景树或门框、中景院地、远景殿堂"],
};
const cameras = Object.entries(what).map(([key, [id, label, composition]]) => {
  const [x, z, yaw, pitch] = site.views[key], y = walker.heightAt(x, z) + EYE, d = 10;
  return { id, label, composition, view: key, url: `?show=${key}&season=summer&time=day&view=first&q=high`, position: [r(x), r(y), r(z)],
    target: [r(x + Math.sin(yaw) * Math.cos(pitch) * d), r(y + Math.sin(pitch) * d), r(z - Math.cos(yaw) * Math.cos(pitch) * d)], yaw_rad: r(yaw), pitch_rad: r(pitch),
    fov_degrees: 52, fov_axis: "vertical", eye_height_m: EYE, resolution: [1920, 1080], locked: true };
});
fs.writeFileSync(new URL("../docs/t00/camera-manifest.json", import.meta.url), JSON.stringify({ scene_id: "T00", status: "registered_from_project", units: "metres; +y up; north (uphill) is -z; the visitor arrives from +z",
  preset: "J01 = summer · day (overcast after rain)", source: "app/src/site.js `views.cam01..cam06`, written by tools/cameras.mjs", cameras }, null, 1) + "\n");
console.log(cameras.map((c) => `${c.id} ${c.position.join(",")}`).join("\n"));
