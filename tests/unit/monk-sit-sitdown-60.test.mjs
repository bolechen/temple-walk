import test from "node:test";
import { sitDownCase } from "./monk-sit-lib.mjs";
// The frame-by-frame sitting-down check of monk-sit.test.mjs at the 1/60 s step, the longest of the three (#697).
test("sitting down, his knees never come out through the robe: frame by frame, every point of his legs above the hem has cloth before it (frames of 17 ms)", () => sitDownCase([1 / 60]));
