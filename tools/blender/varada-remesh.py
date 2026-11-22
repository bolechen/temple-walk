# Tried once and kept for the record: the opening's shell did not come out closed, so this is not part of the build
# (docs/t05/evidence/514-r2-d/). The corner where the grafted wrist meets the knee rebuilt as one closed surface (issue #514, round 2, the T05 lead's
# ruling after the 3D review: "局部重新网格化", one attempt). The patches of the earlier builds sealed each gap that a
# view had found (linings, fans, small fills) and left the next view's gap open; here the surfaces of that corner are
# turned into a volume, the gaps narrower than the closing are filled, and what faces the air is laid back onto the
# figure's own surface.
#
#   python3 tools/blender/varada-remesh.py <varada.json> <out dir>      (rewrites <out>/sakyamuni-varada.glb in place)
#
# `remesh` (or, as committed, `remesh_trial`: the one attempt failed, see docs/t05/evidence/514-r2-d/) in the json: `box` (the part replaced, stage metres), `margin` (the volume reaches this far past it), `voxel`
# (metres, the 3D review's limit 1.5 mm), `shell` (each surface thickened by this much in the volume), `close` (gaps up
# to twice this are filled), the air outside being the piece of air the box's front face mostly opens onto,
# `hand_clear` (new faces this near the hand, which is kept as it is, go). Steps:
#   1. the surfaces in the volume's box (the hand's too, so the closing reaches it) sampled to points every half voxel
#   2. voxels within `shell` of a point are solid; closed (dilated then eroded by `close`), with Euclidean distances
#   3. marching cubes on the solid (padded so the surface is closed), then Blender's voxel remesher at `voxel` on that
#      closed mesh (even quads, no slivers), triangulated
#   4. kept: the faces whose outward side is that outside air (not the body's inside)
#   5. each kept point laid onto the figure's surface (its nearest point), or where no surface lies under it (a gap that
#      was closed) set back by `shell`, the two blended over a voxel or two
#   6. the figure's faces in `box` (not the hand's) taken out; of the new surface, what lies over them is kept, and its
#      border points are put onto the hole's border (nearest point on its edges)
# Writes remesh.json beside the file: the voxel, the faces taken out and put in, the distance of the laid points to the
# surface (median, max), how many points lie over a filled gap, the border gap, thin triangles, pieces.
import sys, os, json, hashlib
import numpy as np, trimesh
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage import measure

cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; T, RM = cfg["target"], cfg.get("remesh") or cfg["remesh_trial"]
path = os.path.join(out, "sakyamuni-varada.glb")
raw = trimesh.load(path, force="mesh", process=False)
v = raw.vertices; mn, mx = v.min(0), v.max(0); s = T["height"] / (mx[1] - mn[1]); off = np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])
V = (v - off) * s; F = raw.faces
h = RM.get("voxel", 0.0015); sh = RM.get("shell", 0.003); cl = RM.get("close", 0.012)
blo, bhi = np.array(RM["box"][0], float), np.array(RM["box"][1], float); mg = RM.get("margin", 0.02)
olo, ohi = blo - mg, bhi + mg
rep = {"voxel_m": h, "shell_m": sh, "close_m": cl, "box": RM["box"]}

# which faces are the hand's (kept as they are): every point of it is a point of the hand as joined
H = np.load(os.path.join(out, "hand-final.npz"))["points"]
dv = cKDTree(H).query(V, k=1)[0]; handv = dv < 1e-4; handf = np.all(handv[F], axis=1)
fc = V[F].mean(1)
inbox = lambda P, lo, hi: np.all((P > lo) & (P < hi), axis=1)
region = inbox(fc, blo, bhi) & ~handf
inouter = inbox(fc, olo - 0.01, ohi + 0.01)
rep["faces_in_box_taken_out"] = int(region.sum())

