#!/usr/bin/env bash
# The walk-round survey (#252) on one T4: the list and stations from tools/around.mjs, the pictures from tools/around-shots.cjs,
# the contact sheets from tools/around-sheet.py. Needs `hf` logged in (HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx stands in
# for the proxy's real one) and NODE_USE_ENV_PROXY=1 for Node behind a proxy. Brings the pictures back to tools/out/gpu/<run>/shots/.
#   tools/around-gpu.sh              # everything: ~340 station pictures at 960x540 and 200 x 8 visitors' eyes at 320x180
#   tools/around-gpu.sh --try        # a few pictures only, to prove the flow
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/around.mjs tools/out/around
LIMIT=1000000; [ "${1:-}" = "--try" ] && LIMIT=3
SPEC="$(node -e 'console.log(JSON.stringify({seconds:0,shots:[],script:"around-shots.cjs",args:{plan:"around-plan.cjs",out:"shots",size:[960,540],vsize:[320,180],limit:+process.argv[1]}}))' "$LIMIT")"
KEEP_MODELS=1 EXTRA_FILES="tools/around-shots.cjs tools/out/around/around-plan.cjs" JOB_TIMEOUT="${JOB_TIMEOUT:-45m}" tools/gpu-render.sh t4-small "$SPEC"
