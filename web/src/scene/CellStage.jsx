import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Cell from './Cell.jsx';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The 3D cell. Sideways drags rotate the view; vertical swipes still scroll the page.
export default function CellStage({ weight, rate, perPallet, speed, onStats, cells = 1 }) {
  const wrap = useRef(null);
  const drag = useRef({ on: false, x: 0, az: 0 });
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(wrap.current);
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq?.addEventListener?.('change', onChange);
    return () => {
      io.disconnect();
      mq?.removeEventListener?.('change', onChange);
    };
  }, []);

  const onDown = (e) => {
    drag.current.on = true;
    drag.current.x = e.clientX;
  };
  const onMove = (e) => {
    if (!drag.current.on) return;
    const dx = e.clientX - drag.current.x;
    drag.current.x = e.clientX;
    drag.current.az = clamp(drag.current.az - dx * 0.006, -1.3, 1.3);
  };
  const onUp = () => {
    drag.current.on = false;
  };

  return (
    <div
      ref={wrap}
      className="cell-stage"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      <Canvas
        flat
        shadows
        dpr={[1, 2]}
        frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
        camera={{ fov: 30, near: 0.1, far: 80, position: [4.5, 4.5, 6] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        fallback={<p className="cell-fallback">Animația 3D nu este disponibilă pe acest dispozitiv.</p>}
      >
        {Array.from({ length: cells }, (_, i) => (
          <Cell
            key={i}
            index={i}
            count={cells}
            weight={weight}
            rate={rate / cells}
            perPallet={perPallet}
            speed={speed}
            frozen={reduced}
            drag={drag}
            onStats={onStats}
          />
        ))}
      </Canvas>
    </div>
  );
}
