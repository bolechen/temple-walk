import json, os, sys
from PIL import Image, ImageDraw, ImageFont
D=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT, exist_ok=True)
R={t: json.load(open(f"{D}/compare-{t}.json")) for t in ["v060","main","new","d08","clear","head","mainfp"] if os.path.exists(f"{D}/compare-{t}.json")}
M=json.load(open(f"{D}/metrics.json"))
NAME={"mainfp":"main (undergrowth as before)","head":"PR head (pool edge cleared)","v060":"0.6.0","main":"main 6699c5d","new":"D0.5 (PR head)","clear":"D0.5 + edge undergrowth cleared","d08":"D0.8"}
F=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",15); FB=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",17)
SH=[("title",["v060","main","new"]),("opening-end",["v060","new"]),("first",["v060","main","new"]),("start",["v060","main","new"]),("pool-16x9",["v060","main","new","clear","d08"]),("pool-9x19.5",["v060","main","new","clear","d08"]),("halfway",["v060","main","new"]),("path-fp-east",["mainfp","head"]),("path-fp-west",["mainfp","head"])]
sheets=[]
for shot,tags in SH:
  tags=[t for t in tags if shot in R.get(t,{}) and os.path.exists(f"{D}/{shot}-{t}.png")]
  ims=[Image.open(f"{D}/{shot}-{t}.png").convert("RGB") for t in tags]
  w=480 if ims[0].width>ims[0].height else 300; h=round(ims[0].height*w/ims[0].width); cap=230 if shot.startswith("pool") else 120
  sheet=Image.new("RGB",(w*len(tags)+8*(len(tags)-1),h+cap+26),"white"); d=ImageDraw.Draw(sheet); d.text((4,3),shot,font=FB,fill="black")
  base=R["v060"][shot]["cameraPitch"] if shot in R["v060"] else None
  for i,(t,im) in enumerate(zip(tags,ims)):
    x=i*(w+8); sheet.paste(im.resize((w,h)),(x,26)); r=R[t][shot]
    if base is None: lines=[NAME[t], "first person, " + ("from the path west of the pool, looking east" if "east" in shot else "from the pool platform, looking at the grove edge")]
    else: lines=[NAME[t] if w>300 else NAME[t].replace(" + edge undergrowth cleared","+clear"), f"arm {r['arm']} m  pitch {r['cameraPitch']}", f"steeper than 0.6.0: {base-r['cameraPitch']:+.1f} deg", f"box y {r['boxY'][0]}-{r['boxY'][1]}", f"box x {r['boxX'][0]}-{r['boxX'][1]}"]
    m=None if base is None else M.get(f"{t} {shot}")
    if m: lines+= [f"near leaf {m['nearLeafCover']}%", f"  outside corners {m['nearLeafOutsideCorners']}%", f"leaf in box+5% {m['nearLeafInBoxPlus5']}%", f"pool {m['toPool']}, stele {m['toStele']}", f"him {m['toHead']}/{m['toWaist']}/{m['toFeet']}"]
    for k,l in enumerate(lines): d.text((x+3,26+h+4+k*22),l,font=F if k else FB,fill="black")
  sheet.save(f"{OUT}/{shot}.jpg",quality=86); sheets.append(sheet); print(shot, sheet.size, os.path.getsize(f"{OUT}/{shot}.jpg"))
