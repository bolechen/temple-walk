import "/home/user/temple-walk/tests/unit/dom-stub.mjs";
const { moodOf } = await import("/home/user/temple-walk/app/src/mood.js");
for (const s of ["autumn","winter"]) for (const t of ["dawn","day","dusk"]) { const m = moodOf(s, t); const [x,y,z]=m.sun; const l=Math.hypot(x,y,z); console.log(s,t,"sun",m.sun.map(v=>+v.toFixed(3)).join(","),"elev",(Math.asin(y/l)*180/Math.PI).toFixed(1),"y",y.toFixed(3),"cloud",m.cloud,"snow",m.snow,"wet",m.wet,"sunI",m.sunI); }
