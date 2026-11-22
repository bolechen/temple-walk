const { chromium } = require("playwright"), fs = require("fs");
(async () => {
  const src = fs.readFileSync("/home/user/temple-walk/app/src/bamboo.js", "utf8"), body = src.slice(src.indexOf("function leafTexture"), src.indexOf("const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy"));
  const b = await chromium.launch(), p = await b.newPage();
  const a = await p.evaluate((body) => { const f = new Function(body.replace("function leafTexture() {", "") + "return c;"); const c = f(), d = c.getContext("2d").getImageData(0, 0, 1024, 1024).data, o = new Array(256 * 256).fill(0);
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) o[(y >> 2) * 256 + (x >> 2)] += d[(y * 1024 + x) * 4 + 3] / 255 / 16; return o; }, body);
  fs.writeFileSync(process.argv[2], JSON.stringify(a.map((v) => +v.toFixed(3)))); await b.close();
  console.log("mean alpha", a.reduce((s, v) => s + v, 0) / a.length);
})();