# 1. points on the surfaces in the volume's box, every half voxel or nearer
sub = trimesh.Trimesh(V, F[inouter], process=False)
area = sub.area; n_pts = int(area / (h / 2) ** 2 * 1.5)
pts, _ = trimesh.sample.sample_surface(sub, n_pts, seed=514)
pts = np.r_[pts, sub.vertices[np.unique(sub.faces)]]
pts = pts[inbox(pts, olo, ohi)]
dims = np.ceil((ohi - olo) / h).astype(int) + 1
occ = np.zeros(dims, bool); ij = np.floor((pts - olo) / h).astype(int); ij = np.clip(ij, 0, dims - 1); occ[ij[:, 0], ij[:, 1], ij[:, 2]] = True
del pts
# 2. the solid: within `shell` of a surface, then closed by `close`
solid = ndi.distance_transform_edt(~occ) * h <= sh; del occ
dil = ndi.distance_transform_edt(~solid) * h <= cl
closed = ndi.distance_transform_edt(dil) * h > cl; del dil
closed |= solid; del solid
rep["voxels"] = [int(d) for d in dims]; print("voxels", dims, int(closed.sum()), flush=True)
air = ~closed; lab, nlab = ndi.label(air)
# (the air outside is the piece of air that most of the box's front face, toward the viewer, opens onto)
fr = lab[:, :, -1]; vals, cnts = np.unique(fr[fr > 0], return_counts=True); exl = int(vals[np.argmax(cnts)])
rep["exterior_share_of_front_face"] = round(float(cnts.max() / fr.size), 3)
outside = lab == exl; del lab, air
# 3. marching cubes on the solid, padded with air so its surface is closed
pad = np.pad(closed.astype(np.float32), 1)
mv, mf, _, _ = measure.marching_cubes(pad, level=0.5, spacing=(h, h, h))
mv = mv - h + olo
rep["marching_cubes_faces"] = int(len(mf)); print("mc", len(mf), flush=True)
import bpy, bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new("slab"); me.from_pydata([tuple(p) for p in mv], [], [tuple(f) for f in mf]); me.update()
ob = bpy.data.objects.new("slab", me); bpy.context.scene.collection.objects.link(ob); bpy.context.view_layer.objects.active = ob
md = ob.modifiers.new("vr", "REMESH"); md.mode = "VOXEL"; md.voxel_size = h; md.adaptivity = 0.0
bpy.ops.object.modifier_apply(modifier="vr")
bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(ob.data); bm.free()
co = np.empty(len(ob.data.vertices) * 3); ob.data.vertices.foreach_get("co", co); RV = co.reshape(-1, 3)
fi = np.empty(len(ob.data.polygons) * 3, int); ob.data.polygons.foreach_get("vertices", fi); RF = fi.reshape(-1, 3)
rep["voxel_remesh_faces"] = int(len(RF))
# 4. the faces whose outward side is the outside air (the solid's own outward normal, found by sampling the solid)
tri = RV[RF]; cen = tri.mean(1); nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
def at(grid, P):
  k = np.floor((P - olo) / h).astype(int); ok = np.all((k >= 0) & (k < dims), axis=1); r = np.zeros(len(P), bool); r[ok] = grid[k[ok, 0], k[ok, 1], k[ok, 2]]; return r
a1 = at(closed, cen + nrm * 1.5 * h); a2 = at(closed, cen - nrm * 1.5 * h)
nrm[a1 & ~a2] *= -1; RF[a1 & ~a2] = RF[a1 & ~a2][:, ::-1]   # every normal out of the solid
keep = at(outside, cen + nrm * 2.0 * h)
RF = RF[keep]; used = np.unique(RF); remap = -np.ones(len(RV), int); remap[used] = np.arange(len(used)); RV = RV[used]; RF = remap[RF]
rep["outer_faces"] = int(len(RF))
# 5. each point laid onto the figure's surface (not the hand's), or set back by `shell` where none lies under it
fig = trimesh.Trimesh(V, F[inouter & ~handf], process=False)
q, dq, tq = trimesh.proximity.closest_point(fig, RV)
vn = trimesh.Trimesh(RV, RF, process=False).vertex_normals
w = np.clip((sh + 3 * h - dq) / (2 * h), 0, 1)
newV = w[:, None] * q + (1 - w[:, None]) * (RV - vn * sh)
over = w > 0.5
rep["laid_points"] = int(over.sum()); rep["points_over_filled_gaps"] = int((~over).sum())
# what lies over the faces taken out (or over a filled gap) inside the box is kept; the hand's place is left to the hand
regset = np.zeros(len(F), bool); regset[np.nonzero(inouter & ~handf)[0][tq]] = False
tq_full = np.nonzero(inouter & ~handf)[0][tq]
vert_ok = (region[tq_full] | ~over) & inbox(newV, blo - h, bhi + h)
hd = cKDTree(H).query(newV, k=1)[0]; vert_ok &= hd > RM.get("hand_clear", 0.0015)
fk = np.all(vert_ok[RF], axis=1)
RF = RF[fk]; used = np.unique(RF); remap = -np.ones(len(newV), int); remap[used] = np.arange(len(used)); newV = newV[used]; RF = remap[RF]
dq = dq[used]; over = over[used]
rep["distance_to_surface_mm"] = {"median": round(float(np.median(dq[over])) * 1000 - sh * 1000, 3), "max_after_laying": None}
# the distance after laying: the laid points against the surface they were laid on
dq2 = trimesh.proximity.closest_point(fig, newV[over])[1]
rep["distance_to_surface_mm"] = {"median": round(float(np.median(dq2)) * 1000, 3), "max": round(float(dq2.max()) * 1000, 3), "points": int(over.sum())}
# 6. the figure's faces in the box taken out, the new surface's border put onto the hole's border
F2 = F[~region]
st2 = trimesh.Trimesh(V, F2, process=False); st2.merge_vertices(merge_tex=True, merge_norm=True)
e_ = np.sort(st2.edges, axis=1); u_, c_ = np.unique(e_, axis=0, return_counts=True); be = u_[c_ == 1]
bmid = st2.vertices[be].mean(1); hole = be[inbox(bmid, blo - 0.02, bhi + 0.02)]
A, B = st2.vertices[hole[:, 0]], st2.vertices[hole[:, 1]]
nm = trimesh.Trimesh(newV, RF, process=False)
e2 = np.sort(nm.edges, axis=1); u2, c2 = np.unique(e2, axis=0, return_counts=True); nb = np.unique(u2[c2 == 1])
# the border points of the new surface near the hole's border, each onto the nearest point of its edges
P = newV[nb]; mids = (A + B) / 2; kd = cKDTree(mids); dd, ii = kd.query(P, k=8)
best = np.full(len(P), np.inf); bestq = P.copy()
for j in range(8):
  a_, b_ = A[ii[:, j]], B[ii[:, j]]; ab = b_ - a_; t_ = np.clip(np.einsum("ij,ij->i", P - a_, ab) / np.maximum(np.einsum("ij,ij->i", ab, ab), 1e-18), 0, 1)
  qq = a_ + t_[:, None] * ab; d_ = np.linalg.norm(P - qq, axis=1); bt = d_ < best; best[bt] = d_[bt]; bestq[bt] = qq[bt]
