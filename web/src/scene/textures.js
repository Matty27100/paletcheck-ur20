import * as THREE from 'three';

// Polished concrete: fine grain, faint trowel clouds and saw-cut slab joints every 4 m.
// Drawn once on a canvas, so nothing extra is downloaded.
export function concreteTexture(dark) {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = dark ? '#2b3038' : '#c9ccd0';
  g.fillRect(0, 0, size, size);

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Large soft clouds: uneven polish.
  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 60 + rand() * 180;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rand() < 0.5 ? (dark ? '255,255,255' : '255,255,255') : '0,0,0';
    grad.addColorStop(0, `rgba(${tone},${dark ? 0.025 : 0.05})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine grain.
  for (let i = 0; i < 24000; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.04 + rand() * 0.05})`;
    g.fillRect(rand() * size, rand() * size, 1.5, 1.5);
  }
  // Saw-cut joints: the texture spans 8 m, joints every 4 m.
  g.strokeStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(60,66,74,0.35)';
  g.lineWidth = 3;
  for (const p of [0, size / 2]) {
    g.beginPath();
    g.moveTo(p + 1.5, 0);
    g.lineTo(p + 1.5, size);
    g.moveTo(0, p + 1.5);
    g.lineTo(size, p + 1.5);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60 / 8, 60 / 8); // floor plane is 60 m
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
