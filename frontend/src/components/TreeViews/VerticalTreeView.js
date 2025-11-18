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
      if (!nodeId) return null;
      const key = String(nodeId);
      if (visited.has(key)) return null; // Prevent cycles
      visited.add(key);

      const node = nodeMap.get(key);
      if (!node || !node.id) return null;

      // Get spouse if exists
      const spouseInfo = spouseMap.get(key);
      let spouse = null;
      if (spouseInfo && !visited.has(spouseInfo.spouseId)) {
        const spouseNode = nodeMap.get(spouseInfo.spouseId);
        if (spouseNode && spouseNode.id) {
          spouse = {
            ...(spouseNode.data || {}),
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

    // Calculate tree width for proper spacing
    const getTreeWidth = (node) => {
      if (!node || !node.id) return 0;
      if (!node.children || node.children.length === 0) {
        return node.spouse ? 160 : 140;
      }
      let totalWidth = 0;
      node.children.forEach((child) => {
        totalWidth += getTreeWidth(child);
      });
      return Math.max(totalWidth, node.spouse ? 160 : 140);
    };

    // Custom layout function to handle spouses side by side
    const layoutTree = (node, x = 0, y = 0, depth = 0) => {
      if (!node || !node.id) return [];
      
      const nodeWidth = 140; // Width per node
      const nodeHeight = 100; // Vertical spacing between levels
      const spouseSpacing = 20; // Space between spouses
      const siblingSpacing = 20; // Space between sibling families
      
      const positions = [];
      
      // Calculate children positions first
      let childrenPositions = [];
      let currentX = x;
      
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          if (!child || !child.id) return;
          const childTreeWidth = getTreeWidth(child);
          const childPositions = layoutTree(child, currentX, y + nodeHeight, depth + 1);
          childrenPositions = childrenPositions.concat(childPositions);
          currentX += childTreeWidth + siblingSpacing;
        });
        // Remove last spacing
        currentX -= siblingSpacing;
      }
      
      // Position main node centered above children
      const mainX = childrenPositions.length > 0 
        ? (Math.min(...childrenPositions.map(p => p.x)) + Math.max(...childrenPositions.map(p => p.x))) / 2
        : x;
      
      positions.push({
        id: node.id,
        x: mainX,
        y: y,
        data: node,
        hasSpouse: !!(node && node.spouse),
      });
      
      // Position spouse next to main node if exists
      if (node && node.spouse && node.spouse.id) {
        positions.push({
          id: node.spouse.id,
          x: mainX + nodeWidth + spouseSpacing,
          y: y,
          data: node.spouse,
          hasSpouse: true,
          isSpouse: true,
        });
      }
      
      return positions.concat(childrenPositions);
    };

    // Calculate total tree width and center it
    const treeWidth = getTreeWidth(treeStructure);
    const startX = Math.max(0, (width - treeWidth) / 2);
    
    // Build flat position array
    const allPositions = layoutTree(treeStructure, startX, 50);
    const positionMap = new Map(allPositions.filter(p => p && p.id).map(p => [p.id, p]));

    // Draw links for parent-child relationships
    const drawLinks = (node) => {
      if (!node || !node.id || node.id === '__root__') return;
      
      const parentPos = positionMap.get(node.id);
      if (!parentPos) return;
      
      // Draw link to spouse if exists
      if (node && node.spouse && node.spouse.id) {
        const spousePos = positionMap.get(node.spouse.id);
        if (spousePos) {
          const maritalStatus = node.spouse.marital_status || 'married';
          const isDivorced = maritalStatus === 'divorced';
          const isWidowed = maritalStatus === 'widowed';
          
          // Draw spouse connection line with different styles based on status
          g.append('line')
            .attr('x1', parentPos.x)
            .attr('y1', parentPos.y)
            .attr('x2', spousePos.x)
            .attr('y2', spousePos.y)
            .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
            .attr('stroke-width', isDivorced ? 2.5 : 3)
            .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none')
            .attr('opacity', isDivorced ? 0.7 : 1);
        }
      }
      
      // Draw links to children with better styling
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          if (!child || !child.id) return; // Skip invalid children
          const childPos = positionMap.get(child.id);
          if (childPos) {
            const spousePos = node && node.spouse && node.spouse.id 
              ? positionMap.get(node.spouse.id) 
              : null;
            const parentCenterX = spousePos
              ? (parentPos.x + spousePos.x) / 2
              : parentPos.x;
            
            // Draw vertical line from parent(s) down
            g.append('line')
              .attr('x1', parentCenterX)
              .attr('y1', parentPos.y + 35)
              .attr('x2', parentCenterX)
              .attr('y2', childPos.y - 35)
              .attr('stroke', '#424242')
              .attr('stroke-width', 2.5)
              .attr('opacity', 0.8);
            
            // Draw horizontal line to child
            g.append('line')
              .attr('x1', parentCenterX)
              .attr('y1', childPos.y - 35)
              .attr('x2', childPos.x)
              .attr('y2', childPos.y - 35)
              .attr('stroke', '#424242')
              .attr('stroke-width', 2.5)
              .attr('opacity', 0.8);
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

    // Add rectangles for nodes with better styling
    nodes
      .append('rect')
      .attr('width', 160)
      .attr('height', 80)
      .attr('x', -80)
      .attr('y', -40)
      .attr('rx', 8)
      .attr('fill', (d) => {
        if (d.hasSpouse) {
          // Check if this node has marital status, or if its spouse has it
          const maritalStatus = d.data?.marital_status || d.data?.spouse?.marital_status || 'married';
          if (maritalStatus === 'divorced') return '#ffebee';
          if (maritalStatus === 'widowed') return '#f5f5f5';
          return '#fff3e0';
        }
        return '#ffffff';
      })
      .attr('stroke', (d) => {
        if (d.hasSpouse) {
          // Check if this node has marital status, or if its spouse has it
          const maritalStatus = d.data?.marital_status || d.data?.spouse?.marital_status || 'married';
          if (maritalStatus === 'divorced') return '#d32f2f';
          if (maritalStatus === 'widowed') return '#757575';
          return '#ff9800';
        }
        return '#1976d2';
      })
      .attr('stroke-width', 3)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

    // Add text with word wrapping
    nodes.each(function(d) {
      const nodeGroup = d3.select(this);
      const name = (d && d.data) ? (d.data.full_name || d.data.label || 'Unknown') : 'Unknown';
      
      // Split long names into multiple lines
      const maxCharsPerLine = 20;
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
          .attr('dy', i === 0 ? -10 : 0)
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#333')
          .text(line.length > maxCharsPerLine ? line.substring(0, maxCharsPerLine - 3) + '...' : line);
      });
      
      // Add date text
      if (d && d.data && d.data.date_of_birth) {
        try {
          const year = new Date(d.data.date_of_birth).getFullYear();
          if (!isNaN(year)) {
            const dateText = d.data.date_of_death
              ? `${year} - ${new Date(d.data.date_of_death).getFullYear()}`
              : `b. ${year}`;
            nodeGroup
              .append('text')
              .attr('text-anchor', 'middle')
              .attr('dy', 15)
              .attr('font-size', '10px')
              .attr('fill', '#666')
              .text(dateText);
          }
        } catch (e) {
          // Ignore date errors
        }
      }
    });

    // Calculate bounds and adjust viewport
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

      // Update SVG dimensions to fit content with padding
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

export default VerticalTreeView;

