# The gate for a changed face (issue #701): the same idea as gate.py, for a figure whose head alone was edited (bow, brow, mouth, chin).
#
#   python3 tools/t05-statue/closed/face-gate.py <before.glb> <after.glb> <face.json> [--json=<out.json>] [--move-mm=1] [--tilt-baseline=<bow-only.glb> --points=<points.json>]
#
# gate.py judges the grafted hand of Sakyamuni against its original through varada.json and varada-check3; it cannot be pointed at
# a face. This one compares two full-detail files of one figure that share their points (repair.py keeps the order), and
# needs only the figure's face.json (its neck: z0 and fade, and the stage height) to know where the head begins. Six checks:
#   elsewhere   no point below the head line moves more than --move-mm (1 by default; the head line is the neck's z0 less its fade,
#               where the bow's weight is gone, in the stage frame: metres up from the seat, the figure `height` tall)
#   folded      no triangle's normal turned over (more than 90 degrees from its normal before: the surface folded on itself; #701)
#   faces       the face count is unchanged (face edits move points, they do not add or remove any)
#   closed      welded open edges, non-manifold edges and pieces of 10 faces or fewer are no more than before; the winding agrees
#   backfaces   raycompare.py's lines from the six visitor places that end on the back of a face are no more than before at each
# Prints a table and exits 1 if any row fails. Before the file already has open edges, the gate does not mend them; it only forbids more. (r3 of the six had 210 from repair.py's weld at 1e-6, issue #701, and Kanakamuni's r3 disagreed in winding; the weld is 1e-8 now and r3c is closed and agrees.)
import sys, os, json, subprocess, tempfile
import numpy as np, trimesh
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
here = os.path.dirname(os.path.abspath(__file__)); py = sys.executable; tmp = tempfile.mkdtemp(); rows = []
before, after, facef = args; face = json.load(open(facef)); lim = float(opt.get("move-mm", 1))
def row(name, value, limit, ok): rows.append({"check": name, "value": value, "limit": limit, "ok": bool(ok)})
def run(*a): return subprocess.run([py, *a], capture_output=True, text=True)
A = trimesh.load(before, force="mesh", process=False); B = trimesh.load(after, force="mesh", process=False)
if len(A.vertices) != len(B.vertices): row("elsewhere (the files do not share their points)", len(B.vertices), str(len(A.vertices)), False)
else:
  s = face["height"] / (A.bounds[1][1] - A.bounds[0][1]); y = (A.vertices[:, 1] - A.bounds[0][1]) * s
  below = y < face["neck"]["z0"] - face["neck"]["fade"] - 0.001; mv = np.linalg.norm(A.vertices - B.vertices, axis=1) * s * 1000
  worst = float(mv[below].max()) if below.any() else 0.0
  row("elsewhere: largest move below the head line (mm)", round(worst, 4), f"<= {lim}", worst <= lim)
if len(A.faces) == len(B.faces):   # folded: a triangle whose normal turned over (more than 90 degrees from before) is a fold in the surface (#701)
  def nrm(M): a, b, c = (M.vertices[M.faces[:, i]].astype(np.float64) for i in range(3)); n = np.cross(b - a, c - a); return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-30)
  flips = int(((nrm(A) * nrm(B)).sum(1) < 0).sum()); row("folded: triangles whose normal turned over (> 90 degrees) from before", flips, "0", flips == 0)
