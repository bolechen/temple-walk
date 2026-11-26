# One figure of the six, from its original to the baked file, in the shipping pose (issue #701): face-ship.py's repair file, repair.py, the face gate against the bow-only baseline, the zones
# (the tiers' boxes laid on this figure from Krakucchanda's by its own mouth, ears and hand anchors), zoned decimation, topology, and the bake with the face left without a normal map.
#
#   python3 tools/t05-statue/ship-fig.py <name> <ver> <NN> [face-ship options...] [--no-bake] [--rest=31000] [--from=<glb> --anchors=<paint file> --tilt=14 --lean=0] [--ears=8500] [--hands=9000]
#
# <NN> is the original's number (01-kasyapa.base_model.glb); outputs go to tools/out/t05/tripo-six/<name>-<ver>{,z,zb}.glb. Prints one JSON line per step and the figure's table at the end.
import sys, os, json, subprocess, math
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here)); O = os.path.join(root, "tools/out/t05/tripo-six")
name, ver, nn = sys.argv[1:4]; rest = [a for a in sys.argv[4:]]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in rest if a.startswith("--"))
fs_opts = [a for a in rest if a.split("=")[0] not in ("--no-bake", "--rest", "--ears", "--hands", "--from", "--anchors", "--keep-zones", "--tilt", "--lean", "--prebow")]
prebow = opt.get("prebow", "0")
tilt = opt.get("tilt", "10"); lean = opt.get("lean", "4")
face = json.load(open(f"{here}/{name}/face.json")); s = face["height"] / face["fileHeight"]
def sh(*a, **k): return subprocess.run([str(x) for x in a], check=True, capture_output=True, text=True, cwd=root, **k).stdout
base = f"{O}/{nn}-{name}.base_model.glb"; full = f"{O}/{name}-{ver}.glb"; r3c = f"{O}/{name}-r3c.glb"
if "from" in opt:   # a figure that is already made up (the grafted Sakyamuni): the file itself is the before, as repair.py reads it (welded, points in its order: the gate and the zones compare point for point)
  base = opt["from"]; r3c = f"{O}/{name}-{ver}.before.glb"; json.dump({"turn": 0, "ops": []}, open(f"/tmp/noops-{name}.json", "w"))
  sh("python3", f"{here}/repair.py", base, f"/tmp/noops-{name}.json", r3c)
sh("python3", f"{here}/face-ship.py", name, ver, f"--tilt={tilt}", f"--lean={lean}", f"--prebow={prebow}", "--chin-shift=0.015", "--no-furrows", *([] if any(a.startswith("--lift") for a in fs_opts) else ["--no-lift"]), *fs_opts)
sh("python3", f"{here}/repair.py", base, f"{here}/{name}/repair-{ver}.json", full); print(json.dumps({"step": "repair", "out": full}))
# the gate: the bow-only baseline (ops up to the snapshot) and the mouth height from the chinshape
d = json.load(open(f"{here}/{name}/repair-{ver}.json")); ops = d["ops"]; i = [(o["op"], o.get("name")) for o in ops].index(("snapshot", "bow")); ch = [o for o in ops if o["op"] == "chinshape"][0]
json.dump({**d, "ops": ops[:i]}, open(f"/tmp/bow-{name}.json", "w")); json.dump({"mouth": [0, round(ch["z0"] * ch["s"], 4)]}, open(f"/tmp/pts-{name}.json", "w"))
bowf = f"{O}/{name}-B4H10bow.glb"
if not os.path.exists(bowf): sh("python3", f"{here}/repair.py", base, f"/tmp/bow-{name}.json", bowf)
g = subprocess.run(["python3", f"{here}/closed/face-gate.py", r3c, full, f"{here}/{name}/face.json", "--move-mm=1000", f"--tilt-baseline={bowf}", f"--points=/tmp/pts-{name}.json"], capture_output=True, text=True, cwd=root).stdout
print(json.dumps({"step": "gate", "last": g.strip().splitlines()[-1], "fails": [l[:160] for l in g.splitlines() if l.startswith("FAIL")]}))
# the zones, from Krakucchanda's
kz = json.load(open(f"{here}/krakucchanda/zones.json")); kf = json.load(open(f"{here}/krakucchanda/face.json")); ks = kf["height"] / kf["fileHeight"]; r = s / ks
an = json.load(open(f"{root}/tools/t05-hall/paint/{opt.get('anchors', name + '-t05')}.json")); an = an.get("anchors", an); ka = json.load(open(f"{root}/tools/t05-hall/paint/krakucchanda-t05.json")); ka = ka.get("anchors", ka)
mo = list(face["features"]["mouth"])
if False:   # (the zones are tested on the head turned back, so the unbowed mouth is the one to use)
  a_ = math.radians(float(opt["prebow"])); cy_, cz_ = face["neck"]["c"]; dy_, dz_ = mo[1] - cy_, mo[2] - cz_
  mo = [mo[0], cy_ + dy_ * math.cos(a_) - dz_ * math.sin(a_), cz_ + dz_ * math.cos(a_) + dy_ * math.sin(a_)]
