# The shipping pose's head for one figure, as a repair file (issue #701, the art director on dc28ce4: the r3c mouth standing upright and level is good; the pained look is looking up at a
# tall face from 1.2 m; real great figures bow their heads a little): r3c's own ops, the head bowed `--tilt` degrees, the lips as r3c has them (nothing of the f2 face ops), the lips' ends
# lifted (mouthlift), the nasolabial folds and the lines down the chin's sides softened outside the lips (flatblocks), and the chin rebuilt (chinshape, L4's numbers).
#
#   python3 tools/t05-statue/face-ship.py <name> <tag> --tilt=10 [--chin-shift=0.015] [--lift=0.024] [--lift-up=0] [--lift-sz=0.035] [--no-furrows] [--no-lift] [--cleft] [--out=<repair.json>]
#
# Writes tools/t05-statue/<name>/repair-<tag>.json; run repair.py on it as for any figure. Positions are the bowed figure's, worked out from face.json the way face-build.py works them out.
import sys, json, os, math
here = os.path.dirname(os.path.abspath(__file__))
name, tag = sys.argv[1], sys.argv[2]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[3:] if a.startswith("--"))
tilt = float(opt.get("tilt", 10)); shift = float(opt.get("chin-shift", 0.0))
spec = json.load(open(os.path.join(here, name, "repair.json"))); face = json.load(open(os.path.join(here, name, "face.json"))); rec = json.load(open(os.path.join(here, "face", "recipe-L4.json")))
H, FH = face["height"], face["fileHeight"]; s = H / FH; neck = face["neck"]; F = face["features"]
base = [o for o in spec["ops"] if o["op"] in ("squeeze", "zband", "xband", "smooth", "laplace", "headscale")]
tilt_op = {"op": "tilt", "note": f"head bowed {tilt}° about the neck (the shipping pose, #701)", "c": [0, round(-neck["c"][1] / s, 4), round(neck["c"][0] / s, 4)], "deg": tilt, "z0": round(neck["z0"] / s, 4), "fade": round(neck["fade"] / s, 4), "rx": round(neck["rx"] / s, 4), "fx": round(neck["fx"] / s, 4)}
def bowed(p):
  x, y, z = p; cy, cz = neck["c"]; a = math.radians(tilt) * min(max((y - (neck["z0"] - neck["fade"])) / neck["fade"], 0), 1) * min(max((neck["rx"] - abs(x)) / neck["fx"], 0), 1)
  dy, dz = y - cy, z - cz; return [x, cy + dy * math.cos(a) - dz * math.sin(a), cz + dz * math.cos(a) + dy * math.sin(a)]
slit = bowed([0, F["mouth"][1], F["mouth"][2]])[1]   # the bowed slit's height, stage metres
front = round(-neck["c"][1] / s, 4); m = 1 / s; C = rec["chinshape"]
chin = {"op": "chinshape", "from": "bow", "z0": round(slit / s, 4), "s": round(s, 4), "k_groove": C["k_groove"], "k_chin": C["k_chin"], "arc_keep": C["arc_keep"], "bow": tilt, "chin_behind": face.get("chinBehind", 0.009), "chin_shift": shift,
        "lip0": C["lip0"] * m, "lip1": C["lip1"] * m, "gr0": C["gr0"] * m, "gr1": C["gr1"] * m, "chin0": C["chin0"] * m, "chin1": C["chin1"] * m, "jaw": C["jaw"] * m, "bin": C["bin"] * m, "span": C["span"] * m, "xm": C["xm"] * m,
        "x0": C["x0"] * m, "x1": 0.40 * m, "front": front, "ffront": C["ffront"], "smooth": {"iter": C["iter"], "lam": C["lam"]}, "dsmooth": C["dsmooth"], "ramp": C["ramp"],
        "note": "the lower profile from the lower lip to the jaw rebuilt on r3c's own: the groove at 0.85 of its depth, the chin behind the lip's tip, a wide bell across the face (#701, 自拟)"}
fb = lambda k, bl, note: {"op": "flatblocks", "s": round(s, 4), "front": front, "iter": 150, "k": k, "blocks": bl, "note": note}
# outside the lips: the lips (|x| < 0.145 m, from 4.5 cm under to 4.5 cm over the slit) are r3c's, whole; the blocks start and end outside that box and ease out over 2 cm
nl = [{"kind": "capsule", "p0": [sg * 0.115, slit + 0.13], "p1": [sg * 0.135, slit + 0.06], "r": 0.012, "soft": 0.02} for sg in (1, -1)]
mar = [{"kind": "capsule", "p0": [sg * 0.15, slit - 0.06], "p1": [sg * 0.165, slit - 0.14], "r": 0.012, "soft": 0.02} for sg in (1, -1)]
lift = {"op": "mouthlift", "s": round(s, 4), "z0": round((slit + float(opt.get("lift-up", 0.0))) / s, 4), "a": float(opt.get("lift", 0.024)), "x0": 0.03, "x1": 0.13, "x2": 0.17, "x3": 0.27, "sz": float(opt.get("lift-sz", 0.035)), "front": front, "note": "the lips' ends lifted (#701, 自拟)"}
cleft = fb(0.3, [{"kind": "capsule", "p0": [0.0, slit - 0.10], "p1": [0.0, slit - 0.26], "r": 0.012, "soft": 0.035}], "the chin's middle groove (r3c's, where the chin has one) softened: detail kept to 0.3 (#701, 自拟)")
ops = base + [tilt_op, {"op": "snapshot", "name": "bow", "note": "the points as the bow leaves them"}, chin]
if "no-furrows" not in opt: ops += [fb(0.4, nl, "the nasolabial folds from the nose's wing to above the lip's corner: detail kept to 0.4, outside the lips (#701, 自拟)"),
                                    fb(0.4, mar, "the lines from under the lip's corner down the chin's sides: detail kept to 0.4, outside the lips (#701, 自拟)")]
if "cleft" in opt: ops += [cleft]
if "no-lift" not in opt: ops += [lift]
out = os.path.join(here, name, f"repair-{tag}.json"); json.dump({**{k: v for k, v in spec.items() if k != "ops"}, "ops": ops}, open(out, "w"), ensure_ascii=False, indent=1); print(out, "slit (bowed)", round(slit, 3))
