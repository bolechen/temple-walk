// node --import ./tools/spike/swap.mjs …: every import of app/src/site.js gets tools/spike/site-swap.mjs instead.
import { register } from "node:module";
register(new URL("./swap-hook.mjs", import.meta.url));
