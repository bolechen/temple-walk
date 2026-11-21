// What a picture of the court says about its floor (#467, ART-REVIEW A4): how much happens in the lowest third of the frame, and
// how wide the joints between the flags read on the screen.
//   node tools/ground-metrics.cjs [--h=<eye height in metres>] [--pitch=<radians down is positive>] [--vfov=<degrees>] a.png b.png …
// Per picture, over the lowest third of its rows (which is paving in every view of the court):
//   lumaStd     standard deviation of the luminance after each row's own mean is taken off (so that the fall of light with
//               distance does not count): how much the floor varies across the picture.
//   edge        the share of pixels whose luminance differs from the next pixel's, across or down, by more than 4/255:
//               the density of edges (joints, flag edges, shadow edges, leaves).
//   rowStd      standard deviation of the rows' own mean luminance: how much the floor varies from the foot of the picture up.
//   jointPx     the width on the screen of a 1 cm joint, worked out from the lens and eye height given (default: 1080p,
//               vfov 50°, eye 1.6 m, level) as the mean over the same rows of the two ways a joint can run: toward the
//               eye (w·f/d) and across (w·f·h/d²), each at least one pixel wide as the drawing makes it. It does not read the
//               picture: it says what width the joints, by their width in the world, take on a screen of this kind.
// Reading the picture needs a browser (a canvas decodes it): the same Chromium the other tools use.
const { chromium } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2), opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.slice(k.length + 3)) : d; };
const files = args.filter((a) => !a.startsWith("--")), eye = opt("h", 1.6), pitch = opt("pitch", 0), vfov = opt("vfov", 50), jointCm = opt("joint", 1.3);

(async () => {
  const b = await chromium.launch(), p = await b.newPage(), out = {};
  for (const f of files) {
    const data = fs.readFileSync(f).toString("base64");
    out[f] = await p.evaluate(async ([data, eye, pitch, vfov, jointCm]) => {
      const img = new Image(); img.src = "data:image/png;base64," + data; await img.decode();
      const W = img.width, H = img.height, c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, W, H).data;
      const L = (x, y) => { const i = (y * W + x) * 4; return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]); };
      const y0 = Math.floor((H * 2) / 3); let n = 0, sum2 = 0, edges = 0; const rowMean = [];
      for (let y = y0; y < H; y++) {
        let m = 0; for (let x = 0; x < W; x++) m += L(x, y); m /= W; rowMean.push(m);
        for (let x = 0; x < W; x++) { const d = L(x, y) - m; sum2 += d * d; n++; if (x + 1 < W && Math.abs(L(x + 1, y) - L(x, y)) > 4) edges++; if (y + 1 < H && Math.abs(L(x, y + 1) - L(x, y)) > 4) edges++; }
      }
      const rm = rowMean.reduce((a, v) => a + v, 0) / rowMean.length, rowStd = Math.sqrt(rowMean.reduce((a, v) => a + (v - rm) ** 2, 0) / rowMean.length);
      // The joint's width on the screen: row y looks down by atan((y - H/2)/f) + pitch below the horizon, so the stone there is at distance d = eye / tan(that).
      const f = H / 2 / Math.tan((vfov * Math.PI) / 360), w = jointCm / 100; let jsum = 0, jn = 0;
      for (let y = y0; y < H; y++) {
        const ang = Math.atan((y + 0.5 - H / 2) / f) + pitch; if (ang <= 0.01) continue;
        const d = eye / Math.tan(ang), along = Math.max(1, (w * f) / d), across = Math.max(1, (w * f * eye) / (d * d + eye * eye));
        jsum += (along + across) / 2; jn++;
      }
      return { size: [W, H], lumaStd: +Math.sqrt(sum2 / n).toFixed(2), edge: +(edges / (2 * n)).toFixed(4), rowStd: +rowStd.toFixed(2), jointPx: jn ? +(jsum / jn).toFixed(2) : null };
    }, [data, eye, pitch, vfov, jointCm]);
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
