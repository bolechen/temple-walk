// What is seen of a hall from outside, through its open door (issue #218). The real room stands sixty metres under the
// courts (interior.js), so behind the leaves there is nothing but a dark box. Here each hall's own room is drawn once
// onto the faces of a cube from just inside its door, at a grown eye's height, together with how far away each thing
// stood; the box behind the leaves then paints that room. For every point of the box, the line from the eye is followed
// into the room, as if the room stood there behind the wall: first to the wall, floor or ceiling it would reach (the
// room's own box), then back along that line to the first thing that stands in it as seen from the door (the figure,
// the offering table, a column), found by a few steps against the cube of distances. So the figure keeps its own depth
// and moves against the door frame as the visitor walks past, and what is seen from outside is the room that is found
// on going in.
//
// The method is interior mapping (Joost van Dongen, 2008) with a box-projected cube taken from a real point, and a short
// march against a distance cube in place of a separate card for the figure. No library: the open ones read for this
// (three-fenestra, three-interior-mapping, Kristian Dixon's notes) map one photograph or a unit cube, not a room of its
// own size captured from inside (docs/t00/SOURCES.md).
import * as THREE from "three";

const EYE = 1.6, INSET = 0.25;   // where the cube is taken: a grown eye's height, a little inside the door
const DIST = 64;                  // distances are kept as a fraction of this many metres

// The material of one hall's dark box. `steps` is how many times the line is tried against the distances (0: only
// the room's own box, one sample of the cube).
function doorMaterial(U, steps) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: true,
    defines: { STEPS: steps },
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      tCol: { value: null }, tDist: { value: null }, uHas: { value: 0 },
      uW2R: { value: new THREE.Matrix4() }, uMin: { value: new THREE.Vector3() }, uMax: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
      uGain: { value: new THREE.Vector2(0.18, 0.8) }, uLamp: U.uLamp,
    }),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWP;
      void main(){
        vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform samplerCube tCol, tDist; uniform float uHas, uLamp; uniform mat4 uW2R; uniform vec3 uMin, uMax, uC; uniform vec2 uGain;
      varying vec3 vWP;
      float gap(vec3 ro, vec3 rd, float t){ vec3 q=ro+rd*t-uC; return length(q)-texture(tDist,q).r*${DIST.toFixed(1)}; }
      void main(){
        vec3 ro=(uW2R*vec4(cameraPosition,1.)).xyz, rd=normalize((uW2R*vec4(vWP,1.)).xyz-ro), inv=1./rd;
        vec3 a=(uMin-ro)*inv, b=(uMax-ro)*inv, lo=min(a,b), hi=max(a,b);
        float tin=max(max(max(lo.x,lo.y),lo.z),0.), tout=min(min(hi.x,hi.y),hi.z);
        vec3 c=vec3(.006,.0045,.003);
        if(uHas>.5 && tout>tin){
          float t=tout;
          #if STEPS > 0
            // Into the room from the door, a step at a time, until the line has passed behind what the door sees.
            float t0=tin, g0=gap(ro,rd,t0), dt=(tout-tin)/float(STEPS);
            for(int i=1;i<=STEPS;i++){
              float t1=tin+dt*float(i), g1=gap(ro,rd,t1);
              if(g1>=0.){ t=mix(t0,t1,clamp(g0/(g0-g1),0.,1.)); break; }
              t0=t1; g0=g1;
            }
          #endif
          c=texture(tCol,ro+rd*t-uC).rgb*mix(uGain.x,uGain.y,clamp(uLamp,0.,1.));
        }
        gl_FragColor=vec4(c,1.);
        #include <fog_fragment>
      }`,
  });
}

// What a distance cube is drawn with: how far each point stands from the cube's centre.
function distMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Vector3() } }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uC; varying vec3 vWP; void main(){ gl_FragColor=vec4(length(vWP-uC)/${DIST.toFixed(1)},0.,0.,1.); }`,
  });
}

