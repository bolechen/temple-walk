// The coin that goes into the 功德箱 by his own hand (issue #202). All of it is in his own frame: x to his left, z the way
// he faces, y up from the floor under him. The right hand takes the coin from where the palms meet, carries it between
// the fingertips to a point just over the slot, lets go, and the coin falls the few centimetres into it under its own
// weight; the left hand goes to rest at his sash. rites.js drives the hands with these numbers and tests/unit/offering.test.mjs
// holds them to what his arm can reach and to where the coin is while he holds it.
import * as THREE from "three";

export const TIP = 0.068;   // the wrist bone to the pinch of the fingers, along them (the skin of his hand reaches 0.076 past the wrist)
export const HOLD = 0.04;   // the pinch is held this far over the lid, over the middle of the slot; the coin falls this far
export const G = 9.8;
export const FALL = Math.sqrt((2 * HOLD) / G);   // seconds from the let go to the coin passing the lid's top
// The fingers' direction (unit) in his frame: up and a little forward in prayer, forward and down over the slot.
export const FINGERS = { pray: new THREE.Vector3(0, 1, 0.3).normalize(), over: new THREE.Vector3(0, -0.5, 1).normalize() };
export const PALM = new THREE.Vector3(1, 0, 0);   // the right palm faces his left throughout: the thumb up, the coin edge-on between it and the finger

const ease = (u) => u * u * (3 - 2 * u);
/** Where the pinch is held, and the wrist that holds it there, for a slot at `slot` (his frame). */
export function over(slot) {
  const pinch = new THREE.Vector3(slot.x, slot.y + HOLD, slot.z);
  return { pinch, wrist: pinch.clone().addScaledVector(FINGERS.over, -TIP) };
}
/**
 * The right hand `u` (0 to 1) of the way from the prayer to over the slot: the wrist, the way the fingers point, and
 * the coin between their tips. The wrist rises a little on the way and comes in over the lid from the front.
 * @param {number} u @param {THREE.Vector3} from the wrist in prayer @param {THREE.Vector3} slot
 */
export function carry(u, from, slot) {
  const k = ease(u), to = over(slot).wrist;
  const at = new THREE.Vector3().lerpVectors(from, to, k); at.y += 0.07 * Math.sin(Math.PI * k);
  const fingers = new THREE.Vector3().lerpVectors(FINGERS.pray, FINGERS.over, k).normalize();
  return { at, fingers, coin: at.clone().addScaledVector(fingers, TIP) };
}
/** The coin's height over the lid's top `t` seconds after the let go. */
export const fallen = (t) => HOLD - 0.5 * G * t * t;