dy = mo[1] - kf["features"]["mouth"][1]; dz = mo[2] - kf["features"]["mouth"][2]
ex = (abs(an["earL"][0]) + abs(an["earR"][0])) / 2 - (abs(ka["earL"][0]) + abs(ka["earR"][0])) / 2; ez = (an["earL"][2] + an["earR"][2]) / 2 - (ka["earL"][2] + ka["earR"][2]) / 2; ey = (an["earL"][1] + an["earR"][1]) / 2 - (ka["earL"][1] + ka["earR"][1]) / 2
c = json.loads(json.dumps(kz)); T = c["tiers"]
for b in T[0]["boxes"]: b["y0"] = round(b["y0"] + dy, 3); b["y1"] = round(b["y1"] + dy, 3); b["z0"] = round(b["z0"] + dz, 3)
for b in T[1]["boxes"]: b["y0"] = round(b["y0"] + ey, 3); b["y1"] = round(b["y1"] + ey, 3); b["x0"] = round(b["x0"] + ex, 3); b["x1"] = round(b["x1"] + ex, 3); b["z0"] = round(b["z0"] + ez, 3); b["z1"] = round(b["z1"] + ez, 3)
neck = T[2]["boxes"][0]; neck["y0"] = round(neck["y0"] + dy, 3); neck["y1"] = round(neck["y1"] + dy, 3)
hb = []
for pre in sorted({k[:-1] for k in an if k.startswith("hand") and k.endswith("a") and k[:-1] + "b" in an}):
  p, q = an[pre + "a"], an[pre + "b"]; rr = an.get(pre + "r", 0.3); rr = rr if isinstance(rr, (int, float)) else max(rr); m = rr + 0.1
  hb.append({"y0": round(min(p[1], q[1]) - m + 0.2, 3), "y1": round(max(p[1], q[1]) + m + 0.2, 3), "x0": round(min(p[0], q[0]) - m, 3), "x1": round(max(p[0], q[0]) + m, 3), "absx": False, "z0": round(min(p[2], q[2]) - m, 3), "z1": round(max(p[2], q[2]) + m, 3)})
T[2]["boxes"] = [neck] + hb; T[1]["target"] = int(opt.get("ears", 8500)); T[2]["target"] = int(opt.get("hands", 9000)); c["rest"] = int(opt.get("rest", 31000))
zp = f"{here}/{name}/zones.json"
if not os.path.exists(zp) or "keep-zones" not in opt: json.dump(c, open(zp, "w"), indent=1)
zf = f"{O}/{name}-{ver}z.glb"
z = json.loads(sh("node", f"{here}/zoned.mjs", full, zf, f"--scale={s:.3f}", f"--tiers={zp}", f"--member={r3c}", *( [f"--unbow={prebow},{face['neck']['c'][0]},{face['neck']['c'][1]},{face['neck']['z0']},{face['neck']['fade']},{face['neck']['rx']},{face['neck']['fx']}"] if float(prebow) else [] )).strip().splitlines()[-1])
print(json.dumps({"step": "zoned", "tiers": [(t["name"], t["before"], t["after"]) for t in z["tiers"]], "rest": z["rest"]["after"], "total": z["total_after"], "sha": z["sha256"][:12]}))
tp = sh("python3", f"{here}/closed/topology.py", full, zf); print(json.dumps({"step": "topology", "lines": [l[:230] for l in tp.strip().splitlines()]}))
if "no-bake" not in opt:
  head = round(face["neck"]["z0"] / s - 0.002, 4); out = f"{O}/{name}-{ver}zb.glb"
  b = sh("python3", f"{here}/bake.py", full, zf, out, "--size=2048", "--uv=xatlas", f"--head={head}", "--cage=0.0012", "--ray=0.0025", f"--face={zf}.face.json")
  print(json.dumps({"step": "bake", "flattened": [l[:120] for l in b.splitlines() if "flattened" in l], "out": out}))
