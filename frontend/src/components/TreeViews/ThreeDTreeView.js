import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { Box } from '@mui/material';
import * as THREE from 'three';
import { 
  generationColors, 
  treeStyles 
} from '../../config/treeConfig';

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
    const levelIndex = Math.min(depth, generationColors.background.length - 1);
    return generationColors.background[levelIndex];
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
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.3 : 0.1} />
      </mesh>
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.15}
        color={treeStyles.textColor}
        anchorX="center"
        anchorY="top"
        maxWidth={1.5}
        textAlign="center"
      >
        {person.full_name || person.label || 'Unknown'}
      </Text>
      {person.date_of_birth && (
        <Text
          position={[0, -1.3, 0]}
          fontSize={0.1}
          color={treeStyles.textSoftColor}
          anchorX="center"
          anchorY="top"
        >
          {new Date(person.data.date_of_birth).getFullYear()}
        </Text>
      )}
    </group>
  );
}

// Connection line component
function ConnectionLine({ start, end, type }) {
  const points = useMemo(() => [start, end], [start, end]);
  // Use redesign palette: beige for all connections
  const color = treeStyles.lineColor;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={type === 'spouse' ? 3 : 2}
      dashed={type === 'spouse'}
      dashScale={0.5}
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

    const hasParent = new Set();
    const childrenMap = new Map();
    const spouseMap = new Map();

    data.edges.forEach((edge) => {
      if (!edge || !edge.source || !edge.target) return;
      const src = String(edge.source);
      const tgt = String(edge.target);
      
      if (edge.type === 'parent') {
        hasParent.add(tgt);
        if (!childrenMap.has(src)) childrenMap.set(src, []);
        childrenMap.get(src).push(tgt);
      } else if (edge.type === 'spouse') {
        if (!spouseMap.has(src)) spouseMap.set(src, new Set());
        if (!spouseMap.has(tgt)) spouseMap.set(tgt, new Set());
        spouseMap.get(src).add(tgt);
        spouseMap.get(tgt).add(src);
      }
    });

    // Calculate generations using iterative rank refinement
    const nodeDepths = new Map();
    validNodes.forEach(node => nodeDepths.set(String(node.id), 0));

    for (let i = 0; i < 25; i++) {
      let changed = false;
      
      // Parent-Child constraint
      childrenMap.forEach((childIds, parentId) => {
        const pGen = nodeDepths.get(parentId) || 0;
        childIds.forEach(childId => {
          if ((nodeDepths.get(childId) || 0) < pGen + 1) {
            nodeDepths.set(childId, pGen + 1);
            changed = true;
          }
        });
      });

      // Spouse constraint
      spouseMap.forEach((spouses, personId) => {
        const gen1 = nodeDepths.get(personId) || 0;
        spouses.forEach(spouseId => {
          const gen2 = nodeDepths.get(spouseId) || 0;
          if (gen1 !== gen2) {
            const maxGen = Math.max(gen1, gen2);
            nodeDepths.set(personId, maxGen);
            nodeDepths.set(spouseId, maxGen);
            changed = true;
          }
        });
      });

      if (!changed) break;
    }

    // Calculate positions level by level
    const levelNodes = new Map();
    nodeDepths.forEach((depth, nodeId) => {
      if (!levelNodes.has(depth)) levelNodes.set(depth, []);
      levelNodes.get(depth).push(nodeId);
    });

    const positions = new Map();
    const nodePositions = [];
    const nodeMap = new Map(validNodes.map((node) => [String(node.id), node]));
    const depths = Array.from(levelNodes.keys());
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const spacing = 3; // Horizontal spacing between nodes
    const depthSpacing = 4; // Vertical spacing between levels

    levelNodes.forEach((nodeIds, depth) => {
      const count = nodeIds.length;
      const startX = -(count - 1) * spacing * 0.5;
      
      nodeIds.forEach((nodeId, index) => {
        const x = startX + index * spacing;
        const y = (maxDepth - depth) * depthSpacing;
        const z = (Math.random() - 0.5) * 0.5;
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

    // Finalize positions with a second pass for centering
    for (let d = maxDepth - 1; d >= 0; d--) {
      const nodesAtLevel = levelNodes.get(d) || [];
      nodesAtLevel.forEach(nodeId => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length > 0) {
          const childXs = children.map(cid => positions.get(cid)?.[0]).filter(x => x !== undefined);
          if (childXs.length > 0) {
            const avgX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
            const currentPos = positions.get(nodeId);
            if (currentPos) {
              currentPos[0] = avgX;
              // Update nodePositions too
              const np = nodePositions.find(p => String(p.node.id) === nodeId);
              if (np) np.position[0] = avgX;
            }
          }
        }
      });
    }

    // Build connections
    const connections = [];
    data.edges.forEach((edge) => {
      if (!edge || !edge.source || !edge.target) return;
      const src = String(edge.source);
      const tgt = String(edge.target);
      const startPos = positions.get(src);
      const endPos = positions.get(tgt);
      if (startPos && endPos) {
        connections.push({
          start: new THREE.Vector3(...startPos),
          end: new THREE.Vector3(...endPos),
          type: edge.type
        });
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
        <ConnectionLine key={`conn-${idx}`} start={conn.start} end={conn.end} type={conn.type} />
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
    <Box sx={{ width: '100%', height: '100%', minHeight: '600px', bgcolor: treeStyles.backgroundColor }}>
      <Canvas shadows camera={{ position: [0, 5, 20], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} castShadow />
        <color attach="background" args={[treeStyles.backgroundColor]} />
        <Tree3D data={data} onPersonClick={onPersonClick} />
      </Canvas>
    </Box>
  );
};

export default ThreeDTreeView;

