// The review sheet's arithmetic (tools/review-sheet-lib.mjs): the colours of the id pass and what they name, the ruler's
// heights turned into points on the picture, and the pixel counts. The page's half (app/src/review.js) is held to the same
// palette here, and to being the workbench's only.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { PALETTE, CLASSES, classify, countParts, project, readings, rulerTicks, rulerLines, lapBox, silhouette, verdict, cameraCounts } from "../../tools/review-sheet-lib.mjs";
import { REVIEW_COLORS, reviewOn } from "../../app/src/review.js";

// a camera 3 m in front of the origin looking back at it: three's matrices for fov 50, 1:1 (column-major)
const proj = (fov, aspect, n = 0.1, f = 100) => { const t = 1 / Math.tan((fov * Math.PI) / 360); return [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; };
const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];   // eye at (0, 0, 3), looking down -z
const cam = { view, projection: proj(50, 1), position: [0, 0, 3], fov: 50 };

test("the id pass's colours: the page's and the tool's are one palette, each part has its own, and each names itself", () => {
  assert.deepEqual(PALETTE, REVIEW_COLORS);
  const seen = new Set(CLASSES.map((k) => PALETTE[k].join()));
  assert.equal(seen.size, CLASSES.length, "no two parts share a colour");
  for (const k of CLASSES) assert.equal(classify(PALETTE[k]), k);
  for (const k of CLASSES) assert.equal(classify(PALETTE[k].map((v) => Math.max(0, v - 40))), k, `${k} survives a little dimming`);
  // the temple's own browns, golds, greys and the paper are none of them
  for (const c of [[120, 80, 50], [200, 170, 110], [128, 128, 128], [255, 255, 255], [20, 20, 20], [210, 120, 60], [170, 80, 50]]) assert.equal(classify(c), null, c.join());
});

test("only the hand's own colour is the hand, and skin beside it is not", () => {
  assert.equal(classify([255, 255, 0]), "hand"); assert.equal(classify([255, 0, 255]), "skin"); assert.notEqual(classify([255, 0, 255]), "hand");
});

