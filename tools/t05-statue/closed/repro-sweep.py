# One round of trying to reproduce #529's 147 / 0 / 0 on the face-processed Sakyamuni (issue #578): the figure stood as the hall's
# tool does, with the stand height (8.2 / 8.6 m), the statue's z (-17.6 tool / -16.9 game), the aim (hand / wrist), the window (0.3 / 0.8 /
# 1.5 m) and both eye frames varied; prints the configurations with any back-face hit. Result: docs/t05/CLOSED-BODY-578.md §五.
#   python3 tools/t05-statue/closed/repro-sweep.py <statue.glb>
import bpy, sys, math, json, itertools, numpy as np, trimesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
src=sys.argv[1]
sc=trimesh.load(src,force='scene'); m=trimesh.util.concatenate(list(sc.geometry.values()))
V0=m.vertices.copy(); F=m.faces
EYES={'aisle':[(-19.12,4.6,-15.79),(-19.33,4.6,-15.43)],'a42':[(-20.85,4.6,-15.0)],'sakya':[(-13.31,4.6,-8.01),(-14.5,4.6,-7.0)]}
AIMS={'hand':(-18.05,7.4,-16.0),'wrist':(-18.17,8.19,-16.22)}
res=[]
for H,Z in itertools.product([8.2,8.6],[-17.6,-16.9]):
    mn,mx=V0.min(0),V0.max(0); k=H/(mx[1]-mn[1]); v=(V0-[(mn[0]+mx[0])/2,mn[1],(mn[2]+mx[2])/2])*k+[-16.45,4.27 if H==8.2 else 3.87+0.4,Z]
    t=trimesh.Trimesh(v,F,process=False); fn=t.face_normals
    tree=BVHTree.FromPolygons([Vector(x) for x in v.tolist()],[tuple(f) for f in F.tolist()],epsilon=0.0)
    for an,aim in AIMS.items():
      aim=np.array(aim)
      for win in (0.3,0.8,1.5):
        for gi,(nm,eyes) in enumerate(EYES.items()):
          for ei,eye in enumerate(eyes):
            e=np.array(eye); d0=aim-e; d0/=np.linalg.norm(d0); r=np.cross(d0,[0,1.,0]); r/=np.linalg.norm(r); u=np.cross(r,d0); n=41
            b=0
            for i in range(n):
              for j in range(n):
                d=aim+r*((i/(n-1)-.5)*win)+u*((j/(n-1)-.5)*win)-e; d/=np.linalg.norm(d)
                loc,nor,idx,_=tree.ray_cast(Vector(e),Vector(d))
                if idx is not None and fn[idx]@d>0: b+=1
            res.append((H,Z,an,win,nm,ei,b))
tot={}
for H,Z,an,win,nm,ei,b in res:
    tot.setdefault((H,Z,an,win),{})[f'{nm}{ei}']=b
for k,v in tot.items():
    if any(v.values()): print(k,v)
print('configs',len(tot),'any nonzero:',sum(any(v.values()) for v in tot.values()))