// `site.doorways` (the dark box of each hall and how its building stands), `rooms` (buildInteriors), the scene and the
// renderer. `size`: the colour cube's face in pixels; `steps`: see doorMaterial.
export function createDoorways({ renderer, scene, site, rooms, U, size = 256, steps = 12 }) {
  const halls = {}, dm = distMaterial();
  let sun = null, hemi = null;
  scene.traverse((o) => { if (o.isDirectionalLight && !sun) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; });
  for (const h of site.halls) {
    const d = site.doorways[h.id], r = rooms.rooms[h.id]; if (!d || !r) continue;
    const R = r.room, wx = (R.x1 - R.x0) / 2 + 0.3, zs = R.z1 + 0.3, zn = R.z0 - 0.3;
    const col = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const dist = new THREE.WebGLCubeRenderTarget(Math.max(64, size / 2), { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.05, 80, col), dcam = new THREE.CubeCamera(0.05, 80, dist);
    const mat = doorMaterial(U, steps), u = mat.uniforms;
    u.tCol.value = col.texture; u.tDist.value = dist.texture;
    u.uMin.value.set(-wx, 0, zn); u.uMax.value.set(wx, R.h + 0.45, zs); u.uC.value.set(0, EYE, zs - INSET);
    const C = new THREE.Vector3(R.cx, R.y + EYE, zs - INSET);
    d.mesh.material = mat;
    halls[h.id] = { hall: h, d, r, col, dist, cam, dcam, mat, C, zs, taken: 0 };
  }
  // From the world into the room's own frame (x across, y up from its floor, z toward its door): through the building's
  // inverse placement into its own space, then its floor down to the room's and its front wall onto the room's.
  const place = (o) => {
    o.d.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(o.d.group.matrixWorld).invert();
    o.mat.uniforms.uW2R.value.makeTranslation(0, -o.d.platH, o.zs - o.d.Z).multiply(inv);
  };
  // Draw one hall's room onto its cubes: only the rooms drawn, its own lamps lit, the sun out and the sky's light low, as
  // on going in (yard.js's `dress`), and everything put back as it was.
  const take = (id) => {
    const o = halls[id]; if (!o) return false;
    place(o);
    const seen = scene.children.map((c) => c.visible);
    for (const c of scene.children) c.visible = c.userData.part === "interior";
    const lit = o.r.lights.map((l) => l.visible); o.r.lights.forEach((l) => { l.visible = true; });
    const was = { sun: sun?.intensity, hemi: hemi?.intensity, lamp: U.uLamp.value, snow: U.uSnow.value, layer: U.uFogLayer?.value.x, fog: scene.fog };
    if (sun) sun.intensity = 0; if (hemi) hemi.intensity *= 0.3; U.uLamp.value = 1; U.uSnow.value = 0; if (U.uFogLayer) U.uFogLayer.value.x = 0;
    const target = renderer.getRenderTarget(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
    try {
      o.cam.position.copy(o.C); o.cam.update(renderer, scene);
      scene.fog = null; dm.uniforms.uC.value.copy(o.C); scene.overrideMaterial = dm; o.dcam.position.copy(o.C); o.dcam.update(renderer, scene);
    } finally {
      scene.overrideMaterial = null; scene.fog = was.fog;
      renderer.xr.enabled = xr; renderer.setRenderTarget(target);
      if (sun) sun.intensity = was.sun; if (hemi) hemi.intensity = was.hemi; U.uLamp.value = was.lamp; U.uSnow.value = was.snow; if (U.uFogLayer) U.uFogLayer.value.x = was.layer;
      o.r.lights.forEach((l, i) => { l.visible = lit[i]; });
      scene.children.forEach((c, i) => { c.visible = seen[i]; });
    }
    o.mat.uniforms.uHas.value = 1; o.taken++;
    return true;
  };
  return { halls, take, takeAll: () => Object.keys(halls).forEach(take), report: () => Object.fromEntries(Object.entries(halls).map(([k, o]) => [k, { taken: o.taken, size: o.col.width }])) };
}
