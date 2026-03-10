import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useDiagramStore } from '../../store/diagramStore';
import { DEVICE_COLORS } from '../shared/DeviceIcon';
import { DeviceType } from '../../types';

const DEVICE_SHAPES: Record<DeviceType, string> = {
  desktop: 'box',
  server:  'tall-box',
  switch:  'flat-box',
  router:  'sphere',
  printer: 'box',
  ap_wifi: 'cone',
  phone:   'box',
  unknown: 'box',
};

function DeviceNode3D({
  node,
  isSelected,
  onClick,
}: {
  node: any;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = node.color || DEVICE_COLORS[node.type as DeviceType] || '#4b5563';
  const shape = DEVICE_SHAPES[node.type as DeviceType] || 'box';

  useFrame((state) => {
    if (meshRef.current) {
      if (isSelected) {
        meshRef.current.rotation.y += 0.01;
      }
      const scale = hovered ? 1.15 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  const geometry = useMemo(() => {
    switch (shape) {
      case 'tall-box': return <boxGeometry args={[0.6, 1.2, 0.6]} />;
      case 'flat-box': return <boxGeometry args={[1.4, 0.3, 0.8]} />;
      case 'sphere': return <sphereGeometry args={[0.5, 16, 16]} />;
      case 'cone': return <coneGeometry args={[0.4, 0.8, 8]} />;
      default: return <boxGeometry args={[0.8, 0.8, 0.8]} />;
    }
  }, [shape]);

  const pos: [number, number, number] = [
    (node.x - 400) / 60,
    (node.z || 0) / 80,
    (node.y - 300) / 60,
  ];

  return (
    <group position={pos}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        {geometry}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.4 : hovered ? 0.2 : 0.05}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Glow ring for selected */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.8, 0.05, 8, 32]} />
          <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.8} />
        </mesh>
      )}

      {/* Label */}
      <Text
        position={[0, 0.8, 0]}
        fontSize={0.18}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
      >
        {node.custom_name || node.hostname || node.ip || node.label}
      </Text>

      {/* IP label */}
      {node.ip && (
        <Text
          position={[0, 0.55, 0]}
          fontSize={0.12}
          color="#475569"
          anchorX="center"
          anchorY="middle"
        >
          {node.ip}
        </Text>
      )}
    </group>
  );
}

function Edge3D({ edge, nodes }: { edge: any; nodes: any[] }) {
  const source = nodes.find(n => n.id === edge.source);
  const target = nodes.find(n => n.id === edge.target);
  if (!source || !target) return null;

  const points: [number, number, number][] = [
    [(source.x - 400) / 60, (source.z || 0) / 80, (source.y - 300) / 60],
    [(target.x - 400) / 60, (target.z || 0) / 80, (target.y - 300) / 60],
  ];

  const edgeColors: Record<string, string> = {
    ethernet: '#334155',
    wifi: '#fbbf24',
    fiber: '#22d3ee',
    wan: '#f97316',
    vpn: '#a78bfa',
  };

  return (
    <Line
      points={points}
      color={edgeColors[edge.type] || '#334155'}
      lineWidth={1.5}
      opacity={0.7}
      transparent
    />
  );
}

function Scene({ onNodeClick }: { onNodeClick: (id: string) => void }) {
  const { nodes, edges, selectedNodeId } = useDiagramStore();

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#6366f1" />
      <pointLight position={[10, -5, 10]} intensity={0.2} color="#22d3ee" />

      {/* Grid floor */}
      <gridHelper args={[50, 50, '#1e293b', '#0f172a']} position={[0, -2, 0]} />

      {/* Edges */}
      {edges.map(edge => (
        <Edge3D key={edge.id} edge={edge} nodes={nodes} />
      ))}

      {/* Nodes */}
      {nodes.map(node => (
        <DeviceNode3D
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          onClick={() => onNodeClick(node.id)}
        />
      ))}
    </>
  );
}

export function View3D({ onNodeClick }: { onNodeClick: (id: string) => void }) {
  return (
    <div className="w-full h-full bg-surface-900">
      <Canvas
        camera={{ position: [8, 8, 8], fov: 60 }}
        shadows
        style={{ background: '#0f172a' }}
      >
        <Scene onNodeClick={onNodeClick} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>
      <div className="absolute bottom-3 left-3 text-xs text-slate-600">
        Rotar: clic + arrastrar · Zoom: rueda · Pan: clic derecho
      </div>
    </div>
  );
}
