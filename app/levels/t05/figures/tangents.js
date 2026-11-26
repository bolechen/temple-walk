// A figure's tangents, looked over once as it arrives. Its normal map is laid on with the tangents the file carries, and three's vertex shader makes
// the third axis by normalising the cross of the normal and the tangent. Where a file's tangent lies along its normal (an exporter's fallback, (1, 0, 0),
// on a stray triangle that happens to face that way) or has no length, that cross is nothing, and normalising nothing is not a number on a graphics
// card: every pixel of the triangle is then not a number, and a pass that blurs the picture (the bloom) spreads it over the screen. The shipped files
// hold four such triangles (tests/unit/t05-figure-mend.test.mjs counts them); a figure published later may hold others, so every one is looked over.

/** A point's attributes as three hands them out: numbers already brought back from their bytes. @typedef {{ count: number, getX(i: number): number, getY(i: number): number, getZ(i: number): number, getW(i: number): number, setXYZW(i: number, x: number, y: number, z: number, w: number): unknown, needsUpdate?: boolean }} Attr */

// the sine squared under which a tangent counts as lying along the normal: one step of the files' bytes (1 in 127) off it is 0.00006 and still counts
const ALONG = 1e-4;

/** Whether point `i`'s tangent cannot span a frame with its normal: no length, or along it. @param {Attr} normal @param {Attr} tangent @param {number} i */
export function tangentAlong(normal, tangent, i) {
  const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i), tx = tangent.getX(i), ty = tangent.getY(i), tz = tangent.getZ(i);
  const cx = ny * tz - nz * ty, cy = nz * tx - nx * tz, cz = nx * ty - ny * tx, n2 = nx * nx + ny * ny + nz * nz, t2 = tx * tx + ty * ty + tz * tz;
  return n2 > 0 && cx * cx + cy * cy + cz * cz <= ALONG * n2 * t2;
}

/**
 * Turns every such tangent square to its normal (toward the axis the normal leans on least), keeping its handedness, 1 where the file left nought.
 * A point with no normal is left alone: nothing can be made of it. Returns how many were turned.
 * @param {Attr} normal @param {Attr} tangent
 */
export function mendTangents(normal, tangent) {
  let mended = 0;
  for (let i = 0; i < tangent.count; i++) {
    if (!tangentAlong(normal, tangent, i)) continue;
    let nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i); const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), a = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
    const d = a[0] * nx + a[1] * ny + a[2] * nz; let tx = a[0] - d * nx, ty = a[1] - d * ny, tz = a[2] - d * nz; const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    tangent.setXYZW(i, tx, ty, tz, tangent.getW(i) || 1); mended++;
  }
  if (mended) tangent.needsUpdate = true;
  return mended;
}
