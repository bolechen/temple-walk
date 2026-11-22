#!/usr/bin/env python3
"""Cut a square window out of a 1-arc-second DEM tile and resample it onto a metric grid (#183, the terrain spike).

The tile is Copernicus DEM GLO-30 (a 1x1 degree GeoTIFF, as the public AWS bucket serves it; licence and attribution:
docs/t00/refactor/terrain-spike.md). The window is centred on a latitude and longitude given on the command line and
written as raw little-endian float32, row 0 at the north, column 0 at the west, `cell` metres apart, with a JSON beside
it. Nothing here is committed but the tool: the window is an intermediate; tools/terrain/heightmap.mjs turns it into
the small file the page loads.

  pip install tifffile imagecodecs numpy
  python3 tools/terrain/dem-window.py <tile.tif> <lat0> <lon0 of the tile's west edge> <lat> <lon> <size m> <cell m> <out.f32>
"""
import json, math, sys
import numpy as np
import tifffile

tif, tile_lat_n, tile_lon_w, lat, lon, size, cell, out = sys.argv[1:9]
tile_lat_n, tile_lon_w, lat, lon, size, cell = map(float, (tile_lat_n, tile_lon_w, lat, lon, size, cell))
a = tifffile.imread(tif).astype(np.float32)
rows, cols = a.shape
m_lat = 111_320.0                       # metres to a degree of latitude
m_lon = m_lat * math.cos(math.radians(lat))
n = int(round(size / cell))
# metric offsets of each output sample from the centre (east x, north y), then their place in the tile
off = (np.arange(n) - (n - 1) / 2) * cell
X, Y = np.meshgrid(off, -off)           # row 0 north
la = lat + Y / m_lat
lo = lon + X / m_lon
r = (tile_lat_n - la) * (rows - 1)      # GLO-30 at this latitude: 3600 rows to the degree
c = (lo - tile_lon_w) * (cols - 1)
r0 = np.clip(np.floor(r).astype(int), 0, rows - 2); c0 = np.clip(np.floor(c).astype(int), 0, cols - 2)
fr = r - r0; fc = c - c0
h = (a[r0, c0] * (1 - fr) * (1 - fc) + a[r0 + 1, c0] * fr * (1 - fc) + a[r0, c0 + 1] * (1 - fr) * fc + a[r0 + 1, c0 + 1] * fr * fc)
h.astype("<f4").tofile(out)
json.dump({"n": n, "cell": cell, "lat": lat, "lon": lon, "min": float(h.min()), "max": float(h.max()), "source": "Copernicus DEM GLO-30"}, open(out + ".json", "w"))
print(n, cell, float(h.min()), float(h.max()))
