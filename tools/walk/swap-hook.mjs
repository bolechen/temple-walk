// The loader hook tools/walk/swap.mjs registers (#265).
const SITE = new URL("../../app/src/site.js", import.meta.url).href, SWAP = new URL("./site-grid.mjs", import.meta.url).href;
export async function resolve(spec, ctx, next) {
  const r = await next(spec, ctx);
  if (r.url === SITE && !spec.endsWith("?real")) return { ...r, url: SWAP };
  return r;
}
