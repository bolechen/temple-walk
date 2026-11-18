import "../../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { namedMaterials } from "./mats.mjs";
const S = await import("../../app/src/site.js");
const site = S.buildSite(namedMaterials()); console.time("walker"); const w = S.createWalker(site); console.timeEnd("walker");
console.log(S.SWAPPED, w.meshes, w.cost, w.heightAt(0, -4.8), w.blocked(0, 20), w.blocked(0, 13), w.floorAt(0,-4.8));
