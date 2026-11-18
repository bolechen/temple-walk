#!/usr/bin/env bash
# Joins the silent segments tools/marketing-film.cjs wrote (1-opening.mp4, 2-title.mp4 …) into one film: a slow dissolve
# between segments, a fade in and out, the score under it and the bells over it. Nothing is added to the picture.
#   tools/marketing-edit.sh <dir of segments> <music.mp3|wav> <bells.wav> <out.mp4> [dissolve secs, default 0.8]
# music: an excerpt of what `node tools/music.mjs autumn-dusk` writes (tools/out/music/); bells: `node tools/marketing-audio.mjs`.
# A short cut for X (10–15 s): add  -ss <from> -t <secs>  after the output name's ffmpeg call, or run this on fewer segments.
set -euo pipefail
DIR="$1"; MUSIC="$2"; BELLS="$3"; OUT="$4"; X="${5:-0.8}"
mapfile -t SEG < <(ls "$DIR"/*.mp4 | sort)
N=${#SEG[@]}; IN=(); for f in "${SEG[@]}"; do IN+=(-i "$f"); done
DUR=(); for f in "${SEG[@]}"; do DUR+=("$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"); done
# video: xfade chain; each dissolve starts X seconds before the end of what has been joined so far
FG=""; PREV="[0:v]"; ACC="${DUR[0]}"
for ((i = 1; i < N; i++)); do
  OFF=$(awk -v a="$ACC" -v x="$X" 'BEGIN{printf "%.3f", a - x}')
  FG+="${PREV}[${i}:v]xfade=transition=fade:duration=${X}:offset=${OFF}[v${i}];"; PREV="[v${i}]"
  ACC=$(awk -v a="$ACC" -v d="${DUR[$i]}" -v x="$X" 'BEGIN{printf "%.3f", a + d - x}')
done
FG+="${PREV}fade=t=in:st=0:d=1,fade=t=out:st=$(awk -v a="$ACC" 'BEGIN{printf "%.3f", a - 1.5}'):d=1.5[vout];"
# audio: music under (lower, faded), bells over
FG+="[$N:a]atrim=0:${ACC},volume=0.55,afade=t=in:st=0:d=2,afade=t=out:st=$(awk -v a="$ACC" 'BEGIN{printf "%.3f", a - 3}'):d=3[m];"
FG+="[$((N + 1)):a]atrim=0:${ACC}[b];[m][b]amix=inputs=2:duration=first:normalize=0[aout]"
ffmpeg -y -loglevel error "${IN[@]}" -i "$MUSIC" -i "$BELLS" -filter_complex "$FG" -map "[vout]" -map "[aout]" \
  -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "wrote $OUT ($ACC s)"
