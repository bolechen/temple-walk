// What a change did to the floor he may stand on (#194): the baked grid of this commit against another's (main's, on a
// pull request; the commit before, on a push to main).
//
//   node tools/walk-diff.mjs <base.bin> [new.bin = app/shared/walk/<level>.bin] [--level=<id>] [--png=<dir>]
//
// --level names whose floor (#405): the new file defaults to that level's, and the report says which level it is.
//
// It says, for the drawn floor and for the walker of the written plan alike:
//   1. how many square metres of floor he can reach were gained or lost, counted against the building (its platform
//      and a metre round) or the part of the place they lie in; any part that changed by more than 1 m² is listed;
//   2. which of the named places (site.places, site.seats, each hall's door, site.views) can no longer be walked to
//      from where he comes in. Any such place fails the check (exit 1), whatever the base says.
// The report is printed, and written to the job's summary on GitHub Actions ($GITHUB_STEP_SUMMARY). With --png, a
// picture of each grid that changed: grey where both reach, red lost, blue gained.
import { readFileSync, appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { decode, oldReached } from "../app/src/walkgrid.js";
import { png } from "./walk/png.mjs";
import { levelFromCommandLine, walkFile } from "./walk/level-arg.mjs";

export const LIMIT = 1;   // square metres a part may change by before it is listed

const inflate = (b) => inflateRawSync(b);
const partOf = (parts, x, z) => { for (const p of parts) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return p.name; return "其余"; };

/** The comparison of two decoded files: rows of area changed by part, and the places no longer reached. */
export function compare(base, next) {
  const rows = new Map(), add = (layer, grid, part, d) => { const k = `${layer}|${grid}|${part}`; const r = rows.get(k) || { layer, grid, part, gained: 0, lost: 0 }; if (d > 0) r.gained += d; else r.lost -= d; rows.set(k, r); };
  const pictures = [], notes = [];
  for (const g of next.grids) {
    const b = base?.grids.find((o) => o.id === g.id);
    if (!b) { notes.push(`${g.id}: 基准里没有这张格子，只查可达`); continue; }
    if (b.nx !== g.nx || b.nz !== g.nz || b.x0 !== g.x0 || b.z0 !== g.z0 || b.step !== g.step) { notes.push(`${g.id}: 格子的范围变了（${b.nx}×${b.nz} → ${g.nx}×${g.nz}），只比总面积：画的 ${b.open} → ${g.open} m²，旧数据 ${b.oldOpen} → ${g.oldOpen} m²`); continue; }
    const a = g.step * g.step, parts = g.kind === "outdoors" ? next.header.parts : [{ name: g.name, x0: -1e9, x1: 1e9, z0: -1e9, z1: 1e9 }];
    let changed = false; const diff = new Int8Array(g.nx * g.nz);
    for (let k = 0; k < g.nx * g.nz; k++) {
      const nNew = g.state[k] === 0, bNew = b.state[k] === 0, nOld = oldReached(g.old, k), bOld = oldReached(b.old, k);
      if (nNew === bNew && nOld === bOld) continue;
      const i = k % g.nx, j = (k - i) / g.nx, part = partOf(parts, g.x0 + (i + 0.5) * g.step, g.z0 + (j + 0.5) * g.step);
      if (nNew !== bNew) { add("画的", g.id, part, nNew ? a : -a); diff[k] = nNew ? 1 : -1; changed = true; }
      if (nOld !== bOld) add("旧数据", g.id, part, nOld ? a : -a);
    }
    if (changed) pictures.push({ id: g.id, nx: g.nx, nz: g.nz, diff, open: g.state });
  }
  // What the drawn floor opens that the written plan's walker never reached (#265, the lead from the census, #252): each
  // part over LIMIT is to be said in the PR to be floor the written plan missed, or closed where it is drawn (site.closed).
  const fresh = new Map();
  for (const g of next.grids) {
    if (!g.old) continue;
    const a = g.step * g.step, parts = g.kind === "outdoors" ? next.header.parts : [{ name: g.name, x0: -1e9, x1: 1e9, z0: -1e9, z1: 1e9 }];
    for (let k = 0; k < g.nx * g.nz; k++) {
      if (g.state[k] !== 0 || oldReached(g.old, k)) continue;
      const i = k % g.nx, j = (k - i) / g.nx, part = partOf(parts, g.x0 + (i + 0.5) * g.step, g.z0 + (j + 0.5) * g.step), key = `${g.id}|${part}`;
      fresh.set(key, (fresh.get(key) || 0) + a);
    }
  }
  const newOnly = [...fresh].map(([k, m2]) => { const [grid, part] = k.split("|"); return { grid, part, m2 }; }).sort((p, q) => q.m2 - p.m2);
  const lost = next.header.targets.filter((t) => !t.new || !t.old);
  return { rows: [...rows.values()].sort((p, q) => q.gained + q.lost - (p.gained + p.lost)), lost, pictures, notes, newOnly };
}

/** The report, as Markdown. */
export function report(c, { baseName = "基准", total = null } = {}) {
  const f = (v) => v.toFixed(2), big = c.rows.filter((r) => r.gained > LIMIT || r.lost > LIMIT);
  const out = [`### 可走的地面（#194）：本提交对比${baseName}`, ""];
  out.push(c.lost.length ? `**有 ${c.lost.length} 处命名地点从入口走不到了（检查失败）：**` : "命名地点（打卡点、座位、殿门站位、命名机位）从入口都走得到。");
  for (const t of c.lost) out.push(`- ${t.kind} \`${t.id}\`（${t.grid}，${t.at.map((v) => +v.toFixed(2)).join(", ")}，半径 ${t.r} m）：画的地面 ${t.new ? "到得了" : "**到不了**"}，旧数据 ${t.old ? "到得了" : "**到不了**"}`);
  out.push("");
  if (!c.rows.length) out.push("可走面积没有变化。");
  else {
    out.push(big.length ? `可走面积变化超过 ${LIMIT} m² 的部分：` : `可走面积有变化，没有哪一部分超过 ${LIMIT} m²：`, "", "| 层 | 格子 | 部分 | 多出 m² | 少了 m² |", "|---|---|---|---|---|");
    for (const r of big.length ? big : c.rows.slice(0, 8)) out.push(`| ${r.layer} | ${r.grid} | ${r.part} | ${f(r.gained)} | ${f(r.lost)} |`);
  }
  const fresh = (c.newOnly || []).filter((r) => r.m2 > LIMIT);
  out.push("", fresh.length ? `画的地面能站、旧数据走不到的（超过 ${LIMIT} m² 的部分；页面默认处处走画的地面，#274；每处都要在 PR 里说一句是旧数据漏了还是该关）：` : "画的地面能站而旧数据走不到的，没有哪一部分超过 " + LIMIT + " m²。");
  if (fresh.length) { out.push("", "| 格子 | 部分 | m² |", "|---|---|---|"); for (const r of fresh) out.push(`| ${r.grid} | ${r.part} | ${f(r.m2)} |`); }
  for (const n of c.notes) out.push("", `- ${n}`);
  if (total) out.push("", total);
  return out.join("\n") + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--")), pngDir = process.argv.find((a) => a.startsWith("--png="))?.slice(6);
  const level = levelFromCommandLine();
  const [baseFile, nextFile = walkFile(level)] = args;
  const next = decode(readFileSync(nextFile), inflate);
  const base = baseFile && existsSync(baseFile) ? decode(readFileSync(baseFile), inflate) : null;
  const c = compare(base, next);
  if (!base) c.notes.unshift(`没有基准文件（${baseFile || "未给"}）：只查可达`);
  const sum = (k) => next.grids.reduce((s, g) => s + g[k], 0).toFixed(1);
  const text = report(c, { baseName: `${process.env.WALK_BASE_NAME || (baseFile ? ` ${baseFile}` : "")}（关卡 ${level}）`, total: `本提交可走面积合计：画的 ${sum("open")} m²，旧数据 ${sum("oldOpen")} m²（${next.grids.length} 张格子）。` });
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  if (pngDir) {
    mkdirSync(pngDir, { recursive: true });
    for (const p of c.pictures) writeFileSync(`${pngDir}/walk-diff-${p.id.replace(/[^\w-]/g, "_")}.png`, png(p.nx, p.nz, (i, j) => { const k = j * p.nx + i; return p.diff[k] > 0 ? [40, 110, 205] : p.diff[k] < 0 ? [205, 60, 50] : p.open[k] === 0 ? [214, 210, 200] : [70, 66, 62]; }));
  }
  process.exit(c.lost.length ? 1 : 0);
}
