// Lit materials whose colour, roughness and relief are computed in the shader, not sampled from files.
import * as THREE from "../v/build/three.module.js";
import { NOISE, WOOD, BUMP } from "./glsl.js";

// `body` may write: vec3 col, float rough_, float bump_ (metres), float ao_.
// Every geometry drawn with these needs a float `ao` attribute (see geo.js): occlusion is baked per vertex
// by whatever built the geometry, because overcast light casts no shadow to do that job.
export function procMat(key, params, body) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float ao; varying float vAO; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vWP=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal); vUv2=uv; vAO=ao;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vAO; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;\n" + NOISE + WOOD + BUMP)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float rough_=roughness, bump_=0., ao_=vAO; vec3 col=diffuseColor.rgb;
        { ${body} }
        diffuseColor.rgb=col*ao_;`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor=clamp(rough_,.04,1.);")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n normal=bumpN(-vViewPosition,normal,bump_);");
  };
  m.customProgramCacheKey = () => key;
  return m;
}

export function createMaterials() {
  const wood = (key, grain) => procMat(key, { roughness: 0.82, envMapIntensity: 0.35 }, `
    col=woodCol(vWP,vec3(${grain}));
    float damp=smoothstep(2.2,.9,vWP.y+fbm3(vWP*.8)*.8);          // feet of columns stay damp and dark
    col*=mix(1.,.62,damp); rough_=mix(.86,.5,damp);
    bump_=fbm3(vWP*vec3(${grain})*5.)*.004;`);

  const plasterCache = new Map();
  const plaster = (base) => {
    const k = base.toFixed(2);
    if (!plasterCache.has(k)) plasterCache.set(k, procMat("plaster" + k, { roughness: 0.9, envMapIntensity: 0.25 }, `
      float t=vWP.x+vWP.z;
      col=vec3(.74,.735,.7)*(.8+.28*fbm3(vWP*.9));
      float drip=smoothstep(.45,.8,n2(vec2(t*5.,vWP.y*.35)))*smoothstep(${k}+2.2,${k}+3.4,vWP.y+fbm2(vec2(t,2.))*1.5);
      col=mix(col,vec3(.36,.37,.34),drip*.55);                      // rain streaks run down from the cap
      float damp=smoothstep(${k}+1.1,${k},vWP.y-fbm2(vec2(t*.9,5.))*.9);
      col=mix(col,vec3(.2,.235,.17),damp*.75);                      // rising damp and moss at the foot
      rough_=mix(.92,.6,damp); bump_=fbm3(vWP*6.)*.003;`));
    return plasterCache.get(k);
  };

  return {
    woodV: wood("woodV", "9.,1.1,9."), woodX: wood("woodX", "1.1,9.,9."), woodZ: wood("woodZ", "9.,9.,1.1"),
    plaster,

    // vUv2 = (metres along the eave, metres up the slope). Rows of half-round cover tiles over pan tiles.
    tile: procMat("tile", { roughness: 0.6, envMapIntensity: 0.9, side: THREE.DoubleSide }, `
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
      rough_=mix(.3,.55,tone)-.1*cover*detail;`),

    stone: procMat("stone", { roughness: 0.8, envMapIntensity: 0.5 }, `
      bool topF=vWN.y>.5; vec2 q=topF?vWP.xz/vec2(1.1,.7):vec2(vWP.x+vWP.z,vWP.y*4.45)/vec2(.95,1.);
      q.x+=floor(q.y)*.37; vec2 f=fract(q), id=floor(q);
      float edge=min(min(f.x,1.-f.x)*1.2,min(f.y,1.-f.y)*.5), joint=1.-smoothstep(.01,.03,edge);
      col=mix(vec3(.17,.175,.165),vec3(.3,.3,.285),h21(id))*(.6+.6*fbm3(vWP*2.5));
      float moss=smoothstep(.45,.7,fbm3(vWP*.9+2.))*(topF?.25:smoothstep(1.,.1,vWP.y));
      col=mix(col,vec3(.13,.18,.08),max(moss*.8,joint*.5)); col=mix(col,vec3(.04),joint*.3);
      float wet=topF?.75:smoothstep(.5,0.,vWP.y); col*=mix(1.,.6,wet); rough_=mix(.85,.28,wet*(1.-joint));
      bump_=fbm3(vWP*9.)*.004-joint*.006;`),

    // vUv2 = (leaf index + position across the leaf, height mapped to 0..3.02); transoms are offset by 100 and mapped to 0...7.
    lattice: procMat("lattice", { roughness: 0.85, envMapIntensity: 0.3 }, `
      vec2 q=vUv2; bool tr=q.y>50.; if(tr) q.y-=100.; float lx=fract(q.x)*1.05, top=tr?.7:3.02;
      float fr=min(min(lx,1.05-lx),min(q.y,top-q.y)), frame=1.-smoothstep(.065,.07,fr);
      float rail=tr?0.:1.-smoothstep(.05,.055,abs(q.y-1.18));
      float zone=tr?1.:step(1.18,q.y);
      vec2 gf=abs(fract(vec2(lx,q.y)/.105)-.5); float bar=step(.33,max(gf.x,gf.y));
      float hole=zone*(1.-frame)*(1.-bar)*(1.-rail);
      float panel=(1.-zone)*(1.-frame)*smoothstep(.0,.03,min(min(lx-.16,.89-lx),min(q.y-.16,1.02-q.y)));
      col=woodCol(vWP,vec3(9.,1.1,9.))*(1.-.25*panel); col=mix(col,vec3(.01,.009,.008),hole);
      rough_=mix(.8,1.,hole); bump_=(frame+bar*zone+rail)*.012-hole*.03+panel*.008;`),

    bronze: procMat("bronze", { roughness: 0.5, metalness: 0.75, envMapIntensity: 1.0 }, `
      float p=smoothstep(.4,.72,fbm3(vWP*5.)); col=mix(vec3(.16,.125,.085),vec3(.16,.27,.22),p*.75);  // verdigris
      col*=.7+.5*n3(vWP*30.); rough_=mix(.42,.85,p); bump_=fbm3(vWP*24.)*.002;`),

    // Underside of a roof: boards and rafters. vUv2.x runs along the eave.
    rafters: procMat("rafters", { roughness: 0.9, envMapIntensity: 0.15, side: THREE.BackSide }, `
      float r=abs(fract(vUv2.x/.3)-.5); float raft=1.-smoothstep(.16,.2,r);
      col=woodCol(vWP,vec3(9.,9.,1.1))*mix(.4,.85,raft); ao_*=.8; bump_=raft*.03;`),
    fascia: procMat("fascia", { roughness: 0.8, envMapIntensity: 0.3, side: THREE.DoubleSide }, "col=woodCol(vWP,vec3(1.1,9.,1.1))*.6; ao_=.8;"),
    ridge: procMat("ridge", { roughness: 0.55, envMapIntensity: 0.8 }, `
      col=mix(vec3(.1,.105,.11),vec3(.19,.195,.195),fbm3(vWP*2.)); float m=smoothstep(.5,.72,fbm3(vWP*1.3+5.)); col=mix(col,vec3(.11,.15,.07),m*.6);
      rough_=.5; bump_=fbm3(vWP*14.)*.004; ao_=1.;`),
    gable: procMat("gable", { roughness: 0.9, envMapIntensity: 0.2, side: THREE.DoubleSide }, "col=vec3(.62,.615,.58)*(.75+.3*fbm3(vWP*.9)); ao_=.75;"),
    // Old red lacquer on the drum barrel, and the hide stretched over its ends.
    lacquer: procMat("lacquer", { roughness: 0.45, envMapIntensity: 0.6 }, `
      float w=fbm3(vWP*3.); col=mix(vec3(.2,.035,.025),vec3(.36,.07,.04),w); col=mix(col,vec3(.09,.05,.04),smoothstep(.55,.8,fbm3(vWP*7.+2.))*.7);
      rough_=mix(.3,.7,w); bump_=fbm3(vWP*20.)*.002;`),
    hide: procMat("hide", { roughness: 0.75, envMapIntensity: 0.3 }, `
      float w=fbm3(vWP*2.5); col=mix(vec3(.5,.42,.3),vec3(.72,.65,.5),w); col*=.85+.3*n3(vWP*40.);
      col=mix(col,vec3(.3,.22,.14),smoothstep(.6,.85,fbm3(vWP*5.+9.))*.5); bump_=n3(vWP*60.)*.0015;`),
    dark: new THREE.MeshBasicMaterial({ color: 0x030302, side: THREE.BackSide, fog: false }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }),
  };
}
