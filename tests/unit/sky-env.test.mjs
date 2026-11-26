// #749: the sky baked an environment map for every lit surface from a cube camera that saw 100 m while the dome stands at 600, so the map
// held only the renderer's clear colour, black (read back in the page: docs/t05/evidence/749-env/README.md), and every lit pixel looked
// it up for nothing. The sky now sets none. A sky that truly lights the surfaces is a change of the picture and must bake from a camera
// that reaches the dome; this holds both halves.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const THREE = await import("three");
const { createSky } = await import("../../app/src/sky.js");
const { moodOf } = await import("../../app/src/mood.js");

test("the sky sets no environment map, at load or with any mood", () => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xffffff, 0.01);
  const sky = createSky(/** @type {any} */ ({}), scene, { shadow: 512, shadowLong: 1024 }, [0, 0]);
  assert.equal(scene.environment, null, "at load");
  for (const s of ["spring", "summer", "autumn", "winter"]) for (const h of ["dawn", "day", "dusk", "night"]) {
    sky.setMood(moodOf(s, h)); assert.equal(scene.environment, null, `${s} ${h}`);
  }
});

test("any environment baked from the dome must come from a camera that reaches it", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../app/src/sky.js", import.meta.url), "utf8");
  for (const m of src.matchAll(/fromScene\(([^)]*)\)/g)) {
    const far = Number(m[1].split(",")[3]);
    assert.ok(far > 600, `fromScene(${m[1]}): its far plane (PMREMGenerator's default is 100 m) must reach the dome at 600 m`);
  }
});
