#!/usr/bin/env bash
# Draws the publicity pictures and film frames on one T4 (tools/gpu-render.sh does the launching), then keeps the big
# files in the render bucket and writes a manifest into docs/marketing/ (names, SHA-256, commit, addresses, site fingerprint).
#   tools/marketing-gpu.sh sample    # one 12 s segment of the bell + two or three stills: proves the flow, well under 10 minutes
#   tools/marketing-gpu.sh full      # every still in shots.json and all four segments, vertical (run `... full-wide` for 16:9)
# Needs `hf` logged in (HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx stands in for the proxy's real one). A run costs about $0.40 an hour.
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-sample}"
case "$MODE" in
  sample)    STILLS="screen-land,lookback-port"; FILM='{"out":"film","fps":30,"size":[1080,1920],"only":["3-bell"],"maxSecs":12}'; TIMEOUT=10m ;;
  full)      STILLS=""; FILM='{"out":"film-v","fps":30,"size":[1080,1920]}'; TIMEOUT=40m ;;
  full-wide) STILLS="-"; FILM='{"out":"film-x","fps":30,"size":[1920,1080]}'; TIMEOUT=30m ;;
  *) echo "usage: $0 sample|full|full-wide"; exit 2 ;;
esac
if [ "$STILLS" = "-" ]; then SHOTS='{"shots":[]}'; elif [ -n "$STILLS" ]; then SHOTS="$(node tools/marketing-shots.cjs --spec --ids "$STILLS")"; else SHOTS="$(node tools/marketing-shots.cjs --spec)"; fi
SPEC="$(node -e 'const s=JSON.parse(process.argv[1]);s.script="marketing-film.cjs";s.args=JSON.parse(process.argv[2]);console.log(JSON.stringify(s))' "$SHOTS" "$FILM")"
EXTRA_FILES="tools/marketing-film.cjs" NEED_FFMPEG=1 JOB_TIMEOUT="$TIMEOUT" tools/gpu-render.sh t4-small "$SPEC"
RUN="$(ls -t tools/out/gpu | head -1)"; DAY="$(date -u +%F)"
NS="$(hf auth whoami --format json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>console.log(JSON.parse(s).user||JSON.parse(s).name))')"
hf buckets sync "tools/out/gpu/$RUN" "hf://buckets/$NS/temple-walk-render/marketing/$DAY/$RUN" >/dev/null
node -e '
const fs=require("fs"),path=require("path"),crypto=require("crypto"),dir=process.argv[1],run=process.argv[2],day=process.argv[3],ns=process.argv[4];
const rep=JSON.parse(fs.readFileSync(path.join(dir,"report.json"),"utf8")),files=[];
const walk=(d)=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);fs.statSync(p).isDirectory()?walk(p):files.push(p)}};walk(dir);
const man={run,day,bucket:`hf://buckets/${ns}/temple-walk-render/marketing/${day}/${run}/`,renderer:rep.renderer,site:rep.site,started:rep.started,finished:rep.finished,errors:rep.errors,
  script:rep.script&&(rep.script.error?{error:rep.script.error}:{timeline:rep.script.timeline}),shots:rep.shots,
  files:files.filter(f=>!f.endsWith("report.json")).map(f=>({file:path.relative(dir,f),bytes:fs.statSync(f).size,sha256:crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")}))};
fs.writeFileSync(`docs/marketing/manifest-${run}.json`,JSON.stringify(man,null,1));console.log("manifest docs/marketing/manifest-"+run+".json",man.files.length,"files");
' "tools/out/gpu/$RUN" "$RUN" "$DAY" "$NS"
