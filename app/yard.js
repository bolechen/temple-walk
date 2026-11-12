
import * as THREE from "./v/build/three.module.js";
import { mergeGeometries } from "./v/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer } from "./v/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "./v/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./v/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "./v/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "./v/jsm/postprocessing/OutputPass.js";

const Q = new URLSearchParams(location.search);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Site plan (metres). 1 unit = 1 m, ground at y = 0, the hall faces +z (south). ----
const YARD = { x: 17, zN: -19, zS: 15, wallH: 3.0 };
const COLS_X = [-6.7, -2.5, 2.5, 6.7];             // three bays wide
const COLS_Z = [-4, -7.6, -11.2, -14.8];           // three bays deep
const CZ = -9.4;                                   // hall centre
const PLAT = { x: 8.3, zF: -2.2, zB: -16.6, h: 0.9 };
const COL_TOP = 4.98, PLATE_TOP = 5.1;             // column head, top of the plate the brackets sit on
const EX = 9.1, EZ = 7.8;                          // eave half-extents (2.4 m overhang)
const EAVE_Y = 5.85, RISE = 5.2, G = 3.3;          // eave height, roof rise, depth of the end slopes (hip-and-gable)
const LIFT = 0.5, LC = 3.6;                       // corner upturn and how far along the eave it reaches
const FOG = new THREE.Color(0.70, 0.745, 0.74);
const SUN_DIR = new THREE.Vector3(-0.45, 0.72, 0.53).normalize();

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const profile = (d) => RISE * Math.pow(Math.min(Math.max(d, 0), EZ) / EZ, 1.38);   // concave Song roof curve
function roofY(x, z, eps = 0) {
  const dz = EZ - Math.abs(z - CZ), dx = EX - Math.abs(x) + eps;
  const d = dx <= G ? Math.min(dz, dx) : dz;                          // beyond G the end slope stops: that step is the gable
  const t = Math.max(0, 1 - Math.max(dz, dx) / LC);
  return EAVE_Y + profile(d) + LIFT * t * t * (1 - smooth(0, 2.6, Math.min(dz, dx)));
}

// ---- Quality ------------------------------------------------------------------
// One tier per class of device, as Saltline does: render scale, a pixel budget, MSAA samples,
// the size of the planar reflection relative to the frame, and the shadow map.
const TIERS = {
  low:    { name: "low",    scale: 0.75, budget: 1.0e6, msaa: 0, planar: 0.35, shadow: 1024, bloom: true },
  medium: { name: "medium", scale: 0.9,  budget: 1.6e6, msaa: 2, planar: 0.5,  shadow: 2048, bloom: true },
  high:   { name: "high",   scale: 1,    budget: 2.4e6, msaa: 4, planar: 0.5,  shadow: 2048, bloom: true },
};
function pickTier() {
  if (TIERS[Q.get("q")]) return { ...TIERS[Q.get("q")], fixed: true };
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900)) return { ...TIERS.low };
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl2"), ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    gpu = String(gl ? gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : "");
  } catch {}
  return { ...(/SwiftShader|llvmpipe|Software|Mali|Adreno|PowerVR/i.test(gpu) || (/Intel/i.test(gpu) && !/Arc/i.test(gpu)) ? TIERS.medium : TIERS.high) };
}
const quality = pickTier();

// ---- Renderer -----------------------------------------------------------------
const canvas = document.getElementById("yardGl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;      // applied by the output pass
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG, 0.009);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);

// ---- Shared GLSL --------------------------------------------------------------
const NOISE = /* glsl */`
float h21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float n3(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+17.; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.03+7.; a*=.5; } return s; }
`;
const HALL = /* glsl */`
#define EX ${EX.toFixed(2)}
#define EZ ${EZ.toFixed(2)}
#define CZ ${CZ.toFixed(2)}
#define EAVE_Y ${EAVE_Y.toFixed(2)}
// Overcast light has no hard shadow, so depth under the eaves is an occlusion term:
// darker the higher a surface sits beneath the roof.
float eaveAO(vec3 p){
  vec2 q=abs(p.xz-vec2(0.,CZ)); float inside=min(EX-q.x,EZ-q.y);
  return 1.-smoothstep(-.4,1.6,inside)*smoothstep(EAVE_Y-2.7,EAVE_Y+.3,p.y)*.72;
}
// Old unpainted timber: warm dark brown, bleached silver-grey where weather reaches it.
vec3 woodCol(vec3 p, vec3 grain){
  float g=fbm3(p*grain), fine=n3(p*grain*7.);
  vec3 c=mix(vec3(.11,.062,.036),vec3(.27,.165,.095),g); c*=.82+.36*fine;
  float w=smoothstep(.42,.72,fbm3(p*.6+3.)); c=mix(c,vec3(.25,.225,.195),w*.42);
  return c*vec3(.6,.57,.55);
}
`;
const BUMP = /* glsl */`
vec3 bumpN(vec3 sp, vec3 N, float h){
  vec3 dpdx=dFdx(sp), dpdy=dFdy(sp); float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpdy,N), r2=cross(N,dpdx); float det=dot(dpdx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2); return normalize(abs(det)*N-g);
}`;

