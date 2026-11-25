# One figure's face, from its generated original to a baked statue and its paint anchors, in one command (issue #463):
#
#   python3 tools/t05-statue/face-build.py <name> <tag> [--tilt=10] [--anchors-from=<anchors.json>] [--colour=<anchor file name>] [--anchors-only] [--quick] [--measure=<glb>] [--recipe=<face-recipe.json> (recipe-L2.json adds the lower face's push back)]
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
tilt = float(opt.get("tilt", 10))
spec = json.load(open(os.path.join(here, name, "repair.json")))
face = json.load(open(os.path.join(here, name, "face.json")))   # the figure's face landmarks before any face op (stage frame, metres)
D = os.path.join(root, face.get("dir", "tools/out/t05/tripo-six"))   # where its files are (Sakyamuni's sample is in tripo-370)
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
snap_op = {"op": "snapshot", "name": "bow", "note": "the points as the bow leaves them: what the upper face is held to (#701)"}
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
if "anchors-from" in opt:   # the eyes, turned with the head, for the face ops that work on the lids
  _a = json.load(open(opt["anchors-from"]))["anchors"]
  pts["eyes"] = {k: [round(q, 3) for q in bowed(_a[k])[:2]] for k in ("eyeL", "eyeR") if k in _a}
pj = os.path.join(here, name, f"points-{tag}.json"); json.dump(pts, open(pj, "w"))
final = os.path.join(D, f"{name}-{tag}.glb"); j = os.path.join(here, name, f"repair-{tag}.json")
if not only:
  fops = json.loads(run(os.path.join(here, "face-ops.py"), pre, pj, f"--recipe={opt.get('recipe', os.path.join(here, 'face/recipe.json'))}"))
  _R = json.load(open(opt.get("recipe", os.path.join(here, "face/recipe.json"))))
  if _R.get("lowerback"):   # #701: the lower face pressed back as one mass (repair.py `lowerback`), laid on this figure's own slit and neck
    L = _R["lowerback"]; z0 = round(pts["mouth"][1] / s - L["below"], 4); z1 = round(z0 - L["span"], 4)
    fops = fops + [{"op": "lowerback", "note": f"the lower face (lip, chin, jaw) pressed back {L['d']} m, whole within {L['x0']} m of the middle, easing out by {L['x1']} m, from z {z0} down to {z1} and out by {round(z1 - L['fz'], 4)} (file units, z up, {L['below']} under the bowed slit), in front of y {round(-neck['c'][1] / s, 4)} (the neck's axis); relaxed {L['iter']} passes (#701, 自拟)",
                    "d": round(L["d"] / s, 5), "z0": z0, "fz0": L["fz0"], "z1": z1, "fz": L["fz"], "x0": round(L["x0"] / s, 5), "x1": round(L["x1"] / s, 5),
                    "front": round(-neck["c"][1] / s, 4), "ffront": L["ffront"], "smooth": {"iter": L["iter"], "lam": L["lam"]}}]
  if _R.get("chinshape"):   # #701: the lower profile rebuilt (repair.py `chinshape`): a soft groove, a round chin behind the lip
    C = _R["chinshape"]; m_ = 1 / s
    fops = fops + [{"op": "chinshape", "from": "bow", "z0": round(pts["mouth"][1] / s, 4), "s": round(s, 4), "k_groove": C["k_groove"], "k_chin": C["k_chin"], "arc_keep": C.get("arc_keep", 0.5), "bow": tilt, "chin_behind": face.get("chinBehind", C.get("chin_behind", 0.009)), "lip0": C["lip0"] * m_, "lip1": C["lip1"] * m_, "gr0": C["gr0"] * m_, "gr1": C["gr1"] * m_,
                    "chin0": C["chin0"] * m_, "chin1": C["chin1"] * m_, "jaw": C["jaw"] * m_, "bin": C["bin"] * m_, "span": C["span"] * m_, "xm": C["xm"] * m_, "x0": C["x0"] * m_, "x1": C["x1"] * m_,
                    "front": round(-neck["c"][1] / s, 4), "ffront": C["ffront"], "smooth": {"iter": C["iter"], "lam": C["lam"]}, "dsmooth": C["dsmooth"], "ramp": C["ramp"],
                    "note": f"the lower profile from the lower lip to the jaw rebuilt: the groove under the lip at {C['k_groove']} of r3c's depth, the chin at {C['k_chin']} of r3c's bulge over the lip-to-jaw line (#701, 自拟)"}]
  if _R.get("hold") and face.get("nose"):   # #701: the upper face is the bow's own: whole from the tip of the nose up, eased to none at its base (face.json "nose": metres above the slit)
    _slit = pts["mouth"][1] / s - _R["lowerback"]["below"] + _R["lowerback"]["below"]   # the bowed slit (file units)
    _tip = _slit + face["nose"]["tipAboveSlit"] / s - _R.get("holdEarly", 0.008); _base = _slit + face["nose"]["baseAboveSlit"] / s
    fops = fops + [{"op": "hold", "from": "bow", "z0": round(_tip, 4), "z1": round(_base, 4), "note": f"the upper face held to the bow's shape: whole from the nose's tip (z {round(_tip, 4)}) up, easing to none at its base (z {round(_base, 4)}) (#701)"}]
    j = repair(base_ops + [tilt_op, snap_op] + small + fops, final)
  else:
    j = repair(base_ops + [tilt_op] + small + fops, final)
  if "quick" in opt: print(json.dumps({"repair": j, "glb": final})); sys.exit(0)   # --quick: the full-detail mesh only, for tuning a recipe by eye (no levels, no bake, no anchors)
  for t, e in (("60000", "0.02"), ("20000", "0.05"), ("6000", "0.1")):
    subprocess.run(["node", os.path.join(root, "tools/t05-statue.mjs"), final, os.path.join(D, f"{name}-{tag}.{t}.glb"), f"--tris={t}", f"--error={e}"], check=True, capture_output=True)
  run(os.path.join(here, "bake.py"), final, os.path.join(D, f"{name}-{tag}.60000.glb"), os.path.join(D, f"{name}-{tag}b.60000.glb"), "--size=2048", "--uv=xatlas",
      f"--head={round(neck['z0'] / s - 0.002, 4)}", "--cage=0.0012", "--ray=0.0025")
