// Writes app/shared/licenses/THIRD-PARTY-NOTICES.txt: the licence of every library the published site is made of, in
// full, in one file that goes into dist/ as it is (the credits page links to it).
//
//     node tools/notices.mjs            write it
//     node tools/notices.mjs --check    exit 1 if the file on disk is not what would be written (tests/unit/notices.test.mjs)
//
// three.js and meshoptimizer's texts are read from node_modules, so a new release brings its own; the others
// (lil-gui, stats.js, Basis Universal's LICENSE and NOTICE) are not in any installed package and are kept beside this
// file's output in app/shared/licenses/, copied from each project's repository on 2026-11-16.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), LIC = path.join(ROOT, "app/shared/licenses"), OUT = path.join(LIC, "THIRD-PARTY-NOTICES.txt");
const read = (p) => fs.readFileSync(p, "utf8").trim();
const three = JSON.parse(read(path.join(ROOT, "node_modules/three/package.json"))).version;

const LIBS = [
  { name: "three.js", version: three, license: "MIT", url: "https://github.com/mrdoob/three.js", text: [read(path.join(ROOT, "node_modules/three/LICENSE"))], note: "Bundled into the page. Its addons used here: the Basis texture loader, the meshopt decoder, and the tree generator (examples/jsm/generators/TreeGenerator.js), copied with changes into app/src/three-tree.js, which grows the cryptomerias' wood." },
  { name: "meshoptimizer", version: "decoder shipped with three.js " + three, license: "MIT", url: "https://github.com/zeux/meshoptimizer", text: [read(path.join(ROOT, "node_modules/meshoptimizer/LICENSE.md"))], note: "The WebAssembly decoder in three's meshopt_decoder.module.js, which opens the statue models." },
  { name: "Basis Universal", version: "transcoder shipped with three.js " + three, license: "Apache-2.0", url: "https://github.com/BinomialLLC/basis_universal", text: [read(path.join(LIC, "basis-universal-LICENSE")), "NOTICE\n\n" + read(path.join(LIC, "basis-universal-NOTICE")).replace(/^NOTICE\s*/, "")], note: "app/vendor/basis/basis_transcoder.js and .wasm, unmodified, which open the KTX2 textures in the statue models. \"Basis Universal\" is a trademark of Binomial LLC." },
  { name: "lil-gui", version: "0.17.0", license: "MIT", url: "https://github.com/georgealways/lil-gui", text: [read(path.join(LIC, "lil-gui-LICENSE"))], note: "The debug panel of the development server, from three.js's addons. The published site does not load it." },
  { name: "stats.js", version: "bundled with three.js " + three, license: "MIT", url: "https://github.com/mrdoob/stats.js", text: [read(path.join(LIC, "stats.js-LICENSE"))], note: "The frame graph of the debug panel, from three.js's addons. The published site does not load it." },
];

export function compose() {
  const rule = "=".repeat(78);
  const head = ["THIRD-PARTY NOTICES", "", "Temple Walk is made with the libraries below. Each is used under the licence reproduced after its name.", "The typefaces' licence is in ../fonts/OFL.txt; the pictures and models are credited on the page of thanks in the game.", ""];
  const body = LIBS.map((l) => [rule, `${l.name} (${l.version}) — ${l.license}`, l.url, l.note, rule, "", ...l.text.flatMap((t) => [t, ""])].join("\n"));
  return head.join("\n") + "\n" + body.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = compose();
  if (process.argv.includes("--check")) { if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text) { console.error("app/shared/licenses/THIRD-PARTY-NOTICES.txt is out of date: run node tools/notices.mjs"); process.exit(1); } }
  else { fs.writeFileSync(OUT, text); console.log(`notices: ${path.relative(ROOT, OUT)}, ${text.length} bytes`); }
}