// A lit standard material whose colour, roughness and relief are computed, not sampled.
// `body` writes: vec3 col, float rough_, float bump_ (metres), float ao_.
function procMat(key, params, body) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec4 wp_=vec4(transformed,1.); vec3 wn_=objectNormal;
        #ifdef USE_INSTANCING
          wp_=instanceMatrix*wp_; wn_=mat3(instanceMatrix)*wn_;
        #endif
        vWP=(modelMatrix*wp_).xyz; vWN=normalize(mat3(modelMatrix)*wn_); vUv2=uv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;\n" + NOISE + HALL + BUMP)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float rough_=roughness, bump_=0., ao_=1.; vec3 col=diffuseColor.rgb;
        { ${body} }
        diffuseColor.rgb=col*ao_;`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor=clamp(rough_,.04,1.);")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n normal=bumpN(-vViewPosition,normal,bump_);");
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// ---- Materials ----------------------------------------------------------------
const wood = (key, grain) => procMat(key, { roughness: 0.82, envMapIntensity: 0.35 }, `
  col=woodCol(vWP,vec3(${grain})); ao_=eaveAO(vWP);
  float damp=smoothstep(2.2,.9,vWP.y+fbm3(vWP*.8)*.8);          // column feet stay damp and dark
  col*=mix(1.,.62,damp); rough_=mix(.86,.5,damp);
  bump_=fbm3(vWP*vec3(${grain})*5.)*.004;`);
const woodV = wood("woodV", "9.,1.1,9."), woodX = wood("woodX", "1.1,9.,9."), woodZ = wood("woodZ", "9.,9.,1.1");

const tileMat = procMat("tile", { roughness: 0.6, envMapIntensity: 0.9, side: THREE.DoubleSide }, `
  // vUv2 = (metres along the eave, metres up the slope). Rows of half-round cover tiles over pan tiles.
  float u=vUv2.x/.25, r=fract(u)-.5, row=floor(u), seg=floor(vUv2.y/.33), fw=fwidth(u);
  float cover=sqrt(max(0.,1.-pow(r/.3,2.)))*step(abs(r),.3);
  float pan=(1.-cos(clamp((abs(r)-.3)/.2,0.,1.)*3.14159))*.5;
  float lap=smoothstep(.0,.06,fract(vUv2.y/.33));               // each course laps the one below
  float detail=1.-smoothstep(.1,.45,fw);                        // relief folds into roughness with distance
  bump_=(cover*.06+pan*.012-(1.-lap)*.012)*detail;
  float tone=h21(vec2(row,seg)); col=mix(vec3(.05,.054,.058),vec3(.125,.13,.13),tone*.55+fbm2(vWP.xz*.7)*.45);
  float gutter=1.-smoothstep(.0,.16,abs(abs(r)-.5)+.02);
  float moss=smoothstep(.5,.75,fbm2(vWP.xz*.9+4.))*gutter; col=mix(col,vec3(.1,.14,.06),moss*.7);
  col*=mix(1.,mix(.5,1.,cover*.6+.4),detail);                                 // gutters sit in shade
  rough_=mix(.3,.55,tone)-.1*cover*detail;`);

const plaster = (key, base) => procMat(key, { roughness: 0.9, envMapIntensity: 0.25 }, `
  float t=vWP.x+vWP.z;
  col=vec3(.74,.735,.7)*(.8+.28*fbm3(vWP*.9));
  float drip=smoothstep(.45,.8,n2(vec2(t*5.,vWP.y*.35)))*smoothstep(${base}+2.2,${base}+3.4,vWP.y+fbm2(vec2(t,2.))*1.5);
  col=mix(col,vec3(.36,.37,.34),drip*.55);                      // rain streaks run down from the cap
  float damp=smoothstep(${base}+1.1,${base},vWP.y-fbm2(vec2(t*.9,5.))*.9);
  col=mix(col,vec3(.2,.235,.17),damp*.75);                      // rising damp and moss at the foot
  ao_=eaveAO(vWP); rough_=mix(.92,.6,damp); bump_=fbm3(vWP*6.)*.003;`);
const plasterHall = plaster("plasterHall", PLAT.h.toFixed(2)), plasterYard = plaster("plasterYard", "0.");

const stone = procMat("stone", { roughness: 0.8, envMapIntensity: 0.5 }, `
  bool topF=vWN.y>.5; vec2 q=topF?vWP.xz/vec2(1.1,.7):vec2(vWP.x+vWP.z,vWP.y*4.45)/vec2(.95,1.);
  q.x+=floor(q.y)*.37; vec2 f=fract(q), id=floor(q);
  float edge=min(min(f.x,1.-f.x)*1.2,min(f.y,1.-f.y)*.5), joint=1.-smoothstep(.01,.03,edge);
  col=mix(vec3(.17,.175,.165),vec3(.3,.3,.285),h21(id))*(.6+.6*fbm3(vWP*2.5));
  float moss=smoothstep(.45,.7,fbm3(vWP*.9+2.))*(topF?.25:smoothstep(1.,.1,vWP.y));
  col=mix(col,vec3(.13,.18,.08),max(moss*.8,joint*.5)); col=mix(col,vec3(.04),joint*.3);
  float wet=topF?.75:smoothstep(.5,0.,vWP.y); col*=mix(1.,.6,wet); rough_=mix(.85,.28,wet*(1.-joint));
  ao_=topF?eaveAO(vWP+vec3(0.,3.2,0.))*.6+.4:1.; bump_=fbm3(vWP*9.)*.004-joint*.006;`);

const lattice = procMat("lattice", { roughness: 0.85, envMapIntensity: 0.3 }, `
  // vUv2 = (leaf index + position across the leaf, metres above the sill); transoms are offset by 100.
  vec2 q=vUv2; bool tr=q.y>50.; if(tr) q.y-=100.; float lx=fract(q.x)*1.05, top=tr?.7:3.02;
  float fr=min(min(lx,1.05-lx),min(q.y,top-q.y)), frame=1.-smoothstep(.065,.07,fr);
  float rail=tr?0.:1.-smoothstep(.05,.055,abs(q.y-1.18));
  float zone=tr?1.:step(1.18,q.y);
  vec2 gf=abs(fract(vec2(lx,q.y)/.105)-.5); float bar=step(.33,max(gf.x,gf.y));
  float hole=zone*(1.-frame)*(1.-bar)*(1.-rail);
  float panel=(1.-zone)*(1.-frame)*smoothstep(.0,.03,min(min(lx-.16,.89-lx),min(q.y-.16,1.02-q.y)));
  col=woodCol(vWP,vec3(9.,1.1,9.))*(1.-.25*panel); col=mix(col,vec3(.01,.009,.008),hole);
  ao_=eaveAO(vWP); rough_=mix(.8,1.,hole); bump_=(frame+bar*zone+rail)*.012-hole*.03+panel*.008;`);

const bronze = procMat("bronze", { roughness: 0.5, metalness: 0.75, envMapIntensity: 1.0 }, `
  float p=smoothstep(.4,.72,fbm3(vWP*5.)); col=mix(vec3(.16,.125,.085),vec3(.16,.27,.22),p*.75);  // verdigris
  col*=.7+.5*n3(vWP*30.); rough_=mix(.42,.85,p); bump_=fbm3(vWP*24.)*.002;`);

// ---- Sky and environment ------------------------------------------------------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: SUN_DIR }, uT: { value: 0 }, uFog: { value: FOG } },
  vertexShader: "varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
  fragmentShader: NOISE + /* glsl */`
    varying vec3 vD; uniform vec3 uSun, uFog; uniform float uT;
    void main(){
      vec3 d=normalize(vD); float up=max(d.y,0.);
      // Overcast after rain: a bright milky horizon, a heavier deck overhead, one thinner patch where the sun sits.
      vec2 cp=d.xz/(up+.18)*1.1+vec2(uT*.004,0.);
      float deck=fbm2(cp)*.65+fbm2(cp*2.7+3.)*.35;
      vec3 c=mix(uFog*1.08,vec3(.5,.545,.57),smoothstep(0.,.75,up));
      c*=mix(.82,1.18,smoothstep(.3,.75,deck));
      float s=max(dot(d,uSun),0.); c+=vec3(1.,.94,.82)*(pow(s,8.)*.22+pow(s,60.)*.35)*smoothstep(.35,.7,deck+.25);
      c=mix(uFog,c,smoothstep(-.02,.14,d.y));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), skyMat);
scene.add(sky);
{
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(sky.geometry, skyMat));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture; pm.dispose();
}
const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);     // weak sun through the deck: just enough for form
sun.position.copy(SUN_DIR).multiplyScalar(60).add(new THREE.Vector3(0, 0, CZ));
sun.target.position.set(0, 3, CZ);
sun.castShadow = true; sun.shadow.mapSize.set(quality.shadow, quality.shadow); sun.shadow.radius = 7; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 22, bottom: -22, near: 10, far: 120 });
scene.add(sun, sun.target);
// The whole overcast sky as one soft light, so faces turned away from the sun still read.
scene.add(new THREE.HemisphereLight(new THREE.Color(0.86, 0.91, 0.93), new THREE.Color(0.3, 0.31, 0.28), 1.15));

