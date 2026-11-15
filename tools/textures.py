#!/usr/bin/env python3
"""Pack the scanned surfaces the temple is dressed in.

Source: Poly Haven (https://polyhaven.com), all CC0. For each surface this reads the 1k Diffuse, nor_gl and Rough
JPEGs (fetch them first: see FETCH below) and writes two files into app/shared/textures/:

    <name>_a.webp   colour (sRGB)
    <name>_n.jpg    red, green = the normal's x and y (OpenGL convention); blue = roughness. No chroma subsampling.

and app/shared/textures/index.js with each surface's mean colour in linear light, which the shaders divide by so that a material's
own colour stays in charge and the scan only supplies the detail.

    python3 tools/textures.py <dir with the downloaded jpgs> [size]

FETCH: https://api.polyhaven.com/files/<slug> lists the files; take Diffuse/nor_gl/Rough → 1k → jpg.
"""
import json, os, sys
import numpy as np
from PIL import Image

# name in the app → Poly Haven slug, and what it is used for (see app/src/materials.js)
SURFACES = {
    "wood":    "fine_grained_wood",        # columns, beams, door leaves: old dark timber, grain along V
    "stone":   "brushed_concrete_2",       # the face of a dressed slab: paving, steps, platform tops
    "blocks":  "medieval_blocks_03",       # coursed masonry: platform sides, terrace walls
    "plaster": "worn_mossy_plasterwall",   # lime-washed walls after many rains
    "bark":    "japanese_cedar_bark",      # the cryptomerias (the same tree)
    "leaves":  "forest_leaves_03",         # the floor of the bamboo grove
    "weave":   "hessian_230",              # rush mats and straw cushions
    "snow":    "snow_02",                  # settled snow
}

def main():
    src = sys.argv[1]; size = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "shared", "textures"); os.makedirs(out, exist_ok=True)
    index = {}
    for name, slug in SURFACES.items():
        a = Image.open(f"{src}/{slug}.Diffuse.jpg").convert("RGB").resize((size, size), Image.LANCZOS)
        n = Image.open(f"{src}/{slug}.nor_gl.jpg").convert("RGB").resize((size, size), Image.LANCZOS)
        r = Image.open(f"{src}/{slug}.Rough.jpg").convert("L").resize((size, size), Image.LANCZOS)
        a.save(f"{out}/{name}_a.webp", quality=86, method=6)
        nr = np.dstack([np.asarray(n)[:, :, 0], np.asarray(n)[:, :, 1], np.asarray(r)])
        Image.fromarray(nr, "RGB").save(f"{out}/{name}_n.jpg", quality=90, subsampling=0, optimize=True)
        s = np.asarray(a).astype(np.float64) / 255.0
        lin = np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4).reshape(-1, 3).mean(axis=0)
        index[name] = {"slug": slug, "mean": [round(float(v), 4) for v in lin], "rough": round(float(np.asarray(r).mean() / 255.0), 3)}
        kb = lambda p: os.path.getsize(p) // 1024
        print(f"{name:8s} {slug:26s} colour {kb(f'{out}/{name}_a.webp'):4d} KB  normal+rough {kb(f'{out}/{name}_n.jpg'):4d} KB  mean {index[name]['mean']} rough {index[name]['rough']}")
    with open(f"{out}/index.js", "w") as f:
        f.write("// Written by tools/textures.py. The scanned surfaces in this folder are from Poly Haven (polyhaven.com), CC0.\n")
        f.write("// mean: the scan's average colour in linear light; rough: its average roughness.\n")
        f.write("export const SURFACES = " + json.dumps(index, indent=1) + ";\n")
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print(f"{len(index)} surfaces, {total // 1024} KB in app/shared/textures/")

if __name__ == "__main__":
    main()
