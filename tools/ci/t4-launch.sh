#!/usr/bin/env bash
# Run some end-to-end scenarios on a T4 in a Hugging Face Job and bring the result back (#335).
#   HF_TOKEN=… tools/ci/t4-launch.sh --shard=2/10 [-- more args for tests/e2e/run.cjs]
#   HF_TOKEN=… tools/ci/t4-launch.sh boot photo
# What it does: packs the checkout's tracked files and the built site (dist/, built first) into one archive, syncs it to
# a private bucket under runs/<run>/, starts a Job on a T4 that runs tools/ci/t4-job.sh, waits for it, brings
# /work/out/<run> back into $OUT/ and removes the run from the bucket. It exits non-zero on anything short of a
# job that finished and whose scenarios all passed: no token, no bucket, a Job that errors, times out or is cancelled,
# a report that did not come back, an exit code that is not 0. The Job's address is printed first.
#   T4_PACK_ONLY=/tmp/pack.tgz tools/ci/t4-launch.sh pack    # only build and pack (no token needed); T4_PACK=/tmp/pack.tgz then sends it
#   T4_OUT=dir sets where the result comes back to (default tools/out).
# Needs the `hf` command (pip install huggingface_hub). Never print the token. T4_FLAVOR and T4_TIMEOUT override the card and the limit; T4_GPU=0 with a CPU flavour (T4_FLAVOR=cpu-performance) tries the whole path without a card.
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT="${T4_OUT:-tools/out}"   # where the report and pictures come back to (a run of several shards by hand gives each its own)
fail() { echo "t4-launch: $*" >&2; exit 1; }
# Asked to send, it must have what it needs before it builds anything.
if [ -z "${T4_PACK_ONLY:-}" ]; then [ -n "${HF_TOKEN:-}" ] || fail "HF_TOKEN is not set (the repository secret of that name; see docs/RELEASING.md)"; [ -n "$*" ] || [ -n "${T4_CMD:-}" ] || fail "say which scenarios: --shard=i/N, or their names"; fi
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
ARGS="$*"; [ -n "$ARGS" ] || [ -n "${T4_CMD:-}" ] || fail "say which scenarios: --shard=i/N, or their names"
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
STARTED="$(hf jobs run -d --flavor "${T4_FLAVOR:-t4-small}" --timeout "${T4_TIMEOUT:-40m}" --name "temple-walk-e2e-$RUN" \
  -e RUN="$RUN" -e COMMIT="$COMMIT" -e E2E_ARGS="$ARGS" -e GPU_ON="${T4_GPU:-1}" -e T4_CMD="${T4_CMD:-}" -v "hf://buckets/$BUCKET:/work" \
  mcr.microsoft.com/playwright:v1.63.0-noble bash /work/runs/$RUN/t4-job.sh 2>&1)"
echo "$STARTED" | grep -v "^ *\(COMMIT\|RUN\|E2E_ARGS\|GPU_ON\|T4_CMD\)" | head -20
# The Job's id, as the command says it: in its own line (`id=…`), in the hint to wait for it (`hf jobs wait <account>/<id>`), or, failing both, a lone 24-character id. Versions of hf word these differently.
JOB="$(printf '%s\n' "$STARTED" | sed 's/\x1b\[[0-9;]*m//g' | sed -n -e 's/.*\bid=\([0-9a-f]\{8,\}\).*/\1/p' -e 's#.*hf jobs wait [^ /]*/\([0-9a-f]\{8,\}\).*#\1#p' | head -1)"
[ -n "$JOB" ] || JOB="$(printf '%s\n' "$STARTED" | grep -oE '(^|[^0-9a-f])[0-9a-f]{24}($|[^0-9a-f])' | grep -oE '[0-9a-f]{24}' | head -1)"
[ -n "$JOB" ] || fail "the Job did not start"
echo "t4-launch: job https://huggingface.co/jobs/$NS/$JOB"
START=$(date +%s)
# Waiting is our own slow poll, not `hf jobs wait`: that asks the API about once a second, and ten shards started together (#335) used up the
# account's 2500 requests per five minutes, so every launcher died on a 429 while its Job went on to finish. One look every 30 s (a shard's own offset
# keeps them from asking together) is a few dozen requests in all; an answer that is not a stage (a 429, a dropped line) is asked again, never taken for the end.
WAIT=1; LIMIT=$(( ${T4_WAIT_SECS:-3000} )); SHARD_N="$(printf '%s' "$ARGS" | sed -n 's#.*--shard=\([0-9]*\)/.*#\1#p')"; sleep $(( ${SHARD_N:-0} % 10 ))
while [ $(( $(date +%s) - START )) -lt "$LIMIT" ]; do
  STAGE="$(hf jobs inspect "$NS/$JOB" --format json 2>/dev/null | sed -n 's/.*"stage": *"\([A-Z_]*\)".*/\1/p' | head -1)"
  case "$STAGE" in COMPLETED) WAIT=0; break ;; ERROR|CANCELED|CANCELLED|DELETED) WAIT=1; break ;; esac
  sleep "${T4_POLL_SECS:-30}"
done
[ "$STAGE" = COMPLETED ] || [ "$STAGE" = ERROR ] || [ "$STAGE" = CANCELED ] || [ "$STAGE" = CANCELLED ] || [ "$STAGE" = DELETED ] || echo "t4-launch: gave up waiting after $LIMIT s (last stage: ${STAGE:-unknown})" >&2
echo "t4-launch: job ended with wait status $WAIT after $(( $(date +%s) - START )) s"
mkdir -p "$OUT"
hf jobs logs "$NS/$JOB" > "$OUT/t4-job.log" 2>&1 || echo "t4-launch: could not fetch the Job's log" >&2
tail -40 "$OUT"/t4-job.log
hf buckets sync "hf://buckets/$BUCKET/out/$RUN" "$OUT" >/dev/null || echo "t4-launch: nothing came back from the bucket" >&2
hf buckets rm "hf://buckets/$BUCKET/runs/$RUN" -R -y >/dev/null 2>&1 || true
hf buckets rm "hf://buckets/$BUCKET/out/$RUN" -R -y >/dev/null 2>&1 || true
DONE=1
[ "$WAIT" -eq 0 ] || fail "the Job did not complete: https://huggingface.co/jobs/$NS/$JOB"
[ -f "$OUT"/e2e-report.json ] || fail "the Job finished but no e2e-report.json came back"
[ "$(cat "$OUT"/exit 2>/dev/null)" = "0" ] || fail "scenarios failed (exit $(cat "$OUT"/exit 2>/dev/null || echo unknown)): see "$OUT"/e2e-report.json"
echo "t4-launch: all passed on $(cat "$OUT"/e2e-renderer.txt 2>/dev/null)"