// ---- Helpers ------------------------------------------------------------------
const world = new THREE.Group(); scene.add(world);
function add(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
  world.add(m); return m;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// Bring any geometry to the same layout (non-indexed; position, normal, uv) so it can be merged with others.
function plain(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(n.attributes.position.count * 2).fill(0), 2));
  n.computeVertexNormals();
  return n;
}
const merge = (list) => mergeGeometries(list.map(plain));

// ---- Platform and steps -------------------------------------------------------
{
  const parts = [box(PLAT.x * 2, PLAT.h, PLAT.zF - PLAT.zB, 0, PLAT.h / 2, (PLAT.zF + PLAT.zB) / 2)];
  const N = 5, sh = PLAT.h / N, sd = 0.34, sw = 4.6;
  for (let i = 0; i < N; i++) parts.push(box(sw, sh * (N - i), sd, 0, (sh * (N - i)) / 2, PLAT.zF + sd * (i + 0.5)));
  for (const sx of [-1, 1]) {   // sloped stone cheeks beside the steps
    const run = sd * N, len = Math.hypot(run, PLAT.h);
    const g = new THREE.BoxGeometry(0.42, 0.26, len + 0.1).rotateX(Math.atan2(PLAT.h, run)).translate(sx * (sw / 2 + 0.21), PLAT.h / 2 - 0.02, PLAT.zF + run / 2);
    parts.push(g, box(0.42, PLAT.h / 2, run, sx * (sw / 2 + 0.21), PLAT.h / 4 - 0.1, PLAT.zF + run / 2));
  }
  add(merge(parts), stone);
}

// ---- Columns, beams, infill ---------------------------------------------------
const perimeter = [];   // every column on the outer ring: {x, z, ox, oz} with the outward direction
for (const x of COLS_X) for (const z of COLS_Z) {
  const ox = x === COLS_X[0] ? -1 : x === COLS_X[3] ? 1 : 0, oz = z === COLS_Z[0] ? 1 : z === COLS_Z[3] ? -1 : 0;
  if (ox || oz) perimeter.push({ x, z, ox, oz });
}
{
  // Shaft with a slight entasis on a carved stone drum.
  const shaftPts = [[0.27, 0], [0.275, 0.6], [0.27, 2.2], [0.25, 3.5], [0.235, COL_TOP - PLAT.h - 0.25]].map(([r, y]) => new THREE.Vector2(r, y));
  const shaft = new THREE.LatheGeometry(shaftPts, 20).translate(0, PLAT.h + 0.25, 0);
  const drumPts = [[0, 0], [0.4, 0], [0.42, 0.05], [0.36, 0.13], [0.33, 0.22], [0.3, 0.25], [0, 0.25]].map(([r, y]) => new THREE.Vector2(r, y));
  const drum = new THREE.LatheGeometry(drumPts, 20).translate(0, PLAT.h, 0);
  add(merge(perimeter.map((c) => shaft.clone().translate(c.x, 0, c.z))), woodV);
  add(merge(perimeter.map((c) => drum.clone().translate(c.x, 0, c.z))), stone);

  const bx = [], bz = [], pl = [];
  const xs = COLS_X, zs = COLS_Z, bh = 0.36, by = COL_TOP - bh / 2;
  for (const z of [zs[0], zs[3]]) {
    for (let i = 0; i < 3; i++) bx.push(box(xs[i + 1] - xs[i], bh, 0.2, (xs[i] + xs[i + 1]) / 2, by, z));
    pl.push(box(xs[3] - xs[0] + 0.7, PLATE_TOP - COL_TOP, 0.5, 0, (COL_TOP + PLATE_TOP) / 2, z));
  }
  for (const x of [xs[0], xs[3]]) {
    for (let i = 0; i < 3; i++) bz.push(box(0.2, bh, zs[i] - zs[i + 1], x, by, (zs[i] + zs[i + 1]) / 2));
    pl.push(box(0.5, PLATE_TOP - COL_TOP, zs[0] - zs[3] + 0.7, x, (COL_TOP + PLATE_TOP) / 2, (zs[0] + zs[3]) / 2));
  }
  // Sill and head rails of the front door line.
  bx.push(box(xs[3] - xs[0], 0.16, 0.2, 0, PLAT.h + 0.08, zs[0]), box(xs[3] - xs[0], 0.14, 0.18, 0, 3.92 + PLAT.h - 0.9, zs[0]));
  add(merge(bx), woodX); add(merge(bz), woodZ); add(merge(pl), woodX);

  // Front: lattice leaves in the side bays, two fixed leaves and a dark opening in the centre, transoms above.
  const lat = [];
  const panel = (x0, x1, y0, y1, transom) => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0).translate((x0 + x1) / 2, (y0 + y1) / 2, zs[0] - 0.03);
    const n = Math.max(1, Math.round((x1 - x0) / 1.05)), uv = g.attributes.uv, v0 = transom ? 100 : 0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n, v0 + uv.getY(i) * (y1 - y0));
    lat.push(g);
  };
  const sill = PLAT.h + 0.16, head = sill + 3.02 - 0.16, topY = COL_TOP - bh;
  panel(xs[0] + 0.25, xs[1] - 0.25, sill, head, false); panel(xs[2] + 0.25, xs[3] - 0.25, sill, head, false);
  panel(xs[1] + 0.25, xs[1] + 1.3, sill, head, false); panel(xs[2] - 1.3, xs[2] - 0.25, sill, head, false);
  for (let i = 0; i < 3; i++) panel(xs[i] + 0.25, xs[i + 1] - 0.25, head + 0.14, topY, true);
  add(merge(lat), lattice, { cast: false });

  // Sides and back: plaster between the columns, with a timber waist rail.
  const walls = [], rails = [];
  for (const x of [xs[0], xs[3]]) for (let i = 0; i < 3; i++) {
    walls.push(box(0.14, topY - PLAT.h, zs[i] - zs[i + 1] - 0.5, x, (topY + PLAT.h) / 2, (zs[i] + zs[i + 1]) / 2));
    rails.push(box(0.2, 0.16, zs[i] - zs[i + 1] - 0.5, x, PLAT.h + 1.5, (zs[i] + zs[i + 1]) / 2));
  }
  const railsX = [];
  for (let i = 0; i < 3; i++) {
    walls.push(box(xs[i + 1] - xs[i] - 0.5, topY - PLAT.h, 0.14, (xs[i] + xs[i + 1]) / 2, (topY + PLAT.h) / 2, zs[3]));
    railsX.push(box(xs[i + 1] - xs[i] - 0.5, 0.16, 0.2, (xs[i] + xs[i + 1]) / 2, PLAT.h + 1.5, zs[3]));
  }
  // The white band between the bracket sets, all the way round.
  const bandH = 1.55, bandY = PLATE_TOP + bandH / 2;
  walls.push(box(xs[3] - xs[0], bandH, 0.1, 0, bandY, zs[0]), box(xs[3] - xs[0], bandH, 0.1, 0, bandY, zs[3]),
    box(0.1, bandH, zs[0] - zs[3], xs[0], bandY, CZ), box(0.1, bandH, zs[0] - zs[3], xs[3], bandY, CZ));
  add(merge(walls), plasterHall); add(merge(rails), woodZ); add(merge(railsX), woodX);

  // The inside of the hall is darkness, with two lamps far back.
  const dark = new THREE.Mesh(box(xs[3] - xs[0] - 0.3, 4.05, 2.4, 0, PLAT.h + 2.025, zs[0] - 1.3),
    new THREE.MeshBasicMaterial({ color: 0x030302, side: THREE.BackSide, fog: false }));
  world.add(dark);
  for (const sx of [-1, 1]) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }));
    flame.position.set(sx * 1.1, PLAT.h + 1.2, zs[0] - 2.3); world.add(flame);
  }
}

