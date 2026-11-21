# One figure's face, from its generated original to a baked statue and its paint anchors, in one command (issue #463):
#
#   python3 tools/t05-statue/face-build.py <name> <tag> [--tilt=10] [--anchors-from=<anchors.json>] [--colour=<anchor file name>] [--anchors-only]
#
# Reads tools/t05-statue/<name>/repair.json for the figure's own fixes (whatever is not a face op: squeeze, zband,
# xband, smoothing of a cuff), adds the face's ops in order — the bow (`tilt`, deg from --tilt), the brow's knit and the
# philtrum (`attenuate`), the mouth's corners (`push`), then the mouth and the chin from face/recipe.json laid on the
# figure's own landmarks (face-ops.py, found on the bowed mesh before they apply) — and writes:
#   tools/t05-statue/<name>/repair-<tag>.json, tools/out/t05/tripo-six/<name>-<tag>.glb and its 60k/20k/6k levels,
#   <name>-<tag>b.60000.glb (the head on a normal map of its own), and the figure's paint anchors
#   tools/t05-hall/paint/<colour>.json: the unbowed anchors (--anchors-from) turned with the head, the lids laid on the
#   carved slit and the lips on the measured mouth (face-ratios.py).
# Numbers in the stage's metres are turned into the file's units by the figure's height on its seat (`height`, 8.6 m for
# Vipasyin: 9.0 less the 0.4 m plinth).
import sys, json, subprocess, os, math, copy
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
name, tag = sys.argv[1], sys.argv[2]
opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[3:] if a.startswith("--"))
tilt = float(opt.get("tilt", 10)); D = os.path.join(root, "tools/out/t05/tripo-six")
spec = json.load(open(os.path.join(here, name, "repair.json")))
face = json.load(open(os.path.join(here, name, "face.json")))   # the figure's face landmarks before any face op (stage frame, metres)
H = face["height"]; FILEH = face["fileHeight"]; s = H / FILEH
B = lambda x, y, z: [round(x / s, 5), round(-z / s, 5), round(y / s, 5)]
base_ops = [o for o in spec["ops"] if o["op"] in ("squeeze", "zband", "xband", "smooth", "laplace", "headscale")]
neck = face["neck"]   # pivot [y, z] in the stage frame, z0 and fade (metres), half-width of the head (metres)
tilt_op = {"op": "tilt", "note": f"head bowed {tilt}° about the neck (#463, the 3D review: the face seen from 10 m below reads frowning and pouting when made for the level)",
           "c": [0, round(-neck["c"][1] / s, 4), round(neck["c"][0] / s, 4)], "deg": tilt, "z0": round(neck["z0"] / s, 4), "fade": round(neck["fade"] / s, 4),
           "rx": round(neck["rx"] / s, 4), "fx": round(neck["fx"] / s, 4)}
def bowed(p):   # a stage-frame point turned with the head, as repair.py's tilt turns the mesh
  x, y, z = p; cy, cz = neck["c"]; a = math.radians(tilt) * min(max((y - (neck["z0"] - neck["fade"])) / neck["fade"], 0), 1) * min(max((neck["rx"] - abs(x)) / neck["fx"], 0), 1)
  dy, dz = y - cy, z - cz; return [x, cy + dy * math.cos(a) - dz * math.sin(a), cz + dz * math.cos(a) + dy * math.sin(a)]
F = face["features"]   # unbowed: knit [x, y, z], philtrum, mouth corners
small = [
  {"op": "attenuate", "note": "the knit between the brows kept to 30% of its depth (#463, the 3D review)", "seed": B(*bowed(F["knit"])), "r": round(0.3 / s, 4), "sr": round(0.6 / s, 4), "k": 0.3, "iter": 500},
  {"op": "attenuate", "note": "the philtrum shallower, k 0.5 (#463)", "seed": B(*bowed(F["philtrum"])), "r": round(0.12 / s, 4), "sr": round(0.3 / s, 4), "k": 0.5, "iter": 300},
] + [{"op": "push", "note": f"{side} corner of the mouth up 5 cm (#463)", "seed": B(*bowed(F["corner" + side[0].upper()])), "r": round(0.15 / s, 4), "dir": [0, 0, 1], "d": round(0.05 / s, 4)} for side in ("left", "right")]
run = lambda *a: subprocess.run([sys.executable, *a], check=True, capture_output=True, text=True).stdout
def repair(ops, out):
  j = os.path.join(here, name, f"repair-{tag}.json"); json.dump({**{k: v for k, v in spec.items() if k != "ops"}, "ops": ops}, open(j, "w"), ensure_ascii=False, indent=1)
  run(os.path.join(here, "repair.py"), os.path.join(D, face["source"]), j, out); return j
