// Schematic geometry for the cell. Sizes are illustrative, not engineering data:
// the brief gives only bucket weights and totals per pallet, not dimensions or patterns.

export const PALLET = { width: 0.8, length: 1.2, height: 0.144 }; // euro pallet, metres

// Bucket size scales with the cube root of its weight, anchored on a 13 kg bucket.
export function bucketDims(weightKg) {
  const s = Math.cbrt(Math.max(1, weightKg) / 13);
  return { rTop: 0.13 * s, rBot: 0.108 * s, h: 0.25 * s };
}

// A simple grid pattern that fits the pallet footprint, filled far-side first.
// `u` is the outward (away from the robot) coordinate, `z` runs along the long side.
export function palletPattern(weightKg, perPallet) {
  const bucket = bucketDims(weightKg);
  const pitch = 2 * bucket.rTop + 0.006;
  const nu = Math.max(1, Math.floor((PALLET.width * 1.03) / pitch));
  const nz = Math.max(1, Math.floor((PALLET.length * 1.03) / pitch));
  const perLayer = nu * nz;
  const count = Math.max(1, Math.round(perPallet));
  const slots = [];
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / perLayer);
    const k = i % perLayer;
    const iu = Math.floor(k / nz);
    const iz = k % nz;
    slots.push({
      u: ((nu - 1) / 2 - iu) * pitch,
      y: PALLET.height + layer * bucket.h,
      z: (iz - (nz - 1) / 2) * pitch,
      layer,
    });
  }
  return { slots, perLayer, layers: Math.ceil(count / perLayer), bucket };
}
