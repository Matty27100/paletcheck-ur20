import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARM, solveIK } from './kinematics.js';
import Factory from './Factory.jsx';
import { concreteTexture } from './textures.js';
import { PHASE, lerpAngle, smooth, toolPath } from './motion.js';
import { PALLET, palletPattern } from './layout.js';

const BELT_TOP = 0.75;
const PICK_Z = -0.9;
const QUEUE = 6;
const SPACING = 0.5;
const LIFT = 0.3;
const PALLET_X = 0.95;
const PALLET_Z = 0.2;
const SWAP_AFTER = 40; // simulated seconds a full pallet waits for the operator
const SLIDE = 2.2; // metres a full pallet travels forward, into the aisle, when it is swapped
export const CELL_SPACING = 3.6; // metres between neighbouring cells
const SIDES = [-1, 1];
const CAMERA_TARGET = [0, 0.75, -0.6];
const HALF_PI = Math.PI / 2;

const randomYaw = () => Math.random() * Math.PI * 2;

function freshSim(slotCount, frozen) {
  const sim = {
    phase: 0,
    cycle: null,
    active: 0,
    pallets: [0, 1].map(() => ({ count: 0, status: 'filling', timer: 0, slide: 0 })),
    yaws: Array.from({ length: QUEUE + 1 }, randomYaw),
  };
  if (frozen) {
    // Reduced motion: a single still frame, mid-transfer, with the first pallet part-filled.
    sim.pallets[0].count = Math.floor(slotCount * 0.6);
    sim.cycle = { pallet: 0, slot: sim.pallets[0].count, released: false };
    sim.phase = 0.46;
  }
  return sim;
}

function PalletWood({ material }) {
  return (
    <>
      {[-0.55, 0, 0.55].map((z) => (
        <mesh key={z} material={material} position={[0, 0.06, z]}>
          <boxGeometry args={[PALLET.width, 0.1, 0.1]} />
        </mesh>
      ))}
      {[-0.33, -0.165, 0, 0.165, 0.33].map((x) => (
        <mesh key={x} material={material} position={[x, 0.127, 0]}>
          <boxGeometry args={[0.14, 0.034, PALLET.length]} />
        </mesh>
      ))}
    </>
  );
}

function TapeRect({ material, cx, cz, w, l }) {
  const t = 0.05;
  const y = 0.004;
  return (
    <>
      <mesh material={material} position={[cx, y, cz - l / 2]}>
        <boxGeometry args={[w + t, 0.004, t]} />
      </mesh>
      <mesh material={material} position={[cx, y, cz + l / 2]}>
        <boxGeometry args={[w + t, 0.004, t]} />
      </mesh>
      <mesh material={material} position={[cx - w / 2, y, cz]}>
        <boxGeometry args={[t, 0.004, l]} />
      </mesh>
      <mesh material={material} position={[cx + w / 2, y, cz]}>
        <boxGeometry args={[t, 0.004, l]} />
      </mesh>
    </>
  );
}

function Conveyor({ mat }) {
  return (
    <group>
      <mesh material={mat.belt} position={[0, BELT_TOP - 0.02, -2.2]}>
        <boxGeometry args={[0.4, 0.04, 3]} />
      </mesh>
      {SIDES.map((s) => (
        <mesh key={s} material={mat.frame} position={[s * 0.225, BELT_TOP - 0.01, -2.2]}>
          <boxGeometry args={[0.05, 0.12, 3.04]} />
        </mesh>
      ))}
      <mesh material={mat.frame} position={[0, BELT_TOP + 0.03, -0.68]}>
        <boxGeometry args={[0.5, 0.1, 0.03]} />
      </mesh>
      {[-0.95, -2.2, -3.45].map((z) =>
        SIDES.map((s) => (
          <mesh key={`${z}${s}`} material={mat.frame} position={[s * 0.2, 0.35, z]}>
            <boxGeometry args={[0.05, 0.7, 0.05]} />
          </mesh>
        )),
      )}
    </group>
  );
}

