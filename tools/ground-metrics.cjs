// What a picture of the court says about its floor (#467, ART-REVIEW A4): how much happens in the lowest third of the frame.
//   node tools/ground-metrics.cjs a.png b.png …
// Per picture, over the lowest third of its rows (which is paving in every view of the court):
//   lumaStd     standard deviation of the luminance after each row's own mean is taken off (so that the fall of light with
//               distance does not count): how much the floor varies across the picture.
//   edge        the share of pixels whose luminance differs from the next pixel's, across or down, by more than 4/255:
//               the density of edges (joints, flag edges, shadow edges, leaves).
//   rowStd      standard deviation of the rows' own mean luminance: how much the floor varies from the foot of the picture up.
// (How wide the joints read on the screen is not worked out here: it depends on the eye's height and the lens, which a picture
// does not say; tools/joint-rows.cjs asks the page.)
// Reading the picture needs a browser (a canvas decodes it): the same Chromium the other tools use.
const { chromium } = require("playwright");
const fs = require("fs");

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

(async () => {
  const b = await chromium.launch(), p = await b.newPage(), out = {};
  for (const f of files) {
    const data = fs.readFileSync(f).toString("base64");
    out[f] = await p.evaluate(async (data) => {
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
      return { size: [W, H], lumaStd: +Math.sqrt(sum2 / n).toFixed(2), edge: +(edges / (2 * n)).toFixed(4), rowStd: +rowStd.toFixed(2) };
    }, data);
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
