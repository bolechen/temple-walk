import test from "node:test";
import { roomCase, rooms } from "./eye-rooms-lib.mjs";
// The eye inside the halls: see eye-rooms-lib.mjs for the setup and the case (split from eye-rooms.test.mjs, #697).
// Rooms main, guanyin, yaoshi, dahui; the others are in eye-rooms-halls.test.mjs.
for (const id of ["main", "guanyin", "yaoshi", "dahui"]) {
  test(`the eye stays inside ${id}'s room, his back to every wall, and on the way in and out`, () => roomCase(id));
}
