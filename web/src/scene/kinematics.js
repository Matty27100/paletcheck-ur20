// Stylised six-axis arm. Link lengths follow the UR20's proportions (0.86 m and 0.73 m).
export const ARM = { baseY: 0.9, shoulderY: 1.15, L1: 0.86, L2: 0.73, tool: 0.32 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Joint angles that put the tool tip at (x, y, z) with the tool pointing straight down.
// Elbow-up solution of a two-link arm in the vertical plane through the base axis.
export function solveIK(x, y, z) {
  const { shoulderY, L1, L2, tool } = ARM;
  const r = Math.hypot(x, z);
  const s = y + tool - shoulderY;
  const d = clamp(Math.hypot(r, s), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.005);
  const gamma = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  const alpha = Math.atan2(s, r) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  return {
    yaw: Math.atan2(x, z),
    shoulder: Math.PI / 2 - alpha,
    elbow: Math.PI - gamma,
    wrist: alpha + gamma - Math.PI / 2,
  };
}
