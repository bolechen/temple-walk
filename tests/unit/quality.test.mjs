// Which tier a machine starts on, from the name of its graphics card.
import test from "node:test"; import assert from "node:assert/strict";
import { tierFor } from "../../app/src/quality.js";

test("a discrete card starts on the high tier", () => {
  for (const g of ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (AMD, Radeon RX 6700 XT, OpenGL 4.6)", "ANGLE (Intel, Intel(R) Arc(TM) A750 Graphics, D3D11)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)"]) assert.equal(tierFor(g), "high", g);
});
test("integrated, base Apple, software and hidden cards start on medium", () => {
  for (const g of ["ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)", "Apple GPU", "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)", "Google SwiftShader", "Mali-G78", "Adreno (TM) 740"]) assert.equal(tierFor(g), "medium", g);
});
test("no name at all is taken for a capable card, as before", () => { assert.equal(tierFor(""), "high"); assert.equal(tierFor(undefined), "high"); });
