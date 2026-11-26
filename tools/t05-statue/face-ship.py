# The shipping pose's head for one figure, as a repair file (issue #701, the art director on dc28ce4: the r3c mouth standing upright and level is good; the pained look is looking up at a
# tall face from 1.2 m; real great figures bow their heads a little): r3c's own ops, the head bowed `--tilt` degrees, the lips as r3c has them (nothing of the f2 face ops), the lips' ends
# lifted (mouthlift), the nasolabial folds and the lines down the chin's sides softened outside the lips (flatblocks), and the chin rebuilt (chinshape, L4's numbers).
#
#   python3 tools/t05-statue/face-ship.py <name> <tag> --tilt=10 [--chin-shift=0.015] [--lift=0.024] [--lift-up=0] [--lift-sz=0.035] [--no-furrows] [--no-lift] [--nl=0.5 --nl-r=0.012 --nl-soft=0.02] [--uplip=0.5] [--nl-x0= --nl-x1= --nl-z1= (the capsule's ends: across at the nose's wing, across and height over the slit at its foot)] [--philtrum=0.7] [--chin-smooth=0.2 (--chin-smooth-dz= --chin-smooth-ax= --chin-smooth-ay= --chin-smooth-soft=)] [--corners=0.5 --corners-x=0.155 (across, metres; the mouth's corners stand at 0.25) --corners-r= --corners-soft=] [--mar=0.1] [--ridge=0.15 --ridge-dz=-0.31] [--lips=0.85 (the lips' relief kept to this share)] [--fill=1 (--fill-sx=0.035: fill the chin's middle groove up to the lobes)] [--cleft [--cleft-k=0.3 --cleft-r=0.012 --cleft-soft=0.035]] [--bell=1 (the chin's bell wider by this factor)] [--prebow=10 (the file's head is already bowed that much)] [--no-base (the file already has r3c's body ops, as a grafted figure does)] [--unfold (smooth any triangle the bow turned past 87 degrees)] [--lean=4 (the whole figure above the lotus leaned forward about the seat's back edge, the head's --tilt then added to it)] [--out=<repair.json>]
#
# Writes tools/t05-statue/<name>/repair-<tag>.json; run repair.py on it as for any figure. Positions are the bowed figure's, worked out from face.json the way face-build.py works them out.
import sys, json, os, math
here = os.path.dirname(os.path.abspath(__file__))
name, tag = sys.argv[1], sys.argv[2]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[3:] if a.startswith("--"))
tilt = float(opt.get("tilt", 10)); prebow = float(opt.get("prebow", 0)); lean = float(opt.get("lean", 0)); shift = float(opt.get("chin-shift", 0.0))
spec = json.load(open(os.path.join(here, name, "repair.json"))); face = json.load(open(os.path.join(here, name, "face.json"))); rec = json.load(open(os.path.join(here, "face", "recipe-L4.json")))
# the lean: points rotate forward about the seat's rear edge (stage: height LP, depth -LD), none at the lotus's top (LA) and whole from LB up
LP, LD, LA, LB = float(opt.get('lean-h', 3.0)), float(opt.get('lean-d', 1.6)), 2.8, 4.0
H, FH = face["height"], face["fileHeight"]; s = H / FH; neck = face["neck"]; F = face["features"]
def leaned(p):   # stage (x, height, depth)
  if not lean: return list(p)
  x, y, z = p; a = math.radians(lean) * min(max((y - LA) / (LB - LA), 0), 1); dh, dz = y - LP, z + LD   # the pivot stands at stage depth -LD; forward is +z
  return [x, LP + dh * math.cos(a) - dz * math.sin(a), -LD + dz * math.cos(a) + dh * math.sin(a)]
if lean:
  nc = leaned([0, neck["c"][0], neck["c"][1]]); neck = dict(neck); neck["c"] = [nc[1], nc[2]]; neck["z0"] = leaned([0, neck["z0"], neck["c"][1]])[1]
  F = {k: (leaned(v) if isinstance(v, list) and len(v) == 3 else v) for k, v in F.items()}
if prebow:   # the file's head is already bowed this much (a grafted figure made on a file that was): its features stand where that bow put them
  def _pre(p):
    x, y, z = p; cy, cz = neck["c"]; a = math.radians(prebow) * min(max((y - (neck["z0"] - neck["fade"])) / neck["fade"], 0), 1) * min(max((neck["rx"] - abs(x)) / neck["fx"], 0), 1)
    dy, dz = y - cy, z - cz; return [x, cy + dy * math.cos(a) - dz * math.sin(a), cz + dz * math.cos(a) + dy * math.sin(a)]
  F = {k: (_pre(v) if isinstance(v, list) and len(v) == 3 else v) for k, v in F.items()}
