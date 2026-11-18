// Cut a piece of a 5 cm comparison map out and enlarge it: node tools/spike/crop.mjs <png> <x0> <z0> <x1> <z1> <out> [scale]
// (the map's own corner is the trial region's, x −22, z −24, or the room's, given as ORIGIN=x,z)
import sharp from "sharp";
const [src, x0, z0, x1, z1, out, sc = 4] = process.argv.slice(2), [ox, oz] = (process.env.ORIGIN || "-22,-24").split(",").map(Number), S = 0.05;
const left = Math.round((+x0 - ox) / S), top = Math.round((+z0 - oz) / S), width = Math.round((x1 - x0) / S), height = Math.round((z1 - z0) / S);
await sharp(src).extract({ left, top, width, height }).resize(width * sc, height * sc, { kernel: "nearest" }).toFile(out);
