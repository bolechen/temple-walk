#!/usr/bin/env bash
# The T05 white-box hall on a real graphics card (issue #280): what no statue, one, three and seven statues cost a frame.
# Stages the built hall page and the statue files to the private render bucket, runs tools/gpu/job.cjs with the script
# tools/gpu/t05-hall-gpu.cjs on a Hugging Face Job, and brings back tools/out/gpu/<run>/ (report.json and pictures).
#
#   tools/t05-gpu.sh <a.glb> <b.glb> <c.glb> [flavor]      the three statues of one route (centre, east, west)
#   SETS=paint tools/t05-gpu.sh <vipasyin> <kasyapa> <sakyamuni>   the three in clay and painted (issue #287), taken in
#                                                       turn twice over in the same job, so the card's warming up and
#                                                       any drift fall on both alike
#   SEVEN="<7 near files, east to west>" SETS=seven370 tools/t05-gpu.sh <a> <b> <c>   the seven as made, each with its anchors,
#                                                       in clay and painted twice over, and four pictures of the line-up
#   SEVEN=… SETS=masks370 tools/t05-gpu.sh <a> <b> <c>   the seven painted with and without their masks, high and low tier
#   SETS=lod370 tools/t05-gpu.sh <near.glb> <mid.glb> <far.glb>    issue #370's Śākyamuni sample: its three levels of
#                                                       detail, each repeated on all seven seats, in clay and painted,
#                                                       with the empty hall, all taken in turn twice over in one job
#
# The report's site.commit is HEAD, with "+dirty" if anything the page is built from has changes not committed: run it
# on a clean commit, after building the page from that commit.
#
# Needs `hf` logged in (in the sandbox: HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, the proxy adds the real one).
# Build the page first: node tools/t05-hall.cjs <any spec> writes tools/out/t05-hall-page/.
set -euo pipefail
cd "$(dirname "$0")/.."
A="$1"; B="$2"; C="$3"; FLAVOR="${4:-t4-small}"
NS="$(hf auth whoami --format json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.name||j.user||j.username)})')"
BUCKET="$NS/temple-walk-render"; RUN="t05-$(date -u +%Y%m%d-%H%M%S)"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/app/s"; cp -R tools/out/t05-hall-page/. "$STAGE/app/"
cp "$A" "$STAGE/app/s/0.glb"; cp "$B" "$STAGE/app/s/1.glb"; cp "$C" "$STAGE/app/s/2.glb"
# SETS=seven370 also takes the seven figures, east to west, in SEVEN (space-separated near-level files) as s/10..16.glb
if [ -n "${SEVEN:-}" ]; then i=10; for f in $SEVEN; do cp "$f" "$STAGE/app/s/$i.glb"; i=$((i+1)); done; fi
cp app/favicon.svg "$STAGE/app/favicon.svg"                       # job.cjs probes the card on a same-origin page
cp tools/gpu/job.cjs tools/gpu/t05-hall-gpu.cjs tools/site.cjs "$STAGE/"   # job.cjs serves the page with site.cjs (#418)
SPEC="$(SETS="${SETS:-}" node -e '
const S = (u, x, turn, extra = {}) => ({ url: "s/" + u + ".glb", x, h: x ? 8.8 : 9.0, turn, paint: "clay", ...extra });
const T = -Math.PI / 2, three = [S(0, 0, T), S(1, 5.8, T), S(2, -5.8, T)];
const seven = [S(0, 0, T), S(1, 5.8, T), S(2, -5.8, T), S(1, 11.33, T), S(2, -11.33, T), S(1, 16.45, T), S(2, -16.45, T)];
if (process.env.SETS === "seven370") {
  // the seven Buddhas as made (#370 and after): each its own near-level file and its own anchors, east to west, in clay and painted, twice over; and the line-up pictures
  const N = ["kasyapa-t05", "krakucchanda-t05", "sikhin-t05", "vipasyin-t05", "visvabhu-t05", "kanakamuni-t05", "sakyamuni-370"], X = [16.45, 11.33, 5.8, 0, -5.8, -11.33, -16.45];
  // heights with the throne: DECISIONS.md §3 (middle 9.0, the sides lower step by step), the outer two pairs brought down until each pair of neighbours keeps 0.2 m apart (docs/t05/SHAKYAMUNI-SAMPLE.md, 七尊第二轮)
  const HT = [8.6, 8.75, 8.9, 9.0, 8.9, 8.75, 8.6];
  const L = N.map((c, i) => ({ url: "s/" + (10 + i) + ".glb", x: X[i], h: HT[i], base: false, plinth: 0.4, turn: 0, headAt: 0.13, maxW: 10, halo: { rings: 0, tips: 0 }, paint: "clay", colour: c }));
  const V = ["door", "door3", "front10"], sets = [];
  sets.push({ name: "lineup", size: [1920, 1080], statues: L, shots: [
    { name: "door3-winter", shoot: { paint: true, mood: "winter", view: "door3" } }, { name: "door-winter", shoot: { paint: true, mood: "winter", view: "door" } },
    { name: "cam06-winter", shoot: { paint: true, mood: "winter", view: "cam06" } }, { name: "row-winter", shoot: { paint: true, mood: "winter", view: "front10", over: { at: [0, 7.0, -1.0], look: [0, 8.8, -17.6], fov: 72, exp: 3.8 } } } ] });
  for (const k of [1, 2]) { sets.push({ name: "none-" + k, statues: [], views: V }, { name: "seven-clay-" + k, statues: L, paint: false, views: V }, { name: "seven-paint-" + k, statues: L, paint: true, views: V }); }
  console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets } })); process.exit(0);
}
if (process.env.SETS === "lips701") {
  // issue #701: the pad under the lower lip painted as chin and the lips only where the lips are. The seven as made, in the winter hall with no lamp, and for the three figures
  // that read as an open mouth (Krakucchanda, Visvabhu, Kanakamuni) and the middle one for comparison two pictures each: from the middle of the hall, 10 m from
  // the figure (about 36 degrees up), and from the foot of the altar, 4 m from it; the same pictures as the faces of tools/t05-hall/specs/t05-paint-463.json
  const N = ["kasyapa-t05", "krakucchanda-t05", "sikhin-t05", "vipasyin-t05", "visvabhu-t05", "kanakamuni-t05", "sakyamuni-370"], X = [16.45, 11.33, 5.8, 0, -5.8, -11.33, -16.45];
  const HT = [8.6, 8.75, 8.9, 9.0, 8.9, 8.75, 8.6], HEAD = [11.15, 11.2, 11.28, 11.48, 11.38, 11.17, 11.2];
  const L = N.map((c, i) => ({ url: "s/" + (10 + i) + ".glb", x: X[i], h: HT[i], base: false, plinth: 0.4, turn: 0, headAt: 0.13, maxW: 10, halo: { rings: 0, tips: 0, ...(i === 0 || i === 6 ? { gain: 1.5 } : {}) }, paint: "clay", colour: c, ...(i === 0 || i === 6 ? { lotusGain: 1.25 } : {}), ...(i === 0 ? { innerTint: [0.97, 1, 1.03] } : {}), ...(i === 6 ? { innerTint: [0.96, 1, 1.05] } : {}) }));
  // L2=1: the three figures that read as an open mouth are drawn on the L2 meshes with their own anchors (paint/<name>-L2.json); give their files in SEVEN
  if (process.env.L2) for (const i of [1, 4, 5]) L[i].colour = N[i].replace("-t05", "-L2");
  const shots = [{ name: "cam03-winter", shoot: { paint: true, mood: "winter", view: "cam03" } }];
  for (const i of [1, 3, 4, 5]) for (const [tag, at, fov] of [["mid10", [X[i], 4.6, -7.6], 11], ["front4", [X[i], 4.6, -13.6], 20]])
    shots.push({ name: tag + "-" + N[i].replace(/-.*/, ""), shoot: { paint: true, mood: "winter", view: "faceFrom10", over: { at, look: [X[i], HEAD[i], -18.1], fov, exp: 4.5 } } });
  console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets: [{ name: "lips", size: [1920, 1080], statues: L, shots }] } })); process.exit(0);
}
if (process.env.SETS === "masks370") {
  // what the masks cost (#370 round 6): the seven painted with and without their masks, inside the hall, at the high tier
  // (1920×1080, GTAO) and the low (960×540, no AO), each pair taken in turn twice over in one job
  const N = ["kasyapa-t05", "krakucchanda-t05", "sikhin-t05", "vipasyin-t05", "visvabhu-t05", "kanakamuni-t05", "sakyamuni-370"], X = [16.45, 11.33, 5.8, 0, -5.8, -11.33, -16.45];
  const HT = [8.6, 8.75, 8.9, 9.0, 8.9, 8.75, 8.6];
  const L = N.map((c, i) => ({ url: "s/" + (10 + i) + ".glb", x: X[i], h: HT[i], base: false, plinth: 0.4, turn: 0, headAt: 0.13, maxW: 10, halo: { rings: 0, tips: 0 }, paint: "clay", colour: c }));
  const V = ["door3", "cam06", "front10"], sets = [];
  for (const k of [1, 2]) for (const [t, size, ao] of [["high", [1920, 1080], true], ["low", [960, 540], false]])
    sets.push({ name: `nomask-${t}-${k}`, statues: L, size, ao, paint: { masks: false }, views: V }, { name: `mask-${t}-${k}`, statues: L, size, ao, paint: true, views: V });
  console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets } })); process.exit(0);
}
if (process.env.SETS === "lod370") {
  const L = (u, paint) => [-16.45, -11.33, -5.8, 0, 5.8, 11.33, 16.45].map((x) => ({ url: "s/" + u + ".glb", x, h: 8.6, base: false, plinth: 0.4, turn: 0, headAt: 0.13, halo: { rings: 0, tips: 0 }, paint: "clay", colour: "sakyamuni-370" }));
  const V = ["door", "door3", "front10"], sets = [];
  for (const k of [1, 2]) { sets.push({ name: "none-" + k, statues: [], views: V });
    for (const [u, n] of [[0, "near"], [1, "mid"], [2, "far"]]) sets.push({ name: n + "-clay-" + k, statues: L(u), paint: false, views: V }, { name: n + "-paint-" + k, statues: L(u), paint: true, views: V }); }
  // the review pictures (the owner asked to see the hands and the paint, #370): the shots of tools/t05-hall/specs/sakyamuni-370-review.json on the near level
  const R = require("./tools/t05-hall/specs/sakyamuni-370-review.json");
  sets.unshift({ name: "review", size: R.size, statues: [{ ...L(0)[3] }], shots: R.shots });
  console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets } })); process.exit(0);
}
if (process.env.SETS === "paint") {
  const C = ["vipasyin", "kasyapa", "sakyamuni"], P = three.map((s, i) => ({ ...s, colour: C[i], ...(i === 2 ? { yaw: 0.12 } : {}) })), V = ["door3", "side3", "front10"];
  const sets = []; for (const k of [1, 2]) sets.push({ name: "three-clay-" + k, statues: P, paint: false, views: V }, { name: "three-paint-" + k, statues: P, paint: true, views: V });
  console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets } })); process.exit(0);
}
console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets: [
  { name: "none", statues: [] }, { name: "one", statues: [S(0, 0, T)] }, { name: "three", statues: three }, { name: "seven", statues: seven },
  { name: "seven-noao", statues: seven, ao: false } ] } }));')"
