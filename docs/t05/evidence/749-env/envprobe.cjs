const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
  for (const q of ['?shot=1&level=t05&season=winter&time=day', '?shot=1&season=summer&time=day', '?shot=1&season=autumn&time=dusk']) {
    await p.goto('http://127.0.0.1:8000/' + q);
    await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 300000 });
    console.log(q, JSON.stringify(await p.evaluate(() => ({ probe: globalThis.__envProbe(), moods: globalThis.__envMoods }))));
  }
  await b.close();
})();
