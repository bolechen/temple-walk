import sys
from PIL import Image
im=Image.open(sys.argv[1]).convert("RGB").resize((160,90)); px=im.load(); v=[]
for i in range(160):
    for j in range(72):
        c=[x/255 for x in px[i,j]]; c=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]; Y=0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
        v.append(116*Y**(1/3)-16 if Y>0.008856 else 903.3*Y)
v.sort(); n=len(v); print(f"top80 L05 {v[int(n*.05)]:.1f} L50 {v[n//2]:.1f} L95 {v[int(n*.95)]:.1f} spread {v[int(n*.95)]-v[int(n*.05)]:.1f}")
