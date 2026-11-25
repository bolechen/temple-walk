// The gate for a changed face (#701, tools/t05-statue/closed/face-gate.py): a point moved below the head line, a face added, and a
// small move in the head each give the verdict they should, on two little spheres written as GLB. It needs python3 with trimesh,
// scipy, numpy, networkx, rtree and bpy (the same as tools/t05-statue/closed/); a machine without them skips it.
import test from "node:test"; import assert from "node:assert/strict";
import { spawnSync } from "node:child_process"; import { mkdtempSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const probe = spawnSync("python3", ["-c", "import trimesh, scipy, numpy, networkx, rtree, bpy"]);
const have = probe.status === 0;
const dir = mkdtempSync(join(tmpdir(), "face-gate-"));
if (have) {
  const mk = spawnSync("python3", ["-c", `
import trimesh, numpy as np
s = trimesh.creation.icosphere(subdivisions=3, radius=0.5); s.vertices[:, 1] += 0.5   # stands on 0, 1 tall
s.export("${dir}/a.glb")
head = s.copy(); i = int(np.argmax(s.vertices[:, 1])); head.vertices[i, 1] += 0.0005; head.vertices[i, 2] += 0.002; head.export("${dir}/head.glb")   # the crown moves 2 mm
foot = s.copy(); j = int(np.argmin(s.vertices[:, 1])); foot.vertices[j, 1] += 0.01; foot.export("${dir}/foot.glb")   # the base moves 1 cm
more = trimesh.Trimesh(s.vertices, s.faces[:-1], process=False); more.export("${dir}/fewer.glb")
fold = s.copy(); k = int(np.argmax(s.vertices[:, 1])); fold.vertices[k, 1] -= 0.8; fold.export("${dir}/fold.glb")   # the crown pushed through its neighbours: the triangles round it turn over
`]);
  assert.equal(mk.status, 0, mk.stderr.toString());
  writeFileSync(join(dir, "face.json"), JSON.stringify({ height: 1, neck: { z0: 0.6, fade: 0.1 } }));
}
const gate = (after) => spawnSync("python3", ["tools/t05-statue/closed/face-gate.py", join(dir, "a.glb"), join(dir, after), join(dir, "face.json")], { encoding: "utf8" });
test("a move in the head only passes", { skip: !have }, () => { const r = gate("head.glb"); assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /PASS elsewhere/); });
test("a move below the head line fails", { skip: !have }, () => { const r = gate("foot.glb"); assert.equal(r.status, 1); assert.match(r.stdout, /FAIL elsewhere/); });
test("a surface folded over in the head fails", { skip: !have }, () => { const r = gate("fold.glb"); assert.equal(r.status, 1); assert.match(r.stdout, /FAIL folded/); });
test("a different face count fails", { skip: !have }, () => { const r = gate("fewer.glb"); assert.equal(r.status, 1); assert.match(r.stdout, /FAIL (faces|elsewhere)/); });
