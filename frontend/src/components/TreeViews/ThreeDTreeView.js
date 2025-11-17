import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { Box } from '@mui/material';
import * as THREE from 'three';

// Person node component
function PersonNode({ position, person, onClick, depth = 0 }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Animate on hover
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.lerp(
        new THREE.Vector3(hovered ? 1.2 : 1, hovered ? 1.2 : 1, hovered ? 1.2 : 1),
        0.1
      );
    }
  });

  // Color based on depth
  const color = useMemo(() => {
    const colors = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#7b1fa2'];
    return colors[depth % colors.length];
  }, [depth]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.3 : 0.1} />
      </mesh>
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
      >
        {person.full_name || person.label || 'Unknown'}
      </Text>
      {person.date_of_birth && (
        <Text
          position={[0, -1, 0]}
          fontSize={0.1}
          color="#aaa"
          anchorX="center"
          anchorY="middle"
        >
          {new Date(person.date_of_birth).getFullYear()}
        </Text>
      )}
    </group>
  );
}

// Connection line component
function ConnectionLine({ start, end }) {
  const points = useMemo(() => [start, end], [start, end]);
  return (
    <Line
      points={points}
      color="#888"
      lineWidth={2}
      dashed={false}
    />
  );
}

// Main 3D tree component
function Tree3D({ data, onPersonClick }) {
  const controlsRef = useRef();

  // Build tree structure and calculate positions
  const { nodes, connections } = useMemo(() => {
    if (!data || !data.nodes || !data.edges) {
      return { nodes: [], connections: [] };
    }

    // Filter out invalid nodes first
    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) {
      return { nodes: [], connections: [] };
    }

    const nodeMap = new Map(validNodes.map((node) => [String(node.id), node]));
    const childrenMap = new Map();
    const hasParent = new Set();

    // Build parent-child relationships - filter out invalid edges
    data.edges.forEach((edge) => {
      if (!edge || !edge.source || !edge.target || edge.type !== 'parent') return;
      hasParent.add(String(edge.target));
      if (!childrenMap.has(String(edge.source))) {
        childrenMap.set(String(edge.source), []);
      }
      childrenMap.get(String(edge.source)).push(String(edge.target));
    });

    // Find root nodes
    const rootNodes = validNodes.filter((node) => !hasParent.has(String(node.id)));

    if (rootNodes.length === 0) {
      return { nodes: [], connections: [] };
    }

    // Calculate positions using a hierarchical layout
    const positions = new Map();
    const nodeDepths = new Map();
    const nodePositions = [];

    // Calculate depth for each node
    const calculateDepth = (nodeId, depth = 0) => {
      if (nodeId == null || nodeDepths.has(String(nodeId))) return;
      nodeDepths.set(String(nodeId), depth);
      const children = childrenMap.get(String(nodeId)) || [];
      children.forEach((childId) => calculateDepth(childId, depth + 1));
    };

    rootNodes.forEach((root) => {
      if (root && root.id != null) {
        calculateDepth(root.id, 0);
      }
    });

    // Calculate positions level by level
    const levelNodes = new Map();
    nodeDepths.forEach((depth, nodeId) => {
      if (!levelNodes.has(depth)) {
        levelNodes.set(depth, []);
      }
      levelNodes.get(depth).push(nodeId);
    });

    const maxDepth = Math.max(...Array.from(nodeDepths.values()));
    const spacing = 3; // Horizontal spacing between nodes
    const depthSpacing = 4; // Vertical spacing between levels

    levelNodes.forEach((nodeIds, depth) => {
      const count = nodeIds.length;
      const startX = -(count - 1) * spacing * 0.5;
      
      nodeIds.forEach((nodeId, index) => {
        const x = startX + index * spacing;
        const y = (maxDepth - depth) * depthSpacing;
        const z = (Math.random() - 0.5) * 0.5; // Slight random Z for depth
        positions.set(nodeId, [x, y, z]);
        
        const node = nodeMap.get(nodeId);
        if (node) {
          nodePositions.push({
            node,
            position: [x, y, z],
            depth,
          });
        }
      });
    });

    // Build connections
    const connections = [];
    data.edges.forEach((edge) => {
      if (edge.type === 'parent') {
        const startPos = positions.get(String(edge.source));
        const endPos = positions.get(String(edge.target));
        if (startPos && endPos) {
          connections.push({
            start: new THREE.Vector3(...startPos),
            end: new THREE.Vector3(...endPos),
          });
        }
      }
    });

    return { nodes: nodePositions, connections };
  }, [data]);

  // Auto-fit camera to view
  useFrame(({ camera }) => {
    if (nodes.length === 0) return;
    
    // Calculate bounding box
    const positions = nodes.map((n) => n.position);
    if (positions.length === 0) return;

    const minX = Math.min(...positions.map((p) => p[0]));
    const maxX = Math.max(...positions.map((p) => p[0]));
    const minY = Math.min(...positions.map((p) => p[1]));
    const maxY = Math.max(...positions.map((p) => p[1]));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX || 10;
    const height = maxY - minY || 10;
    const distance = Math.max(width, height) * 1.5;

    // Smoothly move camera to fit view
    camera.position.lerp(new THREE.Vector3(centerX, centerY, distance), 0.05);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(new THREE.Vector3(centerX, centerY, 0), 0.05);
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      {/* Render connections */}
      {connections.map((conn, idx) => (
        <ConnectionLine key={`conn-${idx}`} start={conn.start} end={conn.end} />
      ))}

      {/* Render nodes */}
      {nodes.map(({ node, position, depth }) => (
        <PersonNode
          key={node.id}
          position={position}
          person={node.data}
          depth={depth}
          onClick={() => onPersonClick && onPersonClick(node.id)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />
    </>
  );
}

// Main component
const ThreeDTreeView = ({ data, onPersonClick }) => {
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: '600px' }}>
      <Canvas
        camera={{ position: [0, 0, 15], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <Tree3D data={data} onPersonClick={onPersonClick} />
      </Canvas>
    </Box>
  );
};

export default ThreeDTreeView;

