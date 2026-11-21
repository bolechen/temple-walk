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
cp tools/gpu/job.cjs tools/gpu/t05-hall-gpu.cjs "$STAGE/"
SPEC="$(SETS="${SETS:-}" node -e '
const S = (u, x, turn, extra = {}) => ({ url: "s/" + u + ".glb", x, h: x ? 8.8 : 9.0, turn, paint: "clay", ...extra });
const T = -Math.PI / 2, three = [S(0, 0, T), S(1, 5.8, T), S(2, -5.8, T)];
const seven = [S(0, 0, T), S(1, 5.8, T), S(2, -5.8, T), S(1, 11.33, T), S(2, -11.33, T), S(1, 16.45, T), S(2, -16.45, T)];
if (process.env.SETS === "seven370") {
  // the seven Buddhas as made (#370 and after): each its own near-level file and its own anchors, east to west, in clay and painted, twice over; and the line-up pictures
  const N = ["kasyapa-t05", "krakucchanda-t05", "sikhin-t05", "vipasyin-t05", "visvabhu-t05", "kanakamuni-t05", "sakyamuni-370"], X = [16.45, 11.33, 5.8, 0, -5.8, -11.33, -16.45];
  const L = N.map((c, i) => ({ url: "s/" + (10 + i) + ".glb", x: X[i], h: i === 3 ? 9.4 : 9.0, base: false, plinth: 0.4, turn: 0, headAt: 0.13, maxW: 5.7, halo: { rings: 0, tips: 0 }, paint: "clay", colour: c }));
  const V = ["door", "door3", "front10"], sets = [];
  sets.push({ name: "lineup", size: [1920, 1080], statues: L, shots: [
    { name: "door3-winter", shoot: { paint: true, mood: "winter", view: "door3" } }, { name: "door-winter", shoot: { paint: true, mood: "winter", view: "door" } },
    { name: "cam06-winter", shoot: { paint: true, mood: "winter", view: "cam06" } }, { name: "row-winter", shoot: { paint: true, mood: "winter", view: "front10", over: { at: [0, 7.0, -1.0], look: [0, 8.8, -17.6], fov: 72, exp: 3.8 } } } ] });
  for (const k of [1, 2]) { sets.push({ name: "none-" + k, statues: [], views: V }, { name: "seven-clay-" + k, statues: L, paint: false, views: V }, { name: "seven-paint-" + k, statues: L, paint: true, views: V }); }
  console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets } })); process.exit(0);
}
if (process.env.SETS === "lod370") {
  const L = (u, paint) => [-16.45, -11.33, -5.8, 0, 5.8, 11.33, 16.45].map((x) => ({ url: "s/" + u + ".glb", x, h: 9.0, base: false, plinth: 0.4, turn: 0, headAt: 0.13, halo: { rings: 0, tips: 0 }, paint: "clay", colour: "sakyamuni-370" }));
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
