// Lit materials. Each has a colour and a pattern of its own, worked out in the shader from where the surface is in
// the world (courses of stone, rows of tile, damp at the foot of a wall), and most take their fine grain from a
// scanned surface (textures.js): the scan is divided by its own mean colour, so it supplies detail and not hue.
import * as THREE from "three";
import { NOISE, WOOD, BUMP, U } from "./glsl.js";
import { TRI, declare, bind } from "./textures.js";
import { STAIR, CHEEK_STONE } from "./geo.js";
import { TRAIL } from "./trail.js";
import { SHELTER } from "./shelter.js";
import { PROBE, PROBE_ON, PROBE_GLSL } from "./probe.js";

/** A one-pixel texture that stands in for a picture a material has not been given. */
const BLANK = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; })();

// `body` may write: vec3 col, float rough_, float bump_ (metres), float ao_.
// Every geometry drawn with these needs a float `ao` attribute (see geo.js): occlusion is baked per vertex
// by whatever built the geometry, because overcast light casts no shadow to do that job.
// It may also write vec3 emit_: light of its own; and vec3 nd_: a nudge to the surface normal in world space,
// which is how a scanned surface (textures.js) gives its relief. `tex` names the scans the body samples.
// Snow settles on whatever faces the sky unless `snow` is false or a roof is over it (shelter.js), and takes his
// footprints (trail.js).
export function procMat(key, params, body, { snow = true, tex = [], stair = false, glsl = "", uniforms = null } = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  if (snow && !tex.includes("snow")) tex = [...tex, "snow"];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = U.uSnow; sh.uniforms.uLamp = U.uLamp; sh.uniforms.uWin = U.uWin; sh.uniforms.uWinNight = U.uWinNight; sh.uniforms.uAmb = U.uAmb; sh.uniforms.uT = U.uT; if (PROBE_ON) Object.assign(sh.uniforms, PROBE); bind(sh.uniforms, tex); if (uniforms) Object.assign(sh.uniforms, uniforms(m));
    if (snow) { sh.uniforms.tTrail = U.tTrail; sh.uniforms.uTrail = U.uTrail; sh.uniforms.tShelter = U.tShelter; sh.uniforms.uShelter = U.uShelter; }
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float ao; varying float vAO; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;" + (stair ? "\nattribute vec4 stair; varying vec4 vSt;" : ""))
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vWP=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal); vUv2=uv; vAO=ao;${stair ? " vSt=stair;" : ""}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSnow, uLamp, uT; uniform float uWinNight; uniform vec3 uAmb, uWin; varying float vAO; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;" + (stair ? " varying vec4 vSt;" : "") + "\n" + (PROBE_ON ? PROBE_GLSL : "") + NOISE + WOOD + BUMP + (tex.length ? declare(tex) + TRI : "") + (snow ? TRAIL + SHELTER : "") + glsl)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float rough_=roughness, bump_=0., ao_=vAO; vec3 col=diffuseColor.rgb, emit_=vec3(0.), nd_=vec3(0.);
        { ${body} }
        ${snow ? `if(uSnow>.001){ float sn_=uSnow*smoothstep(.3,.7,vWN.y)*smoothstep(.2,.5,fbm3(vWP*.8)+.25)*(1.-shelter(vWP)); vec3 sr=texture2D(tSnowN,vWP.xz*.7).xyz;
          vec3 tr_=trail(vWP)*smoothstep(.85,.97,vWN.y); vec3 sc_=vec3(.82,.86,.92)*(.9+.2*sr.z)*mix(vec3(1.),vec3(.6,.65,.76),tr_.x);   // trodden snow: packed, a little grey and blue
          col=mix(col,sc_,sn_*(1.-.25*tr_.x)); rough_=mix(rough_,.82-.12*tr_.x,sn_); bump_*=1.-sn_; ao_=mix(ao_,max(ao_,.8)*(1.-.25*tr_.x),sn_); nd_=mix(nd_,vec3(sr.x*2.-1.,0.,sr.y*2.-1.)*.55*(1.-.6*tr_.x)+vec3(tr_.y,0.,tr_.z),sn_); }` : ""}
        diffuseColor.rgb=col;`)
      // What is tucked away is dark to the sky, and only a little to the sun.
      .replace("#include <aomap_fragment>", `${PROBE_ON ? `vec3 pb_=vec3(0.); float pv_=probeLight(vWP,normalize(vWN),pb_);   // the baked light (probe.js): the sky as this place sees it, and what the walls give back
        reflectedLight.indirectDiffuse=reflectedLight.indirectDiffuse*pv_+material.diffuseColor*RECIPROCAL_PI*pb_; reflectedLight.indirectSpecular*=mix(1.,pv_,.7);` : ""}
        reflectedLight.indirectDiffuse*=ao_; reflectedLight.directDiffuse*=mix(1.,ao_,.3);
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

