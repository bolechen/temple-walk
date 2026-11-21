// The phone audit runs beside every publication (#400) and keeps its pictures when it fails.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const y = fs.readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");
test("e2e.yml has a mobile job on every push that runs the audit in Chinese and English and uploads the pictures of a failing run", () => {
  const job = /^  mobile:\n([\s\S]*?)(?=^  [a-z-]+:\n|^  #)/m.exec(y)?.[1] || "";
  assert.match(job, /if: github\.event_name == 'push' \|\| github\.event\.inputs\.mobile == 'true'/);
  assert.match(y, /mobile:\n\s+description:[^\n]*\n\s+type: boolean\n\s+default: false/, "asked for by hand with the `mobile` input");
  assert.match(job, /lang: \[zh, en\]/, "Chinese and English, a machine each");
  assert.match(job, /run: node tools\/mobile-audit\.cjs \$\{\{ matrix\.lang != 'zh' && format\('--lang=\{0\}', matrix\.lang\) \|\| '' \}\}\n/);
  assert.match(job, /if: failure\(\)\n\s+uses: actions\/upload-artifact@v4/);
  assert.match(job, /path: tools\/out\/mobile\*\//);
  assert.match(job, /retention-days: 14/);
});
test("what the audit writes lies where the job uploads from", () => {
  const src = fs.readFileSync(new URL("../../tools/mobile-audit.cjs", import.meta.url), "utf8");
  assert.match(src, /"mobile" : `mobi/, "zh goes to tools/out/mobile and another language to tools/out/mobile-<lang>");
});
