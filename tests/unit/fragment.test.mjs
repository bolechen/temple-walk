// The part of an address after `#` that two features share (#343 lamps, #338 saves): round trips, and every way of being wrong is a reason, never a throw.
import test from "node:test"; import assert from "node:assert/strict";
import { pack, unpack, b64u, unb64u, crc8, deflate, inflate, ENVELOPE, MOST } from "../../app/src/fragment.js";

test("base64url round-trips every length, without padding", () => {
  for (let n = 0; n < 40; n++) { const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255), t = b64u(b); assert.ok(/^[A-Za-z0-9_-]*$/.test(t)); assert.deepEqual(unb64u(t), b); }
  assert.equal(unb64u("a"), null); assert.equal(unb64u("a+b/"), null); assert.equal(unb64u("ab=="), null);
});
test("pack and unpack: the kind and the bytes come back, with or without the #", () => {
  const t = pack("lamp", [1, 2, 3]); assert.deepEqual(unpack("#" + t), { ok: true, kind: "lamp", bytes: Uint8Array.from([1, 2, 3]) }); assert.equal(unpack(t).ok, true);
  assert.deepEqual(unpack(pack("save", [])).bytes, new Uint8Array(0));
  assert.throws(() => pack("Lamp", [1])); assert.throws(() => pack("toolongkind", [1])); assert.throws(() => pack("", [1]));
});
test("damage is a reason: empty, format, checksum, a version from the future", () => {
  assert.equal(unpack("").why, "empty"); assert.equal(unpack("#").why, "empty"); assert.equal(unpack(undefined).why, "empty");
  for (const bad of ["lamp", "lamp=", "LAMP=AAAA", "lamp=a", "=AAAA", "lamp=AQMJaw=", "lamp=<script>", "x".repeat(10), "lamp=" + "A".repeat(MOST)]) assert.equal(unpack(bad).ok, false, bad);
  const t = pack("lamp", [3, 9]); assert.equal(unpack(t.slice(0, -2)).ok, false);                       // cut
  const flip = t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"); assert.equal(unpack(flip).why, "checksum");  // mistyped
  const future = Uint8Array.from([ENVELOPE + 1, 3, 9]), body = new Uint8Array(4); body.set(future); body[3] = crc8(future);
  assert.equal(unpack("lamp=" + b64u(body)).why, "version");
  const zero = Uint8Array.from([0, 3, 9]), z = new Uint8Array(4); z.set(zero); z[3] = crc8(zero); assert.equal(unpack("lamp=" + b64u(z)).why, "version");
});
test("a check byte that is right for other bytes does not make these right (every single-byte change is caught)", () => {
  const t = pack("save", Array.from({ length: 30 }, (_, i) => i * 7 & 255)), raw = unb64u(t.split("=")[1]);
  for (let i = 0; i < raw.length; i++) { const c = raw.slice(); c[i] ^= 0x10; const u = unpack("save=" + b64u(c)); assert.equal(u.ok, false, "byte " + i); }
});
test("deflate and inflate round-trip; a bomb and garbage are refused", async () => {
  const text = new TextEncoder().encode(JSON.stringify({ seals: { bell: 1, tea: 2 }, note: "x".repeat(500) })), d = await deflate(text);
  assert.ok(d.length < text.length / 2); assert.deepEqual(await inflate(d), text);
  const bomb = await deflate(new Uint8Array(5_000_000)); assert.ok(bomb.length < 10_000); assert.equal(await inflate(bomb, 1 << 20), null);
  assert.equal(await inflate(Uint8Array.from([1, 2, 3, 4, 5])), null);
});
