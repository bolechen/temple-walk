// The page's own camera for view e at 1920x1080, and where on the picture the boards over the top fill light and 3 m from it lie.
const path = require("path"), top = process.cwd(), THREE = require(path.join(top, "node_modules/three/build/three.cjs"));
const { site, serve } = require(path.join(top, "tools/site.cjs")); const { chromium } = require(path.join(top, "node_modules/playwright"));
(async () => {
  const srv = await serve(site()); const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, locale: "zh-CN" })).newPage();
  await page.goto(`${srv.base}?level=t05&shot=1&q=high&view=first&show=${process.argv[3] || "e"}`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  const f = await page.evaluate(() => ({ ...window.__frame(), fov: window.__probe().fov }));
  // what is first met straight up from a point on the floor: the board over it
  const up = async (x, z) => page.evaluate(([x, z]) => { const p = window.__pick; return null; }, [x, z]);
  const cam = new THREE.PerspectiveCamera(f.fov, 1920 / 1080, 0.1, 1000); cam.position.fromArray(f.eye); cam.rotation.set(f.look[1], f.look[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const px = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [Math.round((v.x + 1) / 2 * 1920), Math.round((1 - v.y) / 2 * 1080), v.z < 1]; };
  await page.screenshot({ path: process.argv[2] + ".png" });
  require("fs").writeFileSync(process.argv[2] + ".json", JSON.stringify({ f, px: { over: px(...JSON.parse(process.env.OVER)), off: JSON.parse(process.env.OFF).map((p) => px(...p)) } }));
  await b.close(); srv.close();
})();
