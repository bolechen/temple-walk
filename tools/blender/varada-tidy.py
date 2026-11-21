# The last tidy of the grafted figure (issue #514, the 3D review: no isolated piece of fewer than 50 faces round the
# knee): the exported file read exactly as tools/blender/varada-check2.py reads it (points merged where they coincide,
# pieces joined through shared edges), and every piece of fewer than `cleanup.island` faces whose middle lies in the
# knee box (with `cleanup.margin`) taken out of the file itself. Blender, which keeps coordinates in single precision
# at the stage's scale, still joins some of these slivers to their neighbours; read back from the file they stand apart.
#
#   python3 tools/blender/varada-tidy.py <varada.json> <out dir>      (rewrites <out>/sakyamuni-varada.glb in place)
import sys, os, json, hashlib
import numpy as np, trimesh
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; T, Kn, CL = cfg["target"], cfg["knee"], cfg.get("cleanup", {})
path = os.path.join(out, "sakyamuni-varada.glb")
raw = trimesh.load(path, force="mesh", process=False)
v = raw.vertices; mn, mx = v.min(0), v.max(0); s = T["height"] / (mx[1] - mn[1])
st = trimesh.Trimesh((v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s, raw.faces.copy(), process=False)
st.merge_vertices(merge_tex=True, merge_norm=True)   # the face order is kept, so face i here is face i of the file
blo, bhi = np.array(Kn["box"][0]), np.array(Kn["box"][1]); e = CL.get("margin", 0.12); isl = CL.get("island", 50)
comp = trimesh.graph.connected_components(st.face_adjacency, nodes=np.arange(len(st.faces)), min_len=1); fc = st.triangles_center
kill = [cs for cs in comp if len(cs) < isl and np.all((fc[cs].mean(0) > blo - e) & (fc[cs].mean(0) < bhi + e))]
kill = np.concatenate(kill) if kill else np.zeros(0, int)
keep = np.ones(len(raw.faces), bool); keep[kill] = False
raw.update_faces(keep); raw.remove_unreferenced_vertices()
raw.export(path)
log_p = os.path.join(out, "varada.json"); log = json.load(open(log_p)) if os.path.exists(log_p) else {}
log.setdefault("cleanup", {})["tidy_faces_taken_out"] = int(len(kill))
log["out"] = {"file": path, "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest()}
json.dump(log, open(log_p, "w"), indent=1); print(json.dumps({"tidy_faces_taken_out": int(len(kill)), "sha256": log["out"]["sha256"]}))
