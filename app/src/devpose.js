// Where the eye stands, kept in the page's address while a place is being worked on (`?devpose`, on the dev server
// only). Every change to the code makes the dev server load the page again, and without this the walk would begin
// again at the foot of the path. With it the address always says `?cam=x,z,yaw,pitch` (and the view, the season, the
// hour and the hall he is in), so a reload puts him back where he stood. The address is replaced, not pushed: the
// browser's history does not fill with steps. C copies the address, to keep a view or hand it to someone.

// The address for `pose` = { x, z, yaw, pitch, view?, season?, time?, room? }, keeping every other parameter of `search`.
// A named view (`show`) gives way to the exact place; `in` is the hall he is inside, or nothing when he is out.
export function poseQuery(search, pose) {
  const q = new URLSearchParams(search), yaw = Math.atan2(Math.sin(pose.yaw), Math.cos(pose.yaw));   // a turn of the head is kept within one round
  q.delete("show");
  q.set("cam", [pose.x, pose.z, yaw, pose.pitch].map((v, i) => +v.toFixed(i < 2 ? 2 : 3)).join(","));
  for (const k of ["view", "season", "time"]) if (pose[k]) q.set(k, pose[k]);
  if (pose.room) q.set("in", pose.room); else q.delete("in");
  return "?" + q.toString().replace(/%2C/g, ",").replace(/=(&|$)/g, "$1");   // commas as written; a bare flag stays bare
}

// `read()` gives the pose now (or null while it should not be kept, as when he is passing through a door);
// `where` is the page's location and `history` its history; both are handed in so that the tests can stand in for them.
export function createDevPose({ read, where, history, every = 400 }) {
  let at = -Infinity;
  const address = (p) => where.pathname + poseQuery(where.search, p) + where.hash;
  return {
    // Called every frame; writes at most once every `every` milliseconds, and only when something has changed.
    tick(now) {
      if (now - at < every) return false;
      const p = read(); if (!p) return false;
      at = now;
      const next = poseQuery(where.search, p); if (next === where.search) return false;
      history.replaceState(history.state, "", address(p));
      return true;
    },
    // The whole address of this view, to copy.
    link() { const p = read(); return where.origin + (p ? address(p) : where.pathname + where.search + where.hash); },
  };
}
