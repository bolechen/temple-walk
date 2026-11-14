// Lit materials. Each has a colour and a pattern of its own, worked out in the shader from where the surface is in
// the world (courses of stone, rows of tile, damp at the foot of a wall), and most take their fine grain from a
// scanned surface (textures.js): the scan is divided by its own mean colour, so it supplies detail and not hue.
import * as THREE from "../v/build/three.module.js";
import { NOISE, WOOD, BUMP, U } from "./glsl.js";
import { TRI, declare, bind } from "./textures.js";

// `body` may write: vec3 col, float rough_, float bump_ (metres), float ao_.
// Every geometry drawn with these needs a float `ao` attribute (see geo.js): occlusion is baked per vertex
// by whatever built the geometry, because overcast light casts no shadow to do that job.
// It may also write vec3 emit_: light of its own; and vec3 nd_: a nudge to the surface normal in world space,
// which is how a scanned surface (textures.js) gives its relief. `tex` names the scans the body samples.
// Snow settles on whatever faces the sky unless `snow` is false.
export function procMat(key, params, body, { snow = true, tex = [] } = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  if (snow && !tex.includes("snow")) tex = [...tex, "snow"];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = U.uSnow; sh.uniforms.uLamp = U.uLamp; sh.uniforms.uAmb = U.uAmb; bind(sh.uniforms, tex);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float ao; varying float vAO; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vWP=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal); vUv2=uv; vAO=ao;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSnow, uLamp; uniform vec3 uAmb; varying float vAO; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;\n" + NOISE + WOOD + BUMP + (tex.length ? declare(tex) + TRI : ""))
      .replace("#include <color_fragment>", `#include <color_fragment>
        float rough_=roughness, bump_=0., ao_=vAO; vec3 col=diffuseColor.rgb, emit_=vec3(0.), nd_=vec3(0.);
        { ${body} }
        ${snow ? `if(uSnow>.001){ float sn_=uSnow*smoothstep(.3,.7,vWN.y)*smoothstep(.2,.5,fbm3(vWP*.8)+.25); vec3 sr=texture2D(tSnowN,vWP.xz*.7).xyz;
          col=mix(col,vec3(.82,.86,.92)*(.9+.2*sr.z),sn_); rough_=mix(rough_,.82,sn_); bump_*=1.-sn_; ao_=mix(ao_,max(ao_,.8),sn_); nd_=mix(nd_,vec3(sr.x*2.-1.,0.,sr.y*2.-1.)*.55,sn_); }` : ""}
        diffuseColor.rgb=col;`)
      // What is tucked away is dark to the sky, and only a little to the sun.
      .replace("#include <aomap_fragment>", `reflectedLight.indirectDiffuse*=ao_; reflectedLight.directDiffuse*=mix(1.,ao_,.3);
        #if defined( USE_ENVMAP ) && defined( STANDARD )
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),ao_,material.roughness);
        #endif`)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance+=emit_;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor=clamp(rough_,.04,1.);")
      // A face seen exactly edge-on gives the relief nothing to work from; such a normal is left as it was (one bad
      // pixel there used to spread through the mirror into a black stain on the paving).
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        normal=normalize(normal+(viewMatrix*vec4(nd_,0.)).xyz);
        if(bump_!=0.){ vec3 nb=bumpN(-vViewPosition,normal,bump_); float qn=dot(nb,nb); if(qn>.5&&qn<2.) normal=nb; }`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

export function createMaterials() {
  // Old unpainted timber. `turn` brings the grain's axis to y, so that the scan's grain runs along the member.
  const wood = (key, grain, turn) => procMat(key, { roughness: 0.82, envMapIntensity: 0.35 }, `
    vec3 q=vWP.${turn}*vec3(.95,.5,.95), w=triW(vWN.${turn});
    vec3 A=triA(tWoodA,q,w)/mWood; vec4 Nr=triN(tWoodN,q,w);
    col=vec3(.125,.07,.05)*mix(vec3(1.),A,.9)*(.72+.56*n3(vWP*vec3(${grain})*.22));       // old dark timber, its red long faded; each member its own tone
    float weather=smoothstep(.36,.7,fbm3(vWP*.6+3.)+.25*n2(vec2((vWP.x+vWP.z)*7.,vWP.y*.5))); col=mix(col,vec3(.13,.118,.1)*A,weather*.55);   // bleached silver where the rain runs
    float damp=smoothstep(2.2,.9,vWP.y+fbm3(vWP*.8)*.8);          // feet of columns stay damp and dark
    col*=mix(1.,.62,damp); rough_=mix(Nr.w*.92,.5,damp);
    nd_=Nr.xyz.${turn}*1.5;`, { tex: ["wood"] });

  // Lime-washed walls. One material for all of them: each wall's geometry says how high its foot stands (geo.footAt).
  const plasterOne = procMat("plaster", { roughness: 0.9, envMapIntensity: 0.25 }, `
      float t=vWP.x+vWP.z, base=vUv2.x; vec3 q=vWP/2.7, w=triW(vWN);
      vec3 A=triA(tPlasterA,q,w)/mPlaster; vec4 Nr=triN(tPlasterN,q,w);
      col=vec3(.86,.85,.81)*mix(vec3(1.),A,.3)*(.94+.1*fbm3(vWP*.5));   // lime wash: the paper of this picture, with the stains of many rains
      float drip=smoothstep(.45,.8,n2(vec2(t*5.,vWP.y*.35)))*smoothstep(base+2.2,base+3.4,vWP.y+fbm2(vec2(t,2.))*1.5);
      col=mix(col,vec3(.42,.43,.41)*A,drip*.38);                     // rain streaks run down from the cap
      float damp=smoothstep(base+.75,base,vWP.y-fbm2(vec2(t*.9,5.))*.6);
      col=mix(col,vec3(.2,.225,.175)*A,damp*.7);                    // rising damp and moss at the foot
      rough_=mix(Nr.w,.6,damp); nd_=Nr.xyz*.8;`, { tex: ["plaster"] });
  const plaster = () => plasterOne;


  // What is seen through an open door: not a black hole but a dim room, warmest low down round its one lamp,
  // and behind the same mist as everything else. `base` is the height of the building's floor.
  const interiorCache = new Map();
  const interior = (base) => {
    const k = base.toFixed(2);
    if (!interiorCache.has(k)) interiorCache.set(k, new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: true, uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uLamp: U.uLamp }),
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        varying vec3 vOP;
        void main(){
          vOP=position; vec4 mvPosition=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uLamp; varying vec3 vOP;
        void main(){
          float d=length(vec2(vOP.x,(vOP.y-${k}-1.05)*1.3));
          vec3 c=mix(vec3(.052,.022,.0095),vec3(.0065,.0045,.003),smoothstep(.15,3.6,d))*(.75+1.7*uLamp);
          gl_FragColor=vec4(c,1.);
          #include <fog_fragment>
        }`,
    }));
    return interiorCache.get(k);
  };

  return {
    interior,
    woodV: wood("woodV", "9.,1.1,9.", "xyz"), woodX: wood("woodX", "1.1,9.,9.", "yxz"), woodZ: wood("woodZ", "9.,9.,1.1", "xzy"),
    plaster,

    // vUv2 = (metres along the eave, metres up the slope). Rows of half-round cover tiles over pan tiles.
    tile: procMat("tile", { roughness: 0.6, envMapIntensity: 0.3, side: THREE.DoubleSide }, `
      float u=vUv2.x/.25, r=fract(u)-.5, row=floor(u), seg=floor(vUv2.y/.33), fw=fwidth(u);
      float cover=sqrt(max(0.,1.-pow(r/.3,2.)))*step(abs(r),.3);
      float pan=(1.-cos(clamp((abs(r)-.3)/.2,0.,1.)*3.14159))*.5;
      float lap=smoothstep(.0,.06,fract(vUv2.y/.33));               // each course laps the one below
      float detail=1.-smoothstep(.1,.45,fw);                        // relief folds into roughness with distance
      bump_=(cover*.06+pan*.012-(1.-lap)*.012)*detail;
      float tone=h21(vec2(row,seg)); col=mix(vec3(.05,.054,.058),vec3(.125,.13,.13),tone*.55+fbm2(vWP.xz*.7)*.45);
      float gutter=1.-smoothstep(.0,.16,abs(abs(r)-.5)+.02);
      float moss=smoothstep(.5,.75,fbm2(vWP.xz*.9+4.))*gutter; col=mix(col,vec3(.1,.14,.06),moss*.7);
      col*=mix(1.,mix(.5,1.,cover*.6+.4),detail);                   // gutters sit in shade
      rough_=mix(.5,.72,tone)-.1*cover*detail;
      if(!gl_FrontFacing){ col=vec3(.03,.023,.018); nd_=vec3(0.); bump_=0.; rough_=1.; ao_=min(ao_,.5); }`),

    // Dressed stone. Faces that look up are slabs, each cut from a different part of the scan; faces that look out
    // are coursed masonry.
    stone: procMat("stone", { roughness: 0.8, envMapIntensity: 0.5 }, `
      float moss=smoothstep(.45,.7,fbm3(vWP*.9+2.)), wet;
      if(vWN.y>.5){
        vec2 q=vWP.xz/vec2(1.1,.7); q.x+=floor(q.y)*.37; vec2 f=fract(q), id=floor(q);
        float edge=min(min(f.x,1.-f.x)*1.1,min(f.y,1.-f.y)*.7)+(n2(vWP.xz*9.)-.5)*.012, joint=1.-smoothstep(.006,.022,edge);
        vec2 uv0=vWP.xz*.75, uv=uv0+vec2(h21(id),h21(id+7.))*5., gx=dFdx(uv0), gy=dFdy(uv0); vec3 A=textureGrad(tStoneA,uv,gx,gy).rgb/mStone, nr=textureGrad(tStoneN,uv,gx,gy).xyz;
        col=mix(vec3(.2,.202,.19),vec3(.33,.33,.31),h21(id+3.))*mix(vec3(1.),A,.9);
        col=mix(col,vec3(.11,.14,.075),moss*max(.2,joint*.8)); col=mix(col,vec3(.035),joint*.5);
        float worn=smoothstep(.5,.15,abs(fract(vWP.x*.25)-.5))*.0+smoothstep(.3,.7,fbm2(vWP.xz*.6+2.)); col*=mix(.9,1.22,worn);   // trodden pale where feet go
        wet=.45; rough_=mix(nr.z,.28,wet*(1.-joint)); nd_=vec3(nr.x*2.-1.,0.,nr.y*2.-1.)*(1.-joint)*1.1; bump_=-joint*.006;
      } else {
        vec3 w=triW(vWN); w.y=0.; w/=w.x+w.z+1e-4; vec3 q=vWP/1.6;
        vec3 A=triA(tBlocksA,q,w)/mBlocks; vec4 Nr=triN(tBlocksN,q,w);
        col=vec3(.25,.25,.235)*mix(vec3(1.),A,.95);
        col=mix(col,vec3(.13,.18,.08),moss*smoothstep(1.,.1,vWP.y-floor(vWP.y/2.6)*2.6)*.7);       // green toward the foot of each rise
        wet=smoothstep(.5,0.,vWP.y); rough_=mix(Nr.w,.35,wet); nd_=Nr.xyz*1.3;
      }
      col*=mix(1.,.6,wet); if(vWN.y<-.5) col*=.3;`, { tex: ["stone", "blocks"] }),

    // vUv2 = (leaf index + position across the leaf, height mapped to 0..3.02); transoms are offset by 100 and mapped to 0...7.
    lattice: procMat("lattice", { roughness: 0.85, envMapIntensity: 0.3 }, `
      vec2 q=vUv2; bool win=q.y>150., tr=q.y>50.&&!win; if(tr) q.y-=100.; if(win) q.y-=200.; float lx=fract(q.x)*1.05, top=tr?.7:3.02;
      float fr=min(min(lx,1.05-lx),min(q.y-(win?1.25:0.),top-q.y)), frame=1.-smoothstep(.065,.07,fr);
      float rail=tr?0.:1.-smoothstep(.05,.055,abs(q.y-1.18));
      float zone=tr?1.:step(1.18,q.y);
      vec2 gf=abs(fract(vec2(lx,q.y)/.105)-.5); float bar=win?step(.27,gf.x):step(.33,max(gf.x,gf.y));
      float hole=zone*(1.-frame)*(1.-bar)*(1.-rail);
      float px=.105/max(max(fwidth(lx),fwidth(q.y)),1e-5); hole=mix(zone*(1.-frame)*(1.-rail)*.44,hole,clamp((px-1.6)/2.4,0.,1.));   // too far to count the bars: their mean, not a shimmer
      float panel=(1.-zone)*(1.-frame)*smoothstep(.0,.03,min(min(lx-.16,.89-lx),min(q.y-.16,1.02-q.y)));
      col=woodCol(vWP,vec3(9.,1.1,9.))*(1.-.25*panel); col=mix(col,vec3(.01,.009,.008),hole);
      rough_=mix(.8,1.,hole); bump_=(frame+bar*zone+rail)*.012-hole*.03+panel*.008;
      // Lamplight behind the lattice after dusk: brightest low down where the lamp stands, fading up the paper;
      // each room its own strength, and one leaf in eight dark.
      float leaf=floor(vUv2.x), room=n2(vec2(leaf*.31,2.)), on=step(.125,h21(vec2(leaf,7.)));
      float up=tr?.25:exp(-pow((q.y-.85)/1.25,2.));
      emit_=mix(vec3(.19,.068,.02),vec3(.8,.47,.18),up)*uLamp*hole*on*(.35+.75*room)*1.25;`, { snow: false }),

    bronze: procMat("bronze", { roughness: 0.5, metalness: 0.75, envMapIntensity: 1.0 }, `
      float p=smoothstep(.4,.72,fbm3(vWP*5.)); col=mix(vec3(.16,.125,.085),vec3(.16,.27,.22),p*.75);  // verdigris
      col*=.7+.5*n3(vWP*30.); rough_=mix(.42,.85,p); bump_=fbm3(vWP*24.)*.002;`),

    // Underside of a roof: boards and rafters. vUv2.x runs along the eave.
    rafters: procMat("rafters", { roughness: 0.9, envMapIntensity: 0.15 }, `
      float r=abs(fract(vUv2.x/.3)-.5); float raft=1.-smoothstep(.16,.2,r);
      col=woodCol(vWP,vec3(9.,9.,1.1))*mix(.34,.42,raft); ao_=min(ao_,.42); emit_=col*uAmb*.03; rough_=1.;`, { snow: false }),
    fascia: procMat("fascia", { roughness: 0.8, envMapIntensity: 0.3, side: THREE.DoubleSide }, "col=woodCol(vWP,vec3(1.1,9.,1.1))*.6; ao_=.8;"),
    ridge: procMat("ridge", { roughness: 0.55, envMapIntensity: 0.8 }, `
      col=mix(vec3(.1,.105,.11),vec3(.19,.195,.195),fbm3(vWP*2.)); float m=smoothstep(.5,.72,fbm3(vWP*1.3+5.)); col=mix(col,vec3(.11,.15,.07),m*.6);
      rough_=.5; bump_=fbm3(vWP*14.)*.004; ao_=1.;`),
    gable: procMat("gable", { roughness: 0.9, envMapIntensity: 0.2, side: THREE.DoubleSide }, "col=woodCol(vWP,vec3(9.,1.1,9.))*.8; ao_=.7;"),
    // The floor of the grove: dark leaf litter, moss, a scatter of fallen bamboo leaves.
    earth: procMat("earth", { roughness: 0.95, envMapIntensity: 0.15 }, `
      float a=fbm2(vWP.xz*.35), b=fbm2(vWP.xz*.09+4.);
      vec2 uv=vWP.xz/1.9; vec3 A=mix(texture2D(tLeavesA,uv).rgb,texture2D(tLeavesA,uv.yx*.37+.3).rgb,.35)/mLeaves, nr=texture2D(tLeavesN,uv).xyz;   // two scales, so the litter does not repeat
      col=mix(vec3(.028,.036,.02),vec3(.066,.074,.04),a)*mix(vec3(1.),A,.8)*1.1; col=mix(col,col*vec3(1.12,1.02,.8),smoothstep(.45,.7,b)); col*=.75+.5*fbm2(vWP.xz*.05+7.);   // dark and damp, never the same for long
      rough_=nr.z; nd_=vec3(nr.x*2.-1.,0.,nr.y*2.-1.)*1.6;`, { tex: ["leaves"] }),
    // Rough rubble laid dry: the lining of the well.
    rubble: procMat("rubble", { roughness: 0.92, envMapIntensity: 0.25 }, `
      vec3 q=vWP*2.3; vec3 id=floor(q+fbm3(vWP*1.1)*1.4); float t=h31(id);
      vec3 f=fract(q+fbm3(vWP*1.1)*1.4)-.5; float edge=1.-smoothstep(.34,.48,max(abs(f.x),max(abs(f.y),abs(f.z))));
      col=mix(vec3(.2,.16,.13),vec3(.42,.33,.26),t)*(.7+.5*fbm3(vWP*5.)); col=mix(vec3(.03,.035,.03),col,edge);
      col=mix(col,vec3(.12,.17,.08),smoothstep(.5,.8,fbm3(vWP*1.4+3.))*.6); bump_=edge*.04; rough_=.9;`),
    // White stone of the balustrades: pale, veined, greened where rain sits.
    marble: procMat("marble", { roughness: 0.6, envMapIntensity: 0.5 }, `
      float v=fbm3(vWP*1.7); col=mix(vec3(.5,.5,.47),vec3(.74,.74,.7),v); col=mix(col,vec3(.3,.36,.25),smoothstep(.55,.8,fbm3(vWP*2.6+7.))*.45);
      col*=.85+.25*n3(vWP*18.); rough_=mix(.45,.8,v); bump_=fbm3(vWP*12.)*.003;`),
    // Cryptomeria: dense dark needles in drooping masses, lighter at the tips.
    cedar: procMat("cedar", { roughness: 0.85, envMapIntensity: 0.2 }, `
      float a=fbm3(vWP*1.3), b=fbm3(vWP*9.);
      col=mix(vec3(.018,.05,.03),vec3(.06,.13,.06),a); col=mix(col,vec3(.12,.2,.08),smoothstep(.55,.85,b)*smoothstep(-.2,.7,vWN.y)*.7);
      col*=.6+.7*b; bump_=b*.08; ao_=mix(.35,1.,smoothstep(-.6,.6,vWN.y));`),
    bark: procMat("bark", { roughness: 0.95, envMapIntensity: 0.15 }, `
      vec3 q=vWP*vec3(1.4,.85,1.4), w=triW(vWN); vec3 A=triA(tBarkA,q,w)/mBark; vec4 Nr=triN(tBarkN,q,w);
      col=vec3(.13,.082,.055)*A; col=mix(col,vec3(.12,.15,.08)*A,smoothstep(.5,.75,fbm3(vWP*1.5))*.5);   // moss on the weather side
      rough_=Nr.w; nd_=Nr.xyz*1.8;`, { tex: ["bark"] }),
    // Cast iron left to weather for four hundred years.
    iron: procMat("iron", { roughness: 0.75, metalness: 0.55, envMapIntensity: 0.5 }, `
      float r=smoothstep(.4,.75,fbm3(vWP*6.)); col=mix(vec3(.045,.045,.05),vec3(.2,.1,.05),r*.75);
      col*=.7+.5*n3(vWP*34.); rough_=mix(.55,.95,r); bump_=fbm3(vWP*28.)*.003;`),
    // Tea bowls: black glaze breaking to brown at the rim, as on bowls from these mountains.
    glaze: procMat("glaze", { roughness: 0.18, envMapIntensity: 1.2 }, `
      float s=n3(vWP*vec3(60.,8.,60.)); col=mix(vec3(.012,.01,.012),vec3(.16,.07,.03),smoothstep(.55,.9,s)*.8); rough_=.16;`),
    // Clipped tea bushes: dense dark leaf, paler new growth along the top.
    tea: procMat("tea", { roughness: 0.7, envMapIntensity: 0.3 }, `
      float a=fbm3(vWP*3.), b=fbm3(vWP*14.), far=smoothstep(.02,.2,fwidth(vWP.x)+fwidth(vWP.z));
      col=mix(vec3(.03,.075,.028),vec3(.075,.16,.05),a); col=mix(col,vec3(.17,.29,.09),smoothstep(.5,.95,vWN.y)*smoothstep(.4,.7,b)*.8);
      col*=mix(.7+.55*b,1.,far); rough_=.75; bump_=b*.035*(1.-far); ao_=mix(.4,1.,smoothstep(-.3,.7,vWN.y));`),
    // Old red lacquer on the drum barrel, and the hide stretched over its ends.
    lacquer: procMat("lacquer", { roughness: 0.45, envMapIntensity: 0.6 }, `
      float w=fbm3(vWP*3.); col=mix(vec3(.2,.035,.025),vec3(.36,.07,.04),w); col=mix(col,vec3(.09,.05,.04),smoothstep(.55,.8,fbm3(vWP*7.+2.))*.7);
      rough_=mix(.3,.7,w); bump_=fbm3(vWP*20.)*.002;`),
    hide: procMat("hide", { roughness: 0.75, envMapIntensity: 0.3 }, `
      float w=fbm3(vWP*2.5); col=mix(vec3(.5,.42,.3),vec3(.72,.65,.5),w); col*=.85+.3*n3(vWP*40.);
      col=mix(col,vec3(.3,.22,.14),smoothstep(.6,.85,fbm3(vWP*5.+9.))*.5); bump_=n3(vWP*60.)*.0015;`),
    // Stone cut from one block: column bases, lamp pillars, the stele. No courses, no joints.
    monolith: procMat("monolith", { roughness: 0.8, envMapIntensity: 0.4 }, `
      vec3 q=vWP*.9, w=triW(vWN); vec3 A=triA(tStoneA,q,w)/mStone; vec4 Nr=triN(tStoneN,q,w);
      col=vec3(.3,.3,.28)*A; col=mix(col,vec3(.16,.2,.1),smoothstep(.5,.75,fbm3(vWP*1.3+4.))*.45);
      rough_=Nr.w; nd_=Nr.xyz*1.2;`, { tex: ["stone"] }),
    // Woven rush and straw: mats and cushions.
    straw: procMat("straw", { roughness: 0.8, envMapIntensity: 0.25 }, `
      vec3 q=vWP*1.5, w=triW(vWN); vec3 A=triA(tWeaveA,q,w)/mWeave; vec4 Nr=triN(tWeaveN,q,w);
      col=vec3(.3,.25,.15)*A*A*(.8+.4*fbm3(vWP*1.7)); rough_=mix(.75,.98,Nr.w); nd_=Nr.xyz*2.2;`, { tex: ["weave"] }),
    dark: new THREE.MeshBasicMaterial({ color: 0x030302, side: THREE.BackSide }),   // the dark indoors; the mist outside still lies in front of it
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }),
  };
}
