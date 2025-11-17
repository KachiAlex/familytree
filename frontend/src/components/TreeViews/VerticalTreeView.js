import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';

const VerticalTreeView = ({ data, onPersonClick }) => {
  const svgRef = useRef();
  const containerRef = useRef();

  // Memoize tree structure building with spouse support
  const treeStructure = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return null;

    // Filter out invalid nodes first
    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return null;

    const nodeMap = new Map(validNodes.map((node) => [String(node.id), node]));
    const childrenMap = new Map();
    const spouseMap = new Map(); // Map person to their spouse
    const hasParent = new Set();

    // Build parent-child relationships
    (data.edges || []).forEach((edge) => {
      if (!edge || !edge.source || !edge.target) return; // Skip invalid edges
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

    const rootNodes = validNodes.filter((node) => !hasParent.has(String(node.id)));

    const buildTree = (nodeId, visited = new Set()) => {
      if (!nodeId) return null;
      const key = String(nodeId);
      if (visited.has(key)) return null; // Prevent cycles
      visited.add(key);

      const node = nodeMap.get(key);
      if (!node || !node.id) return null;

      // Get spouse if exists
      const spouseId = spouseMap.get(key);
      let spouse = null;
      if (spouseId && !visited.has(spouseId)) {
        const spouseNode = nodeMap.get(spouseId);
        if (spouseNode && spouseNode.id) {
          spouse = {
            ...(spouseNode.data || {}),
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
        ...(node.data || {}),
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

    if (rootNodes.length === 0) return null;

    const rootData = rootNodes.length > 0
      ? buildTree(rootNodes[0].id)
      : (validNodes[0] ? { id: validNodes[0].id, ...(validNodes[0].data || {}), children: [] } : null);

    return rootData;
  }, [data]);

  const handleNodeClick = useCallback((personId) => {
    if (onPersonClick && personId && personId !== '__root__') {
      onPersonClick(personId);
    }
  }, [onPersonClick]);

  useEffect(() => {
    if (!treeStructure || !data) return;

    const width = containerRef.current?.clientWidth || 800;
    const nodeCount = data.nodes?.length || 0;
    const height = Math.max(600, nodeCount * 80);

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    // Custom layout function to handle spouses side by side
    const layoutTree = (node, x = 0, y = 0, depth = 0) => {
      if (!node || !node.data || !node.data.id) return [];
      
      const nodeWidth = 140; // Width per node including spacing
      const nodeHeight = 80; // Vertical spacing between levels
      const spouseSpacing = 20; // Space between spouses
      
      const positions = [];
      
      // Calculate children positions first to determine parent width
      let childrenPositions = [];
      if (node.children && node.children.length > 0) {
        let childX = 0;
        node.children.forEach((child) => {
          if (!child || !child.data || !child.data.id) return; // Skip invalid children
          const childPositions = layoutTree(child, childX, y + nodeHeight, depth + 1);
          childrenPositions = childrenPositions.concat(childPositions);
          if (childPositions.length > 0) {
            const childWidth = child.data && child.data.spouse 
              ? nodeWidth * 2 + spouseSpacing 
              : nodeWidth;
            childX += childWidth;
          }
        });
      }
      
      // Position main node
      const mainX = childrenPositions.length > 0 
        ? (Math.min(...childrenPositions.map(p => p.x)) + Math.max(...childrenPositions.map(p => p.x))) / 2
        : x;
      
      positions.push({
        id: node.data.id,
        x: mainX,
        y: y,
        data: node.data,
        hasSpouse: !!(node.data && node.data.spouse),
      });
      
      // Position spouse next to main node if exists
      if (node.data && node.data.spouse && node.data.spouse.id) {
        positions.push({
          id: node.data.spouse.id,
          x: mainX + nodeWidth + spouseSpacing,
          y: y,
          data: node.data.spouse,
          hasSpouse: true,
          isSpouse: true,
        });
      }
      
      return positions.concat(childrenPositions);
    };

    // Build flat position array
    const allPositions = layoutTree(treeStructure, width / 2, 50);
    const positionMap = new Map(allPositions.filter(p => p && p.id).map(p => [p.id, p]));

    // Draw links for parent-child relationships
    const drawLinks = (node) => {
      if (!node || !node.data || node.data.id === '__root__') return;
      
      const parentPos = positionMap.get(node.data.id);
      if (!parentPos) return;
      
      // Draw link to spouse if exists
      if (node.data && node.data.spouse && node.data.spouse.id) {
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
      
      // Draw links to children
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          if (!child || !child.data || !child.data.id) return; // Skip invalid children
          const childPos = positionMap.get(child.data.id);
          if (childPos) {
            const spousePos = node.data && node.data.spouse && node.data.spouse.id 
              ? positionMap.get(node.data.spouse.id) 
              : null;
            const parentCenterX = spousePos
              ? (parentPos.x + spousePos.x) / 2
              : parentPos.x;
            
            g.append('path')
              .attr('d', `M ${parentCenterX} ${parentPos.y + 30} L ${parentCenterX} ${childPos.y - 30} L ${childPos.x} ${childPos.y - 30}`)
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
      .data(allPositions.filter(p => p && p.id && p.id !== '__root__' && p.data))
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', onPersonClick ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (d && d.data && d.data.id) {
          handleNodeClick(d.data.id);
        }
      });

    // Add rectangles for nodes
    nodes
      .append('rect')
      .attr('width', 120)
      .attr('height', 60)
      .attr('x', -60)
      .attr('y', -30)
      .attr('rx', 5)
      .attr('fill', (d) => d.hasSpouse ? '#fff3e0' : '#fff')
      .attr('stroke', (d) => d.hasSpouse ? '#ff9800' : '#1976d2')
      .attr('stroke-width', 2);

    // Add text
    nodes
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text((d) => (d && d.data) ? (d.data.full_name || d.data.label || 'Unknown') : 'Unknown');

    nodes
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 10)
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text((d) => {
        if (d && d.data && d.data.date_of_birth) {
          try {
            const year = new Date(d.data.date_of_birth).getFullYear();
            if (isNaN(year)) return '';
            return d.data.date_of_death
              ? `${year} - ${new Date(d.data.date_of_death).getFullYear()}`
              : `b. ${year}`;
          } catch (e) {
            return '';
          }
        }
        return '';
      });
  }, [treeStructure, data, handleNodeClick, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ display: 'block' }}></svg>
    </Box>
  );
};

export default VerticalTreeView;

