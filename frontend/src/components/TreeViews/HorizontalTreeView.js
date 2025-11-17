import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';

const HorizontalTreeView = ({ data, onPersonClick }) => {
  const svgRef = useRef();
  const containerRef = useRef();

  // Memoize tree structure building
  const treeStructure = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return null;

    const nodeMap = new Map(data.nodes.map((node) => [String(node.id), node]));
    const childrenMap = new Map();
    const spouseMap = new Map(); // Map person to their spouse
    const hasParent = new Set();

    // Build parent-child and spouse relationships
    data.edges.forEach((edge) => {
      if (edge.type === 'parent') {
        hasParent.add(String(edge.target));
        if (!childrenMap.has(String(edge.source))) {
          childrenMap.set(String(edge.source), []);
        }
        childrenMap.get(String(edge.source)).push(String(edge.target));
      } else if (edge.type === 'spouse') {
        // Build spouse map (bidirectional)
        spouseMap.set(String(edge.source), String(edge.target));
        spouseMap.set(String(edge.target), String(edge.source));
      }
    });

    const rootNodes = data.nodes.filter((node) => !hasParent.has(String(node.id)));

    const buildTree = (nodeId, visited = new Set()) => {
      const key = String(nodeId);
      if (visited.has(key)) return null; // Prevent cycles
      visited.add(key);

      const node = nodeMap.get(key);
      if (!node) return null;

      // Get spouse if exists
      const spouseId = spouseMap.get(key);
      let spouse = null;
      if (spouseId && !visited.has(spouseId)) {
        const spouseNode = nodeMap.get(spouseId);
        if (spouseNode) {
          spouse = {
            ...spouseNode.data,
            id: spouseNode.id,
            spouse: null, // Prevent infinite recursion
            children: [],
          };
        }
      }

      // Get children (union of both parents' children)
      const children = new Set(childrenMap.get(key) || []);
      if (spouseId) {
        const spouseChildren = childrenMap.get(spouseId) || [];
        spouseChildren.forEach((childId) => children.add(childId));
      }

      const childrenArray = Array.from(children)
        .map((childId) => buildTree(childId, new Set(visited)))
        .filter(Boolean);

      return {
        ...node.data,
        id: node.id,
        spouse: spouse,
        children: childrenArray,
      };
    };

    // If multiple roots, create a dummy root to connect them
    if (rootNodes.length > 1) {
      return {
        id: '__root__',
        full_name: 'Family Tree',
        children: rootNodes.map((root) => buildTree(root.id)).filter(Boolean),
      };
    }

    const rootData = rootNodes.length > 0
      ? buildTree(rootNodes[0].id)
      : { id: data.nodes[0].id, ...data.nodes[0].data, children: [] };

    return rootData;
  }, [data]);

  const handleNodeClick = useCallback((personId) => {
    if (onPersonClick && personId && personId !== '__root__') {
      onPersonClick(personId);
    }
  }, [onPersonClick]);

  useEffect(() => {
    if (!treeStructure || !data) return;

    const width = containerRef.current?.clientWidth || 1200;
    const height = containerRef.current?.clientHeight || 800;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', 'translate(50,50)');

    // Custom layout function to handle spouses side by side (horizontal: left to right)
    const layoutTree = (node, x = 0, y = 0, depth = 0) => {
      if (!node) return [];
      
      const nodeWidth = 160; // Width per node including spacing
      const nodeHeight = 100; // Horizontal spacing between levels (left to right)
      const spouseSpacing = 20; // Space between spouses (vertical)
      
      const positions = [];
      
      // Calculate children positions first to determine parent position
      let childrenPositions = [];
      if (node.children && node.children.length > 0) {
        let childY = 0;
        node.children.forEach((child) => {
          const childPositions = layoutTree(child, x + nodeHeight, childY, depth + 1);
          childrenPositions = childrenPositions.concat(childPositions);
          if (childPositions.length > 0) {
            const childHeight = child.data.spouse 
              ? nodeWidth * 2 + spouseSpacing 
              : nodeWidth;
            childY += childHeight;
          }
        });
      }
      
      // Position main node (x is horizontal position, y is vertical)
      const mainY = childrenPositions.length > 0 
        ? (Math.min(...childrenPositions.map(p => p.y)) + Math.max(...childrenPositions.map(p => p.y))) / 2
        : y;
      
      positions.push({
        id: node.data.id,
        x: x, // Horizontal position (left to right)
        y: mainY, // Vertical position (top to bottom)
        data: node.data,
        hasSpouse: !!node.data.spouse,
      });
      
      // Position spouse next to main node horizontally (side by side)
      if (node.data.spouse) {
        positions.push({
          id: node.data.spouse.id,
          x: x, // Same horizontal position (left to right)
          y: mainY + nodeWidth + spouseSpacing, // Next to main node vertically (side by side when viewing)
          data: node.data.spouse,
          hasSpouse: true,
          isSpouse: true,
        });
      }
      
      return positions.concat(childrenPositions);
    };

    // Build flat position array
    const allPositions = layoutTree(treeStructure, 0, height / 2);
    const positionMap = new Map(allPositions.map(p => [p.id, p]));

    // Draw links for parent-child and spouse relationships
    const drawLinks = (node) => {
      if (!node || node.data.id === '__root__') return;
      
      const parentPos = positionMap.get(node.data.id);
      if (!parentPos) return;
      
      // Draw link to spouse if exists (horizontal line)
      if (node.data.spouse) {
        const spousePos = positionMap.get(node.data.spouse.id);
        if (spousePos) {
          g.append('line')
            .attr('x1', parentPos.x)
            .attr('y1', parentPos.y)
            .attr('x2', spousePos.x)
            .attr('y2', spousePos.y)
            .attr('stroke', '#ff9800')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
        }
      }
      
      // Draw links to children (from parent center to children)
      if (node.children) {
        node.children.forEach((child) => {
          const childPos = positionMap.get(child.data.id);
          if (childPos) {
            const parentCenterY = node.data.spouse 
              ? (parentPos.y + positionMap.get(node.data.spouse.id).y) / 2
              : parentPos.y;
            
            g.append('path')
              .attr('d', `M ${parentPos.x + 75} ${parentCenterY} L ${childPos.x - 75} ${parentCenterY} L ${childPos.x - 75} ${childPos.y}`)
              .attr('fill', 'none')
              .attr('stroke', '#999')
              .attr('stroke-width', 2);
          }
          drawLinks(child);
        });
      }
    };

    drawLinks(treeStructure);

    // Draw nodes
    const nodes = g
      .selectAll('.node')
      .data(allPositions.filter(p => p.id !== '__root__'))
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', onPersonClick ? 'pointer' : 'default')
      .on('click', (event, d) => {
        handleNodeClick(d.data.id);
      });

    // Skip rendering the dummy root node
    const visibleNodes = nodes.filter((d) => d.data.id !== '__root__');

    // Add rectangles for nodes
    visibleNodes
      .append('rect')
      .attr('width', 150)
      .attr('height', 60)
      .attr('x', -75)
      .attr('y', -30)
      .attr('rx', 5)
      .attr('fill', (d) => d.hasSpouse ? '#fff3e0' : '#fff')
      .attr('stroke', (d) => d.hasSpouse ? '#ff9800' : '#1976d2')
      .attr('stroke-width', 2);

    // Add text
    visibleNodes
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -8)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text((d) => d.data.full_name || d.data.label || 'Unknown');

    visibleNodes
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 8)
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text((d) => {
        if (d.data.date_of_birth) {
          const year = new Date(d.data.date_of_birth).getFullYear();
          return d.data.date_of_death
            ? `${year} - ${new Date(d.data.date_of_death).getFullYear()}`
            : `b. ${year}`;
        }
        return '';
      });

    // Center the tree vertically
    if (allPositions.length > 0) {
      const bounds = allPositions.reduce((acc, p) => {
        if (p.id === '__root__') return acc;
        return {
          minX: Math.min(acc.minX, p.x),
          maxX: Math.max(acc.maxX, p.x),
          minY: Math.min(acc.minY, p.y),
          maxY: Math.max(acc.maxY, p.y),
        };
      }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

      const offsetY = (height - (bounds.maxY - bounds.minY)) / 2 - bounds.minY;
      g.attr('transform', `translate(50,${offsetY + 50})`);
    }
  }, [treeStructure, data, handleNodeClick, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ display: 'block' }}></svg>
    </Box>
  );
};

export default HorizontalTreeView;