base = [] if "no-base" in opt else [o for o in spec["ops"] if o["op"] in ("squeeze", "zband", "xband", "smooth", "laplace", "headscale")]
tilt_op = {"op": "tilt", "note": f"head bowed {tilt}° about the neck (the shipping pose, #701)", "c": [0, round(-neck["c"][1] / s, 4), round(neck["c"][0] / s, 4)], "deg": tilt, "z0": round(neck["z0"] / s, 4), "fade": round(neck["fade"] / s, 4), "rx": round(neck["rx"] / s, 4), "fx": round(neck["fx"] / s, 4)}
def bowed(p):
  x, y, z = p; cy, cz = neck["c"]; a = math.radians(tilt) * min(max((y - (neck["z0"] - neck["fade"])) / neck["fade"], 0), 1) * min(max((neck["rx"] - abs(x)) / neck["fx"], 0), 1)
  dy, dz = y - cy, z - cz; return [x, cy + dy * math.cos(a) - dz * math.sin(a), cz + dz * math.cos(a) + dy * math.sin(a)]
slit = bowed([0, F["mouth"][1], F["mouth"][2]])[1]   # the bowed slit's height, stage metres
front = round(-neck["c"][1] / s, 4); m = 1 / s; C = rec["chinshape"]
chin = {"op": "chinshape", "from": "bow", "z0": round(slit / s, 4), "s": round(s, 4), "k_groove": C["k_groove"], "k_chin": C["k_chin"], "arc_keep": C["arc_keep"], "bow": tilt + lean + prebow, "chin_behind": face.get("chinBehind", 0.009), "chin_shift": shift,
        "lip0": C["lip0"] * m, "lip1": C["lip1"] * m, "gr0": C["gr0"] * m, "gr1": C["gr1"] * m, "chin0": C["chin0"] * m, "chin1": C["chin1"] * m, "jaw": C["jaw"] * m, "bin": C["bin"] * m, "span": C["span"] * m, "xm": C["xm"] * m,
        "x0": C["x0"] * m * float(opt.get("bell", 1.0)), "x1": 0.40 * m * float(opt.get("bell", 1.0)), "front": front, "ffront": C["ffront"], "smooth": {"iter": C["iter"], "lam": C["lam"]}, "dsmooth": C["dsmooth"], "ramp": C["ramp"],
        "note": "the lower profile from the lower lip to the jaw rebuilt on r3c's own: the groove at 0.85 of its depth, the chin behind the lip's tip, a wide bell across the face (#701, 自拟)"}
fb = lambda k, bl, note, it=150: {"op": "flatblocks", "s": round(s, 4), "front": front, "iter": it, "k": k, "blocks": bl, "note": note}
# outside the lips: the lips (|x| < 0.145 m, from 4.5 cm under to 4.5 cm over the slit) are r3c's, whole; the blocks start and end outside that box and ease out over 2 cm
nl = [{"kind": "capsule", "p0": [sg * float(opt.get("nl-x0", 0.115)), slit + 0.13], "p1": [sg * float(opt.get("nl-x1", 0.135)), slit + float(opt.get("nl-z1", 0.06))], "r": float(opt.get("nl-r", 0.012)), "soft": float(opt.get("nl-soft", 0.02))} for sg in (1, -1)]
mar = [{"kind": "capsule", "p0": [sg * 0.15, slit - 0.06], "p1": [sg * 0.165, slit - 0.14], "r": 0.012, "soft": 0.02} for sg in (1, -1)]
lift = {"op": "mouthlift", "s": round(s, 4), "z0": round((slit + float(opt.get("lift-up", 0.0))) / s, 4), "a": float(opt.get("lift", 0.024)), "x0": 0.03, "x1": 0.13, "x2": 0.17, "x3": 0.27, "sz": float(opt.get("lift-sz", 0.035)), "front": front, "note": "the lips' ends lifted (#701, 自拟)"}
cleft = fb(float(opt.get("cleft-k", 0.3)), [{"kind": "capsule", "p0": [0.0, slit - 0.10], "p1": [0.0, slit - 0.26], "r": float(opt.get("cleft-r", 0.012)), "soft": float(opt.get("cleft-soft", 0.035))}], "the chin's middle groove (r3c's, where the chin has one) softened: detail kept to 0.3 (#701, 自拟)", int(opt.get("cleft-iter", 150)))
lean_op = {"op": "tilt", "note": f"the figure above the lotus leaned {lean}° about the seat's rear edge (#701)", "c": [0, round(LD / s, 4), round(LP / s, 4)], "deg": lean, "z0": round(LB / s, 4), "fade": round((LB - LA) / s, 4)}
ops = base + [{"op": "snapshot", "name": "pre", "note": "the points before the lean and the bow"}] + ([lean_op] if lean else []) + [tilt_op, {"op": "snapshot", "name": "bow", "note": "the points as the bow leaves them"}, chin]
if "no-furrows" not in opt: ops += [fb(0.4, nl, "the nasolabial folds from the nose's wing to above the lip's corner: detail kept to 0.4, outside the lips (#701, 自拟)"),
                                    fb(0.4, mar, "the lines from under the lip's corner down the chin's sides: detail kept to 0.4, outside the lips (#701, 自拟)")]