test("pixel counts: each part, and only inside a box when one is given", () => {
  const w = 10, h = 10, d = new Uint8Array(w * h * 4).fill(255);
  const put = (x, y, c) => { const o = (y * w + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; };
  for (let x = 0; x < 4; x++) put(x, 2, PALETTE.hand);        // 4 hand pixels in row 2
  for (let x = 6; x < 9; x++) put(x, 8, PALETTE.hand);        // 3 more in row 8
  for (let x = 0; x < 5; x++) put(x, 5, PALETTE.robe);        // 5 robe
  const all = countParts(d, w, h);
  assert.equal(all.hand, 7); assert.equal(all.robe, 5); assert.equal(all.skin, 0);
  assert.equal(countParts(d, w, h, 4, [0, 0, 10, 4]).hand, 4, "the box takes the top rows only");
  assert.equal(countParts(d, w, h, 4, [5, 5, 10, 10]).hand, 3);
  const none = cameraCounts({ all: new Uint8Array(w * h * 4).fill(255), handAlone: d, box: [0, 0, 10, 10], w, h });
  assert.equal(none.handAlone, 7); assert.equal(none.handVisible, 0); assert.equal(none.handHiddenFraction, 1, "a hand the robe hides entirely");
  const some = cameraCounts({ all: d, handAlone: d, box: null, w, h });
  assert.equal(some.handHidden, 0); assert.equal(some.handHiddenFraction, 0);
});

test("projection: the origin is the middle, a metre up is above it, and by the right scale", () => {
  const w = 800, h = 800, c = project(view, cam.projection, w, h, [0, 0, 0]);
  assert.deepEqual(c.map(Math.round), [400, 400]);
  const up = project(view, cam.projection, w, h, [0, 1, 0]);
  // 1 m at 3 m with fov 50: tan(25°)·3 = 1.399 m half height → 400·(1/1.399) = 285.9 px above the middle
  assert.ok(Math.abs(400 - up[1] - 400 / (Math.tan((25 * Math.PI) / 180) * 3)) < 0.01, `${400 - up[1]}`);
  assert.equal(project(view, cam.projection, w, h, [0, 0, 5]), null, "behind the eye is nowhere");
});

const seated = { origin: [0, 0, 0], facing: [0, 0, 1], bones: { leftLowerLeg: [0.2, 0.18, 0.2], rightLowerLeg: [-0.2, 0.18, 0.2], leftUpperLeg: [0.07, 0.1, -0.05], rightUpperLeg: [-0.07, 0.1, -0.05], leftUpperArm: [0.14, 0.62, 0], rightUpperArm: [-0.14, 0.62, 0], head: [0, 0.8, 0] }, hemFront: { y: 0.3, z: 0.4, n: 5 }, hatWidth: 0.42, camera: cam };

test("the ruler's readings: heights above where he stands, the hem against the knee, the hat against the shoulders", () => {
  const r = readings(seated);
  assert.equal(r.kneeHeight, 0.18); assert.equal(r.shoulderHeight, 0.62); assert.equal(r.hemFrontHeight, 0.3);
  assert.equal(r.hemAboveKnee, 0.12, "a hem 12 cm above the knee");
  assert.equal(r.shoulderWidth, 0.28); assert.equal(r.hatOverShoulder, 1.5);
  const up = readings({ ...seated, origin: [0, 0.4, 0], bones: Object.fromEntries(Object.entries(seated.bones).map(([k, v]) => [k, [v[0], v[1] + 0.4, v[2]]])), hemFront: { y: 0.7, z: 0.4, n: 1 } });
  assert.equal(up.kneeHeight, 0.18, "he sits on a seat 0.4 m high: heights are above the seat, not the floor"); assert.equal(up.hemAboveKnee, 0.12);
});

test("the ruler's ticks are in height order and carry 1.18 m, the knee, the shoulder and the hem", () => {
  const t = rulerTicks(readings(seated)), hs = t.map((x) => x[0]);
  assert.deepEqual(hs, [...hs].sort((a, b) => a - b));
  for (const v of [1.18, 0.18, 0.62, 0.3]) assert.ok(hs.includes(v), String(v));
});

test("the ruler on the picture: 1.18 m long by the camera's scale, upright, and the lap and hem lines across", () => {
  const w = 800, h = 800, ls = rulerLines(seated, w, h), post = ls.find((l) => l[5] === "post"), px = 400 / (Math.tan((25 * Math.PI) / 180) * 3);
  assert.ok(post, "the post");
  assert.ok(Math.abs(post[0] - post[2]) < 1e-6, "upright");
  const tick = ls.find((l) => l[5] === "tick" && /1\.18/.test(l[4]));
  // the post stands 0.55 m to his left (+x for him facing +z), at the origin's depth: a metre-eighteen from the floor
  const foot = project(view, cam.projection, w, h, [0.55, 0, 0]), head = project(view, cam.projection, w, h, [0.55, 1.18, 0]);
  assert.ok(Math.abs(tick[1] - head[1]) < 1e-6 && Math.abs(foot[1] - head[1] - 1.18 * px * 3 / 3) < 1);
  assert.ok(ls.some((l) => l[5] === "hem") && ls.some((l) => l[5] === "knee"));
  // the hem line sits above the knee line on the picture (smaller y) when the hem is higher
  const hem = ls.find((l) => l[5] === "hem"), knee = ls.find((l) => l[5] === "knee"); assert.ok(hem[1] < knee[1]);
});

test("the lap box lies round the knees and over them, inside the picture's reach", () => {
  const b = lapBox(seated, 800, 800); assert.ok(b[2] > b[0] && b[3] > b[1]);
  const knee = project(view, cam.projection, 800, 800, [0.2, 0.18, 0.2]);
  assert.ok(knee[0] > b[0] && knee[0] < b[2] && knee[1] > b[1] && knee[1] < b[3], "a knee is inside the box");
});

test("the verdict says buried when the best view shows under a fifth of the hand, and high when the hem is over the knee", () => {
  const views = [{ handAlone: 1000, handVisible: 0 }, { handAlone: 1000, handVisible: 20 }, { handAlone: 1000, handVisible: 150 }];
  const bad = verdict({ hemAboveKnee: 0.1 }, views); assert.equal(bad.handsBuried, true); assert.equal(bad.hemHigh, true); assert.equal(bad.ok, false);
  const good = verdict({ hemAboveKnee: -0.03 }, [{ handAlone: 1000, handVisible: 600 }]); assert.equal(good.ok, true);
});

test("the silhouette picture: him in his flat colours with a dark rim, the scene as pale lines, nothing else", () => {
  const w = 12, h = 12, n = new Uint8Array(w * h * 4).fill(200), id = new Uint8Array(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 6; x < w; x++) { const o = (y * w + x) * 4; n[o] = n[o + 1] = n[o + 2] = 40; }   // a hard edge down the scene at x = 6
  for (let y = 3; y < 9; y++) for (let x = 2; x < 5; x++) { const o = (y * w + x) * 4; id[o] = 0; id[o + 1] = 255; id[o + 2] = 255; }   // robe
  const s = silhouette(n, id, w, h), at = (x, y) => [...s.slice((y * w + x) * 3, (y * w + x) * 3 + 3)];
  assert.deepEqual(at(3, 5), PALETTE.robe, "the robe is cyan");
  assert.deepEqual(at(2, 5), [20, 20, 20], "its rim is dark");
  assert.ok(at(6, 1)[0] < 200, "the scene's edge shows as a line"); assert.equal(at(0, 0)[0], 255, "paper elsewhere");
});

test("the hook is the workbench's: not in a visitor's page, and not without ?review=1", () => {
  assert.equal(reviewOn({ dev: false, hostname: "temple.rushiwowen.co", search: "?review=1" }), false);
  assert.equal(reviewOn({ dev: false, hostname: "temple-walk-canary.bole-chen.workers.dev", search: "?review=1" }), false);
  assert.equal(reviewOn({ dev: true, hostname: "127.0.0.1", search: "" }), false);
  assert.equal(reviewOn({ dev: false, hostname: "pr-0-temple-walk-preview.test", search: "?review=1" }), true);
  const y = fs.readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(y, /review"\) === "1" && onBench\(\{ dev: !!import\.meta\.env\.DEV, hostname: location\.hostname \}\)\) import\("\.\/src\/review\.js"\)/, "yard.js opens the module only inside both gates");
  assert.doesNotMatch(y, /^import .*review\.js/m, "and never imports it statically");
});
