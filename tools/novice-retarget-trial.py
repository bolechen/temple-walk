# Route B of issue #80, the Blender half that needs no paid tool, tried with Blender's own Python module (`pip install
# bpy`, 5.3.0, no window). It stands in for what Auto-Rig Pro and a generator would hand us and checks that what follows
# can be done from the command line:
#
#   1. the sculpted body as shipped (app/shared/models/novice.glb, A-pose) is bent into a T-pose, the pose a generator is
#      usually asked for, and its weights thrown away: that is "a new model from the generator";
#   2. a rig with game-engine (Unreal) bone names, the names Auto-Rig Pro's game export writes, is fitted to it in the
#      T-pose and bound with Blender's heat weights (Auto-Rig Pro binds with its own heat or voxel weights: this is the
#      free stand-in for that step, not a measure of its quality);
#   3. RETARGET: the rig is posed so that every joint lies where monk.js's skeleton has it in its A-pose, the mesh is set
#      in that pose, and that pose becomes the rest: the body is now in our bind pose, weighted to their bones;
#   4. it is exported as glTF with its skin, for tools/novice-retarget-trial.mjs to rename and split.
#
#   python -I tools/novice-retarget-trial.py <bones.json> <novice.glb> <out.glb>
#
# A trial for issue #80, step one; nothing it writes is shipped.
import json, math, sys
import bpy
from mathutils import Vector, Matrix

bones_json, src, dst = sys.argv[-3:]
ours = {b["name"]: b for b in json.load(open(bones_json))}
Y = lambda p: Vector((p[0], -p[2], p[1]))   # three.js (y up, +z toward the viewer) → Blender (z up, -y toward the viewer)
J = {n: Y(b["p"]) for n, b in ours.items()}

# Their bones, and where each lies on ours (head at our joint, tail at the next joint down the limb).
UE = [  # name, parent, our joint at the head, our joint at the tail (or an offset)
    ("root", None, "root", Vector((0, 0, 0.1))), ("pelvis", "root", "hips", "spine"), ("spine_01", "pelvis", "spine", "chest"),
    ("spine_02", "spine_01", "chest", "neck"), ("neck_01", "spine_02", "neck", "head"), ("head", "neck_01", "head", Vector((0, 0, 0.16))),
]
for s, side in (("l", "left"), ("r", "right")):
    UE += [(f"clavicle_{s}", "spine_02", side + "Shoulder", side + "UpperArm"), (f"upperarm_{s}", f"clavicle_{s}", side + "UpperArm", side + "LowerArm"),
           (f"lowerarm_{s}", f"upperarm_{s}", side + "LowerArm", side + "Hand"), (f"hand_{s}", f"lowerarm_{s}", side + "Hand", "+arm"),
           (f"thigh_{s}", "pelvis", side + "UpperLeg", side + "LowerLeg"), (f"calf_{s}", f"thigh_{s}", side + "LowerLeg", side + "Foot"),
           (f"foot_{s}", f"calf_{s}", side + "Foot", Vector((0, -0.09, -0.03)))]

def tail_of(head, tail, name):
    if isinstance(tail, Vector): return J[head] + tail
    if tail == "+arm": side = "left" if name.endswith("_l") else "right"; return J[head] + (J[head] - J[side + "LowerArm"]).normalized() * 0.07
    return J[tail]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes:   # one material per part, named for it, so the parts survive the round trip
    o.data.materials.clear(); o.data.materials.append(bpy.data.materials.get(o.name) or bpy.data.materials.new(o.name))
    o.vertex_groups.clear()
print("imported", [(o.name, len(o.data.vertices)) for o in meshes])

def make_rig(name, where):
    arm = bpy.data.armatures.new(name); rig = bpy.data.objects.new(name, arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode="EDIT")
    for n, parent, head, tail in UE:
        eb = arm.edit_bones.new(n); eb.head, eb.tail = where(n, J[head]), where(n, tail_of(head, tail, n))
        if parent: eb.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT"); return rig

def bind(rig):
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    empty = sum(1 for o in meshes for v in o.data.vertices if not v.groups)
    print(rig.name, "bound with heat weights;", empty, "vertices got no weight")

def pose_to(rig, target):
    """Pose each bone, parent first, so that its head and tail lie on `target(name)` (head, tail) in armature space."""
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode="POSE")
    for n, *_ in UE:
        pb = rig.pose.bones[n]; head, tail = target(n)
        y = (tail - head).normalized(); rest = pb.bone.matrix_local.to_3x3(); q = rest.col[1].rotation_difference(y)
        m = (q.to_matrix() @ rest).to_4x4(); m.translation = head; pb.matrix = m; bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")

def bake_pose(rig):
    """Set the meshes in the rig's present pose and make that pose the rig's rest."""
    for o in meshes:
        bpy.context.view_layer.objects.active = o; mod = next(m for m in o.modifiers if m.type == "ARMATURE")
        bpy.ops.object.modifier_copy(modifier=mod.name); bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode="POSE"); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode="OBJECT")

# 1. the "generated" model: ours bent from the A-pose into a T-pose
a_rig = make_rig("apose", lambda n, p: p); bind(a_rig)
def t_pose(n):
    head, tail = J[next(u for u in UE if u[0] == n)[2]], tail_of(*next((u[2], u[3], u[0]) for u in UE if u[0] == n))
    side = 1 if n.endswith("_l") else -1
    if n.split("_")[0] in ("upperarm", "lowerarm", "hand"):
        s = "left" if side > 0 else "right"; sh = J[s + "UpperArm"]
        flat = lambda p: sh + Vector((side * (p - sh).length, 0, 0))   # each arm joint swung up level with the shoulder
        return flat(head), flat(tail) if (tail - sh).length > 1e-6 else tail
    return head, tail
pose_to(a_rig, t_pose); bake_pose(a_rig)
for o in meshes: o.modifiers.clear(); o.vertex_groups.clear(); o.parent = None
T = {n: (a_rig.data.bones[n].head_local.copy(), a_rig.data.bones[n].tail_local.copy()) for n, *_ in UE}
bpy.data.objects.remove(a_rig)

# 2. their rig, fitted in the T-pose, bound with heat weights (Auto-Rig Pro's step)
rig = make_rig("ue", lambda n, p: p); bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode="EDIT")
for n, (h, t) in T.items(): rig.data.edit_bones[n].head, rig.data.edit_bones[n].tail = h, t
bpy.ops.object.mode_set(mode="OBJECT"); bind(rig)

# 3. retarget: their joints onto ours, in our A-pose, and that pose made the rest
pose_to(rig, lambda n: (J[next(u for u in UE if u[0] == n)[2]], tail_of(*next((u[2], u[3], u[0]) for u in UE if u[0] == n))))
bake_pose(rig)
err = max((rig.data.bones[n].head_local - J[next(u for u in UE if u[0] == n)[2]]).length for n, *_ in UE)
print(f"after the retarget their joints lie within {err * 1000:.2f} mm of ours")

# 4. export with the skin
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_def_bones=True)
print("wrote", dst)
