# CLAUDE.md

Follow the shared [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md): use squash merges and Conventional Commits for new commits, PR titles and final squash titles.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-browser walk through a code-generated Zen mountain temple (three.js r186, vendored in `app/v/`). The design brief, scene walkthrough and known gaps are in `README.md` (Chinese). `docs/JINGSHAN.md` records the research on the real Jingshan temple and which "soul elements" each part of the scene stands for; `docs/SALTLINE-TEARDOWN.md` is the rendering reference we measure against. Read `JINGSHAN.md` before changing the plan: every building, name board and prop exists for a reason listed there, and the "有意没有做的" section lists things deliberately left out.

The guiding principle from the README: 画面精美庄严是第一原则 (a beautiful, solemn image comes first). The scene is an original interpretation, not a reconstruction, and the temple name 云径禅寺 is fictional.

## Reference projects

Four outside projects are documented as references:

- **《小王子：星辰之旅》** (<https://littleprince.dev>) is the reference for taste: a quiet, painterly place worth lingering in, with a memorable visual identity rather than technical spectacle. It is a Unity WebGPU desktop game, not a three.js page; `docs/LITTLEPRINCE-TEARDOWN.md` records what its shipped files show and which of its engineering habits are worth copying here.
- **Saltline** (Felix Rieseberg's generated dock-shooter) is the rendering benchmark. `docs/SALTLINE-TEARDOWN.md` explains its pipeline and ends with the intended order of rendering work here: baked textures, an independent backdrop module, then volumetric fog and light before soft shadows. Its gap table is a snapshot from when the project had a single courtyard; the lines about the module split, blank plaques and missing audio are now stale, so read the conclusions rather than the table as current state.
- **Watercolour** (<https://patch.gg/blendi/watercolour>, by @blendi) is the reference for painterly materials, instanced brush marks and deterministic capture. `docs/WATERCOLOUR-TEARDOWN.md` records its paint-arrival map, depth-aware paper pass and what should not be carried into a solemn temple. It is a technical reference, not an approved visual direction.
- **如是我闻 `/zen`** is the source of the Buddha and pedestal models in `app/m/` (`static.rushiwowen.co/models/zen-v2/`, kept decompressed here at about 11 MB). The repository is now public; no redistribution licence for these models is recorded, so they must be confirmed or replaced (README, `docs/t00/asset-register.csv`).

**Art direction.** `docs/ART-SPEC.md` records the art specification the owner pointed to (the project's research atlas, where this temple is entry T00: "quiet realism, light that comes from somewhere", a working palette, material rules, an acceptance list) and where the scene stands against each rule. Check a visual change against it.

**The game is 《山门之外》; this temple is its prologue, T00.** The research atlas wrote a handoff for it (goal, eight deliverables, six fixed cameras, eight acceptance criteria). What we deliver against it lives in `docs/t00/` — run guide, baseline, decisions, camera manifest, reviews, known issues, acceptance report, evidence. The acceptance scope is five zones only: the bamboo start, the stair, the screen wall, the gate, the first court. The baseline look is J01, overcast after rain, which is summer by day. Do not mark an acceptance item passed without run evidence for the commit in question.

**Start with `docs/HANDOFF.md`**: it states what the user has asked for, in their words and in order, what exists, and what to do next.

## Commands

No build step and nothing to install for the app itself. Serve `app/` statically:

```sh
npm run serve                       # = python3 -m http.server 8000 --bind 127.0.0.1 --directory app (this machine only)
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
node tools/cameras.mjs              # write docs/t00/camera-manifest.json from the plan's cam01..cam06
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
`?season=spring|summer|autumn|winter`, `?time=dawn|day|dusk|night`, `?view=first|third`, `?enter` (skip the title),
`?tour=120x3` (the measured walk: bamboo to first court and back for 120 s, three times, after 10 s of warming up; the
page then shows mean frame rate and 95th-percentile frame and offers `performance.json` and `frame-times.csv`). With `?shot`, `?show` or
`?cam` the default is a summer day seen in first person, so old screenshots stay comparable; without them it is the
visitor's own season and hour, seen from behind the novice.

Deploy: pushing to `main` runs `.github/workflows/pages.yml`: `verify` (check, unit tests, e2e quick tier in a real
browser) and then, only if that passes, publishes `app/` as it is to GitHub Pages. `.github/workflows/e2e.yml` runs
every scenario once a week and on demand. A red `verify` means the site was not published: read the uploaded
`e2e-quick-*` artifact (report + screenshots) before guessing.

## Architecture

**One page, one scene.** `app/index.html` holds the canvas and the interface; `app/yard.js` is the whole walk, outdoors and in. Stepping through a hall's door closes a veil (`#veil`), moves the walker into that hall's room, and opens it again.

**Indoors (`app/src/interior.js`).** Every hall the plan marks with `hall: { id, kind, name }` can be entered: `put()` records its door, where to stand on coming out and which way to face (`site.halls`), and `buildInteriors` builds one room for each, side by side sixty metres under the courts, furnished by `kind` (`buddha`, `figure`, `chan`, `tea`, `library`, `patriarch`, `pavilion`). While he is inside, `walker.setRoom(room)` replaces the plan with the room's floor, walls and furniture; the courts are not drawn, the sun is put out and the room's lamps are lit (`indoors()` in `yard.js`). The Buddha and pedestal models (`app/m/*.json`, GLTF as base64) are fetched once and stood in every hall with an altar. Along each room's side walls hang frames: what hangs in one is data, `GALLERY["<hall>-w1"] = { title, text, image }` in `interior.js`, shown when a visitor stands before it and presses E. This is where the story's artworks go. `?in=<hall id>` starts inside a hall.

**Courtyard pipeline (`app/yard.js`).** Creates the renderer, then composes the modules in `app/src/` in a fixed order: `createMaterials` → `buildSite` → `createWalker` → sky → ground → backdrop → bamboo → props → post → trees → drift → `mergeStatic` (everything built so far, batched per material into a few zones along the axis; a mesh that must stay itself sets `userData.keep`) → mood → monk. It owns input (drag to look, tap the floor to walk, tap bell/drum to strike, WASD), the frame loop, and the quality governor. Everything else is a module exposing one `create*`/`build*` function.

**The plan is data (`app/src/site.js`).** `buildSite(M)` places every building with `put(opts, [x, z], quarterTurns, level, baseY)`, which calls `buildHall` and also registers the building's footprint into two side structures that everything else reads:
- `walk` = `{solids, decks, ramps}` rectangles. `createWalker` turns these into `heightAt / blocked / onGround`. Decks and ramps are "carved" floors that override solids, so stairs and platforms are walkable even inside a building's blocking box.
- `shade[level]` rectangles darken the paving under buildings and walls (consumed by `ground.js`).
Adding a building is one `put(...)` call; walkability and ground shading follow automatically. `putStack` builds multi-storey towers by standing each storey on the roof of the one below (`roofAt`). Exported constants `SITE`, `LEVELS` (the three terraces), `APPROACH` (the zigzag stair) and `terrain(x, z)` are shared with `yard.js`, `backdrop.js` and `bamboo.js`, so moving a terrace moves the hillside, the far bamboo and the near bamboo exclusion zones together.

Conventions: 1 unit = 1 m, north/uphill is -z, the visitor arrives from +z, buildings face +z in local space and are rotated by quarter turns. Named camera positions live in `views` at the bottom of `buildSite`; add one for anything new worth looking at, because `shots.js` renders exactly that list.

**One parametric building (`app/src/building.js`).** `buildHall(M, opts)` makes platform, stairs, columns, beams, bracket sets, infill, name board and a curved tiled roof from the `DEFAULTS` table (column lines `xs`/`zs`, `platH`, `colTop`, `overhang`, `rise`, gable depth `G`, `front/back/sides` = lattice|pass|wall|open, etc.). Halls, the gate, bell/drum towers, pavilions, the library and the summit tower are all this one function. It returns the group plus `walk`, `plat`, `frontZ`, `roofAt` that `site.js` relies on.

**Materials: a pattern from the world, fine grain from a scan (`app/src/materials.js`, `glsl.js`, `textures.js`).** `procMat(key, params, body, { tex })` patches `MeshStandardMaterial` so `body` (GLSL) writes `col`, `rough_`, `bump_`, `ao_`, `emit_` and `nd_` (a world-space nudge to the normal) from world position. The large pattern is still worked out in the shader (courses of stone, rows of tile, damp at the foot of a wall); the fine grain comes from scanned surfaces in `app/t/` (Poly Haven, CC0, packed by `tools/textures.py`: `<name>_a.webp` colour, `<name>_n.jpg` normal x/y + roughness), laid on from three sides (`triA`/`triN`) and divided by the scan's own mean colour so the material's colour stays in charge. Until a scan arrives its mean colour stands in, so the first frame is whole. Every mesh drawn with these needs a per-vertex `ao` attribute; `geo.mesh()` bakes it (`bakeAO`), and `geo.merge()` normalises geometries so they can be batched into one draw per material. The paving (`ground.js`) is lit by hand because of its mirror, but takes the sun's shadows from the same shadow map.

**Quality (`app/src/quality.js`).** Three tiers (render scale, pixel budget, MSAA, planar reflection scale, shadow map). Mobile UAs always start on `low`; a governor drops scale → reflection → bloom when frames average over 30 ms. `?q=` pins a tier.

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

**The visit as a pilgrimage (`journey.js`, `game.js`, `goshuin.js`).** `journey.js` is book-keeping only (seven seals,
the bell's three strokes, the library's line, storage under `yunjing.journey.v1`) and is unit-tested in Node.
`site.places` says where each observance is made. `game.js` owns everything a visitor sees of it: the title, the brush
rings on the ground, the action button, how each observance unfolds, the seal toast, the book; it reaches the walk only
through the small object `yard.js` hands it (`walkTo`, `stage`, `strike`, `where`, `onTick`…). `goshuin.js` draws the
page of seals. Hooks: `__journey()`, `__rite(id)`, `__enter()`, `__book()`, `__places`, `__inside(id|null)`, `__halls`, `__gallery`, `__figures()`.

**How it is played.** Keyboard and mouse as in most role-playing games: WASD or arrows walk relative to the view, Shift
hurries, a click on the picture holds the pointer so that the mouse looks round (Esc lets go), the wheel moves the eye
nearer or farther, E (or Enter) does what is offered, Space jumps (or, at the edge of a low unrailed porch, hops down), V changes the view, B opens the book, P photographs,
T opens the season and hour. While the pointer is held a click strikes the bell or drum under the dot. On a touch
screen: a thumb-stick lower left, a drag to look, a tap on the ground to walk there. The key list (`#keys`) shows only
where a fine pointer is likely; the stick (`#stick`) only where a coarse one is.

**Typefaces (`app/f/`, `tools/fonts.py`).** Four faces under the SIL Open Font License, cut down to the characters the
app uses and served with it: "Yunjing Brush" (Ma Shan Zheng: the title, the page of seals), "Yunjing Kai" (LXGW WenKai:
every label and spoken line, and the name boards, which are written in traditional forms), "Yunjing Serif" and
"Yunjing Seal" (Noto Serif SC regular and black). Nothing is fetched from a font service. After adding words, run `python3 tools/fonts.py <dir with the TTFs>`;
`npm run check` fails if a character is used that the cut does not hold.

**The pause menu and what a visitor sets (`app/src/settings.js`, `#menu`).** Esc with nothing else open, or the 歇脚 chip,
opens it: drawing quality (takes effect on the next load), how fast the head turns, inverted look, volume, the key card, and
a way back to the start of the path. The store is modelled on wok-ing-dead's: one key (`yunjing.settings.v1`), every value
validated on the way in, a damaged save ignored. `__settings()` and `__menu(open)` are the hooks.

**What is said about the controls (`app/src/hints.js`).** Nothing about the controls stays on the picture. One line at
the foot of the view says each thing once, when it becomes useful (how to walk on arriving, Esc and the wheel when the
mouse is first held, Shift after a long stroll, the book after the first seal), and leaves. H opens the list of keys.
The season's name and the next place show when they change and when the visitor has stood still a while; the controls
at the edge fade while the mouse rests. Add a hint there, not as permanent text in `index.html`. `__hud()` reports it.

**Test hooks.** `yard.js` sets `document.body.dataset.ready = "1"` after three frames and exposes
`window.__yard()` (position, yaw, pitch, height, tier, target, frames, tris, calls), `__probe()` (draws a frame and
returns its mean colour plus season, hour, view, photo state, camera distance, snow, lamp, fov), `__views`, `__merged`,
`__walk(points)`, `__pose(x, z, yaw, pitch)`, `__mood(season, time)`, `__view(v)`, `__photo(open, opts)`,
`__capture()`, `__strike(kind)`, `__listen()`, `__hud()`, `__tour()`, and `__pick(x, y)`: what lies under a point of the
picture, nearest first (part of the scene, material, distance, whether it is see-through). The tests and tools depend on these; keep them when refactoring, and add
to `__probe` rather than reaching into the page from a test.

## Working notes

- Code comments are in English and written as prose describing the place, not the code; commit messages and PR titles follow Conventional Commits as AGENTS.md sets out; the README and docs are in Chinese. Keep that split.
- Frame cost is measured on a Tesla T4 with `tools/gpu-render.sh`; no phone has been measured. Stairs are walked as treads, not slopes (`carved()` in `site.js`), and the columns of open pavilions are `walk.posts`, which stop him even on a floor that is otherwise all open. On 2026-11-14 the main court cost 8.45 ms at 1080p on the high tier (1.1 M triangles, 372 draws, the temple drawn twice for the mirror) and 4.55 ms on the low tier at a phone's size (550 k, 185 draws, no mirror); the day began at 10.4 and 7.4. The frame is bound by triangles and draw calls, not by pixels, and roofs are still most of the triangles. Later the same day, with rafters, the wood outside the walls and the gate's detail added, the first court cost 9.3 ms on the high tier and 4.7 ms on the low; the measured walk (`?tour=120x3`, high tier, 1080p) averaged 61 frames a second with a 95th-percentile frame of 21 ms. Switching trees or bamboo off changes nothing on that card; the mirror pass is about 1.8 ms and is drawn only on the level of the forecourt and first court. None of this says what a Mac or a phone does.
- `tools/out/` and `tools/*.png` are gitignored; screenshots are for looking at, not committing. `refs/` holds the approved reference images.
- A shader fragment handed to `procMat` is wrapped in one line of braces: it must not end in a `//` comment (`npm run check` guards this).
- The page has no `<!doctype>` or `<head>` of its own; `[hidden]` only works because `index.html` says `[hidden]{display:none !important}`.
- When a shape in a screenshot will not be explained, do not guess at materials: ask `__pick(x, y)` what is there. A pale
  sheet across the gate's roof was chased through tiles, boards, normals and hills for hours; it was a mist sprite
  (`props.js`) hanging in front of the building. Mist sheets stay outside the walls.
- The shadow map is drawn once per mood change (`shadowMap.autoUpdate = false`), so nothing that moves casts a real shadow; the novice stands on a painted one.
