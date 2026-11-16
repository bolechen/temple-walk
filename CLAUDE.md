# CLAUDE.md

Follow the shared [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md): use squash merges and Conventional Commits for new commits, PR titles and final squash titles.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-browser walk through a code-generated Zen mountain temple (three.js r186, a pnpm dependency bundled by Vite). The design brief, scene walkthrough and known gaps are in `README.md` (Chinese). `docs/JINGSHAN.md` records the research on the real Jingshan temple and which "soul elements" each part of the scene stands for; `docs/SALTLINE-TEARDOWN.md` is the rendering reference we measure against. Read `JINGSHAN.md` before changing the plan: every building, name board and prop exists for a reason listed there, and the "有意没有做的" section lists things deliberately left out.

The guiding principle from the README: 画面精美庄严是第一原则 (a beautiful, solemn image comes first). The scene is an original interpretation, not a reconstruction, and the temple name 云径禅寺 is fictional.

## Reference projects

Four outside projects are documented as references:

- **《小王子：星辰之旅》** (<https://littleprince.dev>) is the reference for taste: a quiet, painterly place worth lingering in, with a memorable visual identity rather than technical spectacle. It is a Unity WebGPU desktop game, not a three.js page; `docs/LITTLEPRINCE-TEARDOWN.md` records what its shipped files show and which of its engineering habits are worth copying here.
- **Saltline** (Felix Rieseberg's generated dock-shooter) is the rendering benchmark. `docs/SALTLINE-TEARDOWN.md` explains its pipeline and ends with the intended order of rendering work here: baked textures, an independent backdrop module, then volumetric fog and light before soft shadows. Its gap table is a snapshot from when the project had a single courtyard; the lines about the module split, blank plaques and missing audio are now stale, so read the conclusions rather than the table as current state.
- **Watercolour** (<https://patch.gg/blendi/watercolour>, by @blendi) is the reference for painterly materials, instanced brush marks and deterministic capture. `docs/WATERCOLOUR-TEARDOWN.md` records its paint-arrival map, depth-aware paper pass and what should not be carried into a solemn temple. It is a technical reference, not an approved visual direction.
- **如是我闻 `/zen`** is the source of the Buddha and pedestal models in `app/shared/models/` (`static.rushiwowen.co/models/zen-v2/`). They are kept in git as published (about 3.9 MB, meshopt and Basis packed; `tools/setup.mjs` records where they come from and checks their hashes) because that CDN refuses GitHub's runners, so a publication cannot fetch them; the page opens them with three's meshopt and Basis decoders. On 2026-11-15 the owner confirmed they own these models and that they may ship with this project (README, `docs/t00/asset-register.csv`).

**Art direction.** `docs/ART-SPEC.md` records the art specification the owner pointed to (the project's research atlas, where this temple is entry T00: "quiet realism, light that comes from somewhere", a working palette, material rules, an acceptance list) and where the scene stands against each rule. Check a visual change against it.

**The game is 《山门之外》; this temple is its prologue, T00.** The research atlas wrote a handoff for it (goal, eight deliverables, six fixed cameras, eight acceptance criteria). What we deliver against it lives in `docs/t00/` — run guide, baseline, decisions, camera manifest, reviews, known issues, acceptance report, evidence. The acceptance scope is five zones only: the bamboo start, the stair, the screen wall, the gate, the first court. The baseline look is J01, overcast after rain, which is summer by day. Do not mark an acceptance item passed without run evidence for the commit in question.

**Start with `docs/HANDOFF.md`**: it states what the user has asked for, in their words and in order, what exists, and what to do next.

## Commands

The page is ES modules developed and built with Vite; three.js is imported as `"three"` / `"three/addons/…"` and comes with the install:

```sh
pnpm install                        # dependencies, then tools/setup.mjs: the Basis transcoder copied to app/vendor/basis/, the statues' hashes checked
pnpm dev                            # Vite's dev server on 127.0.0.1:8000 (this machine only)
pnpm build                          # the site as published → dist/ (git-ignored); `pnpm preview` serves it
pnpm typecheck                      # tsc with checkJs over all of app/ (yard.js and every module in src/), against three's own types (@types/three)
```

**Where things live.** `app/src/` is the code. What belongs to a level sits under `app/levels/<level>/`: for the
prologue, `app/levels/t00/gallery/` (the real works in its halls) and `boards/` (hands cut for its name boards).
What any level may use is in `app/shared/`; what the interface says, in each language, is in `app/locales/<lang>.js` (a level's own words,
such as its works' cards, are in `app/levels/<level>/locales/<lang>.js`): `fonts/` (the typefaces), `textures/` (the scanned surfaces the
materials are grained with) and `models/` (the statue and its pedestal). `app/vendor/` is what the install copies out of `node_modules` and is ignored by git.
A resource that can be had again from where it came from, by the machines that publish the site as well as by a
person (a library from the registry), is fetched by `tools/setup.mjs` rather than committed; one that was worked on here (a packed texture, a cut
typeface, a cropped picture) is committed with the tool that made it. The page's documents live in `docs/<level>/`.

**The built site is what is tested and published.** The end-to-end tests, `shots.js`, `portrait.js`, `inside.cjs` and the GPU job open `dist/`, not
`app/`: `tools/site.cjs` rebuilds it first whenever anything in `app/` is newer than the last build. What the page fetches by name
(textures, models, gallery pictures, board hands, the Basis transcoder) is found from the page's own address through `asset()` in
`app/src/assets.js` and copied into `dist/` as it lies (`KEPT` in `vite.config.mjs`); never write `new URL("../…", import.meta.url)` for such a
file, because a bundled script no longer sits where its source did. The unit tests and Node tools import `app/src/*.js` directly.

`package.json` names the commands and two dependencies: `three` and, for the tests, `playwright` (pinned to the
version whose Chromium the machines already hold; get the browser once with `pnpm exec playwright install chromium`).
The tests and tools need Node 22+. They start their own server
and render with SwiftShader, so everything runs headless with no GPU.

```sh
pnpm run check                      # every script in app/ parses; no shader fragment ends in a // comment
pnpm test                           # unit tests, a second or two: the plan, the walker, the building generator, the seasons
pnpm run e2e:quick                   # tier 1, ~1 min: the page comes up clean and draws
pnpm run e2e:smoke                   # tiers 1–2, ~9 min: + a tap walks him there on every level, bell and drum, all 16 season/hour moods, both views, a phone
pnpm run e2e                        # everything, ~20 min: + the walk in and the offering, the summit climb, the photograph
node tests/e2e/run.cjs moods photo  # only the scenarios named
pnpm run verify                     # check + unit + smoke: run this before pushing anything that touches app/
node tools/shots.js court@autumn-dusk@third gate   # named views → tools/out/*.png (view@season-hour@first|third), prints tris/calls
node tools/inside.cjs tools/out '[{"hall":"main","name":"caisson","abs":[120,-2,0,1.05]}]'   # views inside a hall (pose in the room), which shots.js cannot reach
node tools/inside.cjs tools/out/hall-views --views [level]   # every indoor view a level registers in app/levels/<level>/hall-views.js (default t00)
node tools/portrait.js autumn-dusk  # five close views of the novice, found by __probe().monkBox → tools/out/portrait.png (add `bind` for his A-pose, `sculpt` for the sculpted body)
NOVICE_WELD=8 node tools/novice.mjs <Meshy .glb>  # rebuild his sculpted body, app/shared/models/novice.glb, from the Meshy export (thinned, cut into four parts, weights from the figure built in code, one weight to a point); its SHA-256 is in docs/t00/asset-register.csv
node tools/novice-views.cjs [--glb=<file>|--code]  # either body in five poses from four sides on a bare stage, ~20 s → tools/out/novice-views-*.png
pnpm run edges                      # ~95 s: does his whole body fit everywhere his feet may go, above the knee and (shoes, hem) below it? (add --spots to list where it does not)
pnpm run nearplane                  # ~80 s: the camera's near plane cuts into nothing along the routes and porches, behind him and from his eyes
node tests/e2e/run.cjs rites        # the bell, tea, a stool, incense and a cushion, at the pace a visitor sees them (~3 min)
node tests/e2e/run.cjs seats        # every cushion and stool sat on, hurrying, the place not drawn
node tools/play-t00.cjs [outdir] [summit bell tea phone]   # play-throughs at a visitor's pace by real keys and taps, filmed, every press logged (__pose to get there is marked diagnostic)
node tools/mobile-audit.cjs         # every surface of the interface as a phone sees it → tools/out/mobile/*.png; exits 1 on a control under 44 px, text under 12 px, anything off screen
node tools/cameras.mjs              # write docs/t00/camera-manifest.json from the plan's cam01..cam06
node tools/music.mjs [summer-day]   # the score along a ten-minute walk → tools/out/music/*.mp3 + report.json (peak, silences, phrase log, tuning)
node tools/steps.mjs                # his steps (steps.js): dry stone, after rain with puddles, snow, a hall's floor → tools/out/steps/*.mp3
tools/gpu-render.sh [flavor] ['<json spec>']   # the same pictures, and real frame rates, on a GPU (see below)
python3 tools/textures.py <dir of Poly Haven jpgs>   # repack the scanned surfaces into app/shared/textures/
```

**A real graphics card (`tools/gpu-render.sh`, `tools/gpu/job.cjs`).** Software rendering cannot say how fast the
page is. The script syncs `app/` (without the hall's statue models) to a private Hugging Face bucket, starts a
Hugging Face Job with a GPU (default one T4, about $0.40 an hour; a run takes a few minutes), opens the page there in
Chromium on Vulkan, and brings back `tools/out/gpu/<run>/report.json` and PNGs. It needs the `hf` command logged in
to an account that may run Jobs. Each measurement reports frames per second and, more usefully, `cost`: milliseconds
to draw one frame with the card made to finish it (`window.__cost()`), which leaves out the headless browser's own
presenting (about 10 ms a frame there). `?off=site,bamboo,reflect,bloom,…` switches parts of the scene off so their
cost can be measured one at a time; `window.__census()` says what each part weighs in triangles. Each run stages its site under `runs/<run>/` in the bucket (two sessions syncing the same folder once overwrote each other's site mid-job), and `report.json`'s `site` says whose code drew the pictures: the commit (`+dirty` if `app/` had uncommitted changes), the page's bundled entry and one SHA-256 over every file sent. Measure before and
after anything that adds geometry or a pass, and write the numbers into `docs/HANDOFF.md`.

**Tests are part of every change.** The unit tests in `tests/unit/` build the real plan in Node (three.js with a
stubbed DOM, `dom-stub.mjs`) and assert on it: every named place can be walked to from the first step
(a flood fill over `heightAt/blocked`), nothing leaks through the walls, stairs have even treads, every named view
stands on walkable ground, every mood has every field. The end-to-end scenarios in `tests/e2e/run.cjs` drive the real
page and fail on any page error, console error, failed request or HTTP error; `tests/e2e/lib.cjs` holds what they share.
A scenario that asks what the page does and never looks at the picture is opened with `+ BARE` (the place built but not
drawn: `?off=` hides parts and unbuilds nothing), which runs it about three times faster under software rendering; one
that looks at the picture (`boot`, `halls`, `snow`, `moods`, `views`, `photo`, `photo-ui`, `menu`, `parts`, `rites`, `stairs`, `drop`) draws all of it.
When you add something a visitor can do, add a scenario (or extend one) that does it; when you add a place, add it to
`places` in `plan.test.mjs`; when you fix a bug, first make a test fail for it. Wait on frames (`t.frames(n)`), never on
seconds: software rendering may draw one frame a second or ten.

Run `shots.js` after any visual change and look at the PNGs; a test passing says nothing about beauty.

URL parameters for manual testing: `?show=<view>`, `?cam=x,z,yaw,pitch`, `?fast=1` (walk 14 m/s instead of 2.1),
`?shot=1` (freeze time, hide the controls), `?q=low|medium|high` (fix the quality tier, disables the governor),
`?season=spring|summer|autumn|winter`, `?time=dawn|day|dusk|night`, `?view=first|third`, `?enter` (skip the title),
`?debug` (open by itself on the dev server and on a pull request's preview, `?debug=0` keeps it shut; the published site never loads it; `app/src/debug.js`: a lil-gui panel that reads and drives the hooks below — position and named or room views, season, hour, tier, `__cost`/`__census`, the level's completion (`__journey`/`__visit`), and `__part()` switches for each part and pass; the backtick key shows or hides it), on the workbench (the dev server and a pull request's preview, the same gate; the published site ignores them) `?seals=all|none|bell,tea…` (a book for that visit only, kept in memory, never stored), `?at=<place id>` (steps in and stands him there) and `?play=ending|<observance>` (and begins it there: the close on the summit mat, or bell, tea, incense, sutra, well, lamp, sit; `game.js`), `?devpose` (the dev server only, `app/src/devpose.js`: the address follows him as `cam`, view, season, hour and `in`, so a reload after a code change puts him back where he stood; C copies the link; the published build leaves it out), `?tour=120x3` (the measured walk: bamboo to first court and back for 120 s, three times, after 10 s of warming up; the
page then shows mean frame rate and 95th-percentile frame and offers `performance.json` and `frame-times.csv`). With `?shot`, `?show` or
`?cam` the default is a summer day seen in first person, so old screenshots stay comparable; without them it is the
visitor's own season and hour, seen from behind the novice.

Deploy: pushing to `main` runs `.github/workflows/pages.yml`: `verify` (install, check, type check, unit tests, build, and the `boot`
scenario in a real browser) and then, only if that passes, publishes `dist/` to GitHub
Pages. A push that touches nothing the site is made of (documents, delivery papers) is checked and publishes nothing.
The slower scenarios (`stairs drop`, with `pnpm run edges`) run beside each publication in `.github/workflows/e2e.yml`, not in its
way, and do not repeat the parse, type and unit checks `verify` has just made; the same workflow runs every scenario once a week and on demand, shared among four machines (`--shard=i/4`). A red `verify` means the site was not published: read the uploaded
`e2e-quick-*` artifact (report + screenshots) before guessing.

## Architecture

**One page, one scene.** `app/index.html` holds the canvas and the interface; `app/yard.js` is the whole walk, outdoors and in. Stepping through a hall's door closes a veil (`#veil`), moves the walker into that hall's room, and opens it again.

**Indoors (`app/src/interior.js`).** Every hall the plan marks with `hall: { id, kind, name }` can be entered: `put()` records its door, where to stand on coming out and which way to face (`site.halls`), and `buildInteriors` builds one room for each, side by side sixty metres under the courts, furnished by `kind` (`buddha`, `figure`, `chan`, `tea`, `library`, `patriarch`, `pavilion`). What stands and hangs overhead is `app/src/framing.js`: the room's columns stand on the building's own column lines (`hall.xs/zs`, scaled into the room), leaving out any that would stand on the dais, in the way to the altar or before a frame; crescent beams run front to back on their cap blocks and into brackets in the walls; and the ceiling follows the kind (`CEILING`): coffered with a caisson over the figure, plain small squares in the library, or the roof open to the rafters. `room.frame` holds it as data and `tests/unit/interior.test.mjs` checks that every column carries a beam, every beam rests on something, and every frame and the altar can still be walked to. While he is inside, `walker.setRoom(room)` replaces the plan with the room's floor, walls and furniture; the courts are not drawn, the sun is put out and the room's lamps are lit (`indoors()` in `yard.js`). The Buddha and pedestal models (`app/shared/models/*.glb`, as published: meshopt and Basis packed) are fetched once and stood in every hall with an altar. Along each room's side walls hang frames (the first in each hall holds a small ink painting drawn by `app/src/leaves.js`): what hangs in one is data, `GALLERY["<hall>-w1"] = { title, text, image }` in `interior.js`, shown when a visitor stands before it and presses E. Beside the great Buddha and in three other halls stand scans of real sculpture that two museums publish as public domain (`STAND` in `interior.js` says which stands where; `app/shared/models/`, thinned and vertex-painted by `tools/statues.py`; fetched when a hall is first entered; `__statues()` reports them). They are placeholders until the project carves its own, and `docs/JINGSHAN.md` says which only stand in for another figure. This is where the story's artworks go. Beside the leaves hang real works (`app/levels/t00/works.js` and `app/levels/t00/gallery/`, both written by `tools/gallery.py` from openly licensed museum records; `HANG` there says which hall): standing before one and pressing E opens a card (`#piece`) with the picture, an encyclopedia note and the museum's source line, which must stay with it. `__work(slug)` opens one; `__work()` reports it. `?in=<hall id>` starts inside a hall. The indoor cameras (a view of each hall's furniture and one of its ceiling) are `HALL_VIEWS` in `app/levels/t00/hall-views.js`, separate from the six locked acceptance views in `site.views`; `node tools/inside.cjs tools/out/hall-views --views t00` draws all sixteen (the level is the folder under `app/levels/`; a later temple keeps its own table there and passes its own name), and `hallViewURL` makes a one-click address for one.

**Courtyard pipeline (`app/yard.js`).** Creates the renderer, then composes the modules in `app/src/` in a fixed order: `createMaterials` → `buildSite` → `createWalker` → sky → ground → backdrop → bamboo → props → post → trees → drift → `mergeStatic` (everything built so far, batched per material into a few zones along the axis; a mesh that must stay itself sets `userData.keep`) → mood → monk. It owns input (drag to look, tap the floor to walk, tap bell/drum to strike, WASD), the frame loop, and the quality governor. Everything else is a module exposing one `create*`/`build*` function.

**The plan is data (`app/src/site.js`).** `buildSite(M)` places every building with `put(opts, [x, z], quarterTurns, level, baseY)`, which calls `buildHall` and also registers the building's footprint into two side structures that everything else reads:
- `walk` = `{solids, decks, ramps}` rectangles. `createWalker` turns these into `heightAt / blocked / onGround`. Decks and ramps are "carved" floors that override solids, so stairs and platforms are walkable even inside a building's blocking box.
  `walk.roofs` is what only the eye must keep out of: each building's eave footprint with the heights its beams,
  tiles and ridge take up, its walls (`core`) and its platform (`body`, `edge`); `walk.drops` are the porch edges he may hop down from.
  `walk.posts` stand in the way even on a carved floor: a round one is `{x, z, r}` with its real radius (every outer column of every building), a square one a rectangle drawn already larger than the thing (a table on a porch, the cheek of a stair).
- **He has a width.** The walker moves a point, but the novice reaches `BODY` (0.38 m, `geo.js`) from it. Whatever stands in his way must keep that point its own shape plus `BODY` off: a round post gets it added by the walker; a solid, a deck's edge or a square post must be drawn with it. A unit test holds `BODY` to the model's measured reach, and `pnpm run edges` (`tools/edges.mjs`, a minute and a half) stands him on every reachable spot of the plan and fails if any part of him is more than a centimetre inside anything built, his shoes and hem below the knee included (there his stride counts only sideways; treads and floors he can step onto are the stair tests' and the leg solver's); `--table docs/t00/edge-coverage.md` writes the building-by-building table, side by side and part by part (column base, sill, cheek, rail end, wall foot). A mat or sill his shoe may come down on is a deck (a round deck `{ x, z, r, h }` is a mat). Run it after moving or adding anything he can walk up to.
- `shade[level]` rectangles darken the paving under buildings and walls (consumed by `ground.js`).
Adding a building is one `put(...)` call; walkability and ground shading follow automatically. `putStack` builds multi-storey towers by standing each storey on the roof of the one below (`roofAt`). Exported constants `SITE`, `LEVELS` (the three terraces), `APPROACH` (the zigzag stair) and `terrain(x, z)` are shared with `yard.js`, `backdrop.js` and `bamboo.js`, so moving a terrace moves the hillside, the far bamboo and the near bamboo exclusion zones together.

Conventions: 1 unit = 1 m, north/uphill is -z, the visitor arrives from +z, buildings face +z in local space and are rotated by quarter turns. Named camera positions live in `views` at the bottom of `buildSite`; add one for anything new worth looking at, because `shots.js` renders exactly that list.

**Name boards (`app/src/plaque.js`, `tools/boards.py`).** Painted after the real temple's boards, which `docs/JINGSHAN.md` lists one by one: upright banded boards on the axis, gilt boards with black characters under the great eaves, gold on black, blue or plain wood elsewhere. The main hall's 釋迦寶殿 is not a typeface: its characters are cut from Wuzhun Shifan's own sheet (`app/levels/t00/boards/shijia.webp`). A modern calligrapher's board is never traced.

**One parametric building (`app/src/building.js`).** `buildHall(M, opts)` makes platform, stairs, columns, beams, bracket sets, infill, name board and a curved tiled roof from the `DEFAULTS` table (column lines `xs`/`zs`, `platH`, `colTop`, `overhang`, `rise`, gable depth `G`, `front/back/sides` = lattice|pass|wall|open, etc.). Halls, the gate, bell/drum towers, pavilions, the library and the summit tower are all this one function. It returns the group plus `walk`, `plat`, `frontZ`, `roofAt` that `site.js` relies on.

**One flight of steps (`stairGeo(w, rise, { sides })` in `app/src/geo.js`).** Every stair of every level is this one
function: the halls' platforms, the terraces, the approach. The treads come from `stairProfile(rise)`. A flight of three
steps or more has a cheek each side (`cheekProfile`): one sloped stone a little proud of the tread noses, level into the
platform at its head and cut square at the lowest nose, over a pier against the platform and a panel set back between
them (cut back twice more on a flight tall enough to show it). All of it keeps within `CHEEK` of the treads and between
the head of the flight and 6 cm past its foot: that is the ground each cheek's `walk.posts` rectangle closes, so a new
level only has to place the flight and its post. `sides: [1]` or `[]` builds a flight against a wall. The cheek tests in
`tests/unit/stairs.test.mjs` hold this for any rise and width: inside its footprint, proud of every nose, solid from
the side, and no ledge under the stone looking up at the sky (one shows as a pale slit).

**Materials: a pattern from the world, fine grain from a scan (`app/src/materials.js`, `glsl.js`, `textures.js`).** `procMat(key, params, body, { tex })` patches `MeshStandardMaterial` so `body` (GLSL) writes `col`, `rough_`, `bump_`, `ao_`, `emit_` and `nd_` (a world-space nudge to the normal) from world position. The large pattern is still worked out in the shader (courses of stone, rows of tile, damp at the foot of a wall); the fine grain comes from scanned surfaces in `app/shared/textures/` (Poly Haven, CC0, packed by `tools/textures.py`: `<name>_a.webp` colour, `<name>_n.jpg` normal x/y + roughness), laid on from three sides (`triA`/`triN`) and divided by the scan's own mean colour so the material's colour stays in charge. Until a scan arrives its mean colour stands in, so the first frame is whole. Every mesh drawn with these needs a per-vertex `ao` attribute; `geo.mesh()` bakes it (`bakeAO`), and `geo.merge()` normalises geometries so they can be batched into one draw per material. The paving (`ground.js`) is lit by hand because of its mirror, but takes the sun's shadows from the same shadow map. Its soft darkening under eaves and along walls comes from a light map baked when the place is built (`bake` in `ground.js`: distance to the nearest of `site.shade`'s rectangles, eight points to the metre), not from a loop in the shader. `mergeStatic` also welds vertices that faces share exactly, which costs a couple of seconds of loading and keeps a third of them.

**Quality (`app/src/quality.js`).** Three tiers (render scale, pixel budget, MSAA, planar reflection scale, shadow map). Mobile UAs always start on `low`; a governor drops scale → reflection → bloom when frames average over 30 ms. `?q=` pins a tier.

**The season and the hour (`app/src/mood.js`).** `moodOf(season, time)` returns one table of numbers (sun, sky, fog,
grade, snow, wetness, lamp light, leaf colours, what drifts in the air, the verse for the photograph). `yard.js`'s
`setMood` hands it to every module's `setMood(m)`; nothing else decides how a season looks. The uniforms in `glsl.js`
(`U`), `FOG` and `SUN_DIR` are shared by reference and must be mutated in place.

**The novice and the two views (`app/src/monk.js`, the camera block in `yard.js`).** He is modelled after the owner's
A-pose turnaround (front, side, back) and bound to a humanoid skeleton in that same pose: a `root` bone that carries his
height above the step (`group.children[0]`), then `hips`, `spine`, `chest`, `neck`, `head` and, for each side,
`leftShoulder`/`UpperArm`/`LowerArm`/`Hand`/`UpperLeg`/`LowerLeg`/`Foot` (VRM-style names; he faces +z, so his left
is on +x), plus `robeFront/Back/Left/Right`, `sashTail` and `hat` for what hangs off him. Skin, robe, trousers and shoes are
four skinned meshes weighted by hand (`createMonk().parts`); the beads and the hat are rigid on their bones. The legs
reach the ground under each shoe with a two-bone solver (`reach`), the pelvis coming down when a foot could not otherwise
reach it; the arms reach the same way to pray or to rest in the lap; the skirt, the sash's ends and the hat swing on
springs driven by speed and turning, and the skirt's bones are shortened wherever its hem would pass into a step.
`update(dt, speed, pose, t, surfaceAt, grounding)`; pose `"bind"` shows the A-pose, and
`node tools/portrait.js summer-day bind` renders it front, side and back to set beside the drawing. A sculpted or
generated mesh can take this one's place with the same bone names, bound in the same A-pose and proportions
(`update` starts every frame from this skeleton's rest pose), or after retargeting onto it. One exists: the body the owner
made with Meshy from the drawing (`tools/novice.mjs` → `app/shared/models/novice.glb`), fetched after the first frames by
`app/src/novice.js` and worn through `monk.dress()`, which swaps the geometry of the four skinned parts and nothing else.
**It is switched off by default since 2026-11-15**, so the page wears the body built here and fetches the sculpted one only
with `?body=sculpt` (`?body=code` is the default spelled out; a failed or ill-fitting fetch also keeps the built one). Its
cloth tore at the texture seams, where copies of one point had taken different weights. Since the 2026-11-16 rebuild
(issue #80, route A: `NOVICE_WELD=8`, steps 4a and 4b of `tools/novice.mjs`, `tools/novice-weld.mjs`) every copy of a
point takes one weight (`novice.test.mjs` holds them together standing, through a stride and up a flight), and the arms are
weighted along the arm; it no longer tears standing, with palms together or walking. Sitting it still tears: there are no
legs under its robe, which needs a layered model (route B). Whether it becomes the default again is the owner's call.
`node tools/novice-views.cjs [--glb=<file>|--code]` shows either body from four sides in five poses on a bare stage, in
seconds, frame for frame. Keep `novice.glb`, `novice.js`, `monk.dress()`, `tools/novice.mjs` and their tests. The hat and the beads are built here either way. In third person
the eye follows a few steps behind and a little to his right (`followEye` in `app/src/eye.js`), and is pulled in along
its line, down to his shoulder, where `walker.eyeShut(x, y, z, foot)` says it would be inside something. It never gets
there in one frame: `createFollow` moves it on critically damped springs (times taken from 《小王子》's camera; a friend
felt sick when it jumped), lets a thin column (`eyeShut` answers `"post"`) cross the line of sight a moment before
coming in, and `tests/unit/follow.test.mjs` bounds how far it may move on its own per frame along four routes. "Inside" is: a column, a
building within its walls up to its ridge, its platform only up to the floor (so from a porch the eye backs out over
the edge), any other wall some way above his head, and every roof from the foot of its beams to over its ridge
(`walk.roofs`). `tests/unit/eaves.test.mjs` raycasts from his head to the eye against the Guanyin hall's real meshes,
and `tests/unit/sweeps.test.mjs` does the same round every building on the plan.

**A tap on the ground (`pickFloor` in `yard.js`).** The line of sight is marched outward until it first dips below
`walker.heightAt`, so a tap lands where it was aimed on terraces and stairs, not on a plane at the foot of the mountain.

**The photograph (`capture()` in `yard.js`, `app/src/card.js`, `docs/PHOTO-MODE.md`).** Raising the camera (P, or 留影)
changes nothing in the picture: it is the view he had, whole, with the novice in it if he was. From there the camera
only draws nearer or farther (the wheel, a pinch, three steps in the settings; `photo.zoom`, 0.7 to 6); it does not turn.
The left mouse button on the picture is the shutter (a drag is not); on a touch screen the shutter button is. The
shutter draws the view again at 1600, 2160 or 2880 px on its long side by quality tier and mounts it on a card with
the mood's verse, the temple's name and a seal. Tall, square and wide frames are still offered in the settings.
Pressing it freezes the picture (`freeze` in `yard.js`): the view is drawn once more and copied onto `#still`, the frame
loop and the observances' clock (`pauseRites`) stop until the print is put away, and the large picture is drawn for that
same moment; two leaves of ink close and open over it (`#curtain`) with `audio.js`'s `shutterSound`, and the print comes
with `stampSound`. The viewfinder (`#finder`, `#frame` in `ui.css`): outside the frame the mount's paper, inside four
corners and, if the visitor asks (`settings.thirds`), the thirds; over the whole view, corners only.

**Sound and music (`audio.js`, `score.js`, `instruments.js`).** Everything is synthesised; no recording is used. `audio.js`
has three buses (music, the place, effects), each with its own level in the pause menu (`乐声`, `山声`, `音效`, under the
master `音量`) set before its reverb send, and two reverbs (the court, a timber hall) that follow `inside`. `score.js` is
the music as data and is unit-tested in Node: the mode (G yu, on the bell's 98 Hz), a seven-note theme of which each seal's
chime rings the next note and which is heard whole only after the seventh seal, `zoneOf` (grove, stair, gate, court, hall,
upper, summit), a zone that counts only after two seconds, one phrase maker per place, and a conductor that starts phrases
on the audio clock; on a change of place it drops the notes not yet begun and fades what sounds over 3.5 s (never the whole
theme). `instruments.js` plays it (qin as a Karplus-Strong string, harmonics, xiao, a held fifth) through `createPlayer` on
any audio context, so `tools/music.mjs` renders the same music offline. `docs/t00/MUSIC.md` maps each place to its music.
The great bell is `bell()` in `instruments.js` (struck with a log: a low hum that swells and lasts about 45 s, the
fundamental about 34 s, the high partials dying first; `hillEcho` answers it from the slope), so it renders offline too;
`tests/unit/bell.test.mjs` holds its shape. The music steps back inside `strike()` for the bell (14 s) and drum. The first time the third stroke sounds on a walk, a dozen birds go up from the tall
cryptomerias nearest the tower and fly off toward the hills (`flock.js`, one instanced draw, wings beaten in the vertex
shader; `audio.js`'s `flutter`; not at night, not from indoors; `__flock(go?)`). When the close says a bell answers in
the far hills, `farBell` sounds one, a tone below ours (F2), dark and small (`__cues()`). Water drips from
the eaves only after rain (`place().wet`), not on dry autumn stone or in snow. Deep in the bamboo at the start, in the strongest gusts only (`knockReady`), two culms now and then knock together (`knock`; the Chan books' Xiangyan woke at a shard striking bamboo); `__knock(go?)` reports and makes one. Birds (`bird`, `birdGap`) sing only out on the mountain, in the bamboo and on the path up, most at dawn and none at night, and never within the walls, after Chang Jian's 「萬籟此俱寂，惟聞鐘磬音」; `__bird(go?)`. The dragon well (`well.js`) has no running water, as the chronicles have it (one well left when the pool dried): every 7–15 s a drop falls, heard only within nine metres through `audio.js`'s `wellDrip` with the niche's echo, and sends two faint rings across the pool; `__well(drip?)` reports it. A season or hour changes only `moodMusic`'s few numbers.
His steps are heard (`app/src/steps.js`, unit-tested), as what each comes down on: dry stone (a soft pat of a cloth
shoe, heel then ball), stone wet after rain (the sole lifting off a film of water), a splash where water stands in the
paving (`puddleAt`, the paving shader's own puddle pattern ported to JS; each splash also sends two rings across the water, `ground.ripple` and `RIPPLE` in `ground.js`, which only bend the puddle's mirror and sheen; `__ripples()`), and snow (a shower of tiny breaks following the
push of the foot). All are worked out sample by sample, so `tools/steps.mjs` renders the same steps, and `LEVEL` sets
them against each other: dry stone the quietest, snow the loudest, all well under the music (若隐若现, the owner asked: a stone step about 32 dB
under it, a little fainter than 小王子's, whose files put its own about 26 dB under; `steps.test.mjs` holds the played level). For every shoe `monk.steps` reports, `yard.js` asks
`walker.floorAt` what floor it is (`room`, a building's `stone` or `wood`, the approach's `path`, the courts' `paving`)
and `underfoot()` what that sounds like in this mood: a hall's floor and a roofed platform are dry, the swept axis path
of the court is never snow, autumn has dried. `footstep()` in `audio.js` plays it under the effects slider but on its own
sends: nearly dry outdoors, the hall's reverb indoors. Each step is played a fixed 60 ms after the shoe came down
(`monk.steps[].late` says how far into the frame that was), so steps keep time on slow frames; never before the visitor's first touch has let the place be heard. `__steps(kind?)` reports
how many of each have been heard, or plays one.

**Trees, drifting things (`trees.js`, `drift.js`).** The trees that show the season and the petals, leaves, snow and
fireflies in the air; both are driven only by the mood. Nothing drifts indoors, and no snow lies on a room's floor:
`dress()` in `yard.js` sets `uSnow` to 0 after the doorway's view is taken.

**Footprints in the snow (`trail.js`).** `monk.steps` reports each shoe as it comes down (sole centre, ground height,
toe direction); `trail.js` presses the sole into a render target that follows him (32 m at 2048 px, 24 m at 1024 px on
`low`, wrapped like the drift and cleared a strip at a time as he moves). Red is depth, green the trodden height times
red, so a roof does not take the prints made under its eave. Every shader that lays snow reads it through `TRAIL`
(`procMat`'s snow, the paving in `ground.js`); falling snow fills the prints in about two minutes. Indoors nothing is
stamped and the square stays put. `__trail()` reports it (`__trail(false)`: the next picture without the prints).
No snow lies under a roof (`shelter.js`): `walk.roofs` is baked when the place is built into a map seen from above
(each eave footprint and the foot of its beams, the lowest and highest where roofs overlap), which `procMat`'s snow and
`underfoot`'s `roofed` read; only a strip just inside the eaves takes blown snow. `tests/unit/shelter.test.mjs` holds it.

**The visit as a pilgrimage (`journey.js`, `game.js`, `goshuin.js`).** `journey.js` is book-keeping only (seven seals,
the bell's three strokes, the library's line, storage under `yunjing.journey.v1`) and is unit-tested in Node.
`site.places` says where each observance is made. `game.js` owns everything a visitor sees of it: the title, the brush
rings on the ground, the action button, how each observance unfolds, the seal toast, the book; it reaches the walk only
through the small object `yard.js` hands it (`walkTo`, `stage`, `strike`, `where`, `onTick`…). `goshuin.js` draws the
page of seals. Hooks: `__journey()`, `__rite(id)`, `__enter()`, `__book()`, `__places`, `__inside(id|null)`, `__halls`, `__gallery`, `__figures()`.

**What his hands do (`rites.js`).** game.js says when an observance happens; `rites.js` says how it is done. Each is a
run of timed passages (`play(secs, fn, on)`, on the clock, not on frames) that write into `act`, which `yard.js` hands to
`monk.update` with his pose (`grounding.act`: `bow`, `twist`, `nod`, `breath`, and for either hand a place in the world
to reach, the way its fingers and palm turn, and a weight), and move the thing he holds. The bell: a rope hangs from the
end of the log, out past the platform (`LOG` in `site.js`); he draws it back and lets go, three strokes to one press,
and `logSwing` keeps the log from passing into the bronze. Tea: his bowl (made in `rites.js`, not merged into the table)
is lifted in both hands and tilted at his lips three times. Incense: three sticks between his palms, raised to the brow,
three bows, a step up to the low stand before the cushion (`places.incense.front`, `.bowl`), set in the ash, where they
smoke and burn down over five minutes by the wall clock (`?burn=` seconds for a test; when they were set is kept in
`yunjing.incense.v1`, so a reload finds them as far burnt), leaving cold stubs, after which incense may be offered again. Sitting: `breathe(±1, secs)` fills his chest and sends a ring out on each breath
out. `__riteClock(ms)` holds the observances' clock and steps it, so a moment can be photographed; `__rites()` reports
all of it. The hand offsets (lips, brow, rope) were set against the novice's present proportions.

**Seats.** Every cushion and stool is a seat: `site.seats` out of doors (the three stools at the tea table, the summit
mat), and `seat()` / `sitAt()` in `interior.js` for the rooms (`{ at, top, face, room }`). Where nothing else is offered
within a step or two of one, the button says 坐下; he walks up to the nearest ground beside it and is drawn going over and down onto it (`sitDown` in `game.js`);
he stays until he is sent elsewhere. Each seat has a `kind`, and it says how he sits: on a `stool` as on a chair (pose
`"chair"`: thighs level, shins hanging, hands on his thighs; a stool is a grown man's sitting height, and his feet do not
reach the floor; a seat higher than he can step onto, a stool or a cushion on the meditation hall's platform, he hops up onto with his own
`JUMP`, along `seatHop` in `drop.js`), on a `cushion` cross-legged upon it (pose `"sit"`: knees on its edge, shins folded before him, the
left in front, hands in his lap, left on right). The outlines are `STOOL` and `CUSHION` in `geo.js`, built from by the
courts and the rooms alike, and `monk.test.mjs` keeps his seated body out of them and off the floor. A new cushion or
stool must be registered the same way, with its kind; `rites.test.mjs` holds it.

**The close of the chapter.** This temple is the prologue, where a visitor learns how the walk goes. Sitting on the
summit is the last thing: before the other six seals its mat is only a seat. When the seventh is earned there, `finale`
(`game.js`) hands the eye to `rites.close` (`y.cine(fn)`: round before him, back down the steps, up until the pavilion
stands whole), says the closing words one at a time (`CLOSING`: they end on something unanswered, for a chapter not
yet made), shows the title of what has ended, and then opens the book. A click, a tap or Esc passes over it;
`__ending()` plays it again. It comes once in each season (`journey.closedIn(season)`, `closedSeason` in the book): after a
change of season, sitting there plays it again, without the full book's seal a second time.

**Coming back, and going back (`resume.js`, `game.js`).** Where he stands is kept every two seconds and when the page is
left (`yunjing.place.v1`: place, facing, what to call it). A first visit is offered only 入山; a visitor with a seal, or
who left from up the mountain, finds the title over where they were, with 接着走 and, smaller, 从头走起 (asked twice: it
empties the book and starts at the foot of the path). A test or tool that names its own place (`?cam`, `?show`, `?shot`,
`?in`, `?enter`, `?tour`) is neither moved nor kept. In the book, a button lies over each seal that has been earned
(`sealBoxes` in `goshuin.js`); pressing it closes the book and takes him back to where that seal was earned, behind the
veil (`y.travel`). `__left()` reports what is kept and offered, `__goBack(id)` goes.

**How it is played.** Keyboard and mouse as in most role-playing games: WASD or arrows walk relative to the view, Shift
hurries, dragging with a mouse button held looks round and a click on the ground walks there (or strikes the bell or drum), as a tap does; holding the pointer so that the mouse alone looks round (Esc lets go) is the pause menu's 锁定鼠标 (`settings.lock`, off by default since 2026-11-16, when visitors said the view swam whenever the mouse moved), the wheel moves the eye
nearer or farther (and on past the nearest into his own eyes, and back out), E (or Enter) does what is offered, Space jumps (or, at the edge of a low unrailed porch, hops down), V changes the view, B opens the book, P photographs,
T opens the season and hour once they are the visitor's (below). While the pointer is held a click strikes the bell or drum under the dot. On a touch
screen: a thumb-stick lower left (faint until a thumb is on it), a drag to look, two fingers for nearer and farther (and the view, as the wheel), a tap on the ground to walk there.
On the picture while he walks there are only two slips at the edge (留影, 歇脚) and the book, which is the small seal at the top left;
there is no view button and no jump button.

**The seasons are earned (`journey.opened()`, `body.seasons`).** A first visit is the visitor's own season and hour and offers no
choice. Filling the book the first time opens them (`opened` in `yunjing.journey.v1`, kept through 重新朝山): `game.js`
sets `body.seasons`, and everything marked `need-seasons` shows (a row in the photograph's settings, two rows in the pause
menu, T in the key card); the line at the foot of the view says so once (`told`). `?season=`/`?time=` and `__mood()` are not gated. The key list (`#keys`) shows only
where a fine pointer is likely; the stick (`#stick`) only where a coarse one is.

**Four languages (`app/src/i18n.js`, `docs/t00/I18N.md`).** The page speaks Chinese, Japanese, English or Korean, by `?lang=`,
then the visitor's choice (`yunjing.lang.v1`, set in the pause menu or on the title), then the browser's language. Chinese
is the text of record: write every line in Chinese and pass it through `t("…", vars)` where it is shown; the Japanese and
English and Korean are found by that Chinese in `app/locales/ja.js`, `en.js` and `ko.js` (one entry to a line), and
`tests/unit/i18n.test.mjs` fails if a line the page may show lacks any of them. `index.html` is translated by `app/lang.js` before the title paints.
What is calligraphy (seals, the seal book's page, the title's four characters) goes through `glyphs()`: Japanese forms in
Japanese, the temple's own characters otherwise. Name boards are not translated. The works' cards are: a level keeps its
own translations beside its content, `app/levels/t00/locales/ja.js`, `en.js` and `ko.js` hold each work's fields by slug, `workIn(slug)` in `app/levels/t00/works-local.js` lays them over the Chinese record, and the
museum's source line stays as published; a work added by `tools/gallery.py` needs all three, or `i18n.test.mjs` fails. Each language has
its own faces in front of the Chinese ones (`FONT`/`FACE` in `i18n.js` for canvases; `:lang()` variables in `ui.css`),
cut by `python3 tools/fonts.py --lang ja|en|ko`. Tests and tools pin their browser to `zh-CN`; the `lang` scenario and
`node tools/mobile-audit.cjs --lang=ja|en|ko` look at the others. Every analytics event carries `lang` (`withLang` in `analytics.js`),
and `demo.ready` also says how the language was come by (`lang_source`: url, saved, browser, default) and, on a page opened by
choosing another language, which one it came from (`lang_from`, remembered in `sessionStorage` because the page reloads at once).

**Typefaces (`app/shared/fonts/`, `tools/fonts.py`).** Six faces under the SIL Open Font License, cut down to the characters the
app uses and served with it: "Yunjing Brush" (Ma Shan Zheng: the title, the page of seals), "Yunjing Kai" (LXGW WenKai:
every label and spoken line, and the name boards, which are written in traditional forms), "Yunjing Xing" (Zhi Mang Xing, a running hand: what is written by hand on paper, which is
the verse under a photograph, the slip drawn in the library and the title on a leaf in a hall; it has no traditional
forms, so it is not for name boards), "Yunjing Bang" (Yuji Boku, a heavy brush regular hand cut to the name boards' characters only), "Yunjing Serif" and
"Yunjing Seal" (Noto Serif SC regular and black). The kai (LXGW WenKai) and the Korean running hand (Nanum Brush Script) declare Reserved Font Names, so `cut()` writes them with the project's own names inside the file (`RENAMED`: "Yunjing Kai", "Yunjing Hand KO"; copyright and licence records are left as they were; `python3 tools/fonts.py --rename` does it to files already cut), and `tests/unit/fonts.test.mjs` reads every file's name table (in Node, no font library) and fails on a reserved name. Nothing is fetched from a font service. After adding words, run `python3 tools/fonts.py <dir with the TTFs>`;
`pnpm run check` fails if a character is used that the cut does not hold.

**The way to the next place and the record of the visit (`game.js`).** While the goal line is showing, a small vermilion seal
(`#way`) sits on the picture where the next place lies, or at the edge toward it, with the distance in steps; it leaves with
the goal. The visit's metres and minutes are kept under `yunjing.visit.v1` and told on the book's page. `__visit()` reports them.

**What lies over the picture (`app/src/ui.js`).** Everything that opens over the walk is a layer on one stack:
`modal` sheets (`menu`, `book`, `print`, `piece`, `slip`) are `<dialog class="layer">` opened with `showModal()`, so the
page behind is inert, the pointer is let go, the walk stands still (`ui.modal()`) and only the sheet's own keys are heard
(`confirm`: what E/Enter presses; `keys`: e.g. B closes the book); `panel`s (`keys`, `moodPanel`, `photoSettings`) sit at
the edge and the walk goes on under them; the raised camera is a `mode`. Esc always closes the top layer and opens the
pause menu only when the stack is empty; closing gives the focus back to what opened the layer. Open and close through
`ui.open(id, { onClose })` / `ui.close(id)`, never by setting `hidden` (it is kept in step for the tests). A new sheet is a
`<dialog class="layer">` plus one `ui.layer(id, …)` call. No UI library: comparable web games hand-write their DOM too
(`docs/t00/decisions.md`, "界面").

**Ink on paper (`app/src/ui.css`, `app/src/paper.js`).** The interface's look, chosen by the owner from two drawn
directions: over the picture nothing has a box (words with a little shade under them; the things at the edge are
slips of paper written down the page); what opens over the walk is a sheet of paper with a torn edge (class `paper`);
what is chosen is circled in vermilion (`aria-pressed`); the one button that matters on a sheet is a seal (`stamp`); keys
are written as letters with a stroke under them. `paper.js` draws the paper grain, a dry brush stroke, the ring and the
seal once in canvases when the page opens and hands them to the stylesheet as `--paper-tile`, `--brush-ink`,
`--brush-light`, `--enso-light`, `--enso-red`, `--stamp`; a `ResizeObserver` gives every `.paper` its own torn edge
(`--deckle`, a mask) and every slip at the edge its whole torn paper (`--sheet`, a picture: a mask on a button is not
drawn by every browser). All seeded, so screenshots repeat. Tokens (ink and paper colours, type sizes) are at the top of
`ui.css`; every rule there reads without the drawn textures. The running hand borrows the kai's upright punctuation
(`unicode-range`) so that a slip written down the page has its commas in place.

**The pause menu and what a visitor sets (`app/src/settings.js`, `#menu`).** Esc with nothing else open, or the 歇脚 chip,
opens it: drawing quality (takes effect on the next load), how fast the head turns, inverted look, how wide the view is (`fov`, degrees
added to the walk's 50° behind him or 65° from his eyes; the fixed views keep 44°/52°), volume, the key card, and
a way back to the start of the path, and 鸣谢 (the page of thanks and sources, below). The store is modelled on wok-ing-dead's: one key (`yunjing.settings.v1`), every value
validated on the way in, a damaged save ignored. `__settings()` and `__menu(open)` are the hooks.

**Thanks and sources (`app/src/credits.js`, `#credits`).** The menu's 鸣谢 opens a sheet of paper (`ui.layer`, a `<dialog class="layer">` holding a `.credits-card.paper`) with what the licences ask to be said (`docs/t00/LICENSING-AUDIT.md` §六): the three museums (the 14 ColBase pictures one by one, each linked to its item page; the plaque's four characters, with their source and what was done to them), the 3D scans, Poly Haven, every typeface with its copyright line, and the libraries, linking `shared/licenses/THIRD-PARTY-NOTICES.txt` and `shared/fonts/OFL.txt`. The words are data in `credits.js` passed through `t()`; names, copyright lines and the museums' own source lines are not translated. A work's card carries, below the museum's source line, a line saying a ColBase picture was edited (`processedLine`, from the `processed` field `tools/gallery.py` writes: `resize` or `crop`), written as ColBase's terms give their example. A new ColBase work needs nothing by hand; a new source of another kind needs a section in `credits.js` and a row in `asset-register.csv`. `__credits()` reports it.

**Third-party licences (`tools/notices.mjs`, `app/shared/licenses/`).** `THIRD-PARTY-NOTICES.txt` is composed by `node tools/notices.mjs` from the installed three.js and meshoptimizer licences and the texts kept beside it (lil-gui, stats.js, Basis Universal's LICENSE and NOTICE), and ships in `dist/shared/licenses/`. `vite.config.mjs` fails the build if it, or `vendor/basis/NOTICE`, is missing or does not name the five libraries; `tools/setup.mjs` copies Basis's own Apache-2.0 text, not three's MIT, to `app/vendor/basis/`. `tests/unit/notices.test.mjs` builds the site into a scratch folder and checks it.

**What is said about the controls (`app/src/hints.js`).** Nothing about the controls stays on the picture. One line at
the foot of the view says each thing once, when it becomes useful (how to walk on arriving, Esc and the wheel when the
mouse is first held, Shift after a long stroll, the book after the first seal), and leaves. H opens the list of keys.
The season's name and the next place show when they change and when the visitor has stood still a while; the controls
at the edge fade while the mouse rests. Add a hint there, not as permanent text in `index.html`. `__hud()` reports it.

**Test hooks.** `yard.js` sets `document.body.dataset.ready = "1"` after three frames and exposes
`window.__yard()` (position, yaw, pitch, height, tier, target, frames, tris, calls), `__probe()` (draws a frame and
returns its mean colour plus season, hour, view, photo state (and `frozen`), camera distance, snow, lamp, fov, and `monkBox`: where the novice stands in the picture, or null), `__views`, `__merged`,
`__walk(points)`, `__pose(x, z, yaw, pitch)`, `__mood(season, time)`, `__view(v)`, `__photo(open, opts)`,
`__capture()`, `__shots()` (shutters and seals sounded), `__trail()`, `__steps(kind?)`, `__strike(kind)`, `__listen(bus?)` (one of music, ambience, effects, or all together), `__music(start?)` (zone, section, phrases, duck, levels, players), `__hud()`, `__ui()` (the stack of open layers, whether one is modal, where the focus is), `__tour()`, and `__pick(x, y)`: what lies under a point of the
picture, nearest first (part of the scene, material, distance, whether it is see-through). The tests and tools depend on these; keep them when refactoring, and add
to `__probe` rather than reaching into the page from a test.

## Working notes

- **Every issue has its own goal with acceptance criteria** (the owner's rule, 2026-11-16): background, goal, criteria each of which a test, a number, a set of named views or a command can decide, and who closes it after a recheck on which commit (`AGENTS.md`「Issue 与验收标准」, `.github/ISSUE_TEMPLATE/goal.md`). A long goal file may hold them for a whole line of work, linked from the issue, but they are written out in full there or in the issue; a PR reports against them item by item.
- **Every effect in the game has a recorded source** (the owner's rule, 2026-11-15): when you add or change anything a visitor sees, hears or does, add or amend its row in `docs/t00/SOURCES.md` in the same commit, with how far the source was checked (原文 read, quoted second-hand, photo, reference project, owner's choice, or plainly 按常理/自拟 when there is none). Never pass an inference off as a source.
- Code comments are in English and written as prose describing the place, not the code; commit messages and PR titles follow Conventional Commits as AGENTS.md sets out; the README and docs are in Chinese. Keep that split.
- Frame cost is measured on a Tesla T4 with `tools/gpu-render.sh`; no phone has been measured. Stairs are walked as treads, not slopes (`carved()` in `site.js`), and the columns of open pavilions are `walk.posts`, which stop him even on a floor that is otherwise all open. On 2026-11-14 the main court cost 8.45 ms at 1080p on the high tier (1.1 M triangles, 372 draws, the temple drawn twice for the mirror) and 4.55 ms on the low tier at a phone's size (550 k, 185 draws, no mirror); the day began at 10.4 and 7.4. The frame is bound by triangles and draw calls, not by pixels, and roofs are still most of the triangles. Later the same day, with rafters, the wood outside the walls and the gate's detail added, the first court cost 9.3 ms on the high tier and 4.7 ms on the low; the measured walk (`?tour=120x3`, high tier, 1080p) averaged 61 frames a second with a 95th-percentile frame of 21 ms. Switching trees or bamboo off changes nothing on that card; the mirror pass is about 1.8 ms and is drawn only on the level of the forecourt and first court. None of this says what a Mac or a phone does.
- `tools/out/` and `tools/*.png` are gitignored; screenshots are for looking at, not committing. `refs/` holds the approved reference images.
- A shader fragment handed to `procMat` is wrapped in one line of braces: it must not end in a `//` comment (`pnpm run check` guards this).
- `index.html` carries its own `<!doctype html>`, `lang` and viewport (since 2026-11-16; before that the test servers added them and the published page had neither, so a phone drew it 980 px wide). No server adds anything to it now. `[hidden]` works because `src/ui.css` says `[hidden]{display:none !important}`.
- **A phone in the hand (`tools/mobile-audit.cjs`).** It opens every surface of the interface as a touch device at three sizes (upright, sideways, small), takes a picture of each and lists every control under 44 px, text under 12 px, anything off the screen and any page that scrolls; it exits 1 if it lists anything. Run it after changing the interface.
- When a visitor says the novice goes through something (穿模) or cannot get down (走不下来): first `pnpm run edges`,
  which says whether his body goes into anything; if it is clean, it is the eye, so ask `__pick(x, y)` what lies under
  that point of the picture. For "cannot get down", look for a prop where a hop off a porch would land. Make a unit test
  fail first: `tests/unit/sweeps.test.mjs` already raycasts from his head to the eye against every building and hops off
  every porch edge, and `eaves.test.mjs` shows how to pin one place down. Anything new stood near a porch leaves about
  1.4 m clear in front of its edge.
- When a shape in a screenshot will not be explained, do not guess at materials: ask `__pick(x, y)` what is there. A pale
  sheet across the gate's roof was chased through tiles, boards, normals and hills for hours; it was a mist sprite
  (`props.js`) hanging in front of the building. Mist sheets stay outside the walls.
- The shadow map is drawn once per mood change (`shadowMap.autoUpdate = false`), so nothing that moves casts a real shadow; the novice stands on a painted one.
