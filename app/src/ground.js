// Wet flagstones with a real mirror in the puddles.
import * as THREE from "../v/build/three.module.js";
import { NOISE, fogMix } from "./glsl.js";
import { FOG, SUN_DIR } from "./sky.js";

const MAX_SHADE = 40;

export function createGround(scene, shade, censer, paving) {
  const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.PerspectiveCamera(), texM = new THREE.Matrix4();
  const boxes = (list) => Array.from({ length: MAX_SHADE }, (_, i) => {
    const r = list[i]; return r ? new THREE.Vector4((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2) : new THREE.Vector4(0, 0, -1, -1);
  });
  // One paving shader, used by the entrance court (with the mirror) and by the terraces (without).
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blank.needsUpdate = true;
  const pave = (list, mirror, censerAt) => new THREE.ShaderMaterial({
    uniforms: {
      tRefl: { value: mirror ? rt.texture : blank }, uReflOn: { value: mirror ? 1 : 0 }, uTexM: { value: texM }, uFog: { value: FOG }, uSun: { value: SUN_DIR },
      uShade: { value: boxes(list) }, uCenser: { value: censerAt },
    },
    vertexShader: "varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vWP; uniform sampler2D tRefl; uniform mat4 uTexM; uniform vec3 uFog, uSun; uniform float uReflOn;
      uniform vec4 uShade[${MAX_SHADE}]; uniform vec2 uCenser;
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
        vec3 alb=mix(vec3(.17,.175,.17),vec3(.34,.345,.33),tone)*(.6+.55*fbm2(p*2.6))*(.75+.5*fbm2(p*11.));
        if(path) alb*=vec3(1.16,1.13,1.06); if(kerb) alb*=.78;
        float mossM=smoothstep(.42,.7,fbm2(p*.45+9.));
        alb=mix(alb,vec3(.12,.18,.07),joint*(.35+.65*mossM)); alb=mix(alb,vec3(.03),joint*.3*(1.-mossM));
        alb=mix(alb,vec3(.15,.2,.1),mossM*smoothstep(.12,.0,edge)*.35);
        // Water: one continuous ramp, standing water -> soaked -> damp.
        float low=fbm2(p*.17+3.)+(tone-.5)*.07-joint*.03;
        float puddle=smoothstep(.47,.52,low), damp=smoothstep(.22,.47,low);
        alb*=mix(.78,.5,damp); alb=mix(alb,alb*.55+vec3(.012,.015,.014),puddle);
        // Occlusion from every platform and wall, since overcast light casts no hard shadow.
        float dB=1e3;
        for(int i=0;i<${MAX_SHADE};i++){ vec4 b=uShade[i]; if(b.z<0.) break; vec2 d=abs(p-b.xy)-b.zw; dB=min(dB,length(max(d,0.))+min(max(d.x,d.y),0.)); }
        float ao=mix(.4,1.,smoothstep(0.,2.2,dB))*mix(.4,1.,smoothstep(0.,.9,length(p-uCenser)-.45));
        float dist=length(vWP-cameraPosition), nf=1./(1.+dist*dist*.012);
        vec2 g=((vec2(n2(p*16.),n2(p*16.+5.))-.5)*.09*(1.-puddle)*nf+(vec2(n2(p*3.),n2(p*3.+9.))-.5)*.03*sqrt(nf));
        vec3 N=normalize(vec3(g.x,1.,g.y)), V=normalize(cameraPosition-vWP);
        float ndv=max(dot(N,V),0.), fres=.035+.965*pow(1.-ndv,5.);
        vec3 lit=alb*(vec3(.78,.83,.84)*ao+vec3(1.,.93,.82)*max(dot(N,uSun),0.)*.42*ao);
        // Mirror in puddles; on damp stone only a stretched, blurred sheen. Without the mirror pass: the sky alone.
        vec4 rc=uTexM*vec4(vWP,1.); vec2 ruv=rc.xy/rc.w+g*mix(.5,.06,puddle);
        vec3 refl=uReflOn>.5?texture2D(tRefl,ruv,mix(2.6,.0,puddle)).rgb:uFog*mix(.9,1.06,ndv);
        float kr=fres*mix(.25+damp*.6,1.,puddle)*(1.-joint*.7);
        vec3 c=mix(lit,refl,clamp(kr,0.,1.));
        ${fogMix("c", "dist")}
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mat = pave(shade[0], true, new THREE.Vector2(censer.x, censer.z));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 264).rotateX(-Math.PI / 2).translate(0, 0, -68), mat);   // ends at the head of the approach stair
  scene.add(ground);
  // The same wet paving on the terraces above: no mirror pass up there, only the sky's sheen.
  for (const p of paving) {
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(p.x * 2, p.zS - p.zN).rotateX(-Math.PI / 2).translate(0, p.y, (p.zS + p.zN) / 2), pave(shade[p.level], false, new THREE.Vector2(0, 999))));
  }

  const rot = new THREE.Matrix4(), look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return {
    resize(w, h, on) { if (on) rt.setSize(Math.max(64, w), Math.max(64, h)); mat.uniforms.uReflOn.value = on ? 1 : 0; },
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
