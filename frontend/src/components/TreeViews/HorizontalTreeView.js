import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';

const HorizontalTreeView = ({ data, onPersonClick }) => {
  const svgRef = useRef();
  const containerRef = useRef();

  // Memoize tree structure building
  const treeStructure = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return null;

    // Filter out invalid nodes first
    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return null;

    const nodeMap = new Map(validNodes.map((node) => [String(node.id), node]));
    const childrenMap = new Map();
    const spouseMap = new Map(); // Map person to their spouse
    const hasParent = new Set();

    // Build parent-child and spouse relationships - filter out invalid edges
    (data.edges || []).forEach((edge) => {
      if (!edge || !edge.source || !edge.target) return;
      if (edge.type === 'parent') {
        hasParent.add(String(edge.target));
        if (!childrenMap.has(String(edge.source))) {
          childrenMap.set(String(edge.source), []);
        }
        childrenMap.get(String(edge.source)).push(String(edge.target));
      } else if (edge.type === 'spouse') {
        // Build spouse map (bidirectional) with marital status
        const maritalStatus = edge.marital_status || 'married';
        spouseMap.set(String(edge.source), { 
          spouseId: String(edge.target),
          marital_status: maritalStatus 
        });
        spouseMap.set(String(edge.target), { 
          spouseId: String(edge.source),
          marital_status: maritalStatus 
        });
      }
    });

    const rootNodes = validNodes.filter((node) => !hasParent.has(String(node.id)));

    const buildTree = (nodeId, visited = new Set()) => {
      const key = String(nodeId);
      if (visited.has(key)) return null; // Prevent cycles
      visited.add(key);

      const node = nodeMap.get(key);
      if (!node) return null;

      // Get spouse if exists
      const spouseInfo = spouseMap.get(key);
      let spouse = null;
      if (spouseInfo && !visited.has(spouseInfo.spouseId)) {
        const spouseNode = nodeMap.get(spouseInfo.spouseId);
        if (spouseNode) {
          spouse = {
            ...spouseNode.data,
            id: spouseNode.id,
            spouse: null, // Prevent infinite recursion
            children: [],
            marital_status: spouseInfo.marital_status || 'married', // Include marital status
          };
        }
      }

      // Get children (union of both parents' children)
      const children = new Set(childrenMap.get(key) || []);
      if (spouseInfo && spouseInfo.spouseId) {
        const spouseChildren = childrenMap.get(spouseInfo.spouseId) || [];
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

    const width = containerRef.current?.clientWidth || 1200;
    const height = containerRef.current?.clientHeight || 800;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', 'translate(50,50)');

    // Calculate tree height for proper spacing
    const getTreeHeight = (node) => {
      if (!node || !node.id) return 0;
      if (!node.children || node.children.length === 0) {
        return node.spouse ? 180 : 160;
      }
      let maxChildHeight = 0;
      let totalHeight = 0;
      node.children.forEach((child) => {
        const childHeight = getTreeHeight(child);
        maxChildHeight = Math.max(maxChildHeight, childHeight);
        totalHeight += childHeight;
      });
      return Math.max(totalHeight, node.spouse ? 180 : 160);
    };

    // Custom layout function to handle spouses side by side (horizontal: left to right)
    const layoutTree = (node, x = 0, y = 0, depth = 0) => {
      if (!node || !node.id) return [];
      
      const nodeWidth = 160; // Width per node including spacing
      const nodeHeight = 120; // Horizontal spacing between levels (left to right)
      const spouseSpacing = 20; // Space between spouses (vertical)
      const siblingSpacing = 20; // Space between sibling families
      
      const positions = [];
      
      // Calculate children positions first to determine parent position
      let childrenPositions = [];
      let currentY = y;
      
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          if (!child || !child.id) return; // Skip invalid children
          const childTreeHeight = getTreeHeight(child);
          const childPositions = layoutTree(child, x + nodeHeight, currentY, depth + 1);
          childrenPositions = childrenPositions.concat(childPositions);
          currentY += childTreeHeight + siblingSpacing;
        });
        // Remove last spacing
        currentY -= siblingSpacing;
      }
      
      // Position main node (x is horizontal position, y is vertical)
      const mainY = childrenPositions.length > 0 
        ? (Math.min(...childrenPositions.map(p => p.y)) + Math.max(...childrenPositions.map(p => p.y))) / 2
        : y;
      
      positions.push({
        id: node.id,
        x: x, // Horizontal position (left to right)
        y: mainY, // Vertical position (top to bottom)
        data: node,
        hasSpouse: !!(node && node.spouse),
      });
      
      // Position spouse next to main node horizontally (side by side)
      if (node.spouse && node.spouse.id) {
        positions.push({
          id: node.spouse.id,
          x: x, // Same horizontal position (left to right)
          y: mainY + nodeWidth + spouseSpacing, // Next to main node vertically (side by side when viewing)
          data: node.spouse,
          hasSpouse: true,
          isSpouse: true,
        });
      }
      
      return positions.concat(childrenPositions);
    };

    // Calculate total tree height and center it
    const treeHeight = getTreeHeight(treeStructure);
    const startY = Math.max(0, (height - treeHeight) / 2);
    
    // Build flat position array
    const allPositions = layoutTree(treeStructure, 0, startY);
    const positionMap = new Map(allPositions.map(p => [p.id, p]));

    // Draw links for parent-child and spouse relationships
    const drawLinks = (node) => {
      if (!node || !node.id || node.id === '__root__') return;
      
      const parentPos = positionMap.get(node.id);
      if (!parentPos) return;
      
      // Draw link to spouse if exists (horizontal line)
      if (node.spouse && node.spouse.id) {
        const spousePos = positionMap.get(node.spouse.id);
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
          if (!child || !child.id) return; // Skip invalid children
          const childPos = positionMap.get(child.id);
          if (childPos) {
            const parentCenterY = node.spouse && node.spouse.id
              ? (parentPos.y + (positionMap.get(node.spouse.id)?.y || parentPos.y)) / 2
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
    const visibleNodes = nodes.filter((d) => d.id !== '__root__');

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

    // Add text with word wrapping
    visibleNodes.each(function(d) {
      const nodeGroup = d3.select(this);
      const name = d.data.full_name || d.data.label || 'Unknown';
      
      // Split long names into multiple lines
      const maxCharsPerLine = 18;
      const words = name.split(' ');
      let lines = [];
      let currentLine = '';
      
      words.forEach((word, i) => {
        if ((currentLine + word).length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
        if (i === words.length - 1 && currentLine) {
          lines.push(currentLine);
        }
      });
      
      if (lines.length === 0) lines = [name.substring(0, maxCharsPerLine)];
      
      // Add name text (up to 2 lines)
      lines.slice(0, 2).forEach((line, i) => {
        nodeGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', i === 0 ? -8 : 4)
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#333')
          .text(line.length > maxCharsPerLine ? line.substring(0, maxCharsPerLine - 3) + '...' : line);
      });
      
      // Add date text
      if (d.data.date_of_birth) {
        try {
          const year = new Date(d.data.date_of_birth).getFullYear();
          if (!isNaN(year)) {
            const dateText = d.data.date_of_death
              ? `${year} - ${new Date(d.data.date_of_death).getFullYear()}`
              : `b. ${year}`;
            nodeGroup
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', 18)
              .attr('font-size', '10px')
              .attr('fill', '#666')
              .text(dateText);
          }
        } catch (e) {
          // Ignore date errors
        }
      }
    });

    // Update SVG dimensions to fit content with padding
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

      const padding = 100;
      const contentWidth = bounds.maxX - bounds.minX + padding * 2;
      const contentHeight = bounds.maxY - bounds.minY + padding * 2;
      
      svg.attr('width', Math.max(width, contentWidth))
         .attr('height', Math.max(height, contentHeight));
      
      // Center the tree
      const offsetX = Math.max(0, (Math.max(width, contentWidth) - (bounds.maxX - bounds.minX)) / 2 - bounds.minX);
      const offsetY = Math.max(0, (Math.max(height, contentHeight) - (bounds.maxY - bounds.minY)) / 2 - bounds.minY);
      g.attr('transform', `translate(${offsetX + padding},${offsetY + padding})`);
    }
  }, [treeStructure, data, handleNodeClick, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', overflow: 'auto', bgcolor: '#f5f5f5' }}>
      <svg ref={svgRef} style={{ display: 'block' }}></svg>
    </Box>
  );
};

export default HorizontalTreeView;
