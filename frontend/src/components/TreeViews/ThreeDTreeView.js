import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { Box } from '@mui/material';
import * as THREE from 'three';
import { 
  generationColors, 
  treeStyles 
} from '../../config/treeConfig';

// Person node component
function PersonNode({ position, person, onClick, depth = 0, isFocal }) {
  const meshRef = useRef();
  const textGroupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [scale, setScale] = useState(0);

  // Entrance animation
  useEffect(() => {
    setScale(1);
  }, []);
  
  // Load texture if avatar exists
  const profilePhotoUrl = person.profile_photo_url;
  // Use a 1x1 transparent PNG Data URI as fallback to avoid CORS/404 issues with remote fallbacks
  const fallbackTexture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  
  const texture = useLoader(
    THREE.TextureLoader, 
    profilePhotoUrl || fallbackTexture
  );

  const hasTexture = !!profilePhotoUrl;

  // Animate on hover and entrance
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (meshRef.current) {
      const targetScale = isFocal ? 1.4 : (hovered ? 1.2 : 1);
      
      // Add subtle swaying/breathing animation
      const breathing = Math.sin(time * 2 + position[0]) * 0.03;
      const finalScale = scale * targetScale + breathing;
      
      meshRef.current.scale.lerp(
        new THREE.Vector3(finalScale, finalScale, finalScale),
        0.1
      );
      
      // Subtle swaying position
      meshRef.current.position.y = Math.sin(time + position[0]) * 0.05;
    }
    
    // Billboarding
    if (textGroupRef.current) {
      textGroupRef.current.quaternion.copy(state.camera.quaternion);
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
        <sphereGeometry args={[isFocal ? 0.7 : 0.5, 32, 32]} />
        {hasTexture ? (
          <meshStandardMaterial 
            map={texture}
            emissive={isFocal ? '#D79A1E' : '#000'} 
            emissiveIntensity={isFocal ? 0.4 : 0}
          />
        ) : (
          <meshStandardMaterial 
            color={color} 
            emissive={isFocal ? '#D79A1E' : color} 
            emissiveIntensity={isFocal || hovered ? 0.5 : 0.1} 
          />
        )}
      </mesh>
      {isFocal && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.8, 0.9, 32]} />
          <meshBasicMaterial color="#D79A1E" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={textGroupRef}>
        <Text
          position={[0, -0.8, 0]}
          fontSize={0.15}
          color={treeStyles.textColor}
          anchorX="center"
          anchorY="top"
          maxWidth={1.5}
          textAlign="center"
          fontWeight="bold"
        >
          {(person.traditional_title ? person.traditional_title.toUpperCase() + "\n" : "") + (person.full_name || person.label || 'Unknown')}
        </Text>
        {person.date_of_birth && (
          <Text
            position={[0, -1.3, 0]}
            fontSize={0.1}
            color={treeStyles.textSoftColor}
            anchorX="center"
            anchorY="top"
          >
            {new Date(person.data?.date_of_birth || person.date_of_birth).getFullYear()}
          </Text>
        )}
      </group>
    </group>
  );
}

// Connection line component
function ConnectionLine({ start, end, type }) {
  const points = useMemo(() => {
    if (type === 'spouse') return [start, end];
    
    // Create a curve for parent-child for more organic look
    const midY = (start.y + end.y) / 2;
    const midPoint = new THREE.Vector3(start.x, midY, start.z);
    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
    return curve.getPoints(20);
  }, [start, end, type]);

  const color = treeStyles.lineColor;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={type === 'spouse' ? 3 : 1.5}
      dashed={type === 'spouse'}
      dashScale={0.5}
      transparent
      opacity={0.6}
    />
  );
}

