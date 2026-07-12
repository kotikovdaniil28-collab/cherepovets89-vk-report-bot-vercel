"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Icosahedron, Torus } from "@react-three/drei";
import * as THREE from "three";

const NEON = "#4ade80";
const NEON_DIM = "#22c55e";
const AMBER = "#fbbf24";

function CoreCrystal() {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    if (outer.current) {
      outer.current.rotation.y = t * 0.18 + pointer.x * 0.4;
      outer.current.rotation.x = Math.sin(t * 0.22) * 0.18 + pointer.y * -0.25;
    }
    if (inner.current) {
      inner.current.rotation.y = -t * 0.35;
      inner.current.rotation.z = t * 0.15;
      const s = 1 + Math.sin(t * 1.6) * 0.05;
      inner.current.scale.setScalar(s * 0.55);
    }
  });

  return (
    <group>
      {/* Внешний wireframe-кристалл */}
      <Icosahedron ref={outer} args={[1.6, 1]}>
        <meshBasicMaterial color={NEON} wireframe transparent opacity={0.5} />
      </Icosahedron>
      {/* Внутреннее светящееся ядро */}
      <Icosahedron ref={inner} args={[1, 0]}>
        <meshStandardMaterial
          color={NEON_DIM}
          emissive={NEON}
          emissiveIntensity={1.6}
          roughness={0.2}
          metalness={0.4}
        />
      </Icosahedron>
    </group>
  );
}

function OrbitRings() {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (g1.current) g1.current.rotation.z = t * 0.12;
    if (g2.current) g2.current.rotation.z = -t * 0.08;
  });

  return (
    <>
      <group ref={g1} rotation={[Math.PI / 2.4, 0.4, 0]}>
        <Torus args={[2.5, 0.006, 8, 128]}>
          <meshBasicMaterial color={NEON} transparent opacity={0.35} />
        </Torus>
        {/* Спутник на орбите */}
        <mesh position={[2.5, 0, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={AMBER} />
        </mesh>
      </group>
      <group ref={g2} rotation={[Math.PI / 1.8, -0.5, 0.3]}>
        <Torus args={[3.1, 0.004, 8, 128]}>
          <meshBasicMaterial color={NEON} transparent opacity={0.2} />
        </Torus>
        <mesh position={[-3.1, 0, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={NEON} />
        </mesh>
      </group>
    </>
  );
}

function GridFloor() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(30, 46, new THREE.Color(NEON), new THREE.Color(NEON));
    const mat = g.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = 0.07;
    return g;
  }, []);
  return <primitive object={grid} position={[0, -2.6, 0]} />;
}

function SceneContent({ compact }: { compact?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 4, 4]} intensity={40} color={NEON} />
      <pointLight position={[-4, -2, -3]} intensity={12} color={AMBER} />

      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.9}>
        <CoreCrystal />
      </Float>
      <OrbitRings />
      <Sparkles count={compact ? 40 : 90} scale={[9, 6, 6]} size={2.2} speed={0.35} color={NEON} opacity={0.7} />
      {!compact && <GridFloor />}
      <fog attach="fog" args={["#0a120d", 7, 16]} />
    </>
  );
}

/**
 * Неоновая 3D-сцена: кристалл-ядро, орбитальные кольца, частицы.
 * compact — облегчённый вариант для встраивания в hero-карточки.
 */
export function NeonScene({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, compact ? 6.5 : 7.5], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SceneContent compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}
