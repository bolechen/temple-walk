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
nlin = 0
if CL.get("lining_box"):
  # (a backing round the corner where the knee's head meets the wrist on the inner side, the T05 lead's ruling after
  # the 3D review: every face there, the robe's, the knee sheet's and the forearm's, is lined `lining_depth` metres
  # inside with a copy wound the other way, so a line of sight through any gap left there meets a face turned toward it)
  lb = np.array(CL["lining_box"]); dep = CL.get("lining_depth", 0.005) / s
  V0 = raw.vertices; ctr = (V0[raw.faces].mean(1) - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
  sel = np.all((ctr > lb[0]) & (ctr < lb[1]), axis=1); F1 = raw.faces[sel]
  # the normals at the points of the surface as one piece (the file splits points along the texture's seams)
  mp = trimesh.Trimesh(V0, raw.faces, process=False); mp.merge_vertices(merge_tex=True, merge_norm=True)
  vn_raw = mp.vertex_normals[mp.faces.ravel()]; vnr = np.zeros_like(V0); vnr[raw.faces.ravel()] = vn_raw
  used = np.unique(F1); remap = -np.ones(len(V0), int); remap[used] = np.arange(len(used)) + len(V0)
  newV = V0[used] - vnr[used] * dep; newF = remap[F1][:, ::-1]
  if CL.get("lining_face"):
    # (the figure is many open shells wound either way, so a copy wound against its face may still turn away (turning
    # each away from the face it lines did worse: 15 of 961 against 5); the lining is only seen through the gap, from
    # the figure's left, in front and below, so each of its faces is turned toward `lining_face`, that direction)
    Vn = np.r_[V0, newV]; tri = Vn[newF]; nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    flip = nrm @ np.array(CL["lining_face"], float) < 0; newF[flip] = newF[flip][:, ::-1]
  uv = getattr(raw.visual, "uv", None)
  if CL.get("lining_two_sided"):
    # (two sheets, the second 1 mm deeper: the shallower turned toward the surface it lines, the deeper away from it,
    # both along the normal they were set back by, so a line of sight reaching the lining from either side meets a
    # face turned toward it first, whichever way the shell it copies was wound)
    V2 = V0[used] - vnr[used] * (dep + CL.get("lining_gap", 0.001) / s); F2 = remap[F1] + len(used)
    nav = vnr[F1].mean(1)
    tri1 = np.r_[V0, newV][newF]; n1 = np.cross(tri1[:, 1] - tri1[:, 0], tri1[:, 2] - tri1[:, 0])
    f1 = np.einsum("ij,ij->i", n1, nav) < 0; newF[f1] = newF[f1][:, ::-1]                 # the shallower: toward the surface
    tri2 = np.r_[V0, newV, V2][F2]; n2 = np.cross(tri2[:, 1] - tri2[:, 0], tri2[:, 2] - tri2[:, 0])
    f2 = np.einsum("ij,ij->i", n2, nav) > 0; F2[f2] = F2[f2][:, ::-1]                      # the deeper: away from it
    newV = np.r_[newV, V2]; newF = np.r_[newF, F2]; used = np.r_[used, used]
  allV = np.r_[V0, newV]; allF = np.r_[raw.faces, newF]
  vis = trimesh.visual.TextureVisuals(uv=np.r_[uv, uv[used]], material=raw.visual.material) if uv is not None else None
  raw = trimesh.Trimesh(allV, allF, visual=vis, process=False); nlin = int(len(newF))
nblob = 0
for cen, rad in CL.get("fill_blobs", []):
  # (a small closed piece set into the last of the gap where the knee's head meets the wrist on the inner side, every
  # face turned outward: what still showed the back of a face there now shows this; the 3D review's backing)
  e = trimesh.creation.icosphere(subdivisions=3); e.apply_scale(np.array(rad, float) / s)
  e.apply_translation(np.array(cen, float) / s + [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])
  uv = getattr(raw.visual, "uv", None); nV = len(raw.vertices)
  vis = trimesh.visual.TextureVisuals(uv=np.r_[uv, np.repeat(uv[:1], len(e.vertices), 0)], material=raw.visual.material) if uv is not None else None
  raw = trimesh.Trimesh(np.r_[raw.vertices, e.vertices], np.r_[raw.faces, e.faces + nV], visual=vis, process=False); nblob += len(e.faces)
raw.export(path)
log_p = os.path.join(out, "varada.json"); log = json.load(open(log_p)) if os.path.exists(log_p) else {}
log.setdefault("cleanup", {})["tidy_faces_taken_out"] = int(len(kill)); log["cleanup"]["lining_faces"] = nlin; log["cleanup"]["fill_blob_faces"] = nblob
log["out"] = {"file": path, "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest()}
json.dump(log, open(log_p, "w"), indent=1); print(json.dumps({"tidy_faces_taken_out": int(len(kill)), "sha256": log["out"]["sha256"]}))