// ---- Bracket sets (dougong) -----------------------------------------------------
{
  // One set, outward = +z, base at y = 0. Blocks, lateral arms, two projecting tiers, an outer lateral arm.
  const set = mergeGeometries([
    box(0.46, 0.26, 0.46, 0, 0.13, 0),
    box(1.25, 0.17, 0.16, 0, 0.36, 0), box(0.22, 0.14, 0.22, -0.52, 0.52, 0), box(0.22, 0.14, 0.22, 0.52, 0.52, 0),
    box(1.7, 0.16, 0.15, 0, 0.68, 0),
    box(0.16, 0.18, 1.0, 0, 0.36, 0.25), box(0.22, 0.14, 0.22, 0, 0.52, 0.62),
    box(0.16, 0.18, 1.3, 0, 0.67, 0.3),
    box(1.0, 0.15, 0.15, 0, 0.84, 0.88), box(0.2, 0.12, 0.2, -0.4, 0.97, 0.88), box(0.2, 0.12, 0.2, 0.4, 0.97, 0.88),
    box(0.14, 0.14, 0.36, 0, 0.67, 1.05),
  ]);
  const spots = perimeter.map((c) => ({ x: c.x, z: c.z, a: Math.atan2(c.ox, c.oz) }));
  const mid = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 1)) / (n + 1));
  for (const [z, a] of [[COLS_Z[0], 0], [COLS_Z[3], Math.PI]]) {
    for (const x of [...mid(COLS_X[0], COLS_X[1], 1), ...mid(COLS_X[1], COLS_X[2], 2), ...mid(COLS_X[2], COLS_X[3], 1)]) spots.push({ x, z, a });
  }
  for (const [x, a] of [[COLS_X[0], -Math.PI / 2], [COLS_X[3], Math.PI / 2]]) {
    for (let i = 0; i < 3; i++) spots.push({ x, z: (COLS_Z[i] + COLS_Z[i + 1]) / 2, a });
  }
  add(merge(spots.map((s) => set.clone().rotateY(s.a).translate(s.x, PLATE_TOP, s.z))), woodX);
  // The eave purlin the outer arms carry.
  const o = 0.88, py = PLATE_TOP + 1.0;
  add(merge([
    box(COLS_X[3] * 2 + o * 2 + 0.6, 0.2, 0.17, 0, py, COLS_Z[0] + o), box(COLS_X[3] * 2 + o * 2 + 0.6, 0.2, 0.17, 0, py, COLS_Z[3] - o),
  ]), woodX);
  add(merge([
    box(0.17, 0.2, COLS_Z[0] - COLS_Z[3] + o * 2 + 0.6, COLS_X[0] - o, py, CZ), box(0.17, 0.2, COLS_Z[0] - COLS_Z[3] + o * 2 + 0.6, COLS_X[3] + o, py, CZ),
  ]), woodZ);
}

