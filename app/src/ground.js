// Wet flagstones with a real mirror in the puddles.
import * as THREE from "three";
import { NOISE, fogMix, U } from "./glsl.js";
import { FOG, SUN_DIR } from "./sky.js";
import { declare, bind } from "./textures.js";
import { TRAIL } from "./trail.js";

const MAX_LAMPS = 14;

export function createGround(scene, shade, censer, paving) {
  const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.PerspectiveCamera(), texM = new THREE.Matrix4();
  // The light map: how far each spot of paving lies from the nearest wall, platform or trunk, worked out once when the
  // place is built and kept as a picture, eight points to the metre. The shader reads it for the soft darkening
  // under eaves and along walls, and for where snow drifts. (It used to walk a list of forty boxes for every pixel,
  // and anything past the fortieth cast nothing.)
  const SPAN = 3, bake = (list) => {
    if (!list.length) list = [{ x0: 0, x1: 0, z0: 999, z1: 999 }];
    const x0 = Math.min(...list.map((r) => r.x0)) - 3.5, x1 = Math.max(...list.map((r) => r.x1)) + 3.5, z0 = Math.min(...list.map((r) => r.z0)) - 3.5, z1 = Math.max(...list.map((r) => r.z1)) + 3.5;
    const k = Math.min(8, 1024 / Math.max(x1 - x0, z1 - z0)), W = Math.max(2, Math.ceil((x1 - x0) * k)), H = Math.max(2, Math.ceil((z1 - z0) * k)), data = new Uint8Array(W * H);
    const bx = list.map((r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2]);
    for (let j2 = 0; j2 < H; j2++) for (let i2 = 0; i2 < W; i2++) {
      const px = x0 + ((i2 + 0.5) / W) * (x1 - x0), pz = z0 + ((j2 + 0.5) / H) * (z1 - z0); let d = 1e3;
      for (const b of bx) { const dx = Math.abs(px - b[0]) - b[2], dz = Math.abs(pz - b[1]) - b[3]; const v = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0); if (v < d) d = v; }
      data[j2 * W + i2] = Math.max(0, Math.min(255, Math.round(((d + 0.5) / SPAN) * 255)));
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1; tex.needsUpdate = true;   // one byte a point: rows are not padded to four
    return { tex, box: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)) };
  };
  // One paving shader, used by the entrance court (with the mirror) and by the terraces (without).
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blank.needsUpdate = true;
  // The paving is lit by hand (it has a mirror to mix in), but it takes the sun's shadows from the same map as everything
  // else: at dawn and dusk the long shadows of the halls lie across the court.
  const pave = (list, mirror, censerAt, lm = bake(list)) => new THREE.ShaderMaterial({
    lights: true,
    uniforms: bind(Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.lights), {
      tRefl: { value: mirror ? rt.texture : blank }, uReflOn: { value: mirror ? 1 : 0 }, uTexM: { value: texM }, uFog: { value: FOG }, uSun: { value: SUN_DIR },
      tShade: { value: lm.tex }, uShadeBox: { value: lm.box }, uCenser: { value: censerAt }, uFogD: U.uFogD, uSnow: U.uSnow, uWet: U.uWet, uAmb: U.uAmb, uSunC: U.uSunC,
      uLamp: U.uLamp, tTrail: U.tTrail, uTrail: U.uTrail, uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(0, 0, 1, 0)) },
    }), ["stone", "snow"]),
    vertexShader: /* glsl */`
      #include <common>
      #include <shadowmap_pars_vertex>
      varying vec3 vWP;
      void main(){
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        #include <worldpos_vertex>
        #include <shadowmap_vertex>
        vWP=(modelMatrix*vec4(position,1.)).xyz;
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      ` + NOISE + declare(["stone", "snow"]) + TRAIL + /* glsl */`
      varying vec3 vWP; uniform sampler2D tRefl; uniform mat4 uTexM; uniform vec3 uFog, uSun, uAmb, uSunC; uniform float uReflOn, uFogD, uSnow, uWet;
      uniform sampler2D tShade; uniform vec4 uShadeBox; uniform vec2 uCenser; uniform vec4 uLamps[${MAX_LAMPS}]; uniform float uLamp;
      void main(){
        vec2 p=vWP.xz;
        // Running-bond slabs, each a slightly different stone.
        // Down the axis runs a path of large square slabs between two lines of kerb stones.
        bool onAxis=p.y>-.95&&p.y<53.9, path=onAxis&&abs(p.x)<1.7, kerb=onAxis&&!path&&abs(p.x)<2.02;
        vec2 sz=path?vec2(1.1333):vec2(1.02,.64); float row=floor(p.y/sz.y);
        vec2 q=vec2(p.x/sz.x+(path?1.5:mod(row,2.)*.5+h21(vec2(row,7.))*.3),p.y/sz.y); vec2 id=floor(q)+(path?vec2(300.,0.):vec2(0.)), f=fract(q);
        float edge=min(min(f.x,1.-f.x)*sz.x,min(f.y,1.-f.y)*sz.y);
        if(kerb){ float kz=fract(p.y/1.6); edge=min(min(abs(p.x)-1.7,2.02-abs(p.x)),min(kz,1.-kz)*1.6); id=vec2(floor(p.y/1.6),500.+sign(p.x)); }
        edge+=(n2(p*9.)-.5)*.02; float joint=1.-smoothstep(.014,.04,edge);
        float tone=h21(id);
        // Each slab is cut from a different part of the scanned stone.
        vec2 su0=p*.75, suv=su0+vec2(h21(id+3.),h21(id+7.))*5., sgx=dFdx(su0), sgy=dFdy(su0); vec3 sA=textureGrad(tStoneA,suv,sgx,sgy).rgb/mStone, sN=textureGrad(tStoneN,suv,sgx,sgy).xyz;
        vec3 alb=mix(vec3(.17,.175,.17),vec3(.34,.345,.33),tone)*mix(vec3(1.),sA,.9)*(.78+.4*fbm2(p*.7));
        if(path) alb*=vec3(1.16,1.13,1.06); if(kerb) alb*=.78;
        float mossM=smoothstep(.42,.7,fbm2(p*.45+9.));
        alb=mix(alb,vec3(.085,.115,.06),joint*mossM*.85); alb=mix(alb,vec3(.03),joint*.55*(1.-mossM));   // moss only in the joints that stay damp; the rest are dark with dirt
        alb=mix(alb,vec3(.11,.14,.085),mossM*smoothstep(.12,.0,edge)*.25);
        // Water: one continuous ramp, standing water -> soaked -> damp.
        float low=fbm2(p*.17+3.)+(tone-.5)*.07-joint*.03+(uWet-1.)*.34;
        float puddle=smoothstep(.57,.61,low), damp=smoothstep(.3,.58,low);   // water stands only in the hollows
        alb*=mix(.66,.44,damp); alb=mix(alb,alb*.55+vec3(.012,.015,.014),puddle);
        // Occlusion from every platform and wall, since overcast light casts no hard shadow.
        vec2 lmUv=(p-uShadeBox.xy)*uShadeBox.zw; float dB=(lmUv.x>0.&&lmUv.x<1.&&lmUv.y>0.&&lmUv.y<1.)?texture2D(tShade,lmUv).r*${SPAN}.-.5:2.5;
        float ao=mix(.4,1.,smoothstep(0.,2.2,dB))*mix(.4,1.,smoothstep(0.,.9,length(p-uCenser)-.45));
        // Snow (snowfall.js does the same sums for his steps and the tests). Down the middle of every court a lane is swept
        // each morning: a dusting on its stone, grainy and clean-edged, snow packed in the joints, the swept snow banked
        // along both sides over the kerbs. Off the lane it lies deeper against walls and platforms and in long low waves
        // out in the open; none under a roof.
        float lane=abs(p.x)-1.7, bank=exp(-pow((lane-.32)/.3,2.)), open=smoothstep(-.15,.2,lane);
        float deep=.5+.6*fbm2(p*.09+4.)+.25*fbm2(p*.35+8.)+.45*smoothstep(0.,.2,dB)*exp(-max(dB,0.)*.7)+.35*bank;
        float dust=.15+.14*fbm2(p*1.3+2.)+.22*smoothstep(-.6,0.,lane)+joint*.6, grain=(n2(p*38.)*.6+n2(p*90.)*.4)*.35, roofS=smoothstep(-.3,.1,dB);
        float sn=uSnow*mix(smoothstep(.46,.475,dust+grain),smoothstep(.15,.3,deep),open)*roofS, snD=mix(dust,deep,open)*roofS; puddle*=1.-sn; damp*=1.-sn;
        // Snow on the paving is as bright as the same snow on a platform or a roof: the paving is lit by hand for stone
        // a third as pale, and at full brightness the snow was a glowing white with nothing in it.
        // Where he has walked the snow is pressed down: darker, a little blue, and in thin snow the stone shows through.
        vec3 tr=sn>.001?trail(vWP):vec3(0.); sn*=1.-tr.x*smoothstep(.8,.2,sn)*.6;
        vec3 wN=texture2D(tSnowN,p*.55).xyz; alb=mix(alb,vec3(.8,.84,.9)*.6*(.88+.24*wN.z)*(.86+.14*min(snD,1.3))*mix(vec3(1.),vec3(.6,.65,.76),tr.x),sn); ao*=1.-.25*tr.x*sn;
        float dist=length(vWP-cameraPosition), nf=1./(1.+dist*dist*.012);
        vec2 g=(sN.xy*2.-1.)*.5*(1.-puddle)*(1.-sn)*(1.-joint)+(wN.xy*2.-1.)*.3*sn*(1.-.6*tr.x)+tr.yz*sn+(vec2(sign(p.x)*bank*(lane-.32)*6.,0.)+(vec2(n2(p*.4),n2(p*.4+5.))-.5)*.35*open)*sn*(1.-tr.x)+(vec2(n2(p*3.),n2(p*3.+9.))-.5)*.03*sqrt(nf);
        vec3 N=normalize(vec3(g.x,1.,g.y)), V=normalize(cameraPosition-vWP);
        float ndv=max(dot(N,V),0.), fres=.035+.965*pow(1.-ndv,5.);
        float sun=getShadowMask();
        vec3 lit=alb*(uAmb*ao*mix(.86,1.,sun)+uSunC*1.5*max(dot(N,uSun),0.)*ao*sun);
        // After dark every lamp lays a warm pool on the stone round its foot.
        if(uLamp>.01){ float pool=0.; for(int i=0;i<${MAX_LAMPS};i++){ vec4 L=uLamps[i]; if(L.w<=0.) break; vec2 dl=p-L.xy; pool+=L.w*exp(-dot(dl,dl)/(L.z*L.z)); } lit+=(alb*.55+.03)*vec3(1.,.56,.25)*min(pool,1.2)*uLamp*.85; }
        // Mirror in puddles; on damp stone only a stretched, blurred sheen. Without the mirror pass: the sky alone.
        vec4 rc=uTexM*vec4(vWP,1.); vec2 ruv=rc.xy/rc.w+g*mix(.5,.06,puddle);
        // Standing water mirrors; stone that is only damp gives back a soft, pale light with no shapes in it.
        vec3 sky=uFog*mix(.9,1.06,ndv), refl=sky;
        if(uReflOn>.5){ vec3 sharp=texture2D(tRefl,ruv,0.).rgb, soft=mix(texture2D(tRefl,ruv,6.).rgb,sky,.88); if(!(sharp.r>=0.)) sharp=sky; if(!(soft.r>=0.)) soft=sky; refl=mix(soft,sharp,puddle); }
        if(!(refl.r>=0.)) refl=vec3(0.); refl=min(refl,vec3(32.));
        float kr=fres*mix(.05+damp*.24,1.,puddle)*(1.-joint*.7);
        vec3 c=mix(lit,refl,clamp(kr,0.,1.));
        ${fogMix("c", "dist")}
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const levels = [];   // each stretch of paving, with the height it lies at
  const mat = pave(shade[0], true, new THREE.Vector2(censer.x, censer.z)); levels.push({ mat, y: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(460, 300).rotateX(-Math.PI / 2).translate(0, 0, -86), mat);   // ends at the head of the approach stair
  ground.receiveShadow = true; scene.add(ground);
  // The same wet paving on the terraces above: no mirror pass up there, only the sky's sheen.
  for (const p of paving) {
    const terrace = new THREE.Mesh(new THREE.PlaneGeometry(p.x * 2, p.zS - p.zN).rotateX(-Math.PI / 2).translate(0, p.y, (p.zS + p.zN) / 2), pave(shade[p.level], false, new THREE.Vector2(0, 999)));
    terrace.receiveShadow = true; scene.add(terrace); levels.push({ mat: terrace.material, y: p.y });
  }

  const rot = new THREE.Matrix4(), look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0); let has = false;
  return {
    // `lamps`: [{ x, y, z, reach }] — every flame in the place. Each lights the paving just below it.
    setLamps(lamps) {
      for (const L of levels) {
        const mine = lamps.filter((l) => l.y > L.y && l.y < L.y + 4.5 && (L.y > 0 || !levels.some((o) => o.y > 0 && l.y > o.y && l.y < o.y + 4.5 && Math.abs(l.x) < 22 && l.z < -34))).slice(0, MAX_LAMPS);
        L.mat.uniforms.uLamps.value.forEach((v, i) => { const l = mine[i]; if (l) v.set(l.x, l.z, l.reach, Math.min(1.4, 0.5 + 0.5 / Math.max(0.6, l.y - L.y))); else v.set(0, 0, 1, 0); });
      }
    },
    resize(w, h, on) { if (on) rt.setSize(Math.max(64, w), Math.max(64, h)); has = !!on; mat.uniforms.uReflOn.value = on ? 1 : 0; },
    // Whether the mirror is being drawn this frame. When it is not, the paving falls back to the sky's sheen
    // instead of showing whatever the mirror last held.
    mirror(on) { mat.uniforms.uReflOn.value = has && on ? 1 : 0; },
    // The camera's mirror image below the ground looks back up at the real scene.
    render(renderer, camera) {
      rot.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(camera.position); look.y = -look.y;
      cam.position.set(camera.position.x, -camera.position.y, camera.position.z);
      cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(up);
      cam.lookAt(look); cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix); cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      ground.visible = false;
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
      ground.visible = true;
    },
  };
}
