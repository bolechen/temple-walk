"""Sculpt and export the T05 head. python3 make_head.py /path/to/head.glb"""
import argparse
from pathlib import Path

import bpy
import numpy as np


def bell(v):
    return np.exp(-v * v)


def ramp(v):
    t = np.clip(v, 0, 1)
    return t * t * (3 - 2 * t)


def profile(y, keys, values):
    """Shape-preserving cubic interpolation of clay cross sections."""
    x = np.asarray(keys)
    v = np.asarray(values)
    slopes = np.diff(v) / np.diff(x)
    tangent = np.zeros_like(v, dtype=float)
    same = slopes[:-1] * slopes[1:] > 0
    tangent[1:-1][same] = 2 / (1 / slopes[:-1][same] + 1 / slopes[1:][same])
    tangent[[0, -1]] = slopes[[0, -1]]
    i = np.clip(np.searchsorted(x, y) - 1, 0, len(x) - 2)
    h = x[i + 1] - x[i]
    t = np.clip((y - x[i]) / h, 0, 1)
    return ((1 - ramp(t)) * v[i] + ramp(t) * v[i + 1]
            + h * t * (1 - t) * ((1 - t) * tangent[i] - t * tangent[i + 1]))


def face(x, y):
    """Depth above the facial oval, in metres. Both lids share the eyeball surface."""
    a = np.abs(x)
    # Medial cheek and malar plane support the orbit; leave the glabella broad.
    depth = .052 * bell((a - .41) / .24) * bell((y - 1.00) / .21)
    u = (a - .315) / .209
    lens = np.maximum(0, 1 - u * u)
    eye = 1.185 + .016 * u
    upper = eye + .052 * lens
    lower = eye - .046 * lens
    taper = ramp((1.08 - np.abs(u)) / .33)
    depth -= .055 * bell(u / 1.27) * bell((y - eye) / .125)
    depth += taper * (.062 * bell((y - upper - .043) / .078)
                      + .022 * bell((y - lower + .022) / .050)
                      - .014 * bell((y - upper) / .013)
                      - .004 * bell((y - lower) / .017))
    # Exposed globe and a very shallow carved iris, displaced towards the lower lid.
    inside = taper * ramp((upper - y) / .012) * ramp((y - lower) / .012)
    iris = np.hypot((a - .310) / .071, (y - eye + .033) / .071)
    depth += inside * (.036 * bell(u / .79) - .007 * bell((iris - 1) / .14))
    brow = 1.345 + .019 * bell((u + .08) / .66) - .013 * u
    depth += .049 * bell(u / 1.02) * bell((y - brow) / .043)

    # Bridge, tip, paired alae and the two blind nostril depressions.
    depth += .126 * bell(a / .126) * bell((y - 1.105) / .229)
    depth += .102 * bell(a / .114) * bell((y - .949) / .076)
    depth += .092 * bell((a - .118) / .057) * bell((y - .944) / .052)
    depth -= .038 * bell((a - .098) / .034) * bell((y - .920) / .016)
    depth += .013 * bell((a - .040) / .025) * bell((y - .838) / .064)

    # Only one mouth seam. Vermilion turns back gradually below the lower lip.
    u = a / .250
    taper = ramp((1.05 - u) / .27)
    seam = .745 + .014 * u**2 + .004 * bell((u - .36) / .18)
    upper = seam + .023 + .015 * bell((u - .28) / .21)
    depth += taper * (.022 * bell((y - upper) / .027)
                      + .015 * bell((y - seam + .020) / .031)
                      - .016 * bell((y - seam) / .010))
    return depth


