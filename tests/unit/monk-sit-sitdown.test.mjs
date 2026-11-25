import test from "node:test";
import { sitDownCase } from "./monk-sit-lib.mjs";
// The frame-by-frame sitting-down check of monk-sit.test.mjs at the 1/30 s and 1/20 s steps; the 1/60 s step is in monk-sit-sitdown-60.test.mjs (#697).
test("sitting down, his knees never come out through the robe: frame by frame, every point of his legs above the hem has cloth before it (frames of 33 ms and 50 ms)", () => sitDownCase([1 / 30, 1 / 20]));