// ---- Roof ---------------------------------------------------------------------
{
  const STEP = 0.26, gx = EX - G;
  const xs = []; // {x, eps}: the gable line appears twice, once evaluated on each side of the step
  for (let x = -EX; x < EX - 1e-6; x += STEP) xs.push({ x, eps: 0 });
  xs.push({ x: EX, eps: 0 });
  for (const s of [-1, 1]) xs.push({ x: s * gx, eps: 0, cut: s }, { x: s * gx, eps: -1e-3, cut: s, inner: true });
  xs.sort((a, b) => a.x - b.x || ((a.inner ? 1 : 0) - (b.inner ? 1 : 0)) * Math.sign(a.x));
  const zs = []; for (let z = -EZ; z < EZ - 1e-6; z += STEP) zs.push(z + CZ); zs.push(EZ + CZ);

  const pos = [], uv = [], idx = [];
  for (const c of xs) for (const z of zs) {
    const dz = EZ - Math.abs(z - CZ), dx = EX - Math.abs(c.x) + c.eps;
    const end = dx <= G && dx < dz;                         // on an end slope the tiles run the other way
    pos.push(c.x, roofY(c.x, z, c.eps), z);
    uv.push(end ? z - CZ : c.x, end ? dx : dz);
  }
  const nz = zs.length;
  for (let i = 0; i < xs.length - 1; i++) {
    if (xs[i].cut && xs[i + 1].cut && xs[i].x === xs[i + 1].x) continue;   // the vertical step is the gable wall, built below
    for (let j = 0; j < nz - 1; j++) {
      const a = i * nz + j, b = a + nz, c = b + 1, d = a + 1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  top.setIndex(idx); top.computeVertexNormals();
  add(top, tileMat);

  // Underside: boards and rafters, seen from the courtyard under the deep eave.
  const under = top.clone(); under.translate(0, -0.17, 0);
  const rafters = procMat("rafters", { roughness: 0.9, envMapIntensity: 0.15, side: THREE.BackSide }, `
    float r=abs(fract(vUv2.x/.3)-.5); float raft=1.-smoothstep(.16,.2,r);
    col=woodCol(vWP,vec3(9.,9.,1.1))*mix(.4,.85,raft); ao_=eaveAO(vWP)*.8; bump_=raft*.03;`);
  add(under, rafters, { cast: false });

  // Eave board closing the edge between tiles and rafters.
  const edge = [];
  const ring = [];
  for (let x = -EX; x <= EX + 1e-6; x += STEP) ring.push([Math.min(x, EX), CZ + EZ]);
  for (let z = EZ; z >= -EZ - 1e-6; z -= STEP) ring.push([EX, CZ + Math.max(z, -EZ)]);
  for (let x = EX; x >= -EX - 1e-6; x -= STEP) ring.push([Math.max(x, -EX), CZ - EZ]);
  for (let z = -EZ; z <= EZ + 1e-6; z += STEP) ring.push([-EX, CZ + Math.min(z, EZ)]);
  const ep = [], ei = [];
  ring.forEach(([x, z], i) => { const y = roofY(x, z); ep.push(x, y + 0.02, z, x, y - 0.2, z); if (i) { const a = (i - 1) * 2; ei.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
  const fascia = new THREE.BufferGeometry();
  fascia.setAttribute("position", new THREE.Float32BufferAttribute(ep, 3)); fascia.setIndex(ei); fascia.computeVertexNormals();
  fascia.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((ep.length / 3) * 2).fill(0), 2));
  add(fascia, procMat("fascia", { roughness: 0.8, envMapIntensity: 0.3, side: THREE.DoubleSide }, "col=woodCol(vWP,vec3(1.1,9.,1.1))*.6; ao_=.8;"));

  // Ridges: main ridge with its two end ornaments, the gable ridges, and the four hip ridges that sweep up at the corners.
  const ridgeMat = procMat("ridge", { roughness: 0.55, envMapIntensity: 0.8 }, `
    col=mix(vec3(.1,.105,.11),vec3(.19,.195,.195),fbm3(vWP*2.)); float m=smoothstep(.5,.72,fbm3(vWP*1.3+5.)); col=mix(col,vec3(.11,.15,.07),m*.6);
    rough_=.5; bump_=fbm3(vWP*14.)*.004;`);
  const ridgeY = EAVE_Y + RISE, tubes = [];
  tubes.push(box(gx * 2 + 0.5, 0.62, 0.36, 0, ridgeY + 0.2, CZ), box(gx * 2 + 0.7, 0.1, 0.46, 0, ridgeY + 0.54, CZ));
  const curl = new THREE.Shape([[0, 0], [0.95, 0], [1.0, 0.55], [0.74, 1.1], [0.34, 1.36], [0.1, 1.18], [0.36, 0.98], [0.46, 0.66], [0.22, 0.5], [0, 0.56]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const s of [-1, 1]) {
    const g = plain(new THREE.ExtrudeGeometry(curl, { depth: 0.34, bevelEnabled: false }).translate(-1.0, 0, -0.17));
    if (s < 0) {   // mirror, then restore the winding
      g.scale(-1, 1, 1);
      for (const k of ["position", "uv"]) { const arr = g.attributes[k].array, n = k === "uv" ? 2 : 3; for (let i = 0; i < arr.length; i += n * 3) for (let c = 0; c < n; c++) { const t = arr[i + c]; arr[i + c] = arr[i + n + c]; arr[i + n + c] = t; } }
    }
    tubes.push(g.translate(s * (gx + 0.25), ridgeY - 0.1, CZ));
  }
  const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 8, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hip = [];
    for (let t = -0.04; t <= 1.0001; t += 0.08) { const d = t * G, x = sx * (EX - d), z = CZ + sz * (EZ - d); hip.push(new THREE.Vector3(x, roofY(x, z) + 0.13 + (t < 0 ? 0.12 : 0), z)); }
    tubes.push(tube(hip, 0.17));
    const gab = [];
    for (let t = 0; t <= 1.0001; t += 0.1) { const z = CZ + sz * (EZ - G) * (1 - t); gab.push(new THREE.Vector3(sx * (gx + 0.02), EAVE_Y + profile(EZ - Math.abs(z - CZ)) + 0.14, z)); }
    tubes.push(tube(gab, 0.15));
  }
  add(merge(tubes), ridgeMat);

  // Gable walls under the upper roof.
  const gs = new THREE.Shape(); const half = EZ - G, baseY = EAVE_Y + profile(G) - 0.25;
  gs.moveTo(-half, baseY);
  for (let z = -half; z <= half + 1e-6; z += 0.3) gs.lineTo(z, EAVE_Y + profile(EZ - Math.abs(z)) - 0.22);
  gs.lineTo(half, baseY);
  for (const s of [-1, 1]) {
    const g = new THREE.ShapeGeometry(gs).rotateY(s * Math.PI / 2).translate(s * (gx - 0.3), 0, CZ);
    add(g, procMat("gable" + s, { roughness: 0.9, envMapIntensity: 0.2, side: THREE.DoubleSide }, "col=vec3(.62,.615,.58)*(.75+.3*fbm3(vWP*.9)); ao_=.75;"));
  }
}

// ---- Courtyard walls and gate ---------------------------------------------------
{
  const body = [], cap = [], capPos = [], capUv = [], capIdx = [];
  const H = YARD.wallH, T = 0.42;
  function wall(x0, z0, x1, z1) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    body.push(box(alongX ? len : T, H, alongX ? T : len, (x0 + x1) / 2, H / 2, (z0 + z1) / 2));
    cap.push(box(alongX ? len : 0.16, 0.14, alongX ? 0.16 : len, (x0 + x1) / 2, H + 0.5, (z0 + z1) / 2));
    for (const side of [-1, 1]) {   // two tiled slopes
      const b = capPos.length / 3, w = 0.62;
      const pts = [[0, H + 0.46, 0], [len, H + 0.46, 0], [len, H + 0.1, side * w], [0, H + 0.1, side * w]];
      for (const [l, y, o] of pts) {
        const px = alongX ? Math.min(x0, x1) + l : x0 + o, pz = alongX ? z0 + o : Math.min(z0, z1) + l;
        capPos.push(px, y, pz); capUv.push(l, o === 0 ? 0.72 : 0);
      }
      capIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const X = YARD.x, gate = 1.7;
  wall(-X, YARD.zN, X, YARD.zN); wall(-X, YARD.zN, -X, YARD.zS); wall(X, YARD.zN, X, YARD.zS);
  wall(-X, YARD.zS, -gate, YARD.zS); wall(gate, YARD.zS, X, YARD.zS);
  add(merge(body), plasterYard);
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute("position", new THREE.Float32BufferAttribute(capPos, 3));
  capGeo.setAttribute("uv", new THREE.Float32BufferAttribute(capUv, 2));
  capGeo.setIndex(capIdx); capGeo.computeVertexNormals();
  add(capGeo, tileMat);
  add(merge(cap), stone);
  // A plain timber gate: two posts, a head beam, a small tiled hood.
  add(merge([box(0.3, 3.7, 0.3, -gate, 1.85, YARD.zS), box(0.3, 3.7, 0.3, gate, 1.85, YARD.zS)]), woodV);
  add(box(gate * 2 + 1.2, 0.3, 0.34, 0, 3.55, YARD.zS), woodX);
  const hood = new THREE.BufferGeometry(), hp = [], hu = [], hi = [];
  for (const side of [-1, 1]) {
    const b = hp.length / 3, L = gate * 2 + 2.0;
    for (const [l, y, o] of [[0, 4.35, 0], [L, 4.35, 0], [L, 3.8, side * 1.0], [0, 3.8, side * 1.0]]) { hp.push(-L / 2 + l, y, YARD.zS + o); hu.push(l, o === 0 ? 1.1 : 0); }
    hi.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  hood.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3)); hood.setAttribute("uv", new THREE.Float32BufferAttribute(hu, 2));
  hood.setIndex(hi); hood.computeVertexNormals(); add(hood, tileMat);
}

// ---- Censer and incense ---------------------------------------------------------
const CENSER = new THREE.Vector3(0, 0, 3.2);
const smoke = [];
{
  const prof = [[0, 0.42], [0.3, 0.42], [0.5, 0.52], [0.6, 0.72], [0.6, 0.9], [0.67, 0.96], [0.67, 1.03], [0.57, 1.03], [0.54, 0.9], [0, 0.86]].map(([r, y]) => new THREE.Vector2(r, y));
  const parts = [new THREE.LatheGeometry(prof, 36)];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 2; parts.push(new THREE.CylinderGeometry(0.09, 0.06, 0.5, 10).translate(Math.cos(a) * 0.37, 0.25, Math.sin(a) * 0.37)); }
  for (const sx of [-1, 1]) parts.push(new THREE.TorusGeometry(0.12, 0.035, 8, 16, Math.PI).rotateY(Math.PI / 2).translate(sx * 0.62, 1.03, 0));
  const g = merge(parts).translate(CENSER.x, 0, CENSER.z);
  add(g, bronze);
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), r = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, "rgba(240,240,236,.55)"); r.addColorStop(0.5, "rgba(240,240,236,.16)"); r.addColorStop(1, "rgba(240,240,236,0)");
  x.fillStyle = r; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { t: i / 40, seed: Math.random() * 100 }; smoke.push(s); scene.add(s);
  }
  // Mist: a few very large, very faint sheets hanging at tree height beyond the walls.
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5, color: 0xdfe6e4, fog: false }));
    const a = (i / 9) * Math.PI * 2 + 0.4, R = 30 + (i % 3) * 9;
    s.position.set(Math.cos(a) * R, 5 + (i % 4) * 2.2, CZ + Math.sin(a) * R * 0.8); s.scale.set(34, 11, 1);
    s.userData = { mist: true, a, R, y: s.position.y }; smoke.push(s); scene.add(s);
  }
}

