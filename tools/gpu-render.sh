#!/usr/bin/env bash
# Draw the temple on a real graphics card and bring back the pictures and the frame rates.
# The working tree's app/ (without the hall's statue models) is synced to a private Hugging Face bucket,
# a Hugging Face Job with a GPU opens it in Chromium (tools/gpu/job.cjs), and the results come back to tools/out/gpu/.
#
#   tools/gpu-render.sh                         # the default measurements and pictures, on one T4
#   tools/gpu-render.sh l4x1 '{"shots":["court@autumn-dusk@third"],"size":[3840,2160]}'
#   LEVEL=t05 tools/gpu-render.sh t4-small '{"bench":[{"view":"cam03","q":"high","size":[1920,1080]}],"shots":["cam03"]}'   # another level's pages (?level=); its views are its own, so the spec is given
#
# Needs the `hf` command (pip install huggingface_hub) logged in to an account that may run Jobs. A T4 costs about
# $0.40 an hour and a run takes a few minutes. The spec is JSON: see the top of tools/gpu/job.cjs.
set -euo pipefail
cd "$(dirname "$0")/.."
FLAVOR="${1:-t4-small}"
SPEC="${2:-}"
if [ -n "${LEVEL:-}" ] && [ "$LEVEL" != "t00" ] && [ -z "$SPEC" ]; then echo "LEVEL=$LEVEL: the default measurements are the prologue's views; give a spec with this level's own" >&2; exit 2; fi
if [ -z "$SPEC" ]; then SPEC='{
  "seconds": 6,
  "bench": [
    {"view":"court","q":"high","size":[1920,1080],"season":"autumn","time":"dusk"},
    {"view":"court","q":"medium","size":[1920,1080],"season":"autumn","time":"dusk"},
    {"view":"court","q":"low","size":[1920,1080],"season":"autumn","time":"dusk"},
    {"view":"arrive","q":"high","size":[1920,1080]},
    {"view":"lookback","q":"high","size":[1920,1080]},
    {"view":"court","q":"high","size":[2560,1440],"season":"winter","time":"night"},
    {"view":"court","q":"low","size":[390,844],"scale":3,"season":"autumn","time":"dusk"}
  ],
  "size": [1920,1080],
  "shots": ["court@autumn-dusk@third","arrive@spring-dawn@third","front@autumn-dusk","hall@summer-day","library@winter-day","lookback@autumn-dusk","teamat@autumn-dusk@third","lamps@winter-night"]
}'; fi
if [ -n "${LEVEL:-}" ]; then SPEC="$(printf %s "$SPEC" | LEVEL="$LEVEL" node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const j=JSON.parse(s);j.level=process.env.LEVEL;process.stdout.write(JSON.stringify(j))})')"; fi
NS="$(hf auth whoami --format json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.name||j.user||j.username)})')"
BUCKET="$NS/temple-walk-render"
RUN="$(date -u +%Y%m%d-%H%M%S)"
hf buckets create "$BUCKET" --private --exist-ok >/dev/null
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
SITE="$(node -e 'console.log(require("./tools/site.cjs").site())')"   # the built site, staged under the name the job expects
cp -R "$SITE" "$STAGE/app"; rm -rf "$STAGE/app/plate.webp"; [ -n "${KEEP_MODELS:-}" ] || find "$STAGE/app/shared/models" -type f ! -name "novice*.glb" -delete;   # KEEP_MODELS=1: the statues go along (the walk-round survey wants the Buddha); the novice's bodies always do (#163: he wears one by default)
 cp tools/gpu/job.cjs "$STAGE/job.cjs"; cp tools/site.cjs "$STAGE/site.cjs"; for f in ${EXTRA_FILES:-}; do cp "$f" "$STAGE/"; done   # EXTRA_FILES: scripts a spec names with "script" (tools/marketing-gpu.sh)
# BASE_SITE: another build (the base commit), served at base/ in the same job so the two can be measured turn about.
if [ -n "${BASE_SITE:-}" ]; then cp -R "$BASE_SITE" "$STAGE/app/base"; [ -n "${KEEP_MODELS:-}" ] || find "$STAGE/app/base/shared/models" -type f ! -name "novice*.glb" -delete; rm -rf "$STAGE/app/base/plate.webp"; fi   # KEEP_MODELS keeps the base's figures too, or the two would not be drawing the same hall (#749)
# Each run stages under runs/<run>, outside in/: two sessions sharing the bucket once overwrote each other's site
# mid-job (a sync of in/ with --delete removes everything else under it).
hf buckets sync "$STAGE" "hf://buckets/$BUCKET/runs/$RUN" --delete >/dev/null
echo "run $RUN on $FLAVOR"
COMMIT="$(git rev-parse HEAD)$(git diff --quiet HEAD -- app || echo +dirty)"   # recorded in report.json with the site's fingerprint
hf jobs run --flavor "$FLAVOR" --timeout "${JOB_TIMEOUT:-25m}" --name "temple-walk-render-$RUN" \
  -e RUN="$RUN" -e COMMIT="$COMMIT" -e NEED_FFMPEG="${NEED_FFMPEG:-}" -e SPEC="$(printf %s "$SPEC" | base64 | tr -d '\n')" \
  -v "hf://buckets/$BUCKET:/work" \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c 'set -e; mkdir -p /tmp/run && cd /tmp/run && npm init -y >/dev/null 2>&1 && npm i playwright@1.63.0 >/dev/null 2>&1
    (apt-get update -qq && apt-get install -y -qq libvulkan1 libegl1 libgles2 >/dev/null 2>&1) || echo "could not install the GL loaders; going on"
    [ -n "$NEED_FFMPEG" ] && { apt-get install -y -qq ffmpeg >/dev/null 2>&1 || echo "could not install ffmpeg"; }
    cp /work/runs/$RUN/*.cjs . && node job.cjs "/work/runs/$RUN/app" "/work/out/$RUN" "$SPEC"'
mkdir -p tools/out/gpu
hf buckets sync "hf://buckets/$BUCKET/out/$RUN" "tools/out/gpu/$RUN" >/dev/null
echo "results in tools/out/gpu/$RUN"
node -e 'const r=require(process.argv[1]);console.log("renderer:",r.renderer);for(const b of r.bench)console.log(String(b.fps||b.error).padStart(7),"fps",String(b.ms||"").padStart(6),"ms/frame",String(b.cost??"").padStart(6),"ms to draw",b.q.padEnd(7),(b.size||[]).join("x").padEnd(10),b.view,b.season||"",b.time||"",b.off?"off="+b.off:"",b.tris?`| ${b.tris} tris ${b.calls} calls buffer ${b.buffer.join("x")}`:"")' "$PWD/tools/out/gpu/$RUN/report.json"
