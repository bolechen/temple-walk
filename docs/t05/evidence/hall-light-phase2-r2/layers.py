import sys,json,numpy as np
from PIL import Image
ZM=-12.565
def Lstar(p):
    a=np.asarray(Image.open(p).convert('RGB')).astype(float)/255
    l=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4); y=.2126*l[...,0]+.7152*l[...,1]+.0722*l[...,2]
    return np.where(y>216/24389,116*np.cbrt(y)-16,y*24389/27)
def layers(D,cfg,v):
    L=Lstar(f'{D}/{cfg}-{v}.png'); d=json.load(open(f'{D}/pick-{v}.json')); g={'beam':[],'purlin':[],'board':[]}
    for x,y,part,mat,at in d:
        if y>576: continue            # the top 80%
        val=L[y-3:y+4,x-3:x+4].mean()
        if mat=='woodZ': g['beam'].append(val)
        elif mat=='woodX':
            k=(at[2]-ZM)/2.88
            g['purlin' if abs(k-round(k))*2.88<0.3 and at[1]<19.5 else 'board'].append(val)
    m={k:round(float(np.median(v)),1) if v else None for k,v in g.items()}; n={k:len(v) for k,v in g.items()}
    return m,n
if __name__=='__main__':
    D,cfg=sys.argv[1],sys.argv[2]
    for v in sys.argv[3:]:
        print(v,*layers(D,cfg,v))