hf buckets create "$BUCKET" --private --exist-ok >/dev/null
hf buckets sync "$STAGE" "hf://buckets/$BUCKET/runs/$RUN" --delete >/dev/null
echo "run $RUN on $FLAVOR"
COMMIT="$(git rev-parse HEAD)$(git diff --quiet HEAD -- tools/t05-hall tools/t05-hall.cjs tools/gpu tools/t05-gpu.sh && [ -z "$(git ls-files --others --exclude-standard tools/t05-hall tools/gpu)" ] || echo +dirty)"
hf jobs run --flavor "$FLAVOR" --timeout "${JOB_TIMEOUT:-25m}" --name "temple-walk-$RUN" \
  -e RUN="$RUN" -e COMMIT="$COMMIT" -e SPEC="$(printf %s "$SPEC" | base64 | tr -d '\n')" \
  -v "hf://buckets/$BUCKET:/work" \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c 'set -e; mkdir -p /tmp/run && cd /tmp/run && npm init -y >/dev/null 2>&1 && npm i playwright@1.63.0 >/dev/null 2>&1
    (apt-get update -qq && apt-get install -y -qq libvulkan1 libegl1 libgles2 >/dev/null 2>&1) || echo "could not install the GL loaders; going on"
    cp /work/runs/$RUN/*.cjs . && node job.cjs "/work/runs/$RUN/app" "/work/out/$RUN" "$SPEC"'
mkdir -p tools/out/gpu
hf buckets sync "hf://buckets/$BUCKET/out/$RUN" "tools/out/gpu/$RUN" >/dev/null
echo "results in tools/out/gpu/$RUN"
node -e 'const r=require(process.argv[1]);console.log("renderer:",r.renderer);for(const x of (r.script&&r.script.timeline)||[])console.log(x.set.padEnd(11),x.view.padEnd(6),String(x.ms.toFixed(2)).padStart(7),"ms",String(x.tris).padStart(9),"tris",x.calls,"calls");if(r.script&&r.script.error)console.log(r.script.error)' "$PWD/tools/out/gpu/$RUN/report.json"
