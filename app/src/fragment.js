// What is carried in the part of an address after `#`, which a browser keeps to itself (it is never sent to a server and
// does not reach an access log): a lamp lit for someone (#343, wishes.js), and later a saved walk taken to another device
// (#338). One envelope for both so that neither writes its own way of being damaged or too new: `kind=<base64url>`,
// where the bytes are a version, the payload and a one-byte check. `unpack` never throws: anything wrong is a reason, and
// the caller ignores it (a lamp) or says it (a save). The payload's own layout, and its own version, are the kind's.
// `deflate` and `inflate` are the browser's and Node's own CompressionStream, for a payload big enough to want it.

/** The envelope's version: what is written first. A reader meeting a larger one says it is too new. */
export const ENVELOPE = 1;
/** The most characters of an address's fragment taken in at all. */
export const MOST = 8192;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** @param {Uint8Array} bytes */
export function b64u(bytes) {
  let s = ""; for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : "") + (i + 2 < bytes.length ? ALPHABET[n & 63] : "");
  }
  return s;
}
/** The bytes of a base64url text, or null if it is not one (padding is not written and not taken). @param {string} text @returns {Uint8Array | null} */
export function unb64u(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const A = ALPHABET, out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0; for (let i = 0; i < text.length; i += 4) {
    const a = A.indexOf(text[i]), b = A.indexOf(text[i + 1]), c = i + 2 < text.length ? A.indexOf(text[i + 2]) : 0, d = i + 3 < text.length ? A.indexOf(text[i + 3]) : 0, n = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (n >> 16) & 255; if (i + 2 < text.length) out[o++] = (n >> 8) & 255; if (i + 3 < text.length) out[o++] = n & 255;
  }
  return out;
}
/** CRC-8 (polynomial 0x07) of the bytes: enough to tell a link cut or mistyped from one that was made. @param {Uint8Array} bytes */
export function crc8(bytes) { let c = 0; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 128 ? ((c << 1) ^ 7) & 255 : (c << 1) & 255; } return c; }

/** The text to put after `#` for a `kind` (lower-case letters, at most eight) and its payload bytes. @param {string} kind @param {Uint8Array | number[]} payload */
export function pack(kind, payload) {
  if (!/^[a-z]{1,8}$/.test(kind)) throw new Error("fragment kind must be 1 to 8 lower-case letters");
  const body = new Uint8Array(payload.length + 2); body[0] = ENVELOPE; body.set(payload, 1); body[body.length - 1] = crc8(body.subarray(0, body.length - 1));
  return `${kind}=${b64u(body)}`;
}
/** @typedef {{ ok: true, kind: string, bytes: Uint8Array } | { ok: false, why: "empty" | "format" | "checksum" | "version" }} Unpacked */
/** What an address's fragment (with or without its `#`) holds, or why it holds nothing usable. @param {string} hash @returns {Unpacked} */
export function unpack(hash) {
  const h = String(hash ?? "").replace(/^#/, "");
  if (!h) return { ok: false, why: "empty" };
  const m = /^([a-z]{1,8})=([A-Za-z0-9_-]+)$/.exec(h);
  if (!m || h.length > MOST) return { ok: false, why: "format" };
  const body = unb64u(m[2]);
  if (!body || body.length < 2) return { ok: false, why: "format" };
  if (crc8(body.subarray(0, body.length - 1)) !== body[body.length - 1]) return { ok: false, why: "checksum" };
  if (body[0] === 0 || body[0] > ENVELOPE) return { ok: false, why: "version" };
  return { ok: true, kind: m[1], bytes: body.slice(1, body.length - 1) };
}

/** @param {Uint8Array} bytes @returns {Promise<Uint8Array>} */
export async function deflate(bytes) { return drain(new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(new CompressionStream("deflate-raw"))); }
/** The inflated bytes, or null if they are not deflate or would come to more than `most` bytes (a small link that unpacks to a great deal is refused). @param {Uint8Array} bytes @param {number} [most] */
export async function inflate(bytes, most = 1 << 20) {
  try { return await drain(new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw")), most); } catch { return null; }
}
/** @param {ReadableStream<Uint8Array>} stream @param {number} [most] */
async function drain(stream, most = Infinity) {
  const reader = stream.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > most) { await reader.cancel(); throw new Error("too big"); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