if "tilt-baseline" in opt and "points" in opt and len(A.vertices) == len(B.vertices):
  # the upper face is the bow's own (#701, the art director: eyes, brows and nose as r3c's): against the same figure bowed and nothing else
  Tb = trimesh.load(opt["tilt-baseline"], force="mesh", process=False); sp = json.load(open(opt["points"])); slit = sp["mouth"][1]; sM = face["height"] / (Tb.bounds[1][1] - Tb.bounds[0][1])
  yy = (Tb.vertices[:, 1] - Tb.bounds[0][1]) * sM; dd = np.linalg.norm(Tb.vertices - B.vertices, axis=1) * 1000   # model millimetres: the file's unit (the figure is 1 tall) x 1000, as the 3D review reads them
  nose = face.get("nose", {}).get("tipAboveSlit", 0.234); fr = lambda Mx: Mx.faces
  def zone(lo):
    vm = yy >= slit + lo; fm = vm[B.faces].all(1); return vm, fm
  def turn(fm):
    a_, b_ = (lambda M: tuple(M.vertices[M.faces[fm][:, i]].astype(np.float64) for i in range(3)))(Tb), (lambda M: tuple(M.vertices[M.faces[fm][:, i]].astype(np.float64) for i in range(3)))(B)
    na = np.cross(a_[1] - a_[0], a_[2] - a_[0]); nb = np.cross(b_[1] - b_[0], b_[2] - b_[0]); c = (na * nb).sum(1) / np.maximum(np.linalg.norm(na, axis=1) * np.linalg.norm(nb, axis=1), 1e-30)
    return float(np.degrees(np.arccos(np.clip(c, -1, 1))).max()) if len(c) else 0.0
  for name, lo, lim in (("eyes and brows (slit +0.30 m up)", 0.30, 0.05), ("the nose's tip and up", nose, 0.1)):
    vm, fm = zone(lo); mx = float(dd[vm].max()) if vm.any() else 0.0; row(f"upper face: largest move from the bow, {name} (model mm)", round(mx, 4), f"<= {lim}", mx <= lim)
  vm, fm = zone(0.30); tt = turn(fm); row("upper face: largest turn of a triangle's normal from the bow, eyes and brows (deg)", round(tt, 3), "<= 1", tt <= 1)
lg = after + ".log.json"   # repair.py's log beside the file: lowerback must not touch anything above the slit (the eyes, brows and nose stay as the bow left them)
if os.path.exists(lg):
  for e_ in json.load(open(lg))["log"]:
    if e_["op"] == "lowerback" and "above_z0_max_move" in e_:
      s_ = face["height"] / face["fileHeight"]; mm_ = e_["above_z0_max_move"] * s_ * 1000
      row("lowerback: largest move above the slit line (mm)", round(mm_, 4), "<= 0.01", mm_ <= 0.01)
row("faces: after / before", f"{len(B.faces)} / {len(A.faces)}", "equal", len(B.faces) == len(A.faces))
tj = os.path.join(tmp, "topo.json"); run(os.path.join(here, "topology.py"), before, after, f"--json={tj}"); T = json.load(open(tj)); a, b = T[before], T[after]
row("closed: open edges (before)", f"{b['boundary_edges']} ({a['boundary_edges']})", "<= before", b["boundary_edges"] <= a["boundary_edges"])
row("closed: non-manifold edges (before)", f"{b['nonmanifold_edges']} ({a['nonmanifold_edges']})", "<= before", b["nonmanifold_edges"] <= a["nonmanifold_edges"])
row("closed: pieces of 10 faces or fewer (before)", f"{b['pieces_of_10_faces_or_fewer']} ({a['pieces_of_10_faces_or_fewer']})", "<= before", b["pieces_of_10_faces_or_fewer"] <= a["pieces_of_10_faces_or_fewer"])
row("closed: winding agrees", b["winding_consistent"], "true", b["winding_consistent"])
rays = os.path.join(tmp, "rays.json"); run(os.path.join(here, "raycompare.py"), "--make-grid", rays); S = {}
for k, p in (("a", before), ("b", after)):
  rj = os.path.join(tmp, f"rc-{k}.json"); run(os.path.join(here, "raycompare.py"), p, rays, rj); S[k] = json.load(open(rj))["summary"]
for view in S["b"]:
  v, o = S["b"][view]["back_geom"], S["a"][view]["back_geom"]; row(f"backfaces: {view} (before)", f"{v} ({o})", "<= before", v <= o)
w = max(len(r["check"]) for r in rows)
for r in rows: print(("PASS " if r["ok"] else "FAIL ") + r["check"].ljust(w), str(r["value"]).rjust(16), "  limit", r["limit"])
if "json" in opt: json.dump(rows, open(opt["json"], "w"), indent=1)
bad = [r for r in rows if not r["ok"]]; print(f"\n{len(rows) - len(bad)} of {len(rows)} pass"); sys.exit(1 if bad else 0)
