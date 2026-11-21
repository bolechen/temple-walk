# A normal map baked from a statue's repaired full-detail mesh onto its reduced level (issue #463, the 3D review: repair
# the face on the original, reduce, then bake, so that what the reduced mesh lost comes back from the repaired surface
# and not the generated one). Headless Blender (pip install bpy):
#
#   python3 tools/t05-statue/bake.py <high.glb> <low.glb> <out.glb> [--size=2048] [--cage=0.0035] [--ray=0.007] [--uv=xatlas]
#
# The low mesh is unwrapped (Smart UV Project, one atlas), the high mesh's tangent-space normals baked onto it with
# Cycles' Selected to Active, extruded by `cage` and casting no farther than `ray` (file units: 1 is the figure's
# height, so 0.0035 is about 3 cm on a nine-metre figure, the depth of a fold), and the low mesh written with the map
# as its glTF normal texture (MikkTSpace tangents, as three uses). Also writes <out>.normal.png.
import bpy, sys, json, math
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
hi, lo, out = args; size = int(opt.get("size", 2048)); cage = float(opt.get("cage", 0.0035)); rayd = float(opt.get("ray", 0.007))
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(f):
  before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
  new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
  bpy.ops.object.select_all(action="DESELECT")
  for o in new: o.select_set(True)
  bpy.context.view_layer.objects.active = new[0]
  if len(new) > 1: bpy.ops.object.join()
  o = bpy.context.view_layer.objects.active; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); return o
# --uv: unwrap the low mesh with xatlas first (pip install xatlas trimesh): fewer, larger charts, one atlas
if "uv" in opt:
  import subprocess, os
  tmp = out + ".uv.glb"
  subprocess.run([sys.executable, "-c", f"""
import trimesh, xatlas, numpy as np
m = trimesh.load({lo!r}, force='mesh'); vm, f, uv = xatlas.parametrize(m.vertices, m.faces)
t = trimesh.Trimesh(m.vertices[vm], f, process=False); t.visual = trimesh.visual.TextureVisuals(uv=uv); t.export({tmp!r})
"""], check=True); lo = tmp
H, L = load(hi), load(lo)
# the two files are each normalised by the reducer the same way (t05-statue.mjs keeps the frame), so they overlap
for f in L.data.polygons: f.use_smooth = True
bpy.ops.object.select_all(action="DESELECT"); L.select_set(True); bpy.context.view_layer.objects.active = L
if not L.data.uv_layers:   # unwrapped already (xatlas, `--uv` below) or else by Blender's Smart UV Project, which cuts a reduced statue into thousands of specks
  bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
  bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004); bpy.ops.object.mode_set(mode="OBJECT")
img = bpy.data.images.new("normal", size, size, alpha=False, float_buffer=False); img.colorspace_settings.name = "Non-Color"
mat = bpy.data.materials.new("statue"); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; nm = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(tex.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
bsdf.inputs["Base Color"].default_value = (0.66, 0.54, 0.38, 1); bsdf.inputs["Roughness"].default_value = 0.75
L.data.materials.clear(); L.data.materials.append(mat); nt.nodes.active = tex
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 1
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = cage; bk.max_ray_distance = rayd; bk.margin = 8; bk.normal_space = "TANGENT"
bpy.ops.object.select_all(action="DESELECT"); H.select_set(True); L.select_set(True); bpy.context.view_layer.objects.active = L
bpy.ops.object.bake(type="NORMAL")
img.filepath_raw = out + ".normal.png"; img.file_format = "PNG"; img.save()
bpy.ops.object.select_all(action="DESELECT"); L.select_set(True); bpy.context.view_layer.objects.active = L
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_normals=True, export_tangents=True, export_image_format="AUTO")
print(json.dumps({"high": hi, "low": lo, "out": out, "size": size, "cage": cage, "ray": rayd, "lowTris": len(L.data.polygons)}))
