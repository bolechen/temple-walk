import sys,json,numpy as np
sys.path.insert(0,'/tmp/claude-0/-home-user-temple-walk/2bc36da0-f0ae-50b2-8dee-2a115d5fa167/scratchpad')
from layers import Lstar
D,cfg=sys.argv[1],sys.argv[2]
for v in sys.argv[3:]:
    L=Lstar(f'{D}/{cfg}-{v}.png'); d=json.load(open(f'{D}/pick-{v}.json')); br=[];wl=[]
    for x,y,part,mat,at in d:
        val=L[y-3:y+4,x-3:x+4].mean(); h=at[1]
        if 9.2<h<12.2:
            if mat in('woodX','woodZ'): br.append(val)
            elif mat=='plaster': wl.append(val)
    b=np.median(br) if br else None; w=np.median(wl) if wl else None
    print(v,'bracket',None if b is None else round(float(b),1),'wall',None if w is None else round(float(w),1),'wall-bracket',None if b is None or w is None else round(float(w-b),1),len(br),len(wl))