// ---- Bamboo beyond the walls, hills beyond the bamboo -----------------------------
const bambooMat = (seed, tone) => new THREE.ShaderMaterial({
  side: THREE.DoubleSide, transparent: false,
  uniforms: { uT: { value: 0 }, uFog: { value: FOG }, uSeed: { value: seed }, uTone: { value: tone } },
  vertexShader: "varying vec2 vU; varying vec3 vWP; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: NOISE + /* glsl */`
    varying vec2 vU; varying vec3 vWP; uniform float uT, uSeed, uTone; uniform vec3 uFog;
    void main(){
      float x=vU.x+uSeed*37., y=vU.y, sway=sin(uT*.35+x*.2)*.12*smoothstep(4.,13.,y);
      float top=10.5+4.5*fbm2(vec2(x*.16,uSeed))+1.2*n2(vec2(x*1.1,3.));
      // Culms: thin, slightly leaning, jointed.
      float cw=.42, cid=floor(x/cw), cx=(fract(x/cw)-.5)*cw+(h21(vec2(cid,uSeed))-.5)*.3+sway*.4+(y*.02)*(h21(vec2(cid,9.))-.5)*3.;
      float culm=(1.-smoothstep(.022,.04,abs(cx)))*step(y,top-1.5)*step(.25,h21(vec2(cid,4.)));
      // Leaves: drooping feathery masses, denser toward the crown.
      vec2 lp=vec2(x*1.6+sway*2., y*.85+n2(vec2(x*.5,y*.2))*2.);
      float leaf=fbm2(lp)*.62+fbm2(lp*3.1+7.)*.38;
      float crown=smoothstep(2.5,7.,y)*(1.-smoothstep(top-2.2,top,y));
      float a=smoothstep(.5,.56,leaf*.75+crown*.42)*step(y,top+fbm2(vec2(x*2.3,1.))*1.6-.8);
      a=max(a,step(y,4.6+n2(vec2(x*.8,7.))*1.2));
      if(max(a,culm)<.5) discard;
      vec3 c=mix(vec3(.025,.06,.03),vec3(.17,.3,.1),smoothstep(.35,.8,leaf))*uTone; c=mix(c,vec3(.22,.28,.12)*uTone,culm*(1.-a));
      c*=.55+.6*smoothstep(0.,12.,y);                                  // darker inside the grove near the ground
      float d=length(vWP-cameraPosition); float f=1.-exp(-pow(d*.009,2.)); c=mix(c,uFog,clamp(f+.3*(1.-uTone),0.,1.));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const bamboo = [];
{
  const X = YARD.x, zN = YARD.zN, zS = YARD.zS, Hh = 16;
  const band = (x0, z0, x1, z1, seed, tone) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, Hh, 1, 1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * Hh);
    const m = new THREE.Mesh(g, bambooMat(seed, tone));
    m.position.set((x0 + x1) / 2, Hh / 2, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    scene.add(m); bamboo.push(m);
  };
  [[2.2, 1.0], [5.5, 0.82], [10, 0.62]].forEach(([o, tone], i) => {
    band(-X - o - 12, zN - o, X + o + 12, zN - o, i + 1, tone); band(X + o, zN - o - 12, X + o, zS + o + 12, i + 4, tone);
    band(-X - o, zS + o + 12, -X - o, zN - o - 12, i + 7, tone); band(X + o + 12, zS + o + 3, -X - o - 12, zS + o + 3, i + 10, tone);
  });
  // Three ranges of hills, lost progressively in the mist.
  [[95, 34, 0.5], [150, 58, 2.1], [220, 86, 4.4]].forEach(([R, Hm, ph]) => {
    const g = new THREE.CylinderGeometry(R, R, 1, 96, 1, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const h = Hm * (0.45 + 0.3 * Math.sin(a * 2 + ph) + 0.16 * Math.sin(a * 5 + ph * 2) + 0.09 * Math.sin(a * 11 + ph * 3));
      p.setY(i, p.getY(i) > 0 ? Math.max(6, h) : -2);
    }
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.16, 0.13), side: THREE.BackSide }));
    m.position.z = CZ; scene.add(m);
  });
}

