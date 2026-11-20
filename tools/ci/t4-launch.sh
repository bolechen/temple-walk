#!/usr/bin/env bash
# Run some end-to-end scenarios on a T4 in a Hugging Face Job and bring the result back (#335).
#   HF_TOKEN=… tools/ci/t4-launch.sh --shard=2/4 [-- more args for tests/e2e/run.cjs]
#   HF_TOKEN=… tools/ci/t4-launch.sh boot photo
# What it does: packs the checkout's tracked files and the built site (dist/, built first) into one archive, syncs it to
# a private bucket under runs/<run>/, starts a Job on a T4 that runs tools/ci/t4-job.sh, waits for it, brings
# /work/out/<run> back into tools/out/ and removes the run from the bucket. It exits non-zero on anything short of a
# job that finished and whose scenarios all passed: no token, no bucket, a Job that errors, times out or is cancelled,
# a report that did not come back, an exit code that is not 0. The Job's address is printed first.
#   T4_PACK_ONLY=/tmp/pack.tgz tools/ci/t4-launch.sh pack    # only build and pack (no token needed); T4_PACK=/tmp/pack.tgz then sends it
# Needs the `hf` command (pip install huggingface_hub). Never print the token. T4_FLAVOR and T4_TIMEOUT override the card and the limit; T4_GPU=0 with a CPU flavour (T4_FLAVOR=cpu-performance) tries the whole path without a card.
set -uo pipefail
cd "$(dirname "$0")/../.."
fail() { echo "t4-launch: $*" >&2; exit 1; }
STAGE="$(mktemp -d)"; JOB=""
cleanup() { [ -z "$JOB" ] || [ -n "${DONE:-}" ] || hf jobs cancel "$NS/$JOB" >/dev/null 2>&1 || true; rm -rf "$STAGE"; }   # a cancelled step must not leave a card running and billing
trap cleanup EXIT; trap 'exit 130' INT TERM
# T4_PACK names an archive already made (the workflow packs once and every shard sends it); otherwise it is made here.
if [ -n "${T4_PACK:-}" ]; then cp "$T4_PACK" "$STAGE/repo.tgz" || fail "no archive at $T4_PACK"; else
  SITE="$(node -e 'console.log(require("./tools/site.cjs").site())')" || fail "the site did not build"
  # What the scenarios read besides the site: the sources they import, the unit helpers, the tools they call, the baked floor and doorways (not in git).
  git ls-files -z | tar --null -T - -czf "$STAGE/repo.tgz.base" 2>/dev/null || fail "could not pack the checkout"
  mkdir -p "$STAGE/pack" && tar xzf "$STAGE/repo.tgz.base" -C "$STAGE/pack" && rm "$STAGE/repo.tgz.base"
  rm -rf "$STAGE/pack/dist"; cp -R "$SITE" "$STAGE/pack/dist"
  for d in app/shared/walk app/shared/doorways; do [ -d "$d" ] && { mkdir -p "$STAGE/pack/$d"; cp -R "$d/." "$STAGE/pack/$d/"; }; done
  tar czf "$STAGE/repo.tgz" -C "$STAGE/pack" . && rm -rf "$STAGE/pack"
fi
if [ -n "${T4_PACK_ONLY:-}" ]; then cp "$STAGE/repo.tgz" "$T4_PACK_ONLY"; echo "t4-launch: packed $T4_PACK_ONLY"; exit 0; fi
[ -n "${HF_TOKEN:-}" ] || fail "HF_TOKEN is not set (the repository secret of that name; see docs/RELEASING.md)"
command -v hf >/dev/null || fail "the hf command is not installed (pip install huggingface_hub)"
ARGS="$*"; [ -n "$ARGS" ] || fail "say which scenarios: --shard=i/N, or their names"
NS="$(hf auth whoami --format json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.name||j.user||j.username||"")}catch{console.log("")}})')"
[ -n "$NS" ] || fail "the token is not accepted by Hugging Face"
BUCKET="$NS/temple-walk-e2e"
TAG="$(printf %s "$ARGS" | tr -c 'A-Za-z0-9' '-' | cut -c1-24)"
if [ -n "${GITHUB_RUN_ID:-}" ]; then RUN="gh$GITHUB_RUN_ID-${GITHUB_RUN_ATTEMPT:-1}-$TAG"; else RUN="$(date -u +%Y%m%d-%H%M%S)-$TAG"; fi
cp tools/ci/t4-job.sh "$STAGE/t4-job.sh"
hf buckets create "$BUCKET" --private --exist-ok >/dev/null || fail "could not make the bucket $BUCKET"
hf buckets sync "$STAGE" "hf://buckets/$BUCKET/runs/$RUN" --delete >/dev/null || fail "could not send the site to the bucket"
echo "t4-launch: run $RUN, scenarios: $ARGS"
COMMIT="$(git rev-parse HEAD)"
JOB="$(hf jobs run -d --flavor "${T4_FLAVOR:-t4-small}" --timeout "${T4_TIMEOUT:-40m}" --name "temple-walk-e2e-$RUN" \
  -e RUN="$RUN" -e COMMIT="$COMMIT" -e E2E_ARGS="$ARGS" -e GPU_ON="${T4_GPU:-1}" -v "hf://buckets/$BUCKET:/work" \
  mcr.microsoft.com/playwright:v1.63.0-noble bash /work/runs/$RUN/t4-job.sh | sed -n 's/.*\bid=\([0-9a-f]\{8,\}\).*/\1/p' | tail -1)"
[ -n "$JOB" ] || fail "the Job did not start"
echo "t4-launch: job https://huggingface.co/jobs/$NS/$JOB"
START=$(date +%s)
hf jobs wait "$NS/$JOB" --timeout "${T4_WAIT:-50m}"; WAIT=$?
echo "t4-launch: job ended with wait status $WAIT after $(( $(date +%s) - START )) s"
mkdir -p tools/out
hf jobs logs "$NS/$JOB" > tools/out/t4-job.log 2>&1 || echo "t4-launch: could not fetch the Job's log" >&2
tail -40 tools/out/t4-job.log
hf buckets sync "hf://buckets/$BUCKET/out/$RUN" tools/out >/dev/null || echo "t4-launch: nothing came back from the bucket" >&2
hf buckets rm "hf://buckets/$BUCKET/runs/$RUN" -R -y >/dev/null 2>&1 || true
hf buckets rm "hf://buckets/$BUCKET/out/$RUN" -R -y >/dev/null 2>&1 || true
DONE=1
[ "$WAIT" -eq 0 ] || fail "the Job did not complete: https://huggingface.co/jobs/$NS/$JOB"
[ -f tools/out/e2e-report.json ] || fail "the Job finished but no e2e-report.json came back"
[ "$(cat tools/out/exit 2>/dev/null)" = "0" ] || fail "scenarios failed (exit $(cat tools/out/exit 2>/dev/null || echo unknown)): see tools/out/e2e-report.json"
echo "t4-launch: all passed on $(cat tools/out/e2e-renderer.txt 2>/dev/null)"