// How a flight's stones are laid (the `steps` material below). A level that wants them otherwise sets what it changes on
// `M.steps.userData.stairStyle` while its site is built (before the first frame; the page walks one level): `stoneW`
// the slab's width across a tread, in metres, which sets how many slabs a flight has (two to five, one more or fewer now and
// then); `cheekL` how long a stone down a cheek runs, in metres (a cap of 0.46 m stands at the head whatever this is); `leaves`
// whether bamboo leaves lie on the treads; `moss` whether moss grows on the shaded flights; `crest` how strongly the worn band along each tread's nose is lit (1 as the prologue has it, 0 none: for a hard light that would string the noses into white lines); `crestVary` how much that band's width and brightness differ from slab to slab (1, or 0 for every slab alike). These are the prologue's own.
export const STAIR_STYLE = Object.freeze({ stoneW: 0.8, cheekL: 0.95, leaves: true, moss: true, crest: 1, crestVary: 1 });
export function createMaterials() {
  // Old unpainted timber. `turn` brings the grain's axis to y, so that the scan's grain runs along the member.
  const wood = (key, grain, turn, base = ".125,.07,.05") => procMat(key, { roughness: 0.82, envMapIntensity: 0.35 }, `
    vec3 q=vWP.${turn}*vec3(.95,.5,.95), w=triW(vWN.${turn});
    vec3 A=triA(tWoodA,q,w)/mWood; vec4 Nr=triN(tWoodN,q,w);
    col=vec3(${base})*mix(vec3(1.),A,.9)*(.72+.56*n3(vWP*vec3(${grain})*.22));       // old dark timber, its red long faded; each member its own tone
    float weather=smoothstep(.36,.7,fbm3(vWP*.6+3.)+.25*n2(vec2((vWP.x+vWP.z)*7.,vWP.y*.5))); col=mix(col,vec3(.13,.118,.1)*A,weather*.55);   // bleached silver where the rain runs
    float damp=smoothstep(2.2,.9,vWP.y+fbm3(vWP*.8)*.8);          // feet of columns stay damp and dark
    col*=mix(1.,.62,damp); rough_=mix(Nr.w*.92,.5,damp);
    nd_=Nr.xyz.${turn}*1.5;`, { tex: ["wood"] });

  // Lime-washed walls. One material for all of them: each wall's geometry says how high its foot stands (geo.footAt).
  const plasterOne = procMat("plaster", { roughness: 0.9, envMapIntensity: 0.25 }, `
      float t=vWP.x+vWP.z, base=vUv2.x; vec3 q=vWP/2.7, w=triW(vWN);
      vec3 A=triA(tPlasterA,q,w)/mPlaster; vec4 Nr=triN(tPlasterN,q,w);
      col=vec3(.9,.89,.85)*mix(vec3(1.),A,.3)*(.94+.1*fbm3(vWP*.5));   // lime wash: the paper of this picture, with the stains of many rains
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
    // Indoors (framing.js): the beams, ribs and purlins in the deep, reddish-grey timber of the palette's timber under the
    // eaves, and the columns in vermilion faded almost to brown, as the palette asks for posts (docs/ART-SPEC.md).
    beamX: wood("beamX", "1.1,9.,9.", "yxz", ".07,.058,.047"), beamZ: wood("beamZ", "9.,9.,1.1", "xzy", ".07,.058,.047"), pillar: wood("pillar", "9.,1.1,9.", "xyz", ".17,.06,.04"),
    plaster,

    // vUv2 = (metres along the eave, metres up the slope). Rows of half-round cover tiles over pan tiles.
    tile: procMat("tile", { roughness: 0.6, envMapIntensity: 0.3, side: THREE.DoubleSide }, `
      float u=vUv2.x/.25, r=fract(u)-.5, row=floor(u), seg=floor(vUv2.y/.33), fw=fwidth(u), fv=fwidth(vUv2.y/.33);
      // The rows' profile is averaged over what one pixel covers (four looks across it), so that a roof a few pixels to a
      // row shows each row's mean rather than whichever sliver falls on the pixel, which crawls as the eye moves (#731).
      float cover=0., pan=0., gutter=0.;
      for(int k=0;k<4;k++){ float rk=fract(u+(float(k)-1.5)*.25*fw)-.5, ak=abs(rk);
        cover+=sqrt(max(0.,1.-ak*ak/.09))*step(ak,.3); pan+=(1.-cos(clamp((ak-.3)/.2,0.,1.)*3.14159))*.5; gutter+=1.-smoothstep(.0,.16,abs(ak-.5)+.02); }
      cover*=.25; pan*=.25; gutter*=.25;
      float lap=smoothstep(.0,.06+fv,fract(vUv2.y/.33));            // each course laps the one below (its edge as soft as a pixel is wide)
      float detail=1.-smoothstep(.1,.45,fw);                        // relief folds into roughness with distance
      bump_=(cover*.06+pan*.012-(1.-lap)*.012)*(1.-smoothstep(.08,.3,fw));   // (the relief bends the light by screen slopes: gone before a row is four pixels, where it only shimmers)
      // Each tile's own shade, until tiles are smaller than a pixel: then their mean, not a different tile each frame.
      float tone=mix(h21(vec2(row,seg)),.5,smoothstep(.2,.6,max(fw,fv))); col=mix(vec3(.05,.054,.058),vec3(.125,.13,.13),tone*.55+fbm2(vWP.xz*.7)*.45);
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
        col=mix(vec3(.23,.232,.218),vec3(.37,.37,.345),h21(id+3.))*mix(vec3(1.),A,.9);
        col=mix(col,vec3(.11,.14,.075),moss*max(.2,joint*.8)); col=mix(col,vec3(.035),joint*.5);
        float worn=smoothstep(.5,.15,abs(fract(vWP.x*.25)-.5))*.0+smoothstep(.3,.7,fbm2(vWP.xz*.6+2.)); col*=mix(.9,1.22,worn);   // trodden pale where feet go
        wet=.45; rough_=mix(nr.z,.28,wet*(1.-joint)); nd_=vec3(nr.x*2.-1.,0.,nr.y*2.-1.)*(1.-joint)*1.1; bump_=-joint*.006;
      } else {
        vec3 w=triW(vWN); w.y=0.; w/=w.x+w.z+1e-4; vec3 q=vWP/1.6;
        vec3 A=triA(tBlocksA,q,w)/mBlocks; vec4 Nr=triN(tBlocksN,q,w);
        col=vec3(.25,.25,.235)*mix(vec3(1.),A,.95);
        col=mix(col,vec3(.13,.18,.08),moss*smoothstep(1.,.1,vWP.y-floor(vWP.y/2.6)*2.6)*.7);       // green toward the foot of each rise
        wet=smoothstep(.35,.75,fbm3(vWP*.35+7.))*.7; rough_=mix(Nr.w,.35,wet); nd_=Nr.xyz*1.3;   // damp in patches, wherever the wall stands (it used to be wet below the height of the court, which was the whole approach)
      }
      col*=mix(1.,.6,wet);`, { tex: ["stone", "blocks"] }),
    // A stair is laid of cut stone, not poured: every flight, whichever hall or terrace it serves, reads its stones from the
    // `stair` numbers geo.js writes into it (what each means is set out there), so no triangle is added and the same flight
    // is cut the same way every time. A tread is two to five slabs across with joints that do not line up from one tread
    // to the next; a cheek is a cap at the head and then long stones; the middle of each tread is worn pale and a little
    // glossy where feet fall, its ends and the corner under the riser above stay dark and damp, and moss grows only on a
    // few treads of the flights the sun does not reach (one that comes down toward the north) and in the joints low on a
    // cheek; a bamboo leaf or two lies where feet do not sweep.
    steps: procMat("steps", { roughness: 0.8, envMapIntensity: 0.4 }, `
      vec4 st=vSt; float cd=floor(st.w+.5), Nn=mod(cd,64.), r1=floor(cd/64.), shd=mod(r1,4.); r1=floor(r1/4.);
      float sed=mod(r1,16.), W=floor(r1/16.)/20.;
      bool cheek=st.y<0.; float ck=cheek?1.:0.;
      float ti=floor(max(st.y,0.)), tf=max(st.y,0.)-ti, zc=-1.-st.y, x=st.x;
      vec3 sg; if(cheek) sg=stCheek(zc,sed,Nn*STREAD+SNOSE); else sg=stTread(x,W,ti,sed);
      float up=smoothstep(.45,.65,vWN.y), dn=max(.97-tf,0.)*(STREAD+SNOSE)/.94;      // (dn: how far in metres from the tread's nose)
      float nearK=1.-smoothstep(5.,9.,length(vWP-cameraPosition));      // what is worked into the stone's edges is for the eye within a few metres; by nine it is back to plain stone
      float sid=sg.x, px=fwidth(x)+.4*fwidth(st.y), joint=0., jd=.4, rim=0., fillw=0., chip=0., chipRim=0.;
      if(sg.y<.05){
        // A joint is not one line: along its length it is open for a stretch (a hair to a finger's width, light on a tread where it
        // has silted up, deep on a riser) and packed solid for the next (nearly the stone's own colour), in runs a hand or so long.
        float dj=sg.y+(n2(vWP.xz*13.+vWP.y*9.)-.5)*.005, jn=n2(vWP.xz*8.+vWP.y*10.+sid*2.9), jk=sg.z;
        float la=cheek?st.x*2.+st.z:tf*(STREAD+SNOSE), sS=la*9.+h21(vec2(sid,jk+sed))*9.+(n2(vWP.xz*17.+vWP.y*7.)-.5)*.35, seg=floor(sS);
        float rs=h21(vec2(seg*1.7+jk*3.1,sid+ti*.37+sed));
        float thr=.47+.07*shd+.08*clamp(ti/max(Nn-1.,1.),0.,1.);   // the shaded flights and the higher treads are packed more: damp, and moss in the packing
        fillw=1.-smoothstep(thr,thr+.04,rs);
        float ow=mix(h21(vec2(seg+31.,jk+sed)),h21(vec2(seg+32.,jk+sed)),smoothstep(.3,.7,sS-seg));
        float jw=(.0006+.0044*ow)*(.75+.5*jn)*(1.-.5*fillw);
        jd=mix(mix(.84,.5,up),mix(.16,.1,up),fillw);
        float seen=1.-smoothstep(.03,.1,px);          // (only as long as it can be told apart)
        joint=(1.-smoothstep(jw,jw+.0025+px,dj))*seen;
        rim=smoothstep(jw+.001,jw+.005,dj)*(1.-smoothstep(jw+.005,jw+.018,dj))*seen*(1.-fillw);
        // Where a joint meets the tread's nose a corner has come away: a chip two to four centimetres across.
        if(!cheek&&up>.5&&h21(vec2(jk*5.3+ti*1.9,sed+8.))<.88){      // (nine in ten, never all, each its own size and its own place on the edge)
          float rx=.014+.014*h21(vec2(jk+ti*1.3,sed+2.)), ry=.012+.014*h21(vec2(jk*2.1+ti,sed+6.)), dn0=(h21(vec2(jk+ti*.7,sed+4.))-.4)*.02;
          float e=length(vec2(sg.y/rx,(dn-dn0)/ry)); chip=(1.-smoothstep(.55,1.,e))*nearK;
          chipRim=smoothstep(.55,.8,e)*(1.-smoothstep(.8,1.05,e))*step(dn0,dn)*nearK; } }
      float sr=h21(vec2(sid*1.37+ti*.61+ck*50.,sed+.3));
      vec3 tint=mix(vec3(.95,.98,1.03),vec3(1.05,1.01,.94),h21(vec2(sid+11.,ti+sed+ck*7.)));   // each stone a little cooler or warmer
      vec3 w3=triW(vWN), q=vWP*.75+vec3(h21(vec2(sid,ti+sed)),h21(vec2(ti+sed,sid+3.)),h21(vec2(sid+5.,sed)))*6.;   // and cut from another part of the scan
      vec3 A=triA(tStoneA,q,w3)/mStone; vec4 Nr=triN(tStoneN,q,w3);
      col=mix(vec3(.21,.212,.2),vec3(.31,.31,.29),up)*mix(vec3(1.),A,.72)*tint*(.74+.52*sr);
      // Where on a tread: how near the cheek, how near the riser above (0) or the nose (1), how near the line feet follow.
      float side=1.-smoothstep(0.,.3,W*.5-abs(x)), d=clamp((tf-.13)/.85,0.,1.), corner=1.-smoothstep(0.,.4,d);
      float walk=exp(-pow(abs(x)/clamp(.22*W+.2,.42,.9),2.));
      float wear=(1.-ck)*up*walk*(.35+1.2*h21(vec2(sid+2.,ti*1.7+sed)))*(.5+.5*smoothstep(.05,.6,d));   // some slabs are walked more than others
      float damp=(1.-ck)*up*clamp(.75*side+.55*corner,0.,1.);
      float layer=${CHEEK_STONE.width}-st.x, stoneF=ck*step(0.,.012-min(layer,st.x));     // a cheek's outer stone, as against the panel set back under it
      col*=1.-.22*ck*(1.-stoneF);
      col*=mix(1.,mix(1.25,1.,(1.-ck)*up)*(1.-.17*(1.-up)*(1.-ck))*mix(1.,.78+.38*smoothstep(0.,1.,d),(1.-ck)*up),nearK);              // a riser is a little duller than the tread above it, and a tread is paler toward the nose than at the back
      col*=1.+.07*ck*step(sid,.5);                                                        // the cap at the head stands a little paler
      float foot=1.-smoothstep(0.,.45,st.z), rr=(1.-ck)*(1.-up)*(1.-smoothstep(0.,.1,st.z));   // low on a cheek, low on a riser: where water stands
      float streak=0.; if(stoneF*(1.-up)>.5) streak=smoothstep(.5,.85,n2(vec2(zc*12.+sed*7.,st.z*.5)));
      col*=1.-.4*damp-.25*streak-.22*ck*foot-.25*rr;
      col=mix(col,col*vec3(1.5,1.47,1.32)+.03,clamp(wear,0.,1.));
      // Moss: which treads carry it, by the sun the flight sees; where on them, by the damp.
      float tr=h21(vec2(ti*2.3+sed*5.1,sed+.9)), has=step(tr,shd<.5?.06:shd<1.5?.24:.55), cs=shd>1.5?.7:shd>.5?.35:.12;
      float moss=0.;
      if((has+ck)*uMoss>.5){      // (the noise is only worked out where moss may be: a few treads, and the cheeks)
        float mn=fbm2(vWP.xz*2.4+sed*3.1+vWP.y*1.3);
        moss=max(has*up*(1.-ck)*smoothstep(.52,.78,mn*.85+.5*max(side,corner)-.5*walk)*(1.-clamp(wear,0.,1.)),
                 max(has*rr*smoothstep(.58,.8,mn*.9+.3*rr), ck*cs*smoothstep(.52,.76,mn+.4*foot+.25*joint)));
        if(moss>.002) col=mix(col,mix(vec3(.065,.085,.045),vec3(.11,.14,.065),n2(vWP.xz*31.))*mix(vec3(1.),A,.5),moss*.65);
      }
      // The tread's nose is worn into a rounded band three to five centimetres wide, widest and palest in the middle third and
      // narrowing toward its ends, a little different slab to slab; it stands a tenth or more above the tread, with a dark line along
      // the edge where it turns under. A cheek's top has its two edges worn the same way, narrower.
      float fwn=max(fwidth(dn),1e-4), crest=0., edge_=0.;   // (the worn band and the line under it only while they are wide enough to be seen: far off the nose is just a little older)
      if(ck<.5&&up>.5&&dn<.12){      // (and only within a hand of the nose: the rest of the tread never asks)
        float uu=abs(x)/(.5*max(W,.1)), prof=1.-.85*smoothstep(.15,1.,uu);
        float bw=(.026+.04*prof)*mix(1.,.8+.4*n2(vec2(x*8.+sed*3.,ti*5.1+1.)),uCrestVary)*mix(1.,.75+.55*h21(vec2(sid+ti,sed+5.)),uCrestVary);   // (widest and palest over the middle third of the tread, drawn in toward its ends; and each slab a little its own)
        crest=smoothstep(.003,bw*.35,dn)*(1.-smoothstep(bw*.35,bw,dn))*(1.-chip)*mix(1.,.8+.4*n2(vec2(x*5.+ti*2.,sed)),uCrestVary)*mix(1.,.7+.6*h21(vec2(sid*3.1+ti,sed+9.)),uCrestVary)*(.45+.55*prof)*uCrest*nearK*smoothstep(1.,3.,bw/fwn);
        edge_=(1.-smoothstep(0.,.009,dn))*smoothstep(.4,1.5,.014/fwn)*nearK;
      }
      float de=min(st.x,${CHEEK_STONE.width}-st.x), arrC=ck*up*stoneF*(1.-smoothstep(0.,.02,de));
      float lip=(1.-ck)*(1.-up)*step(.925,tf)*(1.-smoothstep(.004,.03,(.97-tf)*1.5))*nearK;   // the top two or three centimetres of the nosing slab's face, its foot soft (geo.js gives that face its height in tf)
      col*=(1.-jd*joint)*(1.+.14*rim*(.4+.6*up)+.62*crest+.16*arrC)*(1.-.5*edge_-.4*lip-.8*chip)*(1.+.1*chipRim);
      ao_=min(ao_,1.-mix(.6,.1,up)*joint*(1.-fillw)); bump_=-joint*(1.-fillw)*.004-.005*edge_-.005*chip+.002*crest;   // (a deep riser joint takes no sky or sun at all)
      // A bamboo leaf lies here and there on a tread, nearest the edges, and none on the worn middle.
      float lfm=0.;
      if(uLeaves>.5&&ck<.5&&up>.5&&px<.04){
        float cx=floor((x+W*.5)/.5), hc=h21(vec2(cx*1.3+sed,ti*.7+2.));
        if(hc<mix(.1,.34,max(side,corner))*(1.-.85*walk)){
          vec2 c=vec2((cx+.2+.6*h21(vec2(cx,ti+9.)))*.5-W*.5,.08+.28*h21(vec2(ti+1.,cx+5.)));
          float an=h21(vec2(cx+3.,ti+sed))*3.14159, L=.05+.015*h21(vec2(cx,ti));
          vec2 dr=vec2(cos(an),sin(an)), r=vec2(x,tf*(STREAD+SNOSE))-c; float s_=dot(r,dr), t_=dot(r,vec2(-dr.y,dr.x));
          float hw=.0105*pow(max(1.-s_*s_/(L*L),0.),.7), lf=(1.-smoothstep(hw-.002,hw,abs(t_)))*step(abs(s_),L)*(1.-smoothstep(.02,.04,px));
          vec3 lc=mix(vec3(.2,.17,.065),vec3(.12,.13,.05),h21(vec2(cx+7.,ti)))*(1.+.35*(1.-smoothstep(0.,.0016,abs(t_))));
          col=mix(col,lc,lf*.9); bump_+=lf*.0015; lfm=lf;
        }
      }
      rough_=mix(Nr.w,.45,.3*up); rough_=mix(rough_,.5,clamp(wear,0.,1.)*.7); rough_=mix(rough_,.38,damp*.4); rough_=mix(rough_,.95,moss); rough_=mix(rough_,.9,lfm);
      nd_=Nr.xyz*.65+vec3(h21(vec2(sid+1.,ti+sed))-.5,0.,h21(vec2(ti+2.,sid+sed))-.5)*.05*up;`, { tex: ["stone"], stair: true, uniforms: (m) => { const st = { ...STAIR_STYLE, ...(m.userData.stairStyle || {}) }; return { uStoneW: { value: st.stoneW }, uCheekL: { value: st.cheekL }, uLeaves: { value: st.leaves ? 1 : 0 }, uMoss: { value: st.moss ? 1 : 0 }, uCrest: { value: st.crest }, uCrestVary: { value: st.crestVary } }; }, glsl: `
      const float STREAD=${STAIR.tread.toFixed(3)}, SNOSE=${STAIR.nosing.toFixed(3)};
      uniform float uStoneW, uCheekL, uLeaves, uMoss, uCrest, uCrestVary;   // the level's own way with stone (STAIR_STYLE)
      // How many slabs cut a tread across (two to five by its width, one more or fewer now and then), and where their joints fall.
      float stCount(float W,float i,float sed){
        float nb=W<1.35?max(2.,floor(W/(.5625*uStoneW))):clamp(floor(W/uStoneW+.5),3.,5.), r=h21(vec2(i+.5,sed+3.));
        return clamp(nb+(r>.72?1.:0.)-(r<.22?1.:0.),2.,5.);
      }
      float stBreak(float k,float n,float W,float i,float sed){ return W*(-.5+(k+(h21(vec2(i*3.7+k,sed*1.3+9.))-.5)*.55)/n); }
      // (the slab's number across a tread, the distance to the nearest joint, which joint it is)
      vec3 stTread(float x,float W,float i,float sed){
        float n=stCount(W,i,sed), id=0., dj=1e3, jk=0.;
        for(int k=1;k<5;k++){ if(float(k)>=n) break; float b=stBreak(float(k),n,W,i,sed); id+=step(b,x); if(abs(x-b)<dj){ dj=abs(x-b); jk=float(k); } }
        return vec3(id,dj,jk+i*7.);
      }
      // (the stone's number down a cheek, the distance to the nearest joint, which joint it is): a cap at the head, then stones a metre long or more, none shorter than a third of a metre at the foot.
      vec3 stCheek(float z,float sed,float foot){
        float id=step(.46,z), dj=abs(z-.46), b=.46, jk=0.;
        for(int j=0;j<5;j++){ b+=uCheekL+.6*h21(vec2(float(j)+sed*1.7,sed+2.)); if(b>foot-.35) break; id+=step(b,z); if(abs(z-b)<dj){ dj=abs(z-b); jk=float(j+1); } }
        return vec3(id,dj,jk);
      }` }),

    // vUv2 = (leaf index + position across the leaf, height mapped to 0..3.02); transoms are offset by 100 and mapped to 0...7.
    lattice: procMat("lattice", { roughness: 0.85, envMapIntensity: 0.3, side: THREE.DoubleSide }, `
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
      // Lamplight behind the lattice after dusk, where the plan says a bay is lit (windows.js, ART-REVIEW A2): the
      // whole part of u carries a code of sixteen leaves (dusk level * 8 + night level, each 0..7, and the bay's
      // leaves count from there); a bay of level 0 stays dark paper. Brightest low down where the lamp stands,
      // fading up the paper, each leaf a little its own.
      float code=floor((vUv2.x+4.)/16.), leaf=vUv2.x-code*16., lv=mix(floor(code/8.),mod(code,8.),uWinNight)/7.;
      float up=tr?.2:exp(-pow(abs((q.y-.85)/1.1),2.));
      emit_=mix(uWin*vec3(.2,.13,.1),uWin,up)*uLamp*hole*lv*3.2*(.88+.24*h21(vec2(floor(leaf),7.)));`, { snow: false }),

    bronze: procMat("bronze", { roughness: 0.5, metalness: 0.75, envMapIntensity: 1.0 }, `
      float p=smoothstep(.4,.72,fbm3(vWP*5.)); col=mix(vec3(.16,.125,.085),vec3(.16,.27,.22),p*.75);  // verdigris
      col*=.7+.5*n3(vWP*30.); rough_=mix(.42,.85,p); bump_=fbm3(vWP*24.)*.002;`),

    // Underside of a roof: boards and rafters. vUv2.x runs along the eave.
    rafters: procMat("rafters", { roughness: 1, envMapIntensity: 0, metalness: 0 }, `
      float r=abs(fract(vUv2.x/.3)-.5); float raft=1.-smoothstep(.16,.2,r);
      col=woodCol(vWP,vec3(9.,9.,1.1))*mix(.34,.42,raft); ao_=min(ao_,.42); emit_=col*uAmb*.03; rough_=1.;`, { snow: false }),
    // The panels of a coffered ceiling (pingqi), vUv2 in panels: each a dull blue-green ground darkened by centuries of
    // incense, an eight-petalled flower in faded ochre inside a pale ring. A v of 1000 or more is ground alone (the
    // boards of a caisson).
    coffer: procMat("coffer", { roughness: 0.95, envMapIntensity: 0.1 }, `
      vec2 id=floor(vUv2), q=fract(vUv2)-.5; float r=length(q), a=atan(q.y,q.x), fw=fwidth(r)*1.5+.004;
      col=vec3(.05,.066,.062)*(.82+.36*h21(id));
      if(vUv2.y>=500.){ col=vec3(.15,.085,.055)*(.85+.3*fbm3(vWP*2.)); col=mix(col,vec3(.3,.24,.13),smoothstep(.455,.475,abs(fract(vUv2.x*8.)-.5))*.55); }   // the caisson's boards in faded vermilion, ruled in old gold where they meet
      else {
        float pr=.19+.06*cos(a*8.), pet=1.-smoothstep(-fw,fw,r-pr), edge=1.-smoothstep(.006,.006+fw,abs(r-pr));
        float ring=1.-smoothstep(.01,.01+fw,abs(r-.39)), eye=1.-smoothstep(.055,.055+fw,r);
        float corner=1.-smoothstep(.0,fw*2.,length(abs(q)-.5)-.09);
        col=mix(col,vec3(.09,.075,.05),pet*.5); col=mix(col,vec3(.15,.135,.1),max(edge,ring)*.45); col=mix(col,vec3(.17,.13,.07),max(eye,corner*.6)*.8);
      }
      float wear=smoothstep(.3,.75,fbm3(vWP*1.4+vec3(id.x,0.,id.y)*.37)); col=mix(col,col*.5+vec3(.01,.009,.007),wear*.7);   // smoke has dulled some panels more than others
      rough_=.95; emit_=col*uAmb*.02;`, { snow: false }),
    // A plain small-squared ceiling (ping'an): bare boards between the ribs.
    pingan: procMat("pingan", { roughness: 0.95, envMapIntensity: 0.1 }, `
      col=woodCol(vWP,vec3(9.,1.1,9.))*.62*(.9+.2*h21(floor(vWP.xz/.4))); rough_=.95; emit_=col*uAmb*.02;`, { snow: false }),
    // The boards of a gate passage's ceiling (#288): out of doors under a roof, lit by the paving and the day coming in at both
    // ends, which a hall's ceiling, lit by lamps, is not.
    passage: procMat("passage", { roughness: 0.95, envMapIntensity: 0.1 }, `
      col=woodCol(vWP,vec3(9.,1.1,9.))*.85*(.9+.2*h21(floor(vWP.xz/.4))); rough_=.95; emit_=col*uAmb*.37;`, { snow: false }),
    // Window paper on the inside of the south wall, the day coming through it; at night it is only paper.
    paper: procMat("paper", { roughness: 1, envMapIntensity: 0 }, `
      col=vec3(.66,.64,.58)*(.94+.06*n3(vWP*11.)); rough_=1.;
      emit_=vec3(.58,.6,.6)*uAmb*.3*(.8+.2*vUv2.y);`, { snow: false }),
    // Old gilding, rubbed through to the lacquer where hands and smoke have been.
    gilt: procMat("gilt", { roughness: 0.42, metalness: 0.7, envMapIntensity: 0.6 }, `
      float w=smoothstep(.45,.75,fbm3(vWP*7.)); col=mix(vec3(.5,.36,.14),vec3(.12,.06,.04),w*.6); rough_=mix(.38,.8,w);`, { snow: false }),
    // The ink-stone pool by the second landing. The county gazetteer says its water is clear, and when the moon is
    // bright and the wind light the ripples glint as though traces of ink were in it (docs/t00/SOURCES.md). So: deep,
    // clear water that gives back the sky where it is seen aslant and goes dark looking straight down, small slow
    // ripples, and faint dark wisps drifting through it like ink loosening from a stone.
    inkpool: procMat("inkpool", { roughness: 0.12, metalness: 0, envMapIntensity: 0.18 }, `
      vec2 p=vWP.xz; float t=uT*.35;
      float w1=n2(p*2.3+vec2(t,t*.7)), w2=n2(p*4.1-vec2(t*.8,-t*.5)), w=w1*.6+w2*.4;
      nd_=vec3(n2(p*3.+vec2(.5+t,0.))-.5,0.,n2(p*3.+vec2(0.,.5-t))-.5)*.16;
      vec3 V=normalize(cameraPosition-vWP); /* nan-ok: the eye is never on the surface it draws (the near plane is 0.1 m off) */ float fres=pow(max(1.-clamp(V.y+nd_.x*.6,0.,1.),0.),5.)*.6+.03;
      float wisp=smoothstep(.55,.85,fbm2(p*.9+vec2(t*.15,-t*.1)+w*.6));
      col=vec3(.018,.026,.025)*(1.-.45*wisp); rough_=.1+.1*w;
      emit_=uAmb*.32*(fres*(.6+.4*w))*(1.-.5*wisp);`, { snow: false }),
    // A temple banner (fan): old silk faded to the colour of straw, a narrow indigo edge, two painted bands; vUv2 runs
    // across and up the cloth.
    banner: procMat("banner", { roughness: 0.95, envMapIntensity: 0.1, side: THREE.DoubleSide }, `
      vec2 q=vUv2; float edge=step(q.x,.07)+step(.93,q.x), band=step(abs(q.y-.78),.012)+step(abs(q.y-.3),.012);
      col=vec3(.42,.36,.26)*(.82+.3*fbm3(vWP*vec3(4.,1.5,4.))); col=mix(col,vec3(.11,.12,.15),min(edge+band,1.)*.85); rough_=.95;`, { snow: false }),
    // The horn panes of a hanging lamp, lit from within.
    lampglass: procMat("lampglass", { roughness: 0.8, envMapIntensity: 0.1 }, `
      col=vec3(.45,.33,.2); emit_=vec3(1.,.62,.3)*(.15+.5*uLamp)*(.75+.25*sin(vUv2.y*3.14));`, { snow: false }),
    // The lip of snow along an eave: drawn only when it has snowed.
    snowlip: procMat("snowlip", { roughness: 0.9, envMapIntensity: 0.3, side: THREE.DoubleSide }, "if(!(uSnow>=.5)) discard; col=vec3(.8,.84,.9)*(.92+.1*fbm3(vWP*3.)); rough_=.85; ao_=1.;", { snow: false }),
    fascia: procMat("fascia", { roughness: 0.8, envMapIntensity: 0.3, side: THREE.DoubleSide }, "col=woodCol(vWP,vec3(1.1,9.,1.1))*.6; ao_=.8;"),
    ridge: procMat("ridge", { roughness: 0.55, envMapIntensity: 0.8 }, `
      col=mix(vec3(.06,.064,.068),vec3(.12,.124,.124),fbm3(vWP*2.)); float m=smoothstep(.5,.72,fbm3(vWP*1.3+5.)); col=mix(col,vec3(.11,.15,.07),m*.6);
      rough_=.5; bump_=fbm3(vWP*14.)*.004; ao_=1.;`),
    gable: procMat("gable", { roughness: 0.9, envMapIntensity: 0.2, side: THREE.DoubleSide }, "col=woodCol(vWP,vec3(9.,1.1,9.))*.8; ao_=.7;"),
    // The floor of the grove: dark leaf litter, moss, a scatter of fallen bamboo leaves.
    earth: procMat("earth", { roughness: 0.95, envMapIntensity: 0.15 }, `
      float a=fbm2(vWP.xz*.35), b=fbm2(vWP.xz*.09+4.);
      vec2 uv=vWP.xz/1.9; vec3 A=mix(texture2D(tLeavesA,uv).rgb,texture2D(tLeavesA,uv.yx*.37+.3).rgb,.35)/mLeaves, nr=texture2D(tLeavesN,uv).xyz;   // two scales, so the litter does not repeat
      col=mix(vec3(.045,.056,.034),vec3(.1,.11,.062),a)*mix(vec3(1.),A,.8)*1.1; col=mix(col,col*vec3(1.12,1.02,.8),smoothstep(.45,.7,b)); col*=.75+.5*fbm2(vWP.xz*.05+7.);   // dark and damp, never the same for long
      rough_=nr.z; nd_=vec3(nr.x*2.-1.,0.,nr.y*2.-1.)*1.6;`, { tex: ["leaves"] }),
    // Rough rubble laid dry: the lining of the well.
    // Water seeping down the stone of the dragon well's niche: irregular dark wet runs, more of them low down where
    // the water gathers, and moss at their feet. Laid on as thin sheets over the stone; vUv2 runs across and up.
    seep: procMat("seep", { roughness: 0.3, envMapIntensity: 0.6 }, `
      vec2 q=vUv2; float n=fbm2(vec2(q.x*6.+vWP.x+vWP.z,q.y*1.4));
      float runs=n2(vec2(q.x*8.+vWP.x*3.+vWP.z*3.,0.))+.4*(1.-q.y)+.25*n, edge=smoothstep(0.,.18,q.x)*smoothstep(1.,.82,q.x);
      if(!(runs*edge>=.62)) discard;
      float moss=smoothstep(.32,0.,q.y+.18*(n-.5));
      col=mix(vec3(.045,.046,.042),vec3(.06,.085,.04),moss)*(.85+.3*n); rough_=mix(.2,.85,moss);`, { snow: false }),
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
      rough_=Nr.w; nd_=Nr.xyz*1.8;
      // a tree's foot (trees.js gives it a v below -1: how far above the paving it is) is drifted over with snow for its
      // lowest thirty centimetres, so that it goes down into the blanket round it and does not stand on it (#92)
      // and lit a little by the sky, as the paving's snow is (that is lit by hand): in the shade it would be greyer than the snow it lies in
      if(vUv2.y<-.5&&uSnow>.001){ float d_=uSnow*smoothstep(.32,.04,-vUv2.y-1.)*(.85+.15*fbm3(vWP*3.)); col=mix(col,vec3(.82,.86,.92),d_); rough_=mix(rough_,.95,d_); nd_*=1.-d_; ao_=mix(ao_,max(ao_,.85),d_); emit_+=vec3(.82,.86,.92)*uAmb*.25*d_; }`, { tex: ["bark"] }),
    // The young ginkgo's own bark (#162): the same scan and the same snow at the foot, a greyer brown.
    barkGinkgo: procMat("barkGinkgo", { roughness: 0.95, envMapIntensity: 0.15 }, `
      vec3 q=vWP*vec3(1.4,.85,1.4), w=triW(vWN); vec3 A=triA(tBarkA,q,w)/mBark; vec4 Nr=triN(tBarkN,q,w);
      col=vec3(.145,.118,.096)*A; col=mix(col,vec3(.12,.14,.09)*A,smoothstep(.55,.8,fbm3(vWP*1.5))*.3);   // a young ginkgo's bark: grey-brown, shallowly furrowed (the Flora of China, quoted second-hand), not the cedar's red-brown; a little moss
      rough_=Nr.w; nd_=Nr.xyz*1.8;
      // a tree's foot (trees.js gives it a v below -1: how far above the paving it is) is drifted over with snow for its
      // lowest thirty centimetres, so that it goes down into the blanket round it and does not stand on it (#92)
      // and lit a little by the sky, as the paving's snow is (that is lit by hand): in the shade it would be greyer than the snow it lies in
      if(vUv2.y<-.5&&uSnow>.001){ float d_=uSnow*smoothstep(.32,.04,-vUv2.y-1.)*(.85+.15*fbm3(vWP*3.)); col=mix(col,vec3(.82,.86,.92),d_); rough_=mix(rough_,.95,d_); nd_*=1.-d_; ao_=mix(ao_,max(ao_,.85),d_); emit_+=vec3(.82,.86,.92)*uAmb*.25*d_; }`, { tex: ["bark"] }),
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
    // T05's monument stele (shaft and head cut from one block), the monolith's grain at about half its value so that it is no brighter than the coursed stone
    // of the pavilion's plinth and the terrace round it (the art review of #716: the plain monolith read as a pale slab against them).
    steleMono: procMat("steleMono", { roughness: 0.8, envMapIntensity: 0.4 }, `
      vec3 q=vWP*.9, w=triW(vWN); vec3 A=triA(tStoneA,q,w)/mStone; vec4 Nr=triN(tStoneN,q,w);
      col=vec3(.3,.3,.28)*A*.52; col=mix(col,vec3(.12,.15,.08),smoothstep(.5,.75,fbm3(vWP*1.3+4.))*.45);
      rough_=Nr.w; nd_=Nr.xyz*1.2;`, { tex: ["stone"] }),
    // The imperial stele in the stele pavilion (#520): blue-grey stone, cooler and darker than the pavilion's platform, damp at the foot, worn bright where a hand
    // passes the front arrises, mossy on the shaded side low down, its writing weathered into traces and its title still cut. Everything is read from the
    // `stair` numbers stele.js writes (the point's place across the stone and up from the platform, which way the face looks, whether it is the base and whether
    // it is a chamfer), and from two small pictures of the writing, so no triangle is added. Snow does not lie on it: it stands under a roof.
    steleStone: procMat("steleStone", { roughness: 0.8, envMapIntensity: 0.4 }, `
      float lx=vSt.x, ly=vSt.y, nzf=vSt.z, kb=mod(vSt.w,2.), cham=step(1.5,vSt.w);
      float nearK=1.-smoothstep(5.,9.,length(vWP-cameraPosition));
      vec3 q=vWP*.9, w=triW(vWN); vec3 A=triA(tStoneA,q,w)/mStone; vec4 Nr=triN(tStoneN,q,w);
      float big=n3(vWP*1.7+vec3(3.,1.,7.)), mid=.6*n3(vWP*5.+2.)+.4*n3(vWP*10.3+5.);
      vec3 st_=vec3(4.4,1.6,4.4); float pat_=smoothstep(.3,.7,.6*n3(vWP*st_+vec3(5.,2.,1.))+.4*n3(vWP*st_*2.1+vec3(1.,9.,2.))); float fine=smoothstep(.3,.7,n3(vWP*vec3(8.,3.4,8.)+vec3(1.,6.,3.)));
      col=vec3(.255,.265,.264)*A*(.84+.3*big)*(.8+.34*pat_)*(.92+.16*fine); col=mix(col,col*vec3(1.06,1.04,1.),smoothstep(.55,.8,n3(vWP*vec3(.9,.45,.9)+9.))*.4);
      float up=smoothstep(.85,.97,vWN.y), side=1.-step(.5,abs(nzf));
      float streak=smoothstep(.4,.8,.65*n3(vec3(lx*15.,ly*.35,2.))+.35*n3(vec3(lx*31.,ly*.7,4.))); float streak2=smoothstep(.5,.85,n3(vec3(lx*34.,ly*.6,5.))); col*=1.-(.2*streak+.1*streak2)*(1.-up)*(.35+.65*smoothstep(.4,2.6,ly));
      float wet=(1.-smoothstep(.55,1.25+.25*(mid-.5),ly))*(1.-.85*up*kb); col*=(1.-.58*wet*(.7+.6*mid))*(1.+.12*smoothstep(1.2,2.3,ly)*(1.-kb)); rough_=mix(rough_,.5,wet*.5);
      col=mix(col,vec3(dot(col,vec3(.33)))*1.3+.012,.5*up*kb+.3*up*(1.-kb)); col=mix(col,vec3(.5,.5,.48)*(.55+.45*pat_)*A,.6*up*kb);
      float topw=smoothstep(2.35,2.95,ly)*(1.-kb); float corner=smoothstep(.2,.5,abs(lx))*topw;
      col=mix(col,(col*1.3+.012)*vec3(1.04,1.02,.98),smoothstep(.6,.72,n3(vWP*vec3(7.,3.,7.)+4.))*(.3*topw+.5*corner)); col*=1.-.3*step(.64,n3(vWP*34.))*corner*nearK;
      float band=smoothstep(.7,.86,ly)*(1.-smoothstep(1.34,1.5,ly))*(1.-kb); float worn=cham*(1.-kb)*step(.45,abs(lx))*band;
      float hand=.35+.65*smoothstep(.2,.8,n3(vec3(ly*5.5,abs(lx)*30.,1.)));
      float baseTop=cham*kb*smoothstep(.43,.46,ly)*(1.-smoothstep(.5,.54,ly))*(.3+.7*smoothstep(.2,.8,n3(vec3(lx*6.,1.,4.))));
      float polish=max(worn*hand,baseTop*.8); col*=1.+.5*polish; col+=.015*polish; rough_=mix(rough_,.34,polish);
      float mossy=(1.-smoothstep(.5,1.1,ly))*smoothstep(-.1,.5,lx)*smoothstep(.6,.78,n3(vWP*6.+5.))*(1.-up*.6);
      col=mix(col,vec3(.09,.15,.07)*A,.6*mossy);
      float dd=clamp((abs(lx)-.475)/.02,0.,1.); float petal=cham*(1.-kb)*step(.472,abs(lx))*exp(-(dd-.5)*(dd-.5)/.0196); col*=1.-.35*petal*nearK;
      float inBody=step(.5,nzf)*(1.-kb); vec2 iuv=vec2((lx+.425)/.85,(ly-.58)/1.7); vec2 ie=step(vec2(0.),iuv)*step(iuv,vec2(1.));
      vec2 ink=texture2D(uInk,iuv).rg*ie.x*ie.y*inBody; float back=step(nzf,-.5)*(1.-kb); vec2 ib=texture2D(uInk,vec2(1.-iuv.x,iuv.y)).rg*ie.x*ie.y*back; ink=ink+vec2(0.,ib.x*.3+ib.y);
      vec2 tuv=vec2((lx+.23)/.46,(ly-2.34)/.4); vec2 te=step(vec2(0.),tuv)*step(tuv,vec2(1.)); float tk=texture2D(uTitle,tuv).r*te.x*te.y*inBody*step(2.3,ly);
      float chip=smoothstep(.55,.8,n3(vec3(vWP.zy*22.,vWP.x*22.)))*.55; tk*=1.-chip;
      float cutI=clamp(ink.x,0.,1.)*nearK*uInkOn, cutT=clamp(tk,0.,1.)*nearK*uInkOn;
      float gy=(texture2D(uInk,iuv+vec2(0.,.0018)).r-texture2D(uInk,iuv-vec2(0.,.0018)).r)*ie.x*ie.y*inBody*uInkOn;
      float gyT=(texture2D(uTitle,tuv+vec2(0.,.0075)).r-texture2D(uTitle,tuv-vec2(0.,.0075)).r)*te.x*te.y*inBody*step(2.3,ly)*uInkOn;
      float gxT=(texture2D(uTitle,tuv+vec2(.0065,0.)).r-texture2D(uTitle,tuv-vec2(.0065,0.)).r)*te.x*te.y*inBody*step(2.3,ly)*uInkOn;
      col*=(1.-.025*cutI-.1*cutT-.03*ink.y*nearK*uInkOn)*(1.+mix(.48,.45,step(0.,gy))*gy*nearK)*(1.+mix(1.3,.65,step(0.,gyT))*gyT*nearK)*(1.+.4*gxT*nearK); ao_=min(ao_,1.-.12*cutT);
      rough_=Nr.w; nd_=Nr.xyz*1.2; bump_=-(cutI*.0005+cutT*.0016)-(petal*.0012*nearK)+(mid-.5)*.0012;`, { tex: ["stone"], stair: true, snow: false, uniforms: (m) => (m.userData.inkUniforms = { uInk: { value: m.userData.ink || BLANK }, uTitle: { value: m.userData.title || BLANK }, uInkOn: { value: 1 } }), glsl: "uniform sampler2D uInk, uTitle; uniform float uInkOn;" }),
    // Woven rush and straw: mats and cushions.
    straw: procMat("straw", { roughness: 0.8, envMapIntensity: 0.25 }, `
      vec3 q=vWP*1.5, w=triW(vWN); vec3 A=triA(tWeaveA,q,w)/mWeave; vec4 Nr=triN(tWeaveN,q,w);
      col=vec3(.3,.25,.15)*A*A*(.8+.4*fbm3(vWP*1.7)); rough_=mix(.75,.98,Nr.w); nd_=Nr.xyz*2.2;`, { tex: ["weave"] }),
    dark: new THREE.MeshBasicMaterial({ color: 0x030302, side: THREE.BackSide }),   // the dark indoors; the mist outside still lies in front of it
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }),
  };
}
