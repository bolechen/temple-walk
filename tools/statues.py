#!/usr/bin/env python3
"""Pack the museum scans that stand in the halls until the project carves its own figures.

    python3 tools/statues.py <dir holding the collected scans>      (needs numpy and Pillow)

The figures are 3D scans of real Buddhist sculpture which two museums have published under CC0 (public domain):
the Minneapolis Institute of Art and the Cleveland Museum of Art. The directory holds one folder per scan with
`model.glb` and `meta.json` (what it is, the museum's page, the exact file fetched and its hash). The files as
published are five to eleven megabytes and up to two hundred thousand triangles each, far more than a hall seen
by lamplight needs, so each is made small here:

  * every part of the scan is brought into one frame, stood on the ground at the origin, one unit tall;
  * its surface is thinned by clustering: vertices that fall in the same small cube become one (their mean), and
    triangles that collapse are dropped;
  * its paint is carried on the vertices, not in a picture: the scans' pictures are cut into thousands of scraps
    that no thinned surface can still be laid over, so every sample of colour is gathered into the cube it lies in.
    No texture is shipped at all;
  * normals are stored as bytes and colours as shorts (KHR_mesh_quantization).

Writes app/shared/models/<name>.glb and prints a line for each; `FIGURES` below says which scan becomes which
file and how fine. What stands in which hall is `STAND` in app/src/interior.js. Sources and licences are listed
in docs/t00/asset-register.csv, figure by figure.
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
# name of the packed file: (folder of the scan, triangles to aim for, unused)
FIGURES = {
    "arhat":        ("mia-standing-arhat", 34000, 0),          # a young monk, palms together (China, 6th century)
    "gilt-monk":    ("cma-standing-bodhisattva", 34000, 0),   # a robed standing figure in gilt wood (Korea, 1500s)
    "guanyin-seated": ("mia-seated-guanyin", 40000, 0),       # seated Guanyin, painted wood (China, 11th-12th century)
    "guanyin-rock": ("mia-water-moon-guanyin", 40000, 0),     # Guanyin at ease on a rock (China, 12th century)
    "buddha-lacquer": ("mia-amoghasiddhi-buddha", 40000, 0),  # a seated Buddha on a lotus, red lacquer (Ming, 1403-24)
    "guanyin-eleven": ("cma-eleven-headed-guanyin", 44000, 0),  # eleven-headed Guanyin, standing, 2.2 m (Song-Jin)
    "monk-seated":  ("mia-wooden-monk", 26000, 0),             # a seated monk teaching, wood (China, 9th-10th century)
}
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

def read_glb(path):
    b = open(path, "rb").read(); n = struct.unpack("<I", b[12:16])[0]; g = json.loads(b[20:20 + n]); o = 20 + n
    m = struct.unpack("<I", b[o:o + 4])[0]; return g, b[o + 8:o + 8 + m]

def accessor(g, bin_, i):
    a = g["accessors"][i]; v = g["bufferViews"][a["bufferView"]]; t = np.dtype(CT[a["componentType"]]); k = NC[a["type"]]
    off = v.get("byteOffset", 0) + a.get("byteOffset", 0); stride = v.get("byteStride") or t.itemsize * k
    raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * (a["count"] - 1) + t.itemsize * k, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], t.itemsize * k), strides=(stride, 1)).copy().view(t).reshape(a["count"], k)
    if a.get("normalized"): out = out.astype(np.float32) / np.iinfo(t).max
    return out

def node_matrix(nd):
    if "matrix" in nd: return np.array(nd["matrix"], dtype=np.float64).reshape(4, 4).T
    T = np.eye(4); R = np.eye(4); S = np.eye(4)
    if "translation" in nd: T[:3, 3] = nd["translation"]
    if "rotation" in nd:
        x, y, z, w = nd["rotation"]; R[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    if "scale" in nd: S[0, 0], S[1, 1], S[2, 2] = nd["scale"]
    return T @ R @ S

def parts(g, bin_):
    """Every opaque primitive, in world space: positions, texture coordinates, triangles, and the picture it is painted with."""
    out = []
    def walk(i, M):
        nd = g["nodes"][i]; W = M @ node_matrix(nd)
        if "mesh" in nd:
            for p in g["meshes"][nd["mesh"]]["primitives"]:
                mat = g["materials"][p["material"]] if "material" in p else {}
                tex = mat.get("pbrMetallicRoughness", {}).get("baseColorTexture")
                if mat.get("alphaMode") == "BLEND" or tex is None or "TEXCOORD_0" not in p["attributes"]: continue   # a glass jewel, or a part with no paint
                P = accessor(g, bin_, p["attributes"]["POSITION"]).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
                uv = accessor(g, bin_, p["attributes"]["TEXCOORD_0"]).astype(np.float64)
                idx = accessor(g, bin_, p["indices"]).reshape(-1, 3).astype(np.int64) if "indices" in p else np.arange(len(P)).reshape(-1, 3)
                if np.linalg.det(W[:3, :3]) < 0: idx = idx[:, ::-1]
                src = g["textures"][tex["index"]]; img = g["images"][src.get("source", src.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))]
                v = g["bufferViews"][img["bufferView"]]; out.append({"P": P, "uv": uv, "idx": idx, "image": bin_[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]})
        for c in nd.get("children", []): walk(c, W)
    for r in g["scenes"][g.get("scene", 0)]["nodes"]: walk(r, np.eye(4))
    return out

def paint(p):
    """The colour of the scan at every vertex and at the middle of every triangle, in linear light."""
    im = Image.open(io.BytesIO(p["image"])).convert("RGB"); k = 2048 / max(im.size)
    if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.BILINEAR)
    px = (np.asarray(im, dtype=np.float32) / 255) ** 2.2; H, W = px.shape[:2]
    at = lambda uv: px[np.clip(((uv[:, 1] % 1.0) * H).astype(np.int64), 0, H - 1), np.clip(((uv[:, 0] % 1.0) * W).astype(np.int64), 0, W - 1)]
    mid = p["P"][p["idx"]].mean(1), p["uv"][p["idx"]].mean(1)
    return np.concatenate([p["P"], mid[0]]), np.concatenate([at(p["uv"]), at(mid[1])])

def thin(ps, cell):
    """Cluster every part on one grid of cubes `cell` wide: one vertex for each cube, at the mean of what fell in it."""
    allP = np.concatenate([p["P"] for p in ps]); keys = np.floor(allP / cell).astype(np.int64)
    uniq, cube, counts = np.unique(keys, axis=0, return_inverse=True, return_counts=True); cube = cube.ravel()
    centre = np.zeros((len(counts), 3)); np.add.at(centre, cube, allP); centre /= counts[:, None]
    tris = []; start = 0
    for p in ps:
        n = len(p["P"]); c = cube[start:start + n]; start += n; t = c[p["idx"]]
        tris.append(t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])])
    t = np.concatenate(tris); roll = np.argmin(t, axis=1); t = np.take_along_axis(t, (roll[:, None] + np.arange(3)) % 3, axis=1); t = np.unique(t, axis=0)   # the same triangle twice is one
    return uniq, centre, t

def pack(src, name, target, side, out_dir):
    g, bin_ = read_glb(f"{src}/model.glb"); ps = parts(g, bin_)
    P = np.concatenate([p["P"] for p in ps]); lo, hi = P.min(0), P.max(0); h = hi[1] - lo[1]
    for p in ps: p["P"] = (p["P"] - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) / h   # on the ground, at the origin, one unit tall
    a, b = 0.0005, 0.05
    for _ in range(22):   # the cube that leaves about as many triangles as are wanted
        cell = (a * b) ** 0.5; n = len(thin(ps, cell)[2]); a, b = (cell, b) if n > target else (a, cell)
    uniq, centre, tri = thin(ps, b)
    # Paint: every sample of the scan's colour goes to the cube it lies in.
    col = np.zeros((len(centre), 3)); cnt = np.zeros(len(centre)); index = {tuple(k): i for i, k in enumerate(uniq)}
    for p in ps:
        at, c = paint(p); keys = np.floor(at / b).astype(np.int64); ids = np.fromiter((index.get(tuple(k), -1) for k in keys), dtype=np.int64, count=len(keys)); ok = ids >= 0
        np.add.at(col, ids[ok], c[ok]); np.add.at(cnt, ids[ok], 1)
    col /= np.maximum(cnt, 1)[:, None]
    used = np.unique(tri); remap = np.full(len(centre), -1, dtype=np.int64); remap[used] = np.arange(len(used)); tri = remap[tri]; centre = centre[used]; col = col[used]
    normal = np.zeros_like(centre); fn = np.cross(centre[tri[:, 1]] - centre[tri[:, 0]], centre[tri[:, 2]] - centre[tri[:, 0]])
    for k in range(3): np.add.at(normal, tri[:, k], fn)
    length = np.linalg.norm(normal, axis=1); flat = length < 1e-9; normal[flat] = [0, 1, 0]; normal[~flat] /= length[~flat][:, None]   # a vertex with no face left to it would otherwise shade as not-a-number, and the glow would carry that over the whole picture
    blob = bytearray(); views = []; accs = []
    def view(data, target_, stride=None):
        while len(blob) % 4: blob.append(0)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target_, **({"byteStride": stride} if stride else {})}); blob.extend(data); return len(views) - 1
    def acc(v, ct, ty, n, extra={}): accs.append({"bufferView": v, "componentType": ct, "count": n, "type": ty, **extra}); return len(accs) - 1
    pos = centre.astype(np.float32); nor = np.c_[np.round(normal * 127), np.zeros(len(pos))].astype(np.int8); rgb = np.c_[np.round(np.clip(col, 0, 1) * 65535), np.full(len(pos), 65535)].astype(np.uint16)
    idx = tri.astype(np.uint16 if len(pos) < 65536 else np.uint32)
    prim = {"attributes": {"POSITION": acc(view(pos.tobytes(), 34962), 5126, "VEC3", len(pos), {"min": pos.min(0).tolist(), "max": pos.max(0).tolist()}),
                           "NORMAL": acc(view(nor.tobytes(), 34962, 4), 5120, "VEC3", len(pos), {"normalized": True}),
                           "COLOR_0": acc(view(rgb.tobytes(), 34962), 5123, "VEC4", len(pos), {"normalized": True})},
            "indices": acc(view(idx.tobytes(), 34963), 5123 if idx.dtype == np.uint16 else 5125, "SCALAR", idx.size), "material": 0}
    while len(blob) % 4: blob.append(0)
    doc = {"asset": {"version": "2.0", "generator": "temple-walk tools/statues.py"}, "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"],
           "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": name}], "meshes": [{"primitives": [prim]}],
           "materials": [{"pbrMetallicRoughness": {"metallicFactor": 0, "roughnessFactor": 0.78}, "doubleSided": True}], "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(blob)}]}
    js = json.dumps(doc, separators=(",", ":")).encode(); js += b" " * (-len(js) % 4)
    glb = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack("<I", len(js)) + b"JSON" + js + struct.pack("<I", len(blob)) + b"BIN\x00" + bytes(blob)
    open(f"{out_dir}/{name}.glb", "wb").write(glb)
    print(f"{name:16s} {len(tri):6d} triangles, {len(glb) // 1024:5d} KB   (from {os.path.basename(src)}, {sum(len(p['idx']) for p in ps)} triangles, {os.path.getsize(src + '/model.glb') // 1024} KB)")

def main():
    src = sys.argv[1]; out = f"{ROOT}/app/shared/models"; os.makedirs(out, exist_ok=True)
    for name, (folder, target, side) in FIGURES.items(): pack(f"{src}/{folder}", name, target, side, out)

if __name__ == "__main__":
    main()
