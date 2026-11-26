# Pack and upload one figure's shipping files (issue #701): the full and zoned meshes to ship-701/, the baked file in three forms (as baked, PNG + meshopt, WebP + meshopt) to ship-701/baked/, their sha256 into the
# asset register as one row, and the sizes printed.
#
#   HF_TOKEN=<any placeholder> NODE_USE_ENV_PROXY=1 python3 tools/t05-statue/ship-upload.py <name> <ver> "<what was done to it, one line>"
import sys, os, hashlib, json, subprocess, csv, io, shutil
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here)); O = f"{root}/tools/out/t05/tripo-six"
name, ver, what = sys.argv[1:4]; tmp = f"/tmp/up-{name}"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
sh = lambda *a: subprocess.run([str(x) for x in a], check=True, capture_output=True, text=True, cwd=root).stdout
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
files = {"": [f"{name}-{ver}.glb", f"{name}-{ver}z.glb"], "baked/": []}
for f in files[""]: shutil.copy(f"{O}/{f}", f"{tmp}/{f}")
zb = f"{O}/{name}-{ver}zb.glb"; b = f"{tmp}/{name}-{ver}b.glb"; shutil.copy(zb, b)
sh("node", f"{here}/pack.mjs", zb, f"{tmp}/{name}-{ver}b.png-meshopt.glb"); sh("node", f"{here}/pack.mjs", zb, f"{tmp}/{name}-{ver}b.webp-meshopt.glb", "--webp")
files["baked/"] = [f"{name}-{ver}b.glb", f"{name}-{ver}b.png-meshopt.glb", f"{name}-{ver}b.webp-meshopt.glb"]
H = {f: sha(f"{tmp}/{f}") for v in files.values() for f in v}; S = {f: os.path.getsize(f"{tmp}/{f}") for f in H}
for pre, fl in files.items():
  open(f"{tmp}/SHA256-{name}.txt", "w").write("".join(f"{H[f]}  {f}\n" for v in files.values() for f in v))
  for f in fl: sh("hf", "buckets", "cp", f"{tmp}/{f}", f"hf://buckets/bolechen/temple-walk-render/keep/t05-six-buddhas/ship-701/{pre}{f}")
  sh("hf", "buckets", "cp", f"{tmp}/SHA256-{name}.txt", f"hf://buckets/bolechen/temple-walk-render/keep/t05-six-buddhas/ship-701/{pre}SHA256-{name}.txt")
ab = lambda h: h[:8] + "…" + h[-4:]
rows = list(csv.reader(open(f"{root}/docs/t05/asset-register.csv"))); new = list([r for r in rows if r[0] == "STATUE-t05-six-buddhas-ship-baked-701"][0])
new[0] = f"STATUE-t05-{name}-ship-701"
new[1] = (f"hf://buckets/bolechen/temple-walk-render/keep/t05-six-buddhas/ship-701/ (private; not in git, not in app/): {name}-{ver}.glb {ab(H[files[''][0]])} / {name}-{ver}z.glb {ab(H[files[''][1]])} (zoned); "
          f"baked/: {files['baked/'][0]} {ab(H[files['baked/'][0]])} ({S[files['baked/'][0]]/1e6:.1f} MB), .png-meshopt.glb {ab(H[files['baked/'][1]])} ({S[files['baked/'][1]]/1e6:.1f} MB), .webp-meshopt.glb {ab(H[files['baked/'][2]])} ({S[files['baked/'][2]]/1e6:.1f} MB); full list in SHA256-{name}.txt beside them")
new[3] = f"本项目 ship-701 流程的 {name}：{what}"; new[12] = "2026-11-26"
buf = io.StringIO(); csv.writer(buf, lineterminator="\n").writerow(new)
txt = open(f"{root}/docs/t05/asset-register.csv").read().split("\n")
txt = [l for l in txt if not l.startswith(f"STATUE-t05-{name}-ship-701,")]   # a figure made again replaces its own row
open(f"{root}/docs/t05/asset-register.csv", "w").write("\n".join(txt).rstrip("\n") + "\n" + buf.getvalue())
print(json.dumps({"sizes_MB": {f: round(S[f] / 1e6, 2) for f in S}, "sha": {f: H[f][:12] for f in H}}))
