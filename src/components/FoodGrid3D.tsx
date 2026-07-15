import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  glbPath: string;
  hiddenPositions: number[];
}

const COLS = 5;
const ROWS = 5;
// Must match `.grid { gap: 10px }` in index.css — this is how we keep the
// 3D layer pixel-aligned with the real DOM grid instead of guessing.
const GAP = 10;

function AutoFitClone({ url, targetSize }: { url: string; targetSize: number }) {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          (m as THREE.Material).side = THREE.DoubleSide;
        });
      }
    });
    const box = new THREE.Box3().setFromObject(copy);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = (targetSize * 0.8) / maxDim;
    copy.scale.setScalar(scale);
    return copy;
  }, [scene, targetSize]);

  return (
    <Center>
      <primitive object={cloned} rotation={[Math.PI / 2, 0, 0]} />
    </Center>
  );
}

export function FoodGrid3D({ glbPath, hiddenPositions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const hidden = useMemo(() => new Set(hiddenPositions), [hiddenPositions]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cellSize = size.width > 0 ? (size.width - (COLS - 1) * GAP) / COLS : 0;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {cellSize > 0 && (
        <Canvas
          orthographic
          camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={1} />
          <directionalLight position={[3, 6, 8]} intensity={0.7} />
          <Suspense fallback={null}>
            {Array.from({ length: COLS * ROWS }).map((_, i) => {
              if (hidden.has(i)) return null;
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              // Three's world space here has (0,0) at canvas center, +X right, +Y up
              // (this is exactly how R3F's default orthographic camera at zoom=1 maps
              // to CSS pixels), so we convert from top-left DOM-style grid math directly.
              const x = -size.width / 2 + col * (cellSize + GAP) + cellSize / 2;
              const y = size.height / 2 - row * (cellSize + GAP) - cellSize / 2;
              return (
                <group key={i} position={[x, y, 0]}>
                  <AutoFitClone url={glbPath} targetSize={cellSize} />
                </group>
              );
            })}
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