if "cleft" in opt: ops += [cleft]
if "nl" in opt: ops += [fb(float(opt["nl"]), nl, "the nasolabial folds (nose's wing to above the lip's corner): detail kept to this share, outside the lips (#701, 自拟)", 300)]
if "philtrum" in opt: ops += [fb(float(opt["philtrum"]), [{"kind": "capsule", "p0": [sg * 0.03, slit + 0.03], "p1": [sg * 0.03, slit + 0.11], "r": 0.012, "soft": float(opt.get("philtrum-soft", 0.015))} for sg in (1, -1)], "the two ridges of the philtrum: detail kept to this share (#701, 自拟)")]
if "uplip" in opt: ops += [fb(float(opt["uplip"]), [{"kind": "capsule", "p0": [sg * 0.06, slit + 0.055], "p1": [sg * 0.14, slit + 0.035], "r": 0.012, "soft": 0.02} for sg in (1, -1)], "the ridge outside the upper lip's red, from the philtrum's side toward the mouth's corner: relief kept to this share; the red, the slit and the lips' thickness stay (#701, 自拟)")]
if "chin-smooth" in opt: ops += [fb(float(opt["chin-smooth"]), [{"kind": "ellipse", "c": [0.0, slit + float(opt.get("chin-smooth-dz", -0.19))], "ax": float(opt.get("chin-smooth-ax", 0.12)), "ay": float(opt.get("chin-smooth-ay", 0.07)), "soft": float(opt.get("chin-smooth-soft", 0.03))}], "the lumps on the chin's pad taken down: detail kept to this share, inside an ellipse on the pad only (the lips, the corners and the chin's outline stay; #701, 自拟)", int(opt.get("chin-smooth-iter", 400)))]
if "corners" in opt: ops += [fb(float(opt["corners"]), [{"kind": "capsule", "p0": [sg * float(opt.get("corners-x", 0.155)), slit + 0.015], "p1": [sg * (float(opt.get("corners-x", 0.155)) + 0.02), slit - 0.03], "r": float(opt.get("corners-r", 0.016)), "soft": float(opt.get("corners-soft", 0.02))} for sg in (1, -1)], "the dimples at the lips' ends: their depth kept to this share, outside the lips (#701, 自拟)")]
if "mar" in opt: ops += [fb(float(opt["mar"]), mar, "the lines from under the lip's corner down the chin's sides taken out (detail kept to this share, 400 passes; #701, 自拟)", 400)]
if "ridge" in opt: ops += [fb(float(opt["ridge"]), [{"kind": "capsule", "p0": [-0.13, slit + float(opt.get("ridge-dz", -0.31))], "p1": [0.13, slit + float(opt.get("ridge-dz", -0.31))], "r": float(opt.get("ridge-r", 0.02)), "soft": 0.03}], "the soft ridge across under the chin taken out (#701, 自拟)", 400)]
if "lips" in opt: ops += [fb(float(opt["lips"]), [{"kind": "capsule", "p0": [-0.12, slit], "p1": [0.12, slit], "r": 0.045, "soft": 0.02}], "both lips' relief over the surface round them kept to this fraction (depth only: the slit, the outline and the corners stay where they are; #701, 自拟)")]
if "fill" in opt: ops += [{"op": "chinfill", "s": round(s, 4), "z0": round((slit - 0.10) / s, 4), "z1": round((slit - 0.27) / s, 4), "sx": float(opt.get("fill-sx", 0.035)), "k": float(opt.get("fill", 1.0)), "xs0": 0.03, "xs1": 0.09, "front": front, "ffront": 0.03, "smooth": {"iter": 60, "lam": 0.5}, "note": "the chin's middle groove filled to the lobes' tops: one round face (#701, 自拟)"}]
if "no-lift" not in opt: ops += [lift]
if "unfold" in opt: ops += [{"op": "unfold", "s": round(s, 4), "from": "pre", "limit": 0.05, "ring": 2, "iter": 6, "note": "no triangle left turned past 87 degrees from where it stood before the lean and the bow (#701)"}]
out = os.path.join(here, name, f"repair-{tag}.json"); json.dump({**{k: v for k, v in spec.items() if k not in ("ops", "turn")}, "turn": 0 if "no-base" in opt else spec.get("turn", 0), "ops": ops}, open(out, "w"), ensure_ascii=False, indent=1); print(out, "slit (bowed)", round(slit, 3))