// ---- Ground: wet flagstones with a real reflection --------------------------------
const reflRT = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const reflCam = new THREE.PerspectiveCamera();
const texM = new THREE.Matrix4();
const groundMat = new THREE.ShaderMaterial({
  uniforms: { tRefl: { value: reflRT.texture }, uReflOn: { value: 1 }, uTexM: { value: texM }, uFog: { value: FOG }, uSun: { value: SUN_DIR }, uT: { value: 0 } },
  vertexShader: "varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: NOISE + /* glsl */`
    varying vec3 vWP; uniform sampler2D tRefl; uniform mat4 uTexM; uniform vec3 uFog, uSun; uniform float uT, uReflOn;
    float sdRect(vec2 p, vec2 c, vec2 h){ vec2 d=abs(p-c)-h; return length(max(d,0.))+min(max(d.x,d.y),0.); }
    void main(){
      vec2 p=vWP.xz;
      // Running-bond slabs, each a slightly different stone.
      vec2 sz=vec2(1.02,.64); float row=floor(p.y/sz.y);
      vec2 q=vec2(p.x+(mod(row,2.)*.5+h21(vec2(row,7.))*.3)*sz.x,p.y)/sz; vec2 id=floor(q), f=fract(q);
      float edge=min(min(f.x,1.-f.x)*sz.x,min(f.y,1.-f.y)*sz.y)+(n2(p*9.)-.5)*.02, joint=1.-smoothstep(.014,.04,edge);
      float tone=h21(id);
      vec3 alb=mix(vec3(.17,.175,.17),vec3(.34,.345,.33),tone)*(.6+.55*fbm2(p*2.6))*(.75+.5*fbm2(p*11.));
      float mossM=smoothstep(.42,.7,fbm2(p*.45+9.));
      alb=mix(alb,vec3(.12,.18,.07),joint*(.35+.65*mossM)); alb=mix(alb,vec3(.03),joint*.3*(1.-mossM));
      alb=mix(alb,vec3(.15,.2,.1),mossM*smoothstep(.12,.0,edge)*.35);
      // Water: one continuous ramp, standing water -> soaked -> damp.
      float low=fbm2(p*.17+3.)+(tone-.5)*.07-joint*.03;
      float puddle=smoothstep(.47,.52,low), damp=smoothstep(.22,.47,low);
      alb*=mix(.78,.5,damp); alb=mix(alb,alb*.55+vec3(.012,.015,.014),puddle);
      // Occlusion from the platform, the walls and the censer, since overcast light casts no hard shadow.
      float dP=sdRect(p,vec2(0.,${((PLAT.zF + PLAT.zB) / 2).toFixed(2)}),vec2(${PLAT.x.toFixed(2)},${((PLAT.zF - PLAT.zB) / 2).toFixed(2)}));
      float dS=sdRect(p,vec2(0.,${(PLAT.zF + 0.85).toFixed(2)}),vec2(2.7,.85));
      float dW=-sdRect(p,vec2(0.,${((YARD.zN + YARD.zS) / 2).toFixed(2)}),vec2(${(YARD.x - 0.2).toFixed(2)},${((YARD.zS - YARD.zN) / 2 - 0.2).toFixed(2)}));
      float dC=length(p-vec2(${CENSER.x.toFixed(2)},${CENSER.z.toFixed(2)}))-.45;
      float ao=mix(.38,1.,smoothstep(0.,2.4,min(dP,dS)))*mix(.5,1.,smoothstep(0.,1.3,dW))*mix(.4,1.,smoothstep(0.,.9,dC));
      // The eave keeps a dry-ish, darker strip in front of the hall.
      ao*=mix(.8,1.,smoothstep(0.,1.5,dP-.8));
      float dist=length(vWP-cameraPosition), nf=1./(1.+dist*dist*.012);
      vec2 g=((vec2(n2(p*16.),n2(p*16.+5.))-.5)*.09*(1.-puddle)*nf+(vec2(n2(p*3.),n2(p*3.+9.))-.5)*.03*sqrt(nf));
      vec3 N=normalize(vec3(g.x,1.,g.y)), V=normalize(cameraPosition-vWP);
      float ndv=max(dot(N,V),0.), fres=.035+.965*pow(1.-ndv,5.);
      vec3 lit=alb*(vec3(.78,.83,.84)*ao+vec3(1.,.93,.82)*max(dot(N,uSun),0.)*.42*ao);
      // Mirror in puddles; on damp stone only a stretched, blurred sheen.
      vec4 rc=uTexM*vec4(vWP,1.); vec2 ruv=rc.xy/rc.w+g*mix(.5,.06,puddle);
      vec3 refl=uReflOn>.5?texture2D(tRefl,ruv,mix(2.6,.0,puddle)).rgb:uFog*mix(.9,1.06,ndv);   // without the mirror pass: the sky alone
      float kr=fres*mix(.25+damp*.6,1.,puddle)*(1.-joint*.7);
      vec3 c=mix(lit,refl,clamp(kr,0.,1.));
      c=mix(c,uFog,1.-exp(-pow(dist*.009,2.)));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140).rotateX(-Math.PI / 2), groundMat);
scene.add(ground);

// ---- Post-processing ----------------------------------------------------------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality.msaa }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.7, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }",
  fragmentShader: NOISE + /* glsl */`
    varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRes;
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
      c=mix(c,c*vec3(.93,1.,1.035),(1.-l)*.55);          // cool, slightly green shadows
      c=mix(c,c*vec3(1.03,1.,.965),l*.45);               // warm highlights
      c=mix(vec3(l),c,1.06);
      c=mix(c,c*c*(3.-2.*c),.6);                        // gentle S-curve
      c=c*.97+.012;                                      // lifted blacks: the air is wet
      vec2 d=vUv-.5; c*=1.-dot(d,d)*.6;                  // vignette
      c+=(h21(vUv*uRes+fract(uT)*91.)-.5)*.02;           // grain, and dither against banding in the sky
      gl_FragColor=vec4(c,1.);
    }`,
});
composer.addPass(grade);

// ---- Camera, walking ----------------------------------------------------------
const EYE = 1.62;
const start = (Q.get("cam") || "7.5,12.5,-0.52,0.07").split(",").map(Number);
const pos = new THREE.Vector3(start[0], EYE, start[1]);
let yaw = start[2], pitch = start[3], target = null;
// Where you can stand: the yard, the steps, and the porch in front of the doors.
const PORCH = { x: 7.5, zB: COLS_Z[0] + 0.45, zF: PLAT.zF - 0.25 };
const STEP_RUN = 1.7, STEP_X = 2.0;
function region(x, z) {
  if (Math.abs(x) < PORCH.x && z > PORCH.zB && z < PORCH.zF) return "porch";
  if (Math.abs(x) < STEP_X && z >= PORCH.zF && z < PLAT.zF + STEP_RUN) return "steps";
  return "ground";
}
function heightAt(x, z) {
  const r = region(x, z);
  if (r === "porch") return PLAT.h;
  if (r === "steps") return PLAT.h * Math.min(1, Math.max(0, (PLAT.zF + STEP_RUN - z) / STEP_RUN));
  return 0;
}
function blocked(x, z) {
  if (region(x, z) !== "ground") return false;
  if (Math.abs(x) > YARD.x - 0.8 || z < YARD.zN + 0.8 || z > YARD.zS - 0.8) return true;
  if (Math.abs(x) < PLAT.x + 0.5 && z < PLAT.zF + 0.5 && z > PLAT.zB - 0.5) return true;
  if (Math.abs(x) < 3.1 && z < PLAT.zF + STEP_RUN && z > PLAT.zF) return true;      // the stone cheeks beside the steps
  return false;
}
const hallBox = new THREE.Box3(new THREE.Vector3(-PLAT.x, 0, PLAT.zB), new THREE.Vector3(PLAT.x, 11, PLAT.zF + STEP_RUN));
const FOOT = new THREE.Vector3(0, 0, PLAT.zF + STEP_RUN + 0.4), DOOR = new THREE.Vector3(0, 0, COLS_Z[0] + 0.55);
let route = [], running = true, eyeY = EYE, doorArmed = true;
let down = null;
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
canvas.addEventListener("pointermove", (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < (e.pointerType === "mouse" ? 6 : 14)) return;
  down.moved = true; yaw += dx * 0.0042; pitch = THREE.MathUtils.clamp(pitch + dy * 0.0042, -0.5, 0.75);
  down.x = e.clientX; down.y = e.clientY;
});
const ray = new THREE.Raycaster();
canvas.addEventListener("pointerup", (e) => {
  canvas.style.cursor = "grab";
  if (down && !down.moved && performance.now() - down.t < 600) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    const toHall = ray.ray.intersectsBox(hallBox), onGround = region(pos.x, pos.z) === "ground";
    // Tapping the hall means "go to its door"; the way there, and back, is over the steps.
    if (toHall) route = onGround ? [FOOT.clone(), DOOR.clone()] : [DOOR.clone()];
    else if (hit && hit.distanceTo(pos) < 60) route = onGround ? [hit] : [FOOT.clone(), hit];
    else route = [];
    if (route.length) { target = route.shift(); document.getElementById("hint").classList.add("gone"); }
  }
  down = null;
});
const keys = {};
addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  // Device pixels, scaled by the tier, then capped by its pixel budget.
  let k = Math.min(devicePixelRatio, 2) * quality.scale;
  const px = w * h * k * k; if (px > quality.budget) k *= Math.sqrt(quality.budget / px);
  renderer.setPixelRatio(k); renderer.setSize(w, h, false); composer.setPixelRatio(k); composer.setSize(w, h);
  if (quality.planar > 0) reflRT.setSize(Math.max(64, Math.round(w * k * quality.planar)), Math.max(64, Math.round(h * k * quality.planar)));
  groundMat.uniforms.uReflOn.value = quality.planar > 0 ? 1 : 0;
  bloom.enabled = quality.bloom;
  grade.uniforms.uRes.value.set(w * k, h * k);
  camera.aspect = w / h; camera.fov = w < h ? 68 : 52; camera.updateProjectionMatrix();
}
// No two phones are alike and none can be tested from here, so the page watches its own frame time
// and gives things up in order of how little they will be missed.
const governor = { n: 0, sum: 0, level: 0, steps: [
  () => { quality.scale *= 0.8; quality.budget *= 0.7; },
  () => { quality.planar = 0; },
  () => { quality.bloom = false; quality.scale *= 0.85; quality.budget *= 0.8; },
] };
function govern(dtReal) {
  if (quality.fixed || governor.level >= governor.steps.length || frames < 30) return;
  governor.sum += dtReal; governor.n++;
  if (governor.n < 45) return;
  const avg = governor.sum / governor.n; governor.n = 0; governor.sum = 0;
  if (avg > 0.03) { governor.steps[governor.level++](); resize(); }
}
new ResizeObserver(resize).observe(canvas); resize();

