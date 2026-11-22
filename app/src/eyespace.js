// What the eye may not go into, asked of what is drawn (#295, the fifth step of #161's migration). Until now the eye
// following him asked the written plan (`walker.eyeShut`: each building's walls up to its ridge, its platform as a solid
// block, its roof as a box), and since he walks on the floor baked from the drawn meshes he walks where the written plan
// has solid stone: round the great hall's platform the eye was pulled into his head. Now it asks the drawn meshes
// themselves, through a bounding volume hierarchy over the same triangles the floor is baked from (three-mesh-bvh), with a
// sphere as big as the corners of the camera's near plane, worked out for the lens and the screen of the frame: a ray down
// the middle of the arm lets the corners of the picture into a wall (Godot's SpringArm3D says so of its own ray; its
// shape, and Unreal's spring arm's probe size, are a sphere).
import * as THREE from "three";

/**
 * The distance from the eye to a corner of its near plane, and a margin: the sphere that keeps the whole picture out of
 * what is drawn. `fov` is the vertical field in degrees, as three's camera has it.
 */
export function eyeRadius(fov, aspect, near, margin = 0.02) {
  const t = Math.tan((fov * Math.PI) / 360);
  return near * Math.sqrt(1 + t * t * (1 + aspect * aspect)) + margin;
}

/** Does the segment pass through the box? (the slab test, clipped to the segment's length) */
function segmentHitsBox(a, b, box) {
  let t0 = 0, t1 = 1;
  for (const k of ["x", "y", "z"]) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] < box.min[k] || a[k] > box.max[k]) return false; continue; }
    let u = (box.min[k] - a[k]) / d, v = (box.max[k] - a[k]) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}

/**
 * The space the eye moves in, over a MeshBVH of the drawn place. `radius` is set each frame from the camera
 * (`eyeRadius`). `along(a, b)` gathers the triangles within the radius of the segment from a to b (the arm, from the
 * point over his head to as far back as the eye may go), so that the many points the arm is asked at cost only a look
 * at those few; `shut(x, y, z)` says whether a sphere of the radius there touches anything drawn, or lies where the level
 * keeps the eye out (`keepOut(x, y, z, r)`: the prologue's bamboo, which is drawn as cut-out cards the gathering passes
 * over, and was a solid the eye kept out of on the written plan; #515).
 * @param {any} bvh a MeshBVH
 * @param {((x: number, y: number, z: number, r: number) => boolean) | null} [keepOut]
 */
export function createEyeSpace(bvh, keepOut = null) {
  let r = 0.25, near = [], seg = new THREE.Line3(), have = false;
  const box = new THREE.Box3(), p = new THREE.Vector3(), q = new THREE.Vector3(), s = new THREE.Sphere(new THREE.Vector3(), r), ray = new THREE.Ray();
  const touches = (x, y, z) => { p.set(x, y, z); for (const t of near) { t.closestPointToPoint(p, q); if (q.distanceToSquared(p) <= r * r) return true; } return false; };
  return {
    get radius() { return r; },
    set radius(v) { r = v; have = false; },
    /** Gather what lies within the radius of the segment a-b ([x, y, z] each); returns how many triangles. */
    along(a, b) {
      seg.start.set(a[0], a[1], a[2]); seg.end.set(b[0], b[1], b[2]); near = []; have = true;
      bvh.shapecast({
        intersectsBounds: (bounds) => { box.copy(bounds).expandByScalar(r); return segmentHitsBox(seg.start, seg.end, box); },
        intersectsTriangle: (tri) => { if (tri.closestPointToSegment(seg) <= r) { const t = new THREE.Triangle(tri.a.clone(), tri.b.clone(), tri.c.clone()); near.push(t); } return false; },
      });
      return near.length;
    },
    /**
     * Is the line from a to b ([x, y, z] each) clear of everything drawn? (#396: an eye risen over a platform's balustrade
     * stood clear of it and could not see him past it.)
     */
    sees(a, b) {
      ray.origin.set(a[0], a[1], a[2]); ray.direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = ray.direction.length(); if (len < 1e-6) return true;
      ray.direction.divideScalar(len); const h = bvh.raycastFirst(ray, THREE.DoubleSide); return !h || h.distance >= len - 0.05;
    },
    /** Does the sphere at (x, y, z) touch anything drawn? Near the segment last gathered, only those triangles are asked. */
    shut(x, y, z) {
      if (keepOut && keepOut(x, y, z, r)) return true;
      if (have) { p.set(x, y, z); seg.closestPointToPoint(p, true, q); if (q.distanceTo(p) < 1e-3) return touches(x, y, z); }
      s.center.set(x, y, z); s.radius = r; return bvh.intersectsSphere(s);
    },
  };
}