# paint anchors: the unbowed set turned with the head; then the lids, the mouth and the eight landmarks from the mesh
if "anchors-from" in opt:
  # the lips and lids are measured on `--measure=<glb>` (default the figure itself): lowerback moves the flesh from 0.0046 under the slit down, which face-ratios' crease search (4 cm either side of the slit) then reads as a different mouth; the same figure built without it has the same lips
  measure = opt.get("measure") or final
  src = json.load(open(opt["anchors-from"])); a = src["anchors"]; mouth0 = list(a["mouth"])
  # only the face's named points turn with the head; the boxes' corners (far behind the face, they would rise when turned
  # and open a gap of robe colour across the cheeks) move down with the mouth instead
  eyes0 = {k: a[k][:2] for k in ("eyeL", "eyeR") if k in a}   # the eyes before the bow turns them
  for k in ("neckFront", "neckBack", "hairFront", "hairBack", "earL", "earR", "eyeL", "eyeR", "mouth", "urna", "neckB", "lobeL", "lobeR"):
    if k in a: a[k] = [round(q, 3) for q in bowed(a[k])]
  drop = a["mouth"][1] - mouth0[1]
  # the head's box reaches further forward: bowed, the front of the curls moves past where it stood (a patch of robe
  # colour at the hairline at 15°)
  if "skinMax" in a: a["skinMax"][2] = round(a["skinMax"][2] + 0.3, 3)
  for k in ("jawMin", "chinMin"):
    if k in a: a[k][1] = round(a[k][1] + drop, 3)
  eyes = {"eyeL": a["eyeL"][:2], "eyeR": a["eyeR"][:2]}
  pts2 = {**pts, "eyes": eyes}; json.dump(pts2, open(pj, "w")); r = json.loads(run(os.path.join(here, "face-ratios.py"), "mesh", measure, pj))
  if not all(k in r["eyes"] for k in ("eyeL", "eyeR")):   # #701: face-ratios looks for the carved lid in the frame the bow is turned back to; where the bow carries the eye out of its search window (Krakucchanda: lids at 7.01 m, bowed guess 6.87) the guess is where the eye stood before the bow
    pts2 = {**pts, "eyes": eyes0}; json.dump(pts2, open(pj, "w")); r = json.loads(run(os.path.join(here, "face-ratios.py"), "mesh", measure, pj))
  e = r["eyes"]; a["lidL"] = [a["eyeL"][0], e["eyeL"]["y"], e["eyeL"]["rise"]]; a["lidR"] = [a["eyeR"][0], e["eyeR"]["y"], e["eyeR"]["rise"]]
  c = r["corners"]; a["lipHalf"] = round((abs(c["L"]) + abs(c["R"])) / 2, 3)
  # the lip's paint covers the carved lips, from 2.5 cm over the upper lip's foremost point to 1.5 cm under the lower's, and
  # out to the corners (a rim of skin round a narrower painted lip read as a pout: the 3D review's third round)
  # r7: the lips are thin, told by the groove and the colour; the paint is the concept's lip, 0.28 of the mouth's width
  # tall (vermilion over width, concept-points.json), centred a little under the slit, no wider than the corners, its
  # soft edge 2 mm (paint.js); nothing more round it (the 3D review's fourth round: a pink halo outside the lip)
  # the width is the concept's: 0.30 of the face (the art director's r6 review; measured corners read short once the lips
  # are softened); the height 0.14 of that width each way, centred on the slit so that the carved upper lip is painted too
  # the height is the carved lips' own: from 1.2 cm under the lower lip's foremost point to 3.5 cm over the slit, which is
  # as deep as the upper lip's red goes on the concept (the rest of the carved upper lip, up to the nose, is the philtrum's)
  wv = 0.30 * r["faceW_m"]; a["lipHalf"] = round(wv / 2, 3)
  top = r["slit"] + 0.035; bot = r["slit"] - (r["points"]["slit"][0] - r["points"]["lowerLip"][0]) - 0.012
  a["mouth"] = [a["mouth"][0], round((top + bot) / 2 + 0.015, 3), a["mouth"][2]]; a["lipH"] = round((top - bot) / 2, 3)   # +1.5 cm: the stage's frame stands the mesh's slit that much higher than this measure (read off the r7 close-ups)
  for k in ("jawMin", "chinMin"): a[k][1] = round(a[k][1] + (a["mouth"][1] - (mouth0[1] + drop)), 3)   # and with the mouth's own move from the bow to the measured slit
  colour = opt.get("colour", f"{name}-t05")
  json.dump(src, open(os.path.join(root, "tools/t05-hall/paint", colour + ".json"), "w"), ensure_ascii=False, indent=1)
  print(json.dumps({"ratios": {k: r[k] for k in ("mouthW", "lipH", "lipFwd", "sulcus", "w_m", "faceW_m")}, "lid": [a["lidL"], a["lidR"]], "lipHalf": a["lipHalf"], "anchors": colour}))
print(json.dumps({"repair": j, "glb": final, "baked": os.path.join(D, f"{name}-{tag}b.60000.glb")}))
