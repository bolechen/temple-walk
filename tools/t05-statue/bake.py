# A normal map baked from a statue's repaired full-detail mesh onto its reduced level (issue #463, the 3D review: repair
# the face on the original, reduce, then bake, so that what the reduced mesh lost comes back from the repaired surface
# and not the generated one). Headless Blender (pip install bpy):
#
#   python3 tools/t05-statue/bake.py <high.glb> <low.glb> <out.glb> [--size=2048] [--cage=0.0035] [--ray=0.007] [--uv=xatlas] [--head=<z>]
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
# --uv: unwrap the low mesh with xatlas first (pip install xatlas trimesh): fewer, larger charts, one atlas. --head=<z>
# (file units, up): the head above z is unwrapped and baked on a map of its own (the 3D review's second round: on one
# atlas the curls' facets showed for want of texels), so the file carries two primitives, "head" and "body"
head = float(opt["head"]) if "head" in opt else None
if "uv" in opt:
  import subprocess
  tmp = out + ".uv.glb"
  subprocess.run([sys.executable, "-c", f"""
import trimesh, xatlas, numpy as np
m = trimesh.load({lo!r}, force='mesh'); parts = {{}}
c = m.triangles_center[:, 1]; groups = [('all', np.ones(len(m.faces), bool))] if {head!r} is None else [('head', c >= {head!r}), ('body', c < {head!r})]
sc = trimesh.Scene()
for name, sel in groups:
  sub = m.submesh([np.nonzero(sel)[0]], append=True); vm, f, uv = xatlas.parametrize(sub.vertices, sub.faces)
  t = trimesh.Trimesh(sub.vertices[vm], f, process=False); t.visual = trimesh.visual.TextureVisuals(uv=uv); sc.add_geometry(t, geom_name=name, node_name=name)
sc.export({tmp!r})
"""], check=True); lo = tmp
def load_parts(f):
  before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
  new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
  for o in new:
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  return new
H = load(hi); Ls = load_parts(lo)
# the two files are each normalised by the reducer the same way (t05-statue.mjs keeps the frame), so they overlap
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 1
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = cage; bk.max_ray_distance = rayd; bk.margin = 8; bk.normal_space = "TANGENT"
for L in Ls:
  for f in L.data.polygons: f.use_smooth = True
  bpy.ops.object.select_all(action="DESELECT"); L.select_set(True); bpy.context.view_layer.objects.active = L
  if not L.data.uv_layers:   # unwrapped already (xatlas, `--uv`) or else by Blender's Smart UV Project, which cuts a reduced statue into thousands of specks
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004); bpy.ops.object.mode_set(mode="OBJECT")
  nm_ = L.name.split(".")[0]
  img = bpy.data.images.new("normal-" + nm_, size, size, alpha=False, float_buffer=False); img.colorspace_settings.name = "Non-Color"
  mat = bpy.data.materials.new("statue-" + nm_); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
  tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; nmap = nt.nodes.new("ShaderNodeNormalMap")
  nt.links.new(tex.outputs["Color"], nmap.inputs["Color"]); nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
  bsdf.inputs["Base Color"].default_value = (0.66, 0.54, 0.38, 1); bsdf.inputs["Roughness"].default_value = 0.75
  L.data.materials.clear(); L.data.materials.append(mat); nt.nodes.active = tex
  bpy.ops.object.select_all(action="DESELECT"); H.select_set(True); L.select_set(True); bpy.context.view_layer.objects.active = L
  bpy.ops.object.bake(type="NORMAL")
  img.filepath_raw = f"{out}.{nm_}.normal.png"; img.file_format = "PNG"; img.save()
bpy.ops.object.select_all(action="DESELECT")
for L in Ls: L.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_normals=True, export_tangents=True, export_image_format="AUTO")
print(json.dumps({"high": hi, "low": lo, "out": out, "size": size, "cage": cage, "ray": rayd, "parts": {L.name: len(L.data.polygons) for L in Ls}}))
