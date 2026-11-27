#!/usr/bin/env python3
"""
Render grey-clay review views of the generated Buddha head GLB using headless Blender Workbench.

Usage:
    python3 render_views.py <head.glb> <outdir> [--px=1024]

Outputs:
    front.png  - Front eye-level (正面平视)
    up36.png   - Front 36 deg upward angle (正面仰角 36°，对应 10 m 殿中仰看)
    side.png   - Side profile (侧面)
    up60.png   - Front 60 deg upward angle (佛前 4 m 仰看，自检)
    back.png   - Back view (背面，自检)
"""

import math
import os
import sys
import bpy
from mathutils import Matrix, Vector


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    if len(args) < 2:
        print("Usage: python3 render_views.py <head.glb> <outdir> [--px=1024]", file=sys.stderr)
        sys.exit(2)

    src, outdir = os.path.abspath(args[0]), os.path.abspath(args[1])
    px = int(opt.get("px", 1024))
    os.makedirs(outdir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    mw = ob.matrix_world.copy()
    ob.parent = None
    ob.matrix_world = Matrix.Identity(4)
    ob.data.transform(mw)
    if ob.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.update()

    # In Blender after glTF import (Y-up -> Z-up, +Z front -> -Y front):
    # X = left/right, -Y = front (face looks toward -Y), +Z = up
    vs = [v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    center = Vector(((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, (mn.z + mx.z) * 0.5))
    face_center = Vector((0.0, 0.0, 1.12))  # roughly eye/nose centre

    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "SINGLE"
    sc.display.shading.single_color = (0.72, 0.70, 0.67)  # neutral clay grey
    sc.display.shading.show_cavity = True
    sc.display.shading.cavity_type = "BOTH"
    sc.display.shading.cavity_ridge_factor = 0.8
    sc.display.shading.cavity_valley_factor = 1.2
    sc.display.shading.show_shadows = False
    sc.render.film_transparent = False

    if not sc.world:
        sc.world = bpy.data.worlds.new("World")
    sc.world.color = (0.14, 0.14, 0.15)

    sc.render.resolution_x = px
    sc.render.resolution_y = px
    sc.render.image_settings.file_format = "PNG"

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam

    def shoot(name, pos, target, lens=65):
        cam.location = Vector(pos)
        direction = Vector(target) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        cam.data.type = "PERSP"
        cam.data.lens = lens
        cam.data.clip_start = 0.05
        cam.data.clip_end = 200.0
        out_file = os.path.join(outdir, f"{name}.png")
        sc.render.filepath = out_file
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {out_file}")

    # Distance chosen so full head (height 2.20 m) frames cleanly with comfortable margin
    dist = 5.4
    # 1. Front eye-level (正面平视)
    shoot("front", (0.0, -dist, center.z), center, lens=65)

    # 2. Front 36 deg upward angle (正面仰角 36°, 模拟 10 m 殿中仰视)
    el36 = math.radians(36.0)
    shoot(
        "up36",
        (0.0, -dist * math.cos(el36), face_center.z - dist * math.sin(el36)),
        face_center,
        lens=65,
    )

    # 3. Side profile (侧面, 右侧视，脸朝左/右清晰呈现鼻、唇、颏轮廓)
    shoot("side", (dist, 0.0, center.z), center, lens=65)

    # 4. Front 60 deg upward angle (佛前 4 m 仰视自检)
    el60 = math.radians(60.0)
    shoot(
        "up60",
        (0.0, -4.6 * math.cos(el60), face_center.z - 4.6 * math.sin(el60)),
        face_center,
        lens=58,
    )

    # 5. Back view (背面自检)
    shoot("back", (0.0, dist, center.z), center, lens=65)


if __name__ == "__main__":
    main()
