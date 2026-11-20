import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { palletPattern } from './layout.js';

// Static factory hall around the cell. Every repeated part is one instanced mesh,
// so the whole background costs about a dozen draw calls on a phone.

const BACK_Z = -9.5;
const LEFT_X = -9.5;
const RIGHT_X = 11;
const FRONT_Z = 8;

const unitBox = new THREE.BoxGeometry(1, 1, 1);

// items: [x, y, z, sx, sy, sz] with (x, y, z) the box centre (or the base, for pails).
function Boxes({ items, material, geometry = unitBox }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    items.forEach(([x, y, z, sx, sy, sz], i) => {
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.userData.bg = true;
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
}

// Deterministic pseudo-random, so the racking looks the same on every load.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// One row of pallet racking running along +u, with its face toward the cell.
// `place(u, y, v, su, sy, sv)` maps row coordinates to a world box.
function rackRow({ bays, bayW, uStart, place, seed, parts }) {
  const levels = [0, 1.7, 3.3];
  const depth = 1.0;
  const rand = rng(seed);
  for (let b = 0; b <= bays; b++) {
    const u = uStart + b * bayW;
    for (const v of [0, depth]) parts.uprights.push(place(u, 2.5, v, 0.09, 5, 0.09));
  }
  for (let b = 0; b < bays; b++) {
    const u = uStart + b * bayW + bayW / 2;
    for (const y of levels.slice(1).concat(4.9)) {
      for (const v of [0, depth]) parts.beams.push(place(u, y, v, bayW - 0.09, 0.12, 0.06));
    }
    for (const y of levels) {
      for (const k of [-1, 1]) {
        if (rand() < 0.22) continue; // some slots empty
        const cu = u + k * (bayW / 4 + 0.02);
        const base = y + (y === 0 ? 0 : 0.06);
        parts.pallets.push(place(cu, base + 0.072, depth / 2, 1.0, 0.144, 0.9));
        const h = 0.75 + rand() * 0.45;
        const target = rand() < 0.55 ? parts.wrapped : parts.cartons;
        target.push(place(cu, base + 0.144 + h / 2, depth / 2, 0.96, h, 0.86));
      }
    }
  }
}

export default function Factory({ count = 1, dark = false }) {
  const mat = useMemo(
    () => ({
      panel: new THREE.MeshStandardMaterial({ color: '#E3E6E9', roughness: 0.9 }),
      plinth: new THREE.MeshStandardMaterial({ color: '#A7ADB3', roughness: 1 }),
      rib: new THREE.MeshStandardMaterial({ color: '#CBD0D5', roughness: 0.8 }),
      glass: new THREE.MeshBasicMaterial({ color: '#F4F8FB' }),
      column: new THREE.MeshStandardMaterial({ color: '#5E6873', roughness: 0.6, metalness: 0.3 }),
      guard: new THREE.MeshStandardMaterial({ color: '#E8B90F', roughness: 0.6 }),
      upright: new THREE.MeshStandardMaterial({ color: '#2D5C9E', roughness: 0.5, metalness: 0.2 }),
      beam: new THREE.MeshStandardMaterial({ color: '#E2702B', roughness: 0.5, metalness: 0.2 }),
      wood: new THREE.MeshStandardMaterial({ color: '#C39A63', roughness: 0.9 }),
      wrapped: new THREE.MeshStandardMaterial({ color: '#E6E2DA', roughness: 0.35 }),
      carton: new THREE.MeshStandardMaterial({ color: '#B88D5C', roughness: 0.9 }),
      aisle: new THREE.MeshStandardMaterial({ color: '#D9B21E', roughness: 0.6 }),
      walkway: new THREE.MeshStandardMaterial({ color: '#BCC1C6', roughness: 0.35, metalness: 0.05 }),
      pail: new THREE.MeshStandardMaterial({ color: '#F2F2EF', roughness: 0.45 }),
      lid: new THREE.MeshStandardMaterial({ color: '#D9602F', roughness: 0.5 }),
      jack: new THREE.MeshStandardMaterial({ color: '#2E3238', roughness: 0.5, metalness: 0.4 }),
    }),
    [],
  );

  // Night shift: the hall's surfaces drop into shadow so the lit cell stands out.
  useEffect(() => {
    const night = { panel: '#2A3038', plinth: '#22272E', rib: '#323943', walkway: '#22262C', wrapped: '#8E8A83', carton: '#6E5537', wood: '#7C6342', glass: '#26324A', aisle: '#8A7419' };
    const day = { panel: '#E3E6E9', plinth: '#A7ADB3', rib: '#CBD0D5', walkway: '#BCC1C6', wrapped: '#E6E2DA', carton: '#B88D5C', wood: '#C39A63', glass: '#F4F8FB', aisle: '#D9B21E' };
    for (const [k, c] of Object.entries(dark ? night : day)) mat[k].color.set(c);
  }, [dark, mat]);

  const geo = useMemo(() => {
    const { rTop, rBot, h } = palletPattern(13, 44).bucket;
    return {
      pail: new THREE.CylinderGeometry(rTop, rBot, h, 16).translate(0, h / 2, 0),
      lid: new THREE.CylinderGeometry(rTop * 1.05, rTop * 1.05, 0.02, 16).translate(0, h - 0.006, 0),
    };
  }, []);

  const parts = useMemo(() => {
    const aisleX = 3.25 + (count - 1) * 3.6; // walkway to the right of the last cell
    const p = { panels: [], plinths: [], ribs: [], glass: [], columns: [], guards: [], uprights: [], beams: [], pallets: [], wrapped: [], cartons: [], aisle: [], walkway: [], pails: [], lids: [], jack: [] };
    const backLen = RIGHT_X - LEFT_X;
    const leftLen = FRONT_Z - BACK_Z;
    const backMid = (RIGHT_X + LEFT_X) / 2;
    const leftMid = (FRONT_Z + BACK_Z) / 2;

    // Walls: concrete plinth, ribbed sandwich panels, a strip of high windows.
    p.plinths.push([backMid, 0.6, BACK_Z, backLen, 1.2, 0.2], [LEFT_X, 0.6, leftMid, 0.2, 1.2, leftLen]);
    p.panels.push([backMid, 4.6, BACK_Z, backLen, 6.8, 0.15], [LEFT_X, 4.6, leftMid, 0.15, 6.8, leftLen]);
    p.glass.push([backMid, 6.4, BACK_Z + 0.09, backLen, 0.9, 0.02], [LEFT_X + 0.09, 6.4, leftMid, 0.02, 0.9, leftLen]);
    for (let x = LEFT_X + 0.6; x < RIGHT_X; x += 0.6) p.ribs.push([x, 3.9, BACK_Z + 0.09, 0.04, 5.4, 0.04]);
    for (let z = BACK_Z + 0.6; z < FRONT_Z; z += 0.6) p.ribs.push([LEFT_X + 0.09, 3.9, z, 0.04, 5.4, 0.04]);

    // Steel columns with yellow base guards.
    const cols = [];
    for (const x of [-9.2, -3.2, 2.8, 8.8]) cols.push([x, BACK_Z + 0.25]);
    for (const z of [-3.5, 2.5]) cols.push([LEFT_X + 0.25, z]);
    for (const [x, z] of cols) {
      p.columns.push([x, 4, z, 0.3, 8, 0.3]);
      p.guards.push([x, 0.5, z, 0.46, 1, 0.46]);
    }

    // Racking along the back wall and the left wall.
    rackRow({
      bays: 6,
      bayW: 2.7,
      uStart: -8.4,
      seed: 7,
      parts: p,
      place: (u, y, v, su, sy, sv) => [u, y, BACK_Z + 1.65 - v, su, sy, sv],
    });
    rackRow({
      bays: 4,
      bayW: 2.7,
      uStart: -8.2,
      seed: 31,
      parts: p,
      place: (u, y, v, su, sy, sv) => [LEFT_X + 0.65 + v, y, u, sv, sy, su],
    });

    // A magazine of empty pallets next to position A: the operator's next swap.
    for (let i = 0; i < 7; i++) p.pallets.push([-2.55, 0.08 + i * 0.152, 1.35, 0.8, 0.144, 1.2]);

    // Epoxy-coated work area under the cell(s): smoother and a shade darker than the concrete.
    const cellsW = (count - 1) * 3.6;
    p.walkway.push([cellsW / 2, 0.002, 0.35, cellsW + 4.4, 0.004, 3.7]);
    // Painted edge around the work area.
    const zx0 = -2.2;
    const zx1 = cellsW + 2.2;
    for (const z of [-1.5, 2.2]) p.aisle.push([(zx0 + zx1) / 2, 0.006, z, zx1 - zx0, 0.004, 0.05]);
    for (const x of [zx0, zx1]) p.aisle.push([x, 0.006, 0.35, 0.05, 0.004, 3.7]);

    // Pedestrian walkways: thin yellow edge lines only.
    const crossX = -3.1 + (count - 1) * 1.8;
    const crossW = 12.6 + (count - 1) * 3.6;
    for (const x of [aisleX - 0.7, aisleX + 0.7]) p.aisle.push([x, 0.005, -1, 0.06, 0.004, 14]);
    for (const z of [2.55, 3.95]) p.aisle.push([crossX, 0.005, z, crossW, 0.004, 0.06]);

    // Safety rail between the walkway and the left part of the hall (clear of the pallet swap path).
    const railFrom = -8.6;
    const railTo = -1.9;
    for (let x = railFrom; x <= railTo + 0.01; x += (railTo - railFrom) / 4) p.guards.push([x, 0.5, 2.42, 0.08, 1, 0.08]);
    for (const y of [1, 0.55]) p.guards.push([(railFrom + railTo) / 2, y, 2.42, railTo - railFrom, 0.05, 0.05]);

    // Finished pallets waiting for pickup, on both sides of the side walkway, and a pallet truck.
    const done = palletPattern(13, 44);
    for (const px of [aisleX - 3.05, aisleX - 1.75, aisleX + 1.55, aisleX + 2.85]) {
      const pz = 5.0;
      p.pallets.push([px, 0.072, pz, 0.8, 0.144, 1.2]);
      for (const sl of done.slots) {
        p.pails.push([px + sl.u, sl.y, pz + sl.z, 1, 1, 1]);
        p.lids.push([px + sl.u, sl.y, pz + sl.z, 1, 1, 1]);
      }
    }
    const jx = aisleX + 4.3;
    p.jack.push([jx - 0.13, 0.05, 5.05, 0.16, 0.08, 1.15], [jx + 0.13, 0.05, 5.05, 0.16, 0.08, 1.15], [jx, 0.32, 4.42, 0.5, 0.5, 0.18], [jx, 0.85, 4.2, 0.05, 0.9, 0.05]);
    p.guards.push([jx, 1.3, 4.12, 0.36, 0.05, 0.05]);
    return p;
  }, [count]);

  return (
    <group>
      <Boxes items={parts.plinths} material={mat.plinth} />
      <Boxes items={parts.panels} material={mat.panel} />
      <Boxes items={parts.ribs} material={mat.rib} />
      <Boxes items={parts.glass} material={mat.glass} />
      <Boxes items={parts.columns} material={mat.column} />
      <Boxes items={parts.guards} material={mat.guard} />
      <Boxes items={parts.uprights} material={mat.upright} />
      <Boxes items={parts.beams} material={mat.beam} />
      <Boxes items={parts.pallets} material={mat.wood} />
      <Boxes items={parts.wrapped} material={mat.wrapped} />
      <Boxes items={parts.cartons} material={mat.carton} />
      <Boxes items={parts.walkway} material={mat.walkway} />
      <Boxes items={parts.aisle} material={mat.aisle} />
      <Boxes items={parts.pails} material={mat.pail} geometry={geo.pail} />
      <Boxes items={parts.lids} material={mat.lid} geometry={geo.lid} />
      <Boxes items={parts.jack} material={mat.jack} />
    </group>
  );
}
