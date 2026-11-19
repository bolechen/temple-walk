# Bone heat weights for the novice's trousers and skirt (issue #246, third round): Blender's automatic weights
# ("Parent with Automatic Weights", heat diffusion from each bone over the surface) on the skeleton monk.js builds,
# instead of weights copied from the figure built in code, whose formulas were written for a long robe over slim legs.
#
#   node tools/novice-retarget-trial.mjs bones tools/out/bones.json
#   NOVICE_PIECES=tools/out/pieces.json node tools/novice-tripo.mjs <dir>
#   <python with bpy> -I tools/novice-heat.py tools/out/bones.json tools/out/pieces.json tools/out/heat.json
#   NOVICE_HEAT=tools/out/heat.json node tools/novice-tripo.mjs <dir>
#
# Blender's Python module (`pip install bpy`, 5.3.0, GPL-2.0-or-later) runs here with no window and only in tools/: it
# computes numbers that the tool writes into the file; nothing of Blender ships with the page. Each group of pieces is
# weighed on its own, with only its own bones allowed to deform it (GROUPS): the trousers and leg wraps by the hips and
# the legs, the leg wraps by the shins, the upper robe and its sleeves by the trunk and the arms, the skirt by the hips and
# the four skirt bones. Copies of one point (texture seams) are welded first, so the
# heat flows across seams, and each copy takes its point's weights.
import json, sys
import bpy
from mathutils import Vector

bones_json, pieces_json, out_json = sys.argv[-3:]
ours = {b["name"]: b for b in json.load(open(bones_json))}
pieces = json.load(open(pieces_json))
Y = lambda p: Vector((p[0], -p[2], p[1]))   # three.js (y up, +z toward the viewer) → Blender (z up, -y toward the viewer)
J = {n: Y(b["p"]) for n, b in ours.items()}

GROUPS = {
    "legs": {"pieces": lambda p: p["name"] == "tripo_part_7", "bones": ["hips", "leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot"]},
    # the leg wraps go with the shins alone: with the foot's weight in their lower edge, it pulled out in white strips
    # behind the back foot of a stride (#256 review)
    "wraps": {"pieces": lambda p: p["name"] in ("tripo_part_4", "tripo_part_10"), "bones": ["leftLowerLeg", "rightLowerLeg"]},
    # the upper robe and both sleeves together, by the trunk, the shoulders and the arms: with the weights of the figure
    # built in code, the cloth under a raised arm tore in streaks and opened at the armpit (#256 review)
    "upper": {"pieces": lambda p: p["name"] in ("tripo_part_6", "tripo_part_1", "tripo_part_13"),
              "bones": ["hips", "spine", "chest", "neck", "leftShoulder", "leftUpperArm", "leftLowerArm", "rightShoulder", "rightUpperArm", "rightLowerArm"]},
    "skirt": {"pieces": lambda p: p["name"] == "tripo_part_5", "bones": ["hips", "robeFront", "robeBack", "robeLeft", "robeRight"]},
}
import os
if os.environ.get("HEAT_SKIRT_THIGHS"): GROUPS["skirt"]["bones"] += ["leftUpperLeg", "rightUpperLeg"]
# Where each bone's tail lies (Blender needs a length and a direction): the next joint down, or a few centimetres on.
# The skirt bones all start at one point; each runs down to the side of the skirt it carries.
TAIL = {"root": ("+", (0, 0.1, 0)), "hips": "spine", "spine": "chest", "chest": "neck", "neck": "head", "head": ("+", (0, 0.16, 0)),
        "robeFront": ("+", (0, -0.25, 0.16)), "robeBack": ("+", (0, -0.25, -0.15)), "robeLeft": ("+", (0.16, -0.25, 0)), "robeRight": ("+", (-0.16, -0.25, 0)),
        "sashTail": ("+", (0, -0.2, 0.02)), "hat": ("+", (0, 0.05, -0.05))}
for s in ("left", "right"):
    TAIL.update({s + "Shoulder": s + "UpperArm", s + "UpperArm": s + "LowerArm", s + "LowerArm": s + "Hand", s + "Hand": ("arm", s),
                 s + "UpperLeg": s + "LowerLeg", s + "LowerLeg": s + "Foot", s + "Foot": ("+", (0, -0.03, 0.09))})

def tail(name):
    t = TAIL[name]
    if isinstance(t, str): return J[t]
    if t[0] == "+": return J[name] + Y(t[1])
    side = t[1]; return J[name] + (J[name] - J[side + "LowerArm"]).normalized() * 0.07

bpy.ops.wm.read_factory_settings(use_empty=True)
arm_data = bpy.data.armatures.new("novice"); arm = bpy.data.objects.new("novice", arm_data); bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode="EDIT")
for name, b in ours.items():
    e = arm_data.edit_bones.new(name); e.head = J[name]; e.tail = tail(name)
for name, b in ours.items():
    if b["parent"]: arm_data.edit_bones[name].parent = arm_data.edit_bones[b["parent"]]
bpy.ops.object.mode_set(mode="OBJECT")

out = {}
for gname, g in GROUPS.items():
    chosen = [p for p in pieces if g["pieces"](p)]
    # one mesh for the group, copies of a point welded; remember where each piece's vertices went
    verts, index, faces, maps = [], {}, [], {}
    for p in chosen:
        P, m = p["P"], []
        for i in range(len(P) // 3):
            k = (round(P[i * 3], 5), round(P[i * 3 + 1], 5), round(P[i * 3 + 2], 5))
            if k not in index: index[k] = len(verts); verts.append(Y(k))
            m.append(index[k])
        maps[p["name"]] = m
        I = p["I"]; faces += [(m[I[t]], m[I[t + 1]], m[I[t + 2]]) for t in range(0, len(I), 3) if len({m[I[t]], m[I[t + 1]], m[I[t + 2]]}) == 3]
    me = bpy.data.meshes.new(gname); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(gname, me); bpy.context.collection.objects.link(ob)
    for b in arm_data.bones: b.use_deform = b.name in g["bones"]
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    names = {vg.index: vg.name for vg in ob.vertex_groups}
    weights = [[[names[e.group], round(e.weight, 5)] for e in v.groups if e.weight > 1e-4] for v in me.vertices]
    empty = sum(1 for w in weights if not w)
    print(f"{gname}: {len(verts)} points, {len(faces)} faces, {empty} points the heat did not reach")
    for p in chosen: out[p["name"]] = [weights[i] for i in maps[p["name"]]]
json.dump(out, open(out_json, "w"))
print("wrote", out_json)