only = "anchors-only" in opt   # the mesh as built already; redo the paint anchors only
pre = os.path.join(D, f"{name}-{tag}-pre.glb")
if not only: repair(base_ops + [tilt_op] + small, pre)
mouth = bowed([0, F["mouth"][1], F["mouth"][2]])
pts = {"height": H, "mouth": [0, round(mouth[1], 3)], "browY": round(bowed([0, F["browY"], F["knit"][2]])[1], 3), "tilt": tilt, "slitWin": 0.03}
pj = os.path.join(here, name, f"points-{tag}.json"); json.dump(pts, open(pj, "w"))
final = os.path.join(D, f"{name}-{tag}.glb"); j = os.path.join(here, name, f"repair-{tag}.json")
if not only:
  fops = json.loads(run(os.path.join(here, "face-ops.py"), pre, pj, f"--recipe={os.path.join(here, 'face/recipe.json')}"))
  j = repair(base_ops + [tilt_op] + small + fops, final)
  for t, e in (("60000", "0.02"), ("20000", "0.05"), ("6000", "0.1")):
    subprocess.run(["node", os.path.join(root, "tools/t05-statue.mjs"), final, os.path.join(D, f"{name}-{tag}.{t}.glb"), f"--tris={t}", f"--error={e}"], check=True, capture_output=True)
  run(os.path.join(here, "bake.py"), final, os.path.join(D, f"{name}-{tag}.60000.glb"), os.path.join(D, f"{name}-{tag}b.60000.glb"), "--size=2048", "--uv=xatlas",
      f"--head={round(neck['z0'] / s - 0.002, 4)}", "--cage=0.0012", "--ray=0.0025")
# paint anchors: the unbowed set turned with the head; then the lids, the mouth and the eight landmarks from the mesh
if "anchors-from" in opt:
  src = json.load(open(opt["anchors-from"])); a = src["anchors"]; mouth0 = list(a["mouth"])
  # only the face's named points turn with the head; the boxes' corners (far behind the face, they would rise when turned
  # and open a gap of robe colour across the cheeks) move down with the mouth instead
  for k in ("neckFront", "neckBack", "hairFront", "hairBack", "earL", "earR", "eyeL", "eyeR", "mouth", "urna", "neckB", "lobeL", "lobeR"):
    if k in a: a[k] = [round(q, 3) for q in bowed(a[k])]
  drop = a["mouth"][1] - mouth0[1]
  # the head's box reaches further forward: bowed, the front of the curls moves past where it stood (a patch of robe
  # colour at the hairline at 15°)
  if "skinMax" in a: a["skinMax"][2] = round(a["skinMax"][2] + 0.3, 3)
  for k in ("jawMin", "chinMin"):
    if k in a: a[k][1] = round(a[k][1] + drop, 3)
  eyes = {"eyeL": a["eyeL"][:2], "eyeR": a["eyeR"][:2]}
  pts2 = {**pts, "eyes": eyes}; json.dump(pts2, open(pj, "w")); r = json.loads(run(os.path.join(here, "face-ratios.py"), "mesh", final, pj))
  e = r["eyes"]; a["lidL"] = [a["eyeL"][0], e["eyeL"]["y"], e["eyeL"]["rise"]]; a["lidR"] = [a["eyeR"][0], e["eyeR"]["y"], e["eyeR"]["rise"]]
  c = r["corners"]; a["lipHalf"] = round((abs(c["L"]) + abs(c["R"])) / 2, 3)
  # the lip's paint covers the carved lips, from 2.5 cm over the upper lip's foremost point to 1.5 cm under the lower's, and
  # out to the corners (a rim of skin round a narrower painted lip read as a pout: the 3D review's third round)
  top, bot = r["slit"] + (r["points"]["upperLip"][0] - r["points"]["slit"][0]) + 0.025, r["slit"] - (r["points"]["slit"][0] - r["points"]["lowerLip"][0]) - 0.015
  a["mouth"] = [a["mouth"][0], round((top + bot) / 2, 3), a["mouth"][2]]; a["lipH"] = round((top - bot) / 2, 3); a["lipHalf"] = round((abs(c["L"]) + abs(c["R"])) / 2, 3)
  for k in ("jawMin", "chinMin"): a[k][1] = round(a[k][1] + (a["mouth"][1] - (mouth0[1] + drop)), 3)   # and with the mouth's own move from the bow to the measured slit
  colour = opt.get("colour", f"{name}-t05")
  json.dump(src, open(os.path.join(root, "tools/t05-hall/paint", colour + ".json"), "w"), ensure_ascii=False, indent=1)
  print(json.dumps({"ratios": {k: r[k] for k in ("mouthW", "lipH", "lipFwd", "sulcus", "w_m", "faceW_m")}, "lid": [a["lidL"], a["lidR"]], "lipHalf": a["lipHalf"], "anchors": colour}))
print(json.dumps({"repair": j, "glb": final, "baked": os.path.join(D, f"{name}-{tag}b.60000.glb")}))