// Main 3D tree component logic
function Tree3D({ data, onPersonClick, onSetFocalPerson }) {
  const groupRef = useRef();
  const controlsRef = useRef();
  const focalPersonId = data?.focalPersonId;

  // Slow rotation for dynamic feel
  useFrame((state, delta) => {
    if (groupRef.current && !focalPersonId) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  const { nodes, connections } = useMemo(() => {
    if (!data || !data.nodes || !data.edges) {
      return { nodes: [], connections: [] };
    }

    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return { nodes: [], connections: [] };

    const persons = new Map(validNodes.map(n => [String(n.id), n]));
    const childrenMap = new Map();
    const parentsByChild = new Map();
    const spouseMap = new Map();

    data.edges.forEach((edge) => {
      const src = String(edge.source);
      const tgt = String(edge.target);
      if (edge.type === 'parent') {
        if (!childrenMap.has(src)) childrenMap.set(src, []);
        childrenMap.get(src).push(tgt);
        if (!parentsByChild.has(tgt)) parentsByChild.set(tgt, []);
        parentsByChild.get(tgt).push(src);
      } else if (edge.type === 'spouse') {
        if (!spouseMap.has(src)) spouseMap.set(src, new Set());
        if (!spouseMap.has(tgt)) spouseMap.set(tgt, new Set());
        spouseMap.get(src).add(tgt);
        spouseMap.get(tgt).add(src);
      }
    });

    const relevantNodes = new Set();
    if (focalPersonId && persons.has(focalPersonId)) {
      const queue = [focalPersonId];
      relevantNodes.add(focalPersonId);
      let head = 0;
      while(head < queue.length) {
        const id = queue[head++];
        const neighbors = [
          ...(parentsByChild.get(id) || []),
          ...(childrenMap.get(id) || []),
          ...Array.from(spouseMap.get(id) || [])
        ];
        neighbors.forEach(nid => {
          if (!relevantNodes.has(nid)) {
            relevantNodes.add(nid);
            queue.push(nid);
          }
        });
      }
    } else {
      persons.forEach((_, id) => relevantNodes.add(id));
    }

    const nodeDepths = new Map();
    relevantNodes.forEach(id => nodeDepths.set(id, 0));

    for (let i = 0; i < 25; i++) {
      let changed = false;
      childrenMap.forEach((childIds, parentId) => {
        if (!relevantNodes.has(parentId)) return;
        const pGen = nodeDepths.get(parentId) || 0;
        childIds.forEach(childId => {
          if (!relevantNodes.has(childId)) return;
          if ((nodeDepths.get(childId) || 0) < pGen + 1) {
            nodeDepths.set(childId, pGen + 1);
            changed = true;
          }
        });
      });
      spouseMap.forEach((spouses, personId) => {
        if (!relevantNodes.has(personId)) return;
        const gen1 = nodeDepths.get(personId) || 0;
        spouses.forEach(spouseId => {
          if (!relevantNodes.has(spouseId)) return;
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

    if (nodeDepths.size > 0) {
      const minGen = Math.min(...Array.from(nodeDepths.values()));
      nodeDepths.forEach((gen, id) => nodeDepths.set(id, gen - minGen));
    }

    const levelNodes = new Map();
    nodeDepths.forEach((depth, nodeId) => {
      if (!levelNodes.has(depth)) levelNodes.set(depth, []);
      levelNodes.get(depth).push(nodeId);
    });

    const positions = new Map();
    const nodePositions = [];
    const maxDepth = levelNodes.size > 0 ? Math.max(...Array.from(levelNodes.keys())) : 0;
    const spacing = 3;
    const depthSpacing = 4;

    levelNodes.forEach((nodeIds, depth) => {
      const count = nodeIds.length;
      const startX = -(count - 1) * spacing * 0.5;
      nodeIds.forEach((nodeId, index) => {
        const x = startX + index * spacing;
        const y = (maxDepth - depth) * depthSpacing;
        
        // Improve Z-depth: ancestors pushed back, descendants pulled forward
        // If depth < maxDepth/2, it's older generations (ancestors)
        // If depth > maxDepth/2, it's younger generations (descendants)
        const midDepth = maxDepth / 2;
        const z = (depth - midDepth) * 2 + (Math.random() - 0.5) * 1.5;
        
        positions.set(nodeId, [x, y, z]);
        const node = persons.get(nodeId);
        if (node) {
          nodePositions.push({ node, position: [x, y, z], depth });
        }
      });
    });

    // Centering pass
    for (let d = maxDepth - 1; d >= 0; d--) {
      const ids = levelNodes.get(d) || [];
      ids.forEach(id => {
        const children = childrenMap.get(id) || [];
        const childXs = children.map(cid => positions.get(cid)?.[0]).filter(x => x !== undefined);
        if (childXs.length > 0) {
          const avgX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
          const pos = positions.get(id);
          if (pos) pos[0] = avgX;
          const np = nodePositions.find(p => String(p.node.id) === id);
          if (np) np.position[0] = avgX;
        }
      });
    }

    const connections = [];
    data.edges.forEach((edge) => {
      const startPos = positions.get(String(edge.source));
      const endPos = positions.get(String(edge.target));
      if (startPos && endPos) {
        connections.push({
          start: new THREE.Vector3(...startPos),
          end: new THREE.Vector3(...endPos),
          type: edge.type
        });
      }
    });

    return { nodes: nodePositions, connections };
  }, [data, focalPersonId]);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());

  // Trigger flight when focus changes
  useEffect(() => {
    if (nodes.length === 0 || !controlsRef.current) return;
    
    const camera = controlsRef.current.object;
    const newTargetPos = new THREE.Vector3(0, 0, 20);
    const newLookAtPos = new THREE.Vector3(0, 0, 0);

    if (focalPersonId) {
      const focalNode = nodes.find(n => String(n.node.id) === focalPersonId);
      if (focalNode) {
        const [fx, fy, fz] = focalNode.position;
        newTargetPos.set(fx, fy, fz + 10);
        newLookAtPos.set(fx, fy, fz);
      }
    } else {
      const posArr = nodes.map(n => n.position);
      if (posArr.length > 0) {
        const minX = Math.min(...posArr.map(p => p[0]));
        const maxX = Math.max(...posArr.map(p => p[0]));
        const minY = Math.min(...posArr.map(p => p[1]));
        const maxY = Math.max(...posArr.map(p => p[1]));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const dist = Math.max(maxX - minX, maxY - minY) * 1.2 || 15;
        newTargetPos.set(centerX, centerY, dist);
        newLookAtPos.set(centerX, centerY, 0);
      }
    }

    startPos.current.copy(camera.position);
    startTarget.current.copy(controlsRef.current.target);
    endPos.current.copy(newTargetPos);
    endTarget.current.copy(newLookAtPos);
    transitionProgress.current = 0;
    setIsTransitioning(true);
  }, [focalPersonId, nodes]);

  // Handle the smooth transition and user interaction
  useFrame((state, delta) => {
    // 1. Handle auto-rotation when no one is selected
    if (groupRef.current && !focalPersonId && !isTransitioning) {
      groupRef.current.rotation.y += delta * 0.05;
    }

    // 2. Handle programmatic flight
    if (isTransitioning && controlsRef.current) {
      transitionProgress.current += delta * 1.5; // Flight speed
      const t = Math.min(1, transitionProgress.current);
      const ease = 1 - Math.pow(1 - t, 3); // Cubic ease out
      
      const camera = controlsRef.current.object;
      camera.position.lerpVectors(startPos.current, endPos.current, ease);
      controlsRef.current.target.lerpVectors(startTarget.current, endTarget.current, ease);
      
      if (t >= 1) {
        setIsTransitioning(false);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      {connections.map((conn, idx) => (
        <ConnectionLine key={`conn-${idx}`} start={conn.start} end={conn.end} type={conn.type} />
      ))}
      {nodes.map(({ node, position, depth }) => (
        <PersonNode
          key={node.id}
          position={position}
          person={node.data}
          depth={depth}
          isFocal={String(node.id) === focalPersonId}
          onClick={(e) => {
            if (e.shiftKey) {
              if (onSetFocalPerson) onSetFocalPerson(String(node.id));
            } else {
              if (onPersonClick) onPersonClick(node.id);
            }
          }}
        />
      ))}
      <OrbitControls 
        ref={controlsRef} 
        makeDefault
        enableDamping 
        dampingFactor={0.1}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        panSpeed={0.8}
        screenSpacePanning={true}
        minDistance={2}
        maxDistance={100}
        onStart={() => {
          // Immediately stop any programmatic flight if user interacts
          setIsTransitioning(false);
        }}
      />
    </group>
  );
}

const ThreeDTreeView = ({ data, onPersonClick, onSetFocalPerson }) => {
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: '600px', bgcolor: treeStyles.backgroundColor }}>
      <Canvas shadows camera={{ position: [0, 5, 20], fov: 45 }}>
        <color attach="background" args={[treeStyles.backgroundColor]} />
        <Suspense fallback={null}>
          <Tree3D data={data} onPersonClick={onPersonClick} onSetFocalPerson={onSetFocalPerson} />
        </Suspense>
      </Canvas>
    </Box>
  );
};

export default ThreeDTreeView;

