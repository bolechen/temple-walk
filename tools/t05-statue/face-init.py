# A figure's face.json, which face-build.py reads, worked out from its paint anchors (issue #463: "the other six take
# the same recipe, its numbers given by their own landmarks").
#
#   python3 tools/t05-statue/face-init.py <name> <anchors.json> <height on its seat, m> [--source=<NN-name.base_model.glb>]
#       [--dir=tools/out/t05/tripo-six] [--repaired=<name>-r3.glb]   (Sakyamuni's sample: --dir=tools/out/t05/tripo-370
#       --source=sakyamuni-mv-1.base_model.glb --repaired=sakyamuni-r1.glb)
#
# The anchors are the figure's paint anchors before any face op (tools/t05-hall/paint/<name>-t05.json as r3 left
# them), in the stage frame (metres; x across, y up from the seat, z toward the viewer); the height is the stage's
# (its `h` less the 0.4 m plinth). Each landmark is placed against the anchors as Vipasyin's face.json, read by hand on
# its mesh, stands against Vipasyin's anchors:
#   mouth      the anchor's height less 0.022 m, depth less 0.015 m
#   philtrum   0.06 m over the mouth; corners 0.25 m either side, 0.02 m under it; knit halfway between the eyes and the
#              urna; brow 0.02 m over the knit
#   neck       pivot 0.16 m under the front of the neck, halfway between its front and back in depth; z0 0.073 m under
#              the front of the neck; head half-width the skin's half-width plus 0.13 m
# fileHeight is the height of the figure's repaired file (<name>-r3.glb, glTF y), the unit face-build turns metres into.
import sys, json, os
import trimesh
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
name, af, H = sys.argv[1], sys.argv[2], float(sys.argv[3]); opt = dict(a[2:].split("=", 1) for a in sys.argv[4:] if a.startswith("--"))
a = json.load(open(af))["anchors"]
d = opt.get("dir", "tools/out/t05/tripo-six")
src = opt.get("source") or next(f for f in os.listdir(os.path.join(root, d)) if f.endswith(f"-{name}.base_model.glb"))
m = trimesh.load(os.path.join(root, d, opt.get("repaired", f"{name}-r3.glb")), force="mesh"); fh = float(m.bounds[1][1] - m.bounds[0][1])
r = lambda q: round(q, 3)
my, mz = a["mouth"][1] - 0.022, a["mouth"][2] - 0.015
knit = (a["urna"][1] + (a["eyeL"][1] + a["eyeR"][1]) / 2) / 2; kz = (a["urna"][2] + (a["eyeL"][2] + a["eyeR"][2]) / 2) / 2
nf, nb = a["neckFront"], a["neckBack"]
face = {"about": f"{name}'s face before any face op (#463), in the stage frame (metres, y up from the seat, z toward the viewer), worked out from its r3 paint anchors by tools/t05-statue/face-init.py (placed as Vipasyin's face.json stands against its anchors); the neck's pivot and the head's width for the bow. face-build.py reads it.",
        "height": H, "fileHeight": round(fh, 4), "source": src, "dir": d,
        "neck": {"c": [r(nf[1] - 0.16), r((nf[2] + nb[2]) / 2)], "z0": r(nf[1] - 0.073), "fade": 0.305, "rx": r((a["skinMax"][0] - a["skinMin"][0]) / 2 + 0.13), "fx": 0.175},
        "features": {"knit": [0, r(knit), r(kz - 0.07)], "philtrum": [0, r(my + 0.06), r(mz + 0.05)], "cornerL": [0.25, r(my), r(mz + 0.01)], "cornerR": [-0.25, r(my), r(mz + 0.01)],
                     "mouth": [0, r(my), r(mz)], "browY": r(knit + 0.02)}}
out = os.path.join(here, name, "face.json"); json.dump(face, open(out, "w"), ensure_ascii=False, indent=1); print(out, json.dumps(face["neck"]), json.dumps(face["features"]))