def ear(side):
    """Solid pinna with a tapered root, a full dependent lobe and a hollow concha."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=112, ring_count=100)
    obj = bpy.context.object
    for vert in obj.data.vertices:
        outer, along, height = vert.co
        # The upper pole leans away from the skull, the lower pole hangs free.
        y = .975 + .443 * height
        z = -.005 + .151 * along * (1 + .26 * height) - .063 * height
        lobe = np.exp(-((height + .66) / .32)**2)
        lateral = .709 + .040 * height + (.103 + .032 * lobe) * outer
        if outer > 0:
            r = np.hypot(along / .88, (height - .16) / .83)
            concha = -.071 * np.exp(-((along + .06) / .55)**2 - ((height - .12) / .54)**2)
            helix = .032 * np.exp(-((r - .83) / .13)**2)
            fold = .032 * np.exp(-((along + .11 - .43 * height) / .18)**2
                                  - ((height - .11) / .56)**2)
            lateral += outer * (concha + helix + fold)
        vert.co = (side * lateral, -z, y)
    # Local sphere axes map to Blender X, -Y, Z.
    if side == 1:
        obj.data.flip_normals()
    return obj


def scalp(angle, y):
    """Staggered rows wind up the rounded crown; each curl is part of the scalp."""
    polar = np.arccos(np.clip((y - 1.30) / .90, -1, 1))
    hairline = .94 + .66 * ramp((np.cos(angle) + .13) / .86) - .035 * bell(angle / .31)
    mask = ramp((y - hairline) / .047)
    relief = np.zeros(np.broadcast_shapes(angle.shape, y.shape))
    for row in range(1, 19):
        lat = row * .119
        v = (polar - lat) / .077
        n = max(5, round(44 * np.sin(lat)))
        phase = angle * n / (2 * np.pi) + .5 * (row % 2)
        u = (phase - np.floor(phase + .5)) * 1.72
        r = np.hypot(u, v)
        twist = np.arctan2(v, u) - 7.7 * r
        relief += ramp((1.07 - r) / .74) * (.027 + .009 * r * np.cos(twist))
    return mask * (.009 + relief * ramp((polar - .10) / .15)), polar


def sculpt():
    sectors, rows = 640, 430
    angle = 2 * np.pi * np.arange(sectors)[None, :] / sectors
    # Gather latitude rings near the crown to keep the pole smoothly rounded.
    h = 2.20 * np.sin(np.linspace(0, np.pi / 2, rows + 1)[:-1, None])
    keys = [0, .17, .28, .36, .46, .60, .78, 1.0, 1.22, 1.46, 1.66, 1.80, 1.95, 2.07, 2.20]
    width = profile(h, keys, [.397,.395,.402,.455,.515,.595,.665,.715,.730,.725,.705,.650,.548,.395,0])
    front = profile(h, keys, [.363,.367,.401,.500,.608,.666,.658,.658,.645,.665,.653,.603,.493,.366,0])
    back = profile(h, keys, [.363,.369,.411,.465,.525,.619,.689,.738,.754,.747,.706,.639,.536,.394,0])
    # Finish the broad ushnisha with an elliptical cap tangent to the last ring.
    cap = np.sqrt(np.maximum(0, (2.20 - h) / .13))
    blend = ramp((h - 1.98) / .09)
    width = width * (1 - blend) + blend * .395 * cap
    front = front * (1 - blend) + blend * .366 * cap
    back = back * (1 - blend) + blend * .394 * cap
    c, s = np.cos(angle), np.sin(angle)
    x = width * s
    z = (front + back) / 2 * c + (front - back) / 2
    z += .040 * bell(x / .29) * bell((h - .52) / .125)
    z += face(x, h) * ramp((c - .16) / .56)

    hair, polar = scalp(np.arccos(np.clip(c, -1, 1)), h)
    radius = hair * np.sin(polar)
    x += radius * s
    z += radius * c
    # Lower the middle of the chin where it turns into the jaw.
    jaw = .058 * ramp((c - .30) / .70) * bell(x / .34) * bell((h - .46) / .13)
    y = h + hair * np.cos(polar) - jaw
    # A flat plug extends 35 cm below the visible neck. Y=0 is its bottom.
    y[0] = 0
    # Roll the foot into the flat closing disk over the first latitude.
    x[0] *= .985
    z[0] *= .985
    surface = np.stack((x, -z, y), axis=-1)
    verts = []
    faces = []
    # Thin the longitude grid towards the crown. Neighbouring rings share a
    # regular 1:1 or 2:1 stitch instead of extremely narrow polar triangles.
    for row in range(rows):
        stride = 1
        while stride < 64 and width[row, 0] * stride < .38:
            stride *= 2
        ring = list(range(len(verts), len(verts) + sectors // stride))
        verts.extend(surface[row, ::stride].tolist())
        if row == 0:
            base = ring
        else:
            for j, p in enumerate(previous):
                q = previous[(j + 1) % len(previous)]
                k = j * len(ring) // len(previous)
                u = ring[k]
                v = ring[(k + 1) % len(ring)]
                if len(previous) == len(ring):
                    if j < len(ring) // 2:
                        faces.extend(((p, q, v), (p, v, u)))
                    else:
                        faces.extend(((p, q, u), (q, v, u)))
                elif len(previous) == 2 * len(ring):
                    faces.append((p, q, u) if j % 2 == 0 else (p, q, v))
                    if j % 2:
                        faces.append((p, v, u))
                else:
                    w = ring[(k + 2) % len(ring)]
                    faces.extend(((p, q, v), (p, v, u), (q, w, v)))
        previous = ring
    bottom, top = len(verts), len(verts) + 1
    verts.extend([(0, 0, 0), (0, 0, 2.209)])
    for i, v in enumerate(base):
        faces.append((bottom, base[(i + 1) % len(base)], v))
    for i, v in enumerate(previous):
        faces.append((v, previous[(i + 1) % len(previous)], top))
    mesh = bpy.data.meshes.new("T05_head")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    obj = bpy.data.objects.new("T05_head", mesh)
    bpy.context.collection.objects.link(obj)
    for side in (-1, 1):
        pinna = ear(side)
        # The curved ear quads are nonplanar. Cut the actual triangles so
        # triangulation at export cannot reintroduce a crossing at the join.
        triangles = pinna.modifiers.new("Triangular pinna surface", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=triangles.name)
        bpy.context.view_layer.objects.active = obj
        union = obj.modifiers.new("Attach pinna", "BOOLEAN")
        union.operation = "UNION"
        union.solver = "EXACT"
        union.object = pinna
        bpy.ops.object.modifier_apply(modifier=union.name)
        bpy.data.objects.remove(pinna, do_unlink=True)

    # Exact boolean can enumerate the same surface in a different order on
    # another worker thread. Restore a geometric order before glTF indexing.
    source = obj.data
    source.calc_loop_triangles()
    co = np.empty((len(source.vertices), 3), dtype=np.float32)
    source.vertices.foreach_get("co", co.ravel())
    tri = np.empty((len(source.loop_triangles), 3), dtype=np.int32)
    source.loop_triangles.foreach_get("vertices", tri.ravel())
    order = np.lexsort(co.T)
    tri = np.argsort(order)[tri]
    tri = np.take_along_axis(tri, (np.argmin(tri, axis=1)[:, None] + np.arange(3)) % 3, axis=1)
    tri = tri[np.lexsort(tri.T)]
    # Relax the cut locally. The bool operation introduces very short edges
    # where the clay surfaces graze; a tangentially uneven fan can fold there.
    points = co[order].astype(float)
    ear_zone = ((np.abs(points[:, 0]) > .55) & (np.abs(points[:, 1]) < .22)
                & (points[:, 2] > .48) & (points[:, 2] < 1.45))
    i, j = tri[:, [0, 1, 2]].ravel(), tri[:, [1, 2, 0]].ravel()
    degree = np.bincount(i, minlength=len(points))
    for _ in range(7):
        neighbours = np.column_stack([np.bincount(i, weights=points[j, axis],
                                                  minlength=len(points)) for axis in range(3)])
        points[ear_zone] += .55 * (neighbours[ear_zone] / degree[ear_zone, None] - points[ear_zone])
    clean = bpy.data.meshes.new("T05_clay")
    clean.from_pydata(points.tolist(), [], tri.tolist())
    clean.update()
    clean.polygons.foreach_set("use_smooth", np.ones(len(tri), dtype=bool))
    obj.data = clean
    bpy.data.meshes.remove(source)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sculpt()
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB",
                              export_materials="NONE", export_texcoords=False,
                              export_normals=True, export_yup=True)