snap = best < RM.get("snap", 0.006)
newV[nb[snap]] = bestq[snap]
rep["border"] = {"new_border_points": int(len(nb)), "put_on_hole_border": int(snap.sum()), "left_off_mm_max": round(float(best[~snap].min()) * 1000, 2) if (~snap).any() else None}
# assemble: the figure without the box's faces, and the new surface (in the file's frame; its texture coordinates are the
# first point's, the hall paints by place, not by texture)
NV = newV / s + off
uv = getattr(raw.visual, "uv", None)
allV = np.r_[v, NV]; allF = np.r_[F2, RF + len(v)]
vis = trimesh.visual.TextureVisuals(uv=np.r_[uv, np.repeat(uv[:1], len(NV), 0)], material=raw.visual.material) if uv is not None else None
res = trimesh.Trimesh(allV, allF, visual=vis, process=False); res.remove_unreferenced_vertices()
# the new surface's own soundness: thin triangles, edges shared by more than two faces, pieces under 50 faces
tri = newV[RF]; L = np.stack([np.linalg.norm(tri[:, 1] - tri[:, 0], axis=1), np.linalg.norm(tri[:, 2] - tri[:, 1], axis=1), np.linalg.norm(tri[:, 0] - tri[:, 2], axis=1)], 1)
ar2 = 2 * np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / np.maximum(L.max(1), 1e-12)   # twice the area over the longest side: the height
aspect = L.max(1) / np.maximum(ar2, 1e-12)
cnt = np.unique(np.sort(np.r_[RF[:, [0, 1]], RF[:, [1, 2]], RF[:, [2, 0]]], axis=1), axis=0, return_counts=True)[1]
comp = trimesh.graph.connected_components(nm.face_adjacency, nodes=np.arange(len(RF)), min_len=1)
rep["new_surface"] = {"faces": int(len(RF)), "thin_triangles_aspect_over_8": int((aspect > 8).sum()), "edges_shared_by_3_or_more": int((cnt > 2).sum()),
                      "pieces_under_50_faces": int(sum(1 for c in comp if len(c) < 50)), "pieces": int(len(comp))}
rep["faces_total"] = {"before": int(len(F)), "after": int(len(allF)), "original_f1": None}
res.export(path)
np.savez(os.path.join(out, "remesh-patch.npz"), points=newV, faces=RF)
log_p = os.path.join(out, "varada.json"); log = json.load(open(log_p)) if os.path.exists(log_p) else {}
log["remesh"] = rep; log["out"] = {"file": path, "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest()}
json.dump(log, open(log_p, "w"), indent=1); json.dump(rep, open(os.path.join(out, "remesh.json"), "w"), indent=1)
print(json.dumps(rep))
