# The gate for a changed face (issue #701): the same idea as gate.py, for a figure whose head alone was edited (bow, brow, mouth, chin).
#
#   python3 tools/t05-statue/closed/face-gate.py <before.glb> <after.glb> <face.json> [--json=<out.json>] [--move-mm=1]
#
# gate.py judges the grafted hand of Sakyamuni against its original through varada.json and varada-check3; it cannot be pointed at
# a face. This one compares two full-detail files of one figure that share their points (repair.py keeps the order), and
# needs only the figure's face.json (its neck: z0 and fade, and the stage height) to know where the head begins. Five checks:
#   elsewhere   no point below the head line moves more than --move-mm (1 by default; the head line is the neck's z0 less its fade,
#               where the bow's weight is gone, in the stage frame: metres up from the seat, the figure `height` tall)
#   faces       the face count is unchanged (face edits move points, they do not add or remove any)
#   closed      welded open edges, non-manifold edges and pieces of 10 faces or fewer are no more than before; the winding agrees (or did not before)
#   backfaces   raycompare.py's lines from the six visitor places that end on the back of a face are no more than before at each
# Prints a table and exits 1 if any row fails. Before the file already has open edges (r3 of the six has 210, which the original
# does not: the repair's squeeze/zband steps, issue #701), the gate does not mend them; it only forbids more.
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
row("faces: after / before", f"{len(B.faces)} / {len(A.faces)}", "equal", len(B.faces) == len(A.faces))
tj = os.path.join(tmp, "topo.json"); run(os.path.join(here, "topology.py"), before, after, f"--json={tj}"); T = json.load(open(tj)); a, b = T[before], T[after]
row("closed: open edges (before)", f"{b['boundary_edges']} ({a['boundary_edges']})", "<= before", b["boundary_edges"] <= a["boundary_edges"])
row("closed: non-manifold edges (before)", f"{b['nonmanifold_edges']} ({a['nonmanifold_edges']})", "<= before", b["nonmanifold_edges"] <= a["nonmanifold_edges"])
row("closed: pieces of 10 faces or fewer (before)", f"{b['pieces_of_10_faces_or_fewer']} ({a['pieces_of_10_faces_or_fewer']})", "<= before", b["pieces_of_10_faces_or_fewer"] <= a["pieces_of_10_faces_or_fewer"])
row("closed: winding agrees (before)", f"{b['winding_consistent']} ({a['winding_consistent']})", "true, or no worse than before", b["winding_consistent"] or not a["winding_consistent"])   # Kanakamuni's r3 already disagrees (the original does not): the gate forbids making it so, it does not mend it
rays = os.path.join(tmp, "rays.json"); run(os.path.join(here, "raycompare.py"), "--make-grid", rays); S = {}
for k, p in (("a", before), ("b", after)):
  rj = os.path.join(tmp, f"rc-{k}.json"); run(os.path.join(here, "raycompare.py"), p, rays, rj); S[k] = json.load(open(rj))["summary"]
for view in S["b"]:
  v, o = S["b"][view]["back_geom"], S["a"][view]["back_geom"]; row(f"backfaces: {view} (before)", f"{v} ({o})", "<= before", v <= o)
w = max(len(r["check"]) for r in rows)
for r in rows: print(("PASS " if r["ok"] else "FAIL ") + r["check"].ljust(w), str(r["value"]).rjust(16), "  limit", r["limit"])
if "json" in opt: json.dump(rows, open(opt["json"], "w"), indent=1)
bad = [r for r in rows if not r["ok"]]; print(f"\n{len(rows) - len(bad)} of {len(rows)} pass"); sys.exit(1 if bad else 0)
