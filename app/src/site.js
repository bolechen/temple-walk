// The temple's plan now lies with its level, in app/levels/t00/site.js: what is built where belongs to the place, not
// to the engine (#138, #362; docs/t05/LEVEL-SPLIT.md, S1). This file only hands it on, so that everything which has
// always asked for app/src/site.js (the page's modules, the unit tests, tools/walk's swap of the walker) is answered by
// the same module, unchanged. It goes once the engine asks a level for its plan (S2).
export * from "../levels/t00/site.js";
