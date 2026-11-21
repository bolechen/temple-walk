# Which Blender this project's scripts run on (issue #514, check 1). The scripts use Blender as a Python module (`bpy`
# from PyPI), which is Blender itself without its window: `python3 tools/blender/version.py` prints the version and
# exits 1 if it is not the one pinned here.
import sys
PIN = "5.3.0"
try:
  import bpy
except ImportError:
  sys.exit(f"bpy is not installed: pip install bpy=={PIN} (see tools/blender/README.md)")
v = bpy.app.version_string
print(f"Blender {v} (bpy module, {bpy.app.build_platform.decode() if isinstance(bpy.app.build_platform, bytes) else bpy.app.build_platform}, built {bpy.app.build_date.decode() if isinstance(bpy.app.build_date, bytes) else bpy.app.build_date})")
if v.split()[0] != PIN: sys.exit(f"expected Blender {PIN}, found {v}")
