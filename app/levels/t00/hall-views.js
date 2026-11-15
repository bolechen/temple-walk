// T00 only: the indoor views, for working on a hall's room (`tools/inside.cjs renders them). These are not the six fixed
// cameras of the T00 handoff: those live in site.views, are locked, and look at the five zones outdoors. A room lies
// below the courts and sixty metres from the next, so `?show=<name>` cannot stand in one: every view here names a
// hall and a point in that room's own place. `node tools/inside.cjs tools/out --views` draws them all.

const INSIDE = {
  chan:      { door: [0, 3.7, 0, 0.02],          roof: [0, 0.7, 0, 0.72] },
  tea:       { door: [0, 3.7, 0, -0.08],         roof: [0, 0.7, 0, 0.72] },
  main:      { altar: [0, 2.3, 0, 0.22],         roof: [0, 1.6, 0, 0.78] },
  library:   { shelves: [0, 2.7, 0, 0.15],       ceiling: [0, 1.1, 0, 0.78] },
  yaoshi:    { altar: [0, 2, 0, 0.18],           roof: [0, 1, 0, 0.72] },
  dahui:     { table: [0, 2, 0, 0.15],           roof: [0, 1, 0, 0.72] },
  guanyin:   { altar: [0, 2, 0, 0.18],           roof: [0, 1, 0, 0.72] },
  lingxiao:  { room: [0, 3.2, 0, 0.12],          roof: [0, 1.4, 0, 0.78] },
};

// Views as tools/inside.cjs takes them: the hall, a name, and [x, z, yaw, pitch] in that room's own place.
export const HALL_VIEWS = Object.entries(INSIDE).flatMap(([hall, views]) => Object.entries(views).map(([name, abs]) => ({ hall, name: `${hall}-${name}`, abs, view: "first", qs: "season=summer&time=day" })));

// One click, one address: ?in=<hall>&cam=<x,z,yaw,pitch>. A reload after a change to the room opens at the same pose.
export function hallViewURL({ hall, abs, view = "first", qs = "" }) {
  const q = new URLSearchParams(qs); q.set("in", hall); q.set("cam", abs.join(",")); q.set("view", view); q.set("shot", "1"); q.set("q", "high"); q.set("enter", "");
  return "?" + q.toString().replace(/%2C/g, ",").replace(/=(&|$)/g, "$1");
}