const _rot = new THREE.Matrix4(), _look = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0);
function renderReflection() {
  // The camera's mirror image below the ground looks back up at the real scene.
  _rot.extractRotation(camera.matrixWorld);
  _look.set(0, 0, -1).applyMatrix4(_rot).add(camera.position); _look.y = -_look.y;
  reflCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
  reflCam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n);
  reflCam.lookAt(_look); reflCam.updateMatrixWorld();
  reflCam.projectionMatrix.copy(camera.projectionMatrix); reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  ground.visible = false;
  renderer.setRenderTarget(reflRT); renderer.render(scene, reflCam); renderer.setRenderTarget(null);
  ground.visible = true;
}

let prev = performance.now(), frames = 0;
function frame(now) {
  if (!running) return;
  govern((now - prev) / 1000);
  const dt = Math.min(0.05, (now - prev) / 1000), t = now / 1000; prev = now;
  // Walk: keys or the tapped spot, at a slow pace, sliding along what blocks the way.
  const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let vx = 0, vz = 0;
  if (f || s) { target = null; route = []; vx = Math.sin(yaw) * f + Math.cos(yaw) * s; vz = -Math.cos(yaw) * f + Math.sin(yaw) * s; }
  else if (target) { vx = target.x - pos.x; vz = target.z - pos.z; if (Math.hypot(vx, vz) < 0.02) { target = route.shift() || null; vx = vz = 0; } }
  const len = Math.hypot(vx, vz);
  if (len > 0) {
    const step = Math.min(len, (Q.has("fast") ? 14 : 2.1) * dt); vx = (vx / len) * step; vz = (vz / len) * step;
    if (!blocked(pos.x + vx, pos.z + vz)) { pos.x += vx; pos.z += vz; }
    else if (!blocked(pos.x + vx, pos.z)) pos.x += vx;
    else if (!blocked(pos.x, pos.z + vz)) pos.z += vz;
    else { target = null; route = []; }
    // The censer does not stop you: you are eased around it.
    const cx = pos.x - CENSER.x, cz = pos.z - CENSER.z, cd = Math.hypot(cx, cz);
    if (cd < 1.25) { const k = 1.25 / Math.max(cd, 1e-3); pos.x = CENSER.x + (cx || 0.01) * k; pos.z = CENSER.z + cz * k; }
  }
  eyeY += (EYE + heightAt(pos.x, pos.z) - eyeY) * Math.min(1, dt * 9);
  camera.position.set(pos.x, eyeY + (len > 0 && !still ? Math.sin(t * 6.5) * 0.018 : 0), pos.z);
  // Crossing the threshold hands over to the hall interior.
  const atDoor = region(pos.x, pos.z) === "porch" && Math.abs(pos.x) < 1.35 && pos.z < COLS_Z[0] + 0.8;
  if (!atDoor) doorArmed = true;
  else if (doorArmed) { doorArmed = false; target = null; route = []; window.dispatchEvent(new CustomEvent("enter-hall")); }
  camera.rotation.set(pitch, -yaw, 0, "YXZ");
  camera.updateMatrixWorld();

  for (const sp of smoke) {
    const u = sp.userData;
    if (u.mist) { if (!still) sp.position.x = Math.cos(u.a) * u.R + Math.sin(t * 0.03 + u.a * 3) * 6; continue; }
    if (!still) u.t = (u.t + dt * 0.09) % 1;
    const a = u.t, sway = a * a;
    sp.position.set(CENSER.x + Math.sin(t * 0.5 + u.seed + a * 5) * 0.4 * sway + a * 0.5, 1.02 + a * 4.2, CENSER.z + Math.cos(t * 0.4 + u.seed * 1.7 + a * 4) * 0.3 * sway);
    sp.scale.setScalar(0.05 + a * 0.9); sp.material.opacity = Math.sin(Math.min(1, a * 6) * Math.PI / 2) * (1 - a) * 0.22;
  }
  const tt = still ? 0 : t;
  skyMat.uniforms.uT.value = tt; grade.uniforms.uT.value = tt; groundMat.uniforms.uT.value = tt;
  for (const b of bamboo) b.material.uniforms.uT.value = tt;

  if (frames < 3) renderer.shadowMap.needsUpdate = true;
  if (quality.planar > 0) renderReflection();
  composer.render();
  if (++frames === 3) document.body.dataset.ready = "1";
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(() => document.getElementById("hint").classList.add("gone"), 9000);

window.addEventListener("yard-pause", () => { running = false; });
window.addEventListener("yard-resume", () => {
  // Step back out of the hall: on the porch, facing the courtyard.
  pos.set(0, EYE, COLS_Z[0] + 1.15); yaw = Math.PI; pitch = 0.04; target = null; route = []; doorArmed = false;
  eyeY = EYE + PLAT.h; for (const k in keys) keys[k] = false;
  if (!running) { running = true; prev = performance.now(); requestAnimationFrame(frame); }
});
window.__yard = () => ({ tier: quality.name, scale: +quality.scale.toFixed(2), planar: quality.planar, governed: governor.level, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), region: region(pos.x, pos.z), target: target && [+target.x.toFixed(2), +target.z.toFixed(2)], route: route.length, running, frames });
