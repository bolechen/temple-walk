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

No build step, no `package.json`, no dependencies to install for the app itself. Serve `app/` statically:

```sh
cd app && python3 -m http.server 8000
```

The two tools need Playwright (`npm i -g playwright` or a local install, plus Chromium). Both start their own server and render with SwiftShader, so they run headless with no GPU:

```sh
node tools/shots.js                 # every named view → tools/out/<name>.png, prints tris/calls and page errors
node tools/shots.js gate library    # only those views (names: `views` in app/src/site.js, or window.__views)
node tools/walkthrough-test.js      # end-to-end walk; exits 1 on any failure or page error
```

Run `shots.js` after any visual change and look at the PNGs. Run `walkthrough-test.js` after touching `site.js`, `yard.js`, `index.html`, `hall.js` or `audio.js`: it walks the approach → gate → court → into the hall, offers incense, leaves, taps the hall from the court at real speed, climbs to the summit, and checks the bell's spectrum contains its designed partials (~98/196 Hz). Both are slow under software rendering (minutes); timeouts are already generous.

URL parameters for manual testing: `?show=<view>`, `?cam=x,z,yaw,pitch`, `?fast=1` (walk 14 m/s instead of 2.1), `?shot=1` (freeze time), `?q=low|medium|high` (fix the quality tier, disables the governor).

Deploy: pushing to `main` publishes `app/` as-is to GitHub Pages (`.github/workflows/pages.yml`).

## Architecture

**Two views in one page.** `app/index.html` holds the courtyard canvas and the hall interior, joined by a black/mist veil. It imports `yard.js` immediately and lazy-imports `hall.js` after 2.5 s. The views talk only through window events: `enter-hall` (fired by yard when the walker crosses the main hall's door), `yard-pause`/`yard-resume`, `hall-show`/`hall-hide`. `yard-resume` always re-places the visitor on the porch facing the court.

**Courtyard pipeline (`app/yard.js`).** Creates the renderer, then composes the modules in `app/src/` in a fixed order: `createMaterials` → `buildSite` → `createWalker` → sky → ground → backdrop → bamboo → props → post. It owns input (drag to look, tap the floor to walk, tap bell/drum to strike, WASD), the frame loop, and the quality governor. Everything else is a module exposing one `create*`/`build*` function.

**The plan is data (`app/src/site.js`).** `buildSite(M)` places every building with `put(opts, [x, z], quarterTurns, level, baseY)`, which calls `buildHall` and also registers the building's footprint into two side structures that everything else reads:
- `walk` = `{solids, decks, ramps}` rectangles. `createWalker` turns these into `heightAt / blocked / onGround`. Decks and ramps are "carved" floors that override solids, so stairs and platforms are walkable even inside a building's blocking box.
- `shade[level]` rectangles darken the paving under buildings and walls (consumed by `ground.js`).
Adding a building is one `put(...)` call; walkability and ground shading follow automatically. `putStack` builds multi-storey towers by standing each storey on the roof of the one below (`roofAt`). Exported constants `SITE`, `LEVELS` (the three terraces), `APPROACH` (the zigzag stair) and `terrain(x, z)` are shared with `yard.js`, `backdrop.js` and `bamboo.js`, so moving a terrace moves the hillside, the far bamboo and the near bamboo exclusion zones together.

Conventions: 1 unit = 1 m, north/uphill is -z, the visitor arrives from +z, buildings face +z in local space and are rotated by quarter turns. Named camera positions live in `views` at the bottom of `buildSite`; add one for anything new worth looking at, because `shots.js` renders exactly that list.

**One parametric building (`app/src/building.js`).** `buildHall(M, opts)` makes platform, stairs, columns, beams, bracket sets, infill, name board and a curved tiled roof from the `DEFAULTS` table (column lines `xs`/`zs`, `platH`, `colTop`, `overhang`, `rise`, gable depth `G`, `front/back/sides` = lattice|pass|wall|open, etc.). Halls, the gate, bell/drum towers, pavilions, the library and the summit tower are all this one function. It returns the group plus `walk`, `plat`, `frontZ`, `roofAt` that `site.js` relies on.

**Materials are shaders, not textures (`app/src/materials.js`, `glsl.js`).** `procMat(key, params, body)` patches `MeshStandardMaterial` so `body` (GLSL) writes `col`, `rough_`, `bump_`, `ao_` from world position. Every mesh drawn with these needs a per-vertex `ao` attribute; `geo.mesh()` bakes it (`bakeAO`), and `geo.merge()` normalises geometries so they can be batched into one draw per material. Prefer merging static geometry per material over many meshes.

**Quality (`app/src/quality.js`).** Three tiers (render scale, pixel budget, MSAA, planar reflection scale, shadow map). Mobile UAs always start on `low`; a governor drops scale → reflection → bloom when frames average over 30 ms. `?q=` pins a tier.

**Hall interior (`app/hall.js`).** A single painted plate (`plate.webp`) with a 3D statue and pedestal (`app/m/*.json`, GLTF) composited at a fixed camera. The camera constants at the top of the file are calibrated to the plate's pixel geometry; a new plate means re-deriving them. The statue model comes from an external scene and is the reason the README asks that the repo stay private.

**Test hooks.** `yard.js` sets `document.body.dataset.ready = "1"` after three frames and exposes `window.__yard()` (position, height, tier, tris, calls), `__views`, `__walk(points)`, `__strike(kind)`, `__listen()`. The tools depend on these; keep them when refactoring.

## Working notes

- Code comments and commit messages are in English and written as prose describing the place, not the code; the README and docs are in Chinese. Keep that split.
- Only headless software rendering has ever been tested. Real-device frame rate is unknown; anything that adds geometry near the bamboo or the planar reflection is the first suspect for performance.
- `tools/out/` and `tools/*.png` are gitignored; screenshots are for looking at, not committing. `refs/` holds the approved reference images.
