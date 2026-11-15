// The real works in the halls: every one that is hung is described, credited and present, and no hall is given more
// than its walls can hold.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import "./dom-stub.mjs";
import * as THREE from "../../app/v/build/three.module.js";
const { WORKS, HANG } = await import("../../app/src/works.js");
const { buildSite } = await import("../../app/src/site.js");
const { KINDS } = await import("../../app/src/interior.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), app = new URL("../../app/", import.meta.url);

test("every work that hangs is described, credited to the museum that publishes it, and its picture is there", () => {
  const hung = Object.values(HANG).flat(); assert.equal(new Set(hung).size, hung.length, "a work hangs twice");
  for (const slug of hung) {
    const w = WORKS[slug]; assert.ok(w, `${slug} is hung but not described`);
    for (const k of ["title", "by", "period", "medium", "holder", "note", "link", "credit", "url"]) assert.ok(typeof w[k] === "string" && w[k].length > 1, `${slug}: no ${k}`);
    assert.ok(w.note.length >= 100 && w.note.length <= 200, `${slug}: the note is ${w.note.length} characters`);
    assert.ok(/ColBase \(https:\/\/colbase\.nich\.go\.jp\/collection_items\//.test(w.credit) || /Metropolitan Museum of Art.*Open Access/.test(w.credit), `${slug}: the source line does not name an open collection: ${w.credit}`);
    assert.ok(/^https:\/\/(colbase\.nich\.go\.jp|www\.metmuseum\.org)\//.test(w.url), `${slug}: ${w.url}`);
    const file = new URL(`g/${slug}.webp`, app); assert.ok(fs.existsSync(file) && fs.statSync(file).size > 8000, `${slug}: no picture in app/g`);
    assert.ok(fs.statSync(file).size < 300e3, `${slug}: the picture is heavier than 300 KB`); assert.ok(w.w > 300 && w.h > 300 && Math.max(w.w, w.h) <= 1280);
  }
  for (const slug of Object.keys(WORKS)) assert.ok(hung.includes(slug), `${slug} is described but hangs nowhere`);
});
test("each hall has wall enough for its works beside its own leaf", () => {
  for (const [id, slugs] of Object.entries(HANG)) {
    const hall = site.halls.find((h) => h.id === id); assert.ok(hall, `no hall called ${id}`);
    const frames = 2 * Math.max(1, Math.floor((KINDS[hall.kind].d - 2.4) / 3.1)); assert.ok(slugs.length <= frames - 1, `${hall.name} has ${frames} frames and ${slugs.length} works besides its leaf`);
  }
  for (const h of site.halls) assert.ok((HANG[h.id] || []).length >= 1, `${h.name} has nothing real on its walls`);
});
