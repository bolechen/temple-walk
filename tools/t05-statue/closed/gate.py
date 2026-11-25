# The gate for a changed figure: one command, one table (issue #578). Run it after every step of an edit.
#
#   python3 tools/t05-statue/closed/gate.py <varada.json> <out dir> [--rays=<rays.json>] [--json=<out.json>]
#
# <out dir> is where tools/blender/varada.py wrote sakyamuni-varada.glb (and the arm-moved.npy and hand-final.npz that
# tools/blender/varada-check3.py reads). Four checks, each against the original (the varada.json's target.file, f1):
#   elsewhere   varada-check3's `elsewhere`: every point of the original outside the intended change areas has a point
#               of the result within 1 mm (#578 criterion 3)
#   faces       the result's faces are at most 110% of the original's (#578 criterion 3)
#   closed      topology.py's welded count: open edges and non-manifold edges no more than the original's own, the faces'
#               winding agrees, and the open edges inside the arm box are no more than the original's there
#   backfaces   raycompare.py's lines (41x41 from each of six places; `--make-grid` writes the set): the count that end on the
#               back of a face is 0 at the west aisle's nearest point, the 4.2 m place and sakya (the original has 0 at all),
#               and no more than the original's at the other three
# Prints a table and exits 1 if any row fails.
import sys, os, json, subprocess, tempfile
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(os.path.dirname(here)))
cfgp, out = args[0], args[1]; cfg = json.load(open(cfgp)); orig = os.path.join(root, cfg["target"]["file"]); res = os.path.join(out, "sakyamuni-varada.glb")
py = sys.executable; tmp = tempfile.mkdtemp(); rows = []
def run(*a): return subprocess.run([py, *a], capture_output=True, text=True, cwd=root)
def row(name, value, limit, ok): rows.append({"check": name, "value": value, "limit": limit, "ok": bool(ok)})
# elsewhere
r = run(os.path.join(root, "tools/blender/varada-check3.py"), cfgp, out); c3 = os.path.join(out, "check3.json")
if os.path.exists(c3):
  e = json.load(open(c3))["elsewhere"]; row("elsewhere: largest move outside the change areas (mm)", e["largest_move_mm"], "<= 1", e["largest_move_mm"] <= 1)
else: row("elsewhere (varada-check3 did not write check3.json)", r.stderr[-200:], "<= 1", False)
# topology, both files
tj = os.path.join(tmp, "topo.json"); run(os.path.join(here, "topology.py"), orig, res, f"--json={tj}"); T = json.load(open(tj)); a, b = T[orig], T[res]
row("faces: result / original", round(b["faces"] / a["faces"], 4), "<= 1.10", b["faces"] <= 1.10 * a["faces"])
row("closed: open edges (original)", f"{b['boundary_edges']} ({a['boundary_edges']})", "<= original", b["boundary_edges"] <= a["boundary_edges"])
row("closed: non-manifold edges (original)", f"{b['nonmanifold_edges']} ({a['nonmanifold_edges']})", "<= original", b["nonmanifold_edges"] <= a["nonmanifold_edges"])
row("closed: winding agrees", b["winding_consistent"], "true", b["winding_consistent"])
row("closed: pieces of 10 faces or fewer (original)", f"{b['pieces_of_10_faces_or_fewer']} ({a['pieces_of_10_faces_or_fewer']})", "<= original", b["pieces_of_10_faces_or_fewer"] <= a["pieces_of_10_faces_or_fewer"])
lj = [os.path.join(tmp, f"loops-{k}.json") for k in "ab"]; run(os.path.join(here, "loops.py"), orig, orig, lj[0]); run(os.path.join(here, "loops.py"), res, orig, lj[1])
la, lb = (json.load(open(p))["edges_in_box"] for p in lj)
row("closed: open edges in the arm box (original)", f"{lb} ({la})", "<= original", lb <= la)
# back faces
rays = opt.get("rays") or os.path.join(tmp, "rays.json")
if not opt.get("rays"): run(os.path.join(here, "raycompare.py"), "--make-grid", rays)
S = {}
for k, p in (("a", orig), ("b", res)):
  rj = os.path.join(tmp, f"rc-{k}.json"); run(os.path.join(here, "raycompare.py"), p, rays, rj); S[k] = json.load(open(rj))["summary"]
for view in S["b"]:
  must0 = view in ("aisle-nearest", "aisle42", "sakya"); v, o = S["b"][view]["back_geom"], S["a"][view]["back_geom"]
  row(f"backfaces: {view} (original)", f"{v} ({o})", "0" if must0 else "<= original", v == 0 if must0 else v <= o)
w = max(len(r["check"]) for r in rows)
for r in rows: print(("PASS " if r["ok"] else "FAIL ") + r["check"].ljust(w), str(r["value"]).rjust(14), "  limit", r["limit"])
if "json" in opt: json.dump(rows, open(opt["json"], "w"), indent=1)
bad = [r for r in rows if not r["ok"]]; print(f"\n{len(rows) - len(bad)} of {len(rows)} pass"); sys.exit(1 if bad else 0)
