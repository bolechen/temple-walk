// A photograph, mounted: the picture on a sheet of paper with a line of verse, the name of the place, and a seal.
const BRUSH = '"Yunjing Brush", "STKaiti", "KaiTi", "Kaiti SC", serif', SERIF = '"Yunjing Serif", "Songti SC", "STSong", serif';

export async function composeCard(shot, { line, label, temple, url }) {
  try { await Promise.all([document.fonts.load(`80px "Yunjing Brush"`, line + temple), document.fonts.load(`30px "Yunjing Serif"`, label)]); } catch {}
  const W = shot.width, H = shot.height, m = Math.round(Math.min(W, H) * 0.055), foot = Math.round(Math.min(W, H) * 0.2);
  const c = document.createElement("canvas"); c.width = W + m * 2; c.height = H + m + foot;
  const x = c.getContext("2d"), u = Math.min(W, H) / 100;
  x.fillStyle = "#f3efe5"; x.fillRect(0, 0, c.width, c.height);
  // The tooth of the paper.
  let s = 9; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "90,80,60" : "255,255,255"},${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * c.width, rnd() * c.height, 1 + rnd() * 3, 1); }
  x.shadowColor = "rgba(40,30,20,.28)"; x.shadowBlur = u * 1.6; x.shadowOffsetY = u * 0.5;
  x.drawImage(shot, m, m); x.shadowColor = "transparent";
  x.strokeStyle = "rgba(30,26,22,.35)"; x.lineWidth = 1; x.strokeRect(m + 0.5, m + 0.5, W - 1, H - 1);

  const y0 = H + m, cy = y0 + foot / 2;
  x.fillStyle = "#26221e"; x.textBaseline = "middle"; x.textAlign = "left";
  x.font = `${Math.round(u * 5.4)}px ${BRUSH}`; x.fillText(line, m + u, cy - u * 2.4);
  x.fillStyle = "#6f695e"; x.font = `${Math.round(u * 2.1)}px ${SERIF}`;
  try { x.letterSpacing = `${u * 0.7}px`; } catch {}
  x.fillText(`${temple} · ${label}`, m + u, cy + u * 3.4);
  x.fillStyle = "#a39c8e"; x.font = `${Math.round(u * 1.5)}px ${SERIF}`; try { x.letterSpacing = `${u * 0.15}px`; } catch {}
  x.fillText(url, m + u, cy + u * 6.6);
  // The seal: two characters cut in red, pressed a little unevenly.
  const z = u * 8.6, sx = c.width - m - u - z, sy = cy - z / 2 - u * 0.4;
  x.save(); x.translate(sx + z / 2, sy + z / 2); x.rotate(-0.025); x.fillStyle = "#b02a1f";
  const r = z * 0.12; x.beginPath(); x.roundRect(-z / 2, -z / 2, z, z, r); x.fill();
  x.fillStyle = "#f6efe2"; x.textAlign = "center"; try { x.letterSpacing = "0px"; } catch {} x.font = `${Math.round(z * 0.46)}px ${BRUSH}`;
  [...temple.slice(0, 2)].forEach((ch, i) => x.fillText(ch, 0, (i - 0.5) * z * 0.46 + z * 0.02));
  x.globalCompositeOperation = "destination-out";   // wear in the seal
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.5})`; x.fillRect((rnd() - 0.5) * z, (rnd() - 0.5) * z, 1 + rnd() * u * 0.4, 1 + rnd() * u * 0.25); }
  x.restore();
  // destination-out cut through to nothing; lay paper back under those specks.
  x.globalCompositeOperation = "destination-over"; x.fillStyle = "#f3efe5"; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = "source-over";
  return c;
}
