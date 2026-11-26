import sys; sys.path.insert(0,'tools/out'); sys.path.insert(0,'tools')
from art758 import labimg, sky
import numpy as np
def reg(p,b):
    L=labimg(p)[b[1]:b[3],b[0]:b[2]]; l=L[...,0].ravel(); h=np.degrees(np.arctan2(np.median(L[...,2]),np.median(L[...,1])))
    return f"L50 {np.median(l):.1f} P90 {np.percentile(l,90):.1f} spread {np.percentile(l,90)-np.percentile(l,10):.1f} C {np.median(np.hypot(L[...,1],L[...,2])):.1f} h {h:.0f}"
B={'cam01':{'ground':(0,900,350,1000)},'cam03':{'screenL':(240,400,300,740),'screenR':(1620,400,1680,740)},'cam04':{'leftwall':(0,760,180,940),'gaps':(400,380,1800,470)},'cam06':{'farwall':(180,620,400,680),'pave':(0,720,1920,1080)}}
for R in sys.argv[1:]:
    R+='/'; print('==',R)
    import glob,os
    for f in sorted(glob.glob(R+'*_base.png')):
        n=f.replace('_base',''); name=os.path.basename(n)[:-4]; c=name.split('_')[0]
        sb,sn=sky(f),sky(n)
        print(name,f"noSkyL95 {sb['noSky_L95']}->{sn['noSky_L95']} L50 {sb['noSky_L50']}->{sn['noSky_L50']} sky {sn['sky_L']}")
        for k,bx in B.get(c,{}).items(): print('   ',k,'base',reg(f,bx),'| new',reg(n,bx))
