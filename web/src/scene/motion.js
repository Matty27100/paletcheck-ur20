// One pick-and-place cycle, as fractions of the cycle time.
export const PHASE = {
  pickDown: 0.1,
  grip: 0.13,
  liftStart: 0.16,
  liftEnd: 0.28,
  moveEnd: 0.58,
  placeDown: 0.68,
  release: 0.71,
  retreatStart: 0.74,
  retreatEnd: 0.84,
};

const ease = (u) => {
  const t = Math.min(1, Math.max(0, u));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function lerpAngle(a, b, u) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

// Interpolate around the robot's base axis so the arm swings instead of cutting through itself.
function swing(a, b, u) {
  const th = lerpAngle(Math.atan2(a.x, a.z), Math.atan2(b.x, b.z), u);
  const ra = Math.hypot(a.x, a.z);
  const rb = Math.hypot(b.x, b.z);
  const r = ra + (rb - ra) * u;
  return { x: Math.sin(th) * r, y: a.y + (b.y - a.y) * u, z: Math.cos(th) * r };
}

// Tool-tip position at a given phase of the cycle.
export function toolPath(phase, pick, place, lift) {
  const pickHover = { x: pick.x, y: pick.y + lift, z: pick.z };
  const placeHover = { x: place.x, y: place.y + lift, z: place.z };
  const seg = (a, b, t0, t1) => swing(a, b, ease((phase - t0) / (t1 - t0)));
  if (phase < PHASE.pickDown) return seg(pickHover, pick, 0, PHASE.pickDown);
  if (phase < PHASE.liftStart) return pick;
  if (phase < PHASE.liftEnd) return seg(pick, pickHover, PHASE.liftStart, PHASE.liftEnd);
  if (phase < PHASE.moveEnd) return seg(pickHover, placeHover, PHASE.liftEnd, PHASE.moveEnd);
  if (phase < PHASE.placeDown) return seg(placeHover, place, PHASE.moveEnd, PHASE.placeDown);
  if (phase < PHASE.retreatStart) return place;
  if (phase < PHASE.retreatEnd) return seg(place, placeHover, PHASE.retreatStart, PHASE.retreatEnd);
  return seg(placeHover, pickHover, PHASE.retreatEnd, 1);
}
