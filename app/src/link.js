// The address of a view: `?cam=x,z,yaw,pitch&view=…&season=…&time=…`, with the hall he is inside (`in`) or the balcony
// he is up on (`up`). `?devpose` keeps it in the page's own address while a place is being worked on (devpose.js), and
// `__debugURL()` in yard.js hands the same address out from the console on the published site, where a view seen can be
// opened again here. The place is written to two decimals, or to as many more as it takes to stay where he stood: a
// centimetre's rounding at the edge of a stair can put him inside the stop beside it, where the ground reads as the
// level below and he comes back sunk into the steps.

// The address for `pose` = { x, z, yaw, pitch, view?, season?, time?, room?, up?, devpose?, ok? }, keeping every other
// parameter of `search`. `show` gives way to the exact place; `in` and `up` are the hall he is inside and the balcony he
// is up on, or nothing when he is out and down. `devpose` asks the address to be followed by a dev server. `ok(x, z)`
// says whether a point stands where he stands (free, at his height).
export function poseQuery(search, pose) {
  const q = new URLSearchParams(search), yaw = Math.atan2(Math.sin(pose.yaw), Math.cos(pose.yaw));   // a turn of the head is kept within one round
  q.delete("show");
  let n = 2; while (n < 6 && pose.ok && !pose.ok(+pose.x.toFixed(n), +pose.z.toFixed(n))) n++;
  q.set("cam", [pose.x, pose.z, yaw, pose.pitch].map((v, i) => +v.toFixed(i < 2 ? n : 3)).join(","));
  for (const k of ["view", "season", "time"]) if (pose[k]) q.set(k, pose[k]);
  if (pose.room) q.set("in", pose.room); else q.delete("in");
  if (pose.up) q.set("up", pose.up); else q.delete("up");
  if (pose.devpose) q.set("devpose", "");
  return "?" + q.toString().replace(/%2C/g, ",").replace(/=(&|$)/g, "$1");   // commas as written; a bare flag stays bare
}
