# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-browser walk through a code-generated Zen mountain temple (three.js r186, vendored in `app/v/`). The design brief, scene walkthrough and known gaps are in `README.md` (Chinese). `docs/JINGSHAN.md` records the research on the real Jingshan temple and which "soul elements" each part of the scene stands for; `docs/SALTLINE-TEARDOWN.md` is the rendering reference we measure against. Read `JINGSHAN.md` before changing the plan: every building, name board and prop exists for a reason listed there, and the "有意没有做的" section lists things deliberately left out.

The guiding principle from the README: 画面精美庄严是第一原则 (a beautiful, solemn image comes first). The scene is an original interpretation, not a reconstruction, and the temple name 云径禅寺 is fictional.

## Reference projects

Four outside projects are documented as references:

- **《小王子：星辰之旅》** (<https://littleprince.dev>) is the reference for taste: a quiet, painterly place worth lingering in, with a memorable visual identity rather than technical spectacle. It is a Unity WebGPU desktop game, not a three.js page; `docs/LITTLEPRINCE-TEARDOWN.md` records what its shipped files show and which of its engineering habits are worth copying here.
- **Saltline** (Felix Rieseberg's generated dock-shooter) is the rendering benchmark. `docs/SALTLINE-TEARDOWN.md` explains its pipeline and ends with the intended order of rendering work here: baked textures, an independent backdrop module, then volumetric fog and light before soft shadows. Its gap table is a snapshot from when the project had a single courtyard; the lines about the module split, blank plaques and missing audio are now stale, so read the conclusions rather than the table as current state.
- **Watercolour** (<https://patch.gg/blendi/watercolour>, by @blendi) is the reference for painterly materials, instanced brush marks and deterministic capture. `docs/WATERCOLOUR-TEARDOWN.md` records its paint-arrival map, depth-aware paper pass and what should not be carried into a solemn temple. It is a technical reference, not an approved visual direction.
- **如是我闻 `/zen`** is the source of the Buddha and pedestal models in `app/m/` (`static.rushiwowen.co/models/zen-v2/`, kept decompressed here at about 11 MB). That provenance is why the README asks that this repo stay private.

**Start with `docs/HANDOFF.md`**: it states what the user has asked for, in their words and in order, what exists, and what to do next.

## Commands

No build step and nothing to install for the app itself. Serve `app/` statically:

```sh
npm run serve                       # = cd app && python3 -m http.server 8000
```

The root `package.json` only names the commands; it has no dependencies. The tests and tools need Node 22+ and
Playwright with Chromium (`npm i -g playwright`, or whatever the machine already has). They start their own server
and render with SwiftShader, so everything runs headless with no GPU.

```sh
npm run check                       # every script in app/ parses; no shader fragment ends in a // comment
npm test                            # unit tests, a second or two: the plan, the walker, the building generator, the seasons
npm run e2e:quick                   # tier 1, ~1 min: the page comes up clean and draws
npm run e2e:smoke                   # tiers 1–2, ~9 min: + a tap walks him there on every level, bell and drum, all 16 season/hour moods, both views, a phone
npm run e2e                         # everything, ~20 min: + the walk in and the offering, the summit climb, the photograph
node tests/e2e/run.cjs moods photo  # only the scenarios named
npm run verify                      # check + unit + smoke: run this before pushing anything that touches app/
node tools/shots.js court@autumn-dusk@third gate   # named views → tools/out/*.png (view@season-hour@first|third), prints tris/calls
node tools/portrait.js autumn-dusk  # five close views of the novice → tools/out/portrait.png
tools/gpu-render.sh [flavor] ['<json spec>']   # the same pictures, and real frame rates, on a GPU (see below)
python3 tools/textures.py <dir of Poly Haven jpgs>   # repack the scanned surfaces into app/t/
```

**A real graphics card (`tools/gpu-render.sh`, `tools/gpu/job.cjs`).** Software rendering cannot say how fast the
page is. The script syncs `app/` (without the hall's statue models) to a private Hugging Face bucket, starts a
Hugging Face Job with a GPU (default one T4, about $0.40 an hour; a run takes a few minutes), opens the page there in
Chromium on Vulkan, and brings back `tools/out/gpu/<run>/report.json` and PNGs. It needs the `hf` command logged in
to an account that may run Jobs. Each measurement reports frames per second and, more usefully, `cost`: milliseconds
to draw one frame with the card made to finish it (`window.__cost()`), which leaves out the headless browser's own
presenting (about 10 ms a frame there). `?off=site,bamboo,reflect,bloom,…` switches parts of the scene off so their
cost can be measured one at a time; `window.__census()` says what each part weighs in triangles. Measure before and
after anything that adds geometry or a pass, and write the numbers into `docs/HANDOFF.md`.

**Tests are part of every change.** The unit tests in `tests/unit/` build the real plan in Node (three.js with a
stubbed DOM, `dom-stub.mjs`) and assert on it: every named place can be walked to from the first step
(a flood fill over `heightAt/blocked`), nothing leaks through the walls, stairs have even treads, every named view
stands on walkable ground, every mood has every field. The end-to-end scenarios in `tests/e2e/run.cjs` drive the real
page and fail on any page error, console error, failed request or HTTP error; `tests/e2e/lib.cjs` holds what they share.
When you add something a visitor can do, add a scenario (or extend one) that does it; when you add a place, add it to
`places` in `plan.test.mjs`; when you fix a bug, first make a test fail for it. Wait on frames (`t.frames(n)`), never on
seconds: software rendering may draw one frame a second or ten.

Run `shots.js` after any visual change and look at the PNGs; a test passing says nothing about beauty.

URL parameters for manual testing: `?show=<view>`, `?cam=x,z,yaw,pitch`, `?fast=1` (walk 14 m/s instead of 2.1),
`?shot=1` (freeze time, hide the controls), `?q=low|medium|high` (fix the quality tier, disables the governor),
`?season=spring|summer|autumn|winter`, `?time=dawn|day|dusk|night`, `?view=first|third`. With `?shot`, `?show` or
`?cam` the default is a summer day seen in first person, so old screenshots stay comparable; without them it is the
visitor's own season and hour, seen from behind the novice.

Deploy: pushing to `main` runs `.github/workflows/pages.yml`: `verify` (check, unit tests, e2e quick tier in a real
browser) and then, only if that passes, publishes `app/` as it is to GitHub Pages. `.github/workflows/e2e.yml` runs
every scenario once a week and on demand. A red `verify` means the site was not published: read the uploaded
`e2e-quick-*` artifact (report + screenshots) before guessing.

## Architecture

**Two views in one page.** `app/index.html` holds the courtyard canvas and the hall interior, joined by a black/mist veil. It imports `yard.js` immediately and lazy-imports `hall.js` after 2.5 s. The views talk only through window events: `enter-hall` (fired by yard when the walker crosses the main hall's door), `yard-pause`/`yard-resume`, `hall-show`/`hall-hide`. `yard-resume` always re-places the visitor on the porch facing the court.

**Courtyard pipeline (`app/yard.js`).** Creates the renderer, then composes the modules in `app/src/` in a fixed order: `createMaterials` → `buildSite` → `createWalker` → sky → ground → backdrop → bamboo → props → post → trees → drift → `mergeStatic` (everything built so far, batched per material into a few zones along the axis; a mesh that must stay itself sets `userData.keep`) → mood → monk. It owns input (drag to look, tap the floor to walk, tap bell/drum to strike, WASD), the frame loop, and the quality governor. Everything else is a module exposing one `create*`/`build*` function.

**The plan is data (`app/src/site.js`).** `buildSite(M)` places every building with `put(opts, [x, z], quarterTurns, level, baseY)`, which calls `buildHall` and also registers the building's footprint into two side structures that everything else reads:
- `walk` = `{solids, decks, ramps}` rectangles. `createWalker` turns these into `heightAt / blocked / onGround`. Decks and ramps are "carved" floors that override solids, so stairs and platforms are walkable even inside a building's blocking box.
- `shade[level]` rectangles darken the paving under buildings and walls (consumed by `ground.js`).
Adding a building is one `put(...)` call; walkability and ground shading follow automatically. `putStack` builds multi-storey towers by standing each storey on the roof of the one below (`roofAt`). Exported constants `SITE`, `LEVELS` (the three terraces), `APPROACH` (the zigzag stair) and `terrain(x, z)` are shared with `yard.js`, `backdrop.js` and `bamboo.js`, so moving a terrace moves the hillside, the far bamboo and the near bamboo exclusion zones together.

Conventions: 1 unit = 1 m, north/uphill is -z, the visitor arrives from +z, buildings face +z in local space and are rotated by quarter turns. Named camera positions live in `views` at the bottom of `buildSite`; add one for anything new worth looking at, because `shots.js` renders exactly that list.

**One parametric building (`app/src/building.js`).** `buildHall(M, opts)` makes platform, stairs, columns, beams, bracket sets, infill, name board and a curved tiled roof from the `DEFAULTS` table (column lines `xs`/`zs`, `platH`, `colTop`, `overhang`, `rise`, gable depth `G`, `front/back/sides` = lattice|pass|wall|open, etc.). Halls, the gate, bell/drum towers, pavilions, the library and the summit tower are all this one function. It returns the group plus `walk`, `plat`, `frontZ`, `roofAt` that `site.js` relies on.

**Materials: a pattern from the world, fine grain from a scan (`app/src/materials.js`, `glsl.js`, `textures.js`).** `procMat(key, params, body, { tex })` patches `MeshStandardMaterial` so `body` (GLSL) writes `col`, `rough_`, `bump_`, `ao_`, `emit_` and `nd_` (a world-space nudge to the normal) from world position. The large pattern is still worked out in the shader (courses of stone, rows of tile, damp at the foot of a wall); the fine grain comes from scanned surfaces in `app/t/` (Poly Haven, CC0, packed by `tools/textures.py`: `<name>_a.webp` colour, `<name>_n.jpg` normal x/y + roughness), laid on from three sides (`triA`/`triN`) and divided by the scan's own mean colour so the material's colour stays in charge. Until a scan arrives its mean colour stands in, so the first frame is whole. Every mesh drawn with these needs a per-vertex `ao` attribute; `geo.mesh()` bakes it (`bakeAO`), and `geo.merge()` normalises geometries so they can be batched into one draw per material. The paving (`ground.js`) is lit by hand because of its mirror, but takes the sun's shadows from the same shadow map.

**Quality (`app/src/quality.js`).** Three tiers (render scale, pixel budget, MSAA, planar reflection scale, shadow map). Mobile UAs always start on `low`; a governor drops scale → reflection → bloom when frames average over 30 ms. `?q=` pins a tier.

**Hall interior (`app/hall.js`).** A single painted plate (`plate.webp`) with a 3D statue and pedestal (`app/m/*.json`, GLTF) composited at a fixed camera. The camera constants at the top of the file are calibrated to the plate's pixel geometry; a new plate means re-deriving them. The statue model comes from an external scene and is the reason the README asks that the repo stay private.

**The season and the hour (`app/src/mood.js`).** `moodOf(season, time)` returns one table of numbers (sun, sky, fog,
grade, snow, wetness, lamp light, leaf colours, what drifts in the air, the verse for the photograph). `yard.js`'s
`setMood` hands it to every module's `setMood(m)`; nothing else decides how a season looks. The uniforms in `glsl.js`
(`U`), `FOG` and `SUN_DIR` are shared by reference and must be mutated in place.

**The novice and the two views (`app/src/monk.js`, the camera block in `yard.js`).** `createMonk()` returns `group` and
`update(dt, speed, pray, t)`; replacing the hand-built figure with a rigged model touches nothing else. In third person
the eye follows a few steps behind and is pulled in along its line when `walker.blocked` says a wall is in the way.

**A tap on the ground (`pickFloor` in `yard.js`).** The line of sight is marched outward until it first dips below
`walker.heightAt`, so a tap lands where it was aimed on terraces and stairs, not on a plane at the foot of the mountain.

**The photograph (`capture()` in `yard.js`, `app/src/card.js`, the DOF pass in `post.js`).** Photograph mode frames the
view (tall, square, wide; three lenses), a tap chooses what is sharp, and the shutter re-renders the framed region at
1600 or 2160 px and mounts it on a card with the mood's verse, the temple's name and a seal.

**Trees, drifting things (`trees.js`, `drift.js`).** The trees that show the season and the petals, leaves, snow and
fireflies in the air; both are driven only by the mood.

**Test hooks.** `yard.js` sets `document.body.dataset.ready = "1"` after three frames and exposes
`window.__yard()` (position, yaw, pitch, height, tier, target, frames, tris, calls), `__probe()` (draws a frame and
returns its mean colour plus season, hour, view, photo state, camera distance, snow, lamp, fov), `__views`, `__merged`,
`__walk(points)`, `__pose(x, z, yaw, pitch)`, `__mood(season, time)`, `__view(v)`, `__photo(open, opts)`,
`__capture()`, `__strike(kind)`, `__listen()`. The tests and tools depend on these; keep them when refactoring, and add
to `__probe` rather than reaching into the page from a test.

## Working notes

- Code comments and commit messages are in English and written as prose describing the place, not the code; the README and docs are in Chinese. Keep that split.
- Frame cost is measured on a Tesla T4 with `tools/gpu-render.sh`; no phone has been measured. On 2026-11-14 the main court cost 10.4 ms at 1080p on the high tier and 7.4 ms on the low tier at a phone's size: it is bound by triangles (1.5 M a frame, the whole temple drawn twice for the mirror) and draw calls (about 500), not by pixels. Roofs are two thirds of the temple's triangles.
- `tools/out/` and `tools/*.png` are gitignored; screenshots are for looking at, not committing. `refs/` holds the approved reference images.
- A shader fragment handed to `procMat` is wrapped in one line of braces: it must not end in a `//` comment (`npm run check` guards this).
- The page has no `<!doctype>` or `<head>` of its own; `[hidden]` only works because `index.html` says `[hidden]{display:none !important}`.
- The shadow map is drawn once per mood change (`shadowMap.autoUpdate = false`), so nothing that moves casts a real shadow; the novice stands on a painted one.
