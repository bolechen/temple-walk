#!/usr/bin/env bash
# The half of a T4 end-to-end run that happens inside the Hugging Face Job (#335, tools/ci/t4-launch.sh starts it).
# The launcher put the checkout and the built site in /work/runs/$RUN; this unpacks them, asks Chromium for the card
# through Vulkan and walks the scenarios it was given (E2E_ARGS: `--shard=2/4`, or scenario names), and leaves the
# report, the screenshots and the exit code in /work/out/$RUN. The exit code is also this script's own, so a job whose
# scenarios failed is a failed job.
set -uo pipefail
RUN="${RUN:?}"; OUT="/work/out/$RUN"; mkdir -p "$OUT"
log() { echo "[t4-job] $*"; }
(apt-get update -qq && apt-get install -y -qq libvulkan1 libegl1 libgles2 >/dev/null 2>&1) || log "could not install the GL loaders; going on"
mkdir -p /tmp/repo && tar xzf "/work/runs/$RUN/repo.tgz" -C /tmp/repo && cd /tmp/repo || { echo 2 > "$OUT/exit"; exit 2; }
npm i -g pnpm@10.28.0 >/dev/null 2>&1 || log "could not install pnpm"
pnpm install --frozen-lockfile >"$OUT/install.log" 2>&1 || { tail -20 "$OUT/install.log"; echo 2 > "$OUT/exit"; exit 2; }
# The browser is the image's own (PLAYWRIGHT_BROWSERS_PATH), the version the lockfile pins; the site is the one built on the launcher.
export TEMPLE_SITE=/tmp/repo/dist
[ "${GPU_ON:-1}" = 1 ] && export E2E_GPU=1   # GPU_ON=0 only for trying the pipeline on a flavour with no card (T4_GPU=0 in the launcher)
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>&1 | tee "$OUT/gpu.txt"
START=$(date +%s)
if [ -n "${T4_CMD:-}" ]; then bash -c "$T4_CMD"; STATUS=$?; else node tests/e2e/run.cjs ${E2E_ARGS:-}; STATUS=$?; fi   # T4_CMD: a command in place of the scenarios, for looking at what a page does on the card
log "scenarios finished with $STATUS after $(( $(date +%s) - START )) s"
cp -R tools/out/. "$OUT/" 2>/dev/null || true
echo "$STATUS" > "$OUT/exit"
exit "$STATUS"
