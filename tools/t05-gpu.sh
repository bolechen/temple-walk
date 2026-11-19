#!/usr/bin/env bash
# The T05 white-box hall on a real graphics card (issue #280): what no statue, one, three and seven statues cost a frame.
# Stages the built hall page and the statue files to the private render bucket, runs tools/gpu/job.cjs with the script
# tools/gpu/t05-hall-gpu.cjs on a Hugging Face Job, and brings back tools/out/gpu/<run>/ (report.json and pictures).
#
#   tools/t05-gpu.sh <a.glb> <b.glb> <c.glb> [flavor]      the three statues of one route (centre, east, west)
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
cp app/favicon.svg "$STAGE/app/favicon.svg"                       # job.cjs probes the card on a same-origin page
cp tools/gpu/job.cjs tools/gpu/t05-hall-gpu.cjs "$STAGE/"
SPEC="$(node -e '
const S = (u, x, turn, extra = {}) => ({ url: "s/" + u + ".glb", x, h: x ? 8.8 : 9.0, turn, paint: "clay", ...extra });
const T = -Math.PI / 2, three = [S(0, 0, T), S(1, 5.8, T), S(2, -5.8, T)];
const seven = [S(0, 0, T), S(1, 5.8, T), S(2, -5.8, T), S(1, 11.33, T), S(2, -11.33, T), S(1, 16.45, T), S(2, -16.45, T)];
console.log(JSON.stringify({ script: "t05-hall-gpu.cjs", args: { out: "hall", sets: [
  { name: "none", statues: [] }, { name: "one", statues: [S(0, 0, T)] }, { name: "three", statues: three }, { name: "seven", statues: seven },
  { name: "seven-noao", statues: seven, ao: false } ] } }));')"
hf buckets create "$BUCKET" --private --exist-ok >/dev/null
hf buckets sync "$STAGE" "hf://buckets/$BUCKET/runs/$RUN" --delete >/dev/null
echo "run $RUN on $FLAVOR"
COMMIT="$(git rev-parse HEAD)$(git diff --quiet HEAD -- tools/t05-hall || echo +dirty)"
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