export default function Cell({ weight, rate, perPallet, speed, frozen, drag, onStats, index = 0, count = 1, look = 'default' }) {
  const env = index === 0; // the first cell also draws the hall, the lights and drives the camera
  const pattern = useMemo(() => palletPattern(weight, perPallet), [weight, perPallet]);
  const { bucket } = pattern;
  const slotCount = pattern.slots.length;
  const maxInstances = slotCount * 2 + QUEUE + 2;

  const sim = useRef(null);
  const j1 = useRef();
  const j2 = useRef();
  const j3 = useRef();
  const j4 = useRef();
  const bodies = useRef();
  const lids = useRef();
  const handles = useRef();
  const palletRefs = [useRef(), useRef()];
  const beam = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const mat = useMemo(
    () => ({
      // Industrial palette: UR-style grey arm with light-blue joint caps, safety-yellow markings.
      shell: new THREE.MeshStandardMaterial({ color: '#E6E9EC', roughness: 0.38, metalness: 0.15 }),
      cap: new THREE.MeshStandardMaterial({ color: '#79AEDB', roughness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2F3439', roughness: 0.55 }),
      frame: new THREE.MeshStandardMaterial({ color: '#B8BEC4', roughness: 0.45, metalness: 0.45 }),
      belt: new THREE.MeshStandardMaterial({ color: '#34383D', roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ color: '#C9A06A', roughness: 0.85 }),
      tape: new THREE.MeshBasicMaterial({ color: '#F0C400' }),
      scanner: new THREE.MeshStandardMaterial({ color: '#F0C400', roughness: 0.5 }),
      floor: new THREE.MeshStandardMaterial({ color: '#C7CACD', roughness: 0.95 }),
      bucket: new THREE.MeshStandardMaterial({ color: '#F5F5F2', roughness: 0.45 }),
      lid: new THREE.MeshStandardMaterial({ color: '#E0602B', roughness: 0.5 }),
      handle: new THREE.MeshStandardMaterial({ color: '#4A5057', roughness: 0.4 }),
    }),
    [],
  );

  const geo = useMemo(() => {
    const { rTop, rBot, h } = bucket;
    return {
      body: new THREE.CylinderGeometry(rTop, rBot, h, 24).translate(0, h / 2, 0),
      lid: new THREE.CylinderGeometry(rTop * 1.05, rTop * 1.05, 0.02, 24).translate(0, h - 0.006, 0),
      // Half-ring resting against one side of the rim: shows which way the handle points.
      handle: new THREE.TorusGeometry(rTop * 1.06, 0.007, 6, 20, Math.PI)
        .rotateX(HALF_PI + 0.3)
        .translate(0, h - 0.035, 0),
    };
  }, [bucket]);

  useEffect(
    () => () => {
      geo.body.dispose();
      geo.lid.dispose();
      geo.handle.dispose();
    },
    [geo],
  );

  const report = () => {
    const s = sim.current;
    if (s && onStats && env) {
      onStats({ counts: s.pallets.map((p) => p.count), status: s.pallets.map((p) => p.status), active: s.active });
    }
  };

  // Shadows on everything solid; the floor and pallets also receive them.
  const scene = useThree((state) => state.scene);
  const quality = useRef({ frames: 0, time: 0, done: false });
  const framing = useRef({ key: '' });
  const dark = look === 'dark';
  const haze = dark ? '#0E1116' : '#D6DADE';
  useEffect(() => {
    if (!env) return undefined;
    const tex = concreteTexture(dark);
    mat.floor.map = tex;
    mat.floor.color.set('#ffffff');
    mat.floor.roughness = 0.82;
    mat.floor.needsUpdate = true;
    return () => tex.dispose();
  }, [dark, mat, env]);
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.bg) return;
      const flatMark = o.material === mat.tape || o.material.transparent;
      o.castShadow = !flatMark && o.material !== mat.floor;
      o.receiveShadow = !flatMark;
    });
  }, [scene, mat, weight, perPallet]);

  useEffect(() => {
    sim.current = freshSim(slotCount, frozen);
    report();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, frozen]);

  useFrame((state, delta) => {
    const s = sim.current;
    if (!s) return;
    const dt = Math.min(delta, 0.05);
    const dtSim = frozen ? 0 : dt * speed;

    // Slow device: after two seconds of frames, drop shadows and resolution once.
    const ql = quality.current;
    // Frames slower than 10 fps mean a hidden or throttled tab, not a slow device: skip them.
    if (env && !ql.done && !frozen && delta < 0.1 && document.visibilityState === 'visible') {
      ql.frames += 1;
      ql.time += delta;
      if (ql.frames >= 120) {
        ql.done = true;
        if (ql.time / ql.frames > 1 / 34) {
          state.gl.shadowMap.enabled = false;
          state.scene.traverse((o) => {
            if (o.material) o.material.needsUpdate = true;
          });
          state.setDpr(1);
        }
      }
    }
    const h = bucket.h;
    let changed = false;

    // Pallet swap: a full pallet waits, is taken away, and an empty one comes back.
    for (const p of s.pallets) {
      if (p.status === 'full') {
        p.timer -= dtSim;
        if (p.timer <= 0) {
          p.status = 'out';
          changed = true;
        }
      } else if (p.status === 'out') {
        p.slide = Math.min(1, p.slide + dt / 1.4);
        if (p.slide >= 1) {
          p.count = 0;
          p.status = 'in';
          changed = true;
        }
      } else if (p.status === 'in') {
        p.slide = Math.max(0, p.slide - dt / 1.1);
        if (p.slide <= 0) {
          p.status = 'filling';
          changed = true;
        }
      }
    }

    const tryStart = () => {
      if (s.cycle) return;
      const next = [s.active, 1 - s.active].find(
        (i) => s.pallets[i].status === 'filling' && s.pallets[i].count < slotCount,
      );
      if (next === undefined) {
        s.phase = 0; // both positions busy: the robot waits and the line backs up
        return;
      }
      s.active = next;
      s.cycle = { pallet: next, slot: s.pallets[next].count, released: false };
    };

    tryStart();
    if (s.cycle) {
      s.phase += (dtSim * rate) / 60;
      if (!s.cycle.released && s.phase >= PHASE.release) {
        const p = s.pallets[s.cycle.pallet];
        p.count += 1;
        s.cycle.released = true;
        changed = true;
        if (p.count >= slotCount) {
          p.status = 'full';
          p.timer = SWAP_AFTER;
          s.active = 1 - s.cycle.pallet;
        }
      }
      if (s.phase >= 1) {
        s.phase -= 1;
        s.yaws.shift();
        s.yaws.push(randomYaw());
        s.cycle = null;
        tryStart();
      }
    }

    const slotWorld = (pi, si) => {
      const slot = pattern.slots[si];
      return {
        x: SIDES[pi] * (PALLET_X + slot.u),
        y: slot.y,
        z: PALLET_Z + slot.z + s.pallets[pi].slide * SLIDE,
      };
    };

    // Arm pose
    const pick = { x: 0, y: BELT_TOP + h, z: PICK_Z };
    let tool = { x: pick.x, y: pick.y + LIFT, z: pick.z };
    if (s.cycle) {
      const target = slotWorld(s.cycle.pallet, s.cycle.slot);
      tool = toolPath(s.phase, pick, { x: target.x, y: target.y + h, z: target.z }, LIFT);
    }
    const q = solveIK(tool.x, tool.y, tool.z);
    if (j1.current) {
      j1.current.rotation.y = q.yaw;
      j2.current.rotation.x = q.shoulder;
      j3.current.rotation.x = q.elbow;
      j4.current.rotation.x = q.wrist;
    }

    // Pallets
    palletRefs.forEach((ref, i) => {
      if (ref.current) ref.current.position.z = PALLET_Z + s.pallets[i].slide * SLIDE;
    });

    // Buckets: placed, queued on the belt, and the one in the gripper
    if (bodies.current && lids.current && handles.current) {
      let n = 0;
      const put = (x, y, z, yaw) => {
        if (n >= maxInstances) return;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(n, dummy.matrix);
        lids.current.setMatrixAt(n, dummy.matrix);
        handles.current.setMatrixAt(n, dummy.matrix);
        n += 1;
      };
      s.pallets.forEach((p, pi) => {
        for (let i = 0; i < p.count; i++) {
          const w = slotWorld(pi, i);
          put(w.x, w.y, w.z, SIDES[pi] * HALF_PI);
        }
      });
      const gripped = s.cycle && s.phase >= PHASE.grip;
      const advance = s.cycle ? smooth(0.22, 0.72, s.phase) : 0;
      if (!gripped) put(0, BELT_TOP, PICK_Z, s.yaws[0]);
      for (let j = 1; j <= QUEUE; j++) put(0, BELT_TOP, PICK_Z - j * SPACING + SPACING * advance, s.yaws[j]);
      if (gripped && !s.cycle.released) {
        const turn = smooth(PHASE.liftEnd, PHASE.moveEnd, s.phase);
        put(tool.x, tool.y - h, tool.z, lerpAngle(s.yaws[0], SIDES[s.cycle.pallet] * HALF_PI, turn));
      }
      for (const m of [bodies.current, lids.current, handles.current]) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
      }
    }

    // Camera light: reads the next bucket's handle while it waits upstream of the pick point.
    if (beam.current) beam.current.opacity = 0.05 + 0.22 * (s.cycle ? 1 - smooth(0, 0.22, s.phase) : 0.4);

    if (changed) report();
    if (!env) return;

    // Camera: slow sway around a 3/4 view, plus whatever the visitor dragged.
    const { camera, size, clock } = state;
    const cx = ((count - 1) * CELL_SPACING) / 2;
    const target = [CAMERA_TARGET[0] + cx, CAMERA_TARGET[1], CAMERA_TARGET[2]];
    // Full-screen looks: the scene sits behind a panel, so frame the cell in the part
    // left visible (top of a phone screen, right of the panel on a wide screen).
    let aspect = size.width / size.height;
    const view = framing.current;
    const key = `${look}:${size.width}x${size.height}`;
    if (view.key !== key) {
      view.key = key;
      // On a tall phone screen only the top 40% is visible: widen the lens so the cell
      // keeps the size it has in a 40%-high stage, then shift it into that band.
      const phone = look !== 'default' && size.width < 900;
      camera.fov = phone ? (2 * Math.atan(Math.tan((15 * Math.PI) / 180) / 0.4) * 180) / Math.PI : 30;
      camera.updateProjectionMatrix();
      if (look === 'default') camera.clearViewOffset();
      else if (phone) camera.setViewOffset(size.width, size.height, 0, size.height * 0.3, size.width, size.height);
      else camera.setViewOffset(size.width, size.height, -Math.min(260, size.width * 0.2), 0, size.width, size.height);
    }
    if (look !== 'default') aspect = size.width < 900 ? size.width / (size.height * 0.4) : (size.width - 480) / size.height;
    // Far enough back that both pallets fit the width, whatever the stage's shape.
    const radius = Math.max(7 + (count - 1) * 2.4, (9.6 + (count - 1) * 4.6) / aspect);
    const azimuth = 0.62 + (drag?.current?.az ?? 0) + (frozen ? 0 : Math.sin(clock.elapsedTime * 0.25) * 0.16);
    const elevation = 0.3;
    camera.position.set(
      target[0] + Math.sin(azimuth) * Math.cos(elevation) * radius,
      target[1] + Math.sin(elevation) * radius,
      target[2] + Math.cos(azimuth) * Math.cos(elevation) * radius,
    );
    camera.lookAt(...target);
  });

  const { L1, L2 } = ARM;
  const gripR = bucket.rTop;

  return (
    <>
      {env && (
        <>
      <color attach="background" args={[haze]} />
      <fog attach="fog" args={[haze, (dark ? 7 : 9) + (count - 1) * 2, (dark ? 17 : 23) + (count - 1) * 4]} />
      <Factory count={count} dark={dark} />
      <hemisphereLight args={dark ? ['#dfe7f2', '#2a313a', 0.85] : ['#ffffff', '#b4bcc6', 1.25]} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={dark ? 1.9 : 1.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-4.5, 4.5 + (count - 1) * CELL_SPACING, 4.5, -4.5, 0.5, 20]} />
      </directionalLight>
      <directionalLight position={[-4, 3, -2]} intensity={0.35} />

      <mesh material={mat.floor} rotation={[-HALF_PI, 0, 0]}>
        <planeGeometry args={[60, 60]} />
      </mesh>
        </>
      )}

      <group position={[index * CELL_SPACING, 0, 0]}>

      {/* Floor tape around the two pallet positions, and the area scanners */}
      {SIDES.map((side) => (
        <TapeRect key={side} material={mat.tape} cx={side * PALLET_X} cz={PALLET_Z} w={1.04} l={1.46} />
      ))}
      {[-1.62, 0, 1.62].map((x) => (
        <mesh key={x} material={mat.scanner} position={[x, 0.065, 1.0]}>
          <boxGeometry args={[0.12, 0.13, 0.1]} />
        </mesh>
      ))}

      <Conveyor mat={mat} />

      {/* Vision camera over the belt, one bucket upstream of the pick point */}
      <mesh material={mat.frame} position={[0.42, 0.8, -1.42]}>
        <boxGeometry args={[0.05, 1.6, 0.05]} />
      </mesh>
      <mesh material={mat.frame} position={[0.2, 1.58, -1.42]}>
        <boxGeometry args={[0.47, 0.04, 0.04]} />
      </mesh>
      <mesh material={mat.dark} position={[0, 1.53, -1.42]}>
        <boxGeometry args={[0.11, 0.1, 0.15]} />
      </mesh>
      <mesh position={[0, 1.17, -1.42]}>
        <coneGeometry args={[0.2, 0.62, 24, 1, true]} />
        <meshBasicMaterial ref={beam} color="#9FD3F5" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Pallets */}
      {SIDES.map((side, i) => (
        <group key={side} ref={palletRefs[i]} position={[side * PALLET_X, 0, PALLET_Z]}>
          <PalletWood material={mat.wood} />
        </group>
      ))}

      {/* Buckets */}
      <instancedMesh
        key={`body-${weight}-${maxInstances}`}
        ref={bodies}
        args={[geo.body, mat.bucket, maxInstances]}
        frustumCulled={false}
      />
      <instancedMesh
        key={`lid-${weight}-${maxInstances}`}
        ref={lids}
        args={[geo.lid, mat.lid, maxInstances]}
        frustumCulled={false}
      />
      <instancedMesh
        key={`handle-${weight}-${maxInstances}`}
        ref={handles}
        args={[geo.handle, mat.handle, maxInstances]}
        frustumCulled={false}
      />

      {/* Pedestal */}
      <mesh material={mat.frame} position={[0, 0.015, 0]}>
        <boxGeometry args={[0.56, 0.03, 0.56]} />
      </mesh>
      <mesh material={mat.frame} position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.9, 28]} />
      </mesh>

      {/* Arm */}
      <group ref={j1} position={[0, ARM.baseY, 0]}>
        <mesh material={mat.shell} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.115, 0.128, 0.2, 28]} />
        </mesh>
        <mesh material={mat.shell} position={[0.03, 0.25, 0]} rotation={[0, 0, HALF_PI]}>
          <cylinderGeometry args={[0.108, 0.108, 0.3, 28]} />
        </mesh>
        <mesh material={mat.cap} position={[-0.125, 0.25, 0]} rotation={[0, 0, HALF_PI]}>
          <cylinderGeometry args={[0.098, 0.098, 0.022, 28]} />
        </mesh>

        <group ref={j2} position={[0, 0.25, 0]}>
          <mesh material={mat.shell} position={[0.15, L1 / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.078, L1, 24]} />
          </mesh>
          <mesh material={mat.shell} position={[0.09, L1, 0]} rotation={[0, 0, HALF_PI]}>
            <cylinderGeometry args={[0.088, 0.088, 0.28, 28]} />
          </mesh>
          <mesh material={mat.cap} position={[0.238, L1, 0]} rotation={[0, 0, HALF_PI]}>
            <cylinderGeometry args={[0.08, 0.08, 0.022, 28]} />
          </mesh>

          <group ref={j3} position={[0, L1, 0]}>
            <mesh material={mat.shell} position={[0, L2 / 2, 0]}>
              <cylinderGeometry args={[0.052, 0.062, L2, 24]} />
            </mesh>
            <mesh material={mat.shell} position={[0.035, L2, 0]} rotation={[0, 0, HALF_PI]}>
              <cylinderGeometry args={[0.06, 0.06, 0.19, 24]} />
            </mesh>
            <mesh material={mat.cap} position={[-0.068, L2, 0]} rotation={[0, 0, HALF_PI]}>
              <cylinderGeometry args={[0.054, 0.054, 0.02, 24]} />
            </mesh>

            <group ref={j4} position={[0, L2, 0]}>
              <mesh material={mat.shell} position={[0, 0.07, 0]}>
                <cylinderGeometry args={[0.056, 0.056, 0.16, 24]} />
              </mesh>
              <mesh material={mat.dark} position={[0, 0.16, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.03, 24]} />
              </mesh>
              {/* Gripper sized to the bucket rim */}
              <mesh material={mat.dark} position={[0, 0.205, 0]}>
                <cylinderGeometry args={[gripR * 0.92, gripR * 0.92, 0.06, 24]} />
              </mesh>
              {[0, 1, 2].map((k) => {
                const a = (k * Math.PI * 2) / 3;
                return (
                  <mesh
                    key={k}
                    material={mat.dark}
                    position={[Math.sin(a) * (gripR + 0.012), 0.275, Math.cos(a) * (gripR + 0.012)]}
                    rotation={[0, a, 0]}
                  >
                    <boxGeometry args={[0.06, 0.12, 0.022]} />
                  </mesh>
                );
              })}
            </group>
          </group>
        </group>
      </group>
      </group>
    </>
  );
}
