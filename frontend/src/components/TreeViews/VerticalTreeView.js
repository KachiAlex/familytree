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

    // Build parent-child relationships - group by parent pairs
    const parentPairMap = new Map(); // Map parent pair (sorted IDs) to children
    
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
    
    // Build parent pair map - group children by their parent pairs
    // A child belongs to a parent pair if BOTH parents are listed as parents of that child
    childrenMap.forEach((childIds, parentId) => {
      childIds.forEach(childId => {
        // Check if this child has another parent (spouse of parentId)
        const otherParentIds = [];
        childrenMap.forEach((otherChildIds, otherParentId) => {
          if (otherParentId !== parentId && otherChildIds.includes(childId)) {
            otherParentIds.push(otherParentId);
          }
        });
        
        // Find if any of the other parents is a spouse of parentId
        const spouseInfo = spouseMap.get(parentId);
        let pairKey = null;
        
        if (spouseInfo && otherParentIds.includes(spouseInfo.spouseId)) {
          // This child has both parents - group by parent pair
          pairKey = [parentId, spouseInfo.spouseId].sort().join('_');
        } else if (otherParentIds.length === 0) {
          // Single parent - create a pair key with just this parent
          pairKey = parentId + '_';
        } else {
          // Child has other parent(s) but not the spouse - use single parent key
          pairKey = parentId + '_';
        }
        
        if (pairKey) {
          if (!parentPairMap.has(pairKey)) {
            if (spouseInfo && otherParentIds.includes(spouseInfo.spouseId)) {
              parentPairMap.set(pairKey, { parents: [parentId, spouseInfo.spouseId], children: new Set() });
            } else {
              parentPairMap.set(pairKey, { parents: [parentId], children: new Set() });
            }
          }
          parentPairMap.get(pairKey).children.add(childId);
        }
      });
    });

    const rootNodes = validNodes.filter((node) => !hasParent.has(String(node.id)));

    // Build tree structure with proper parent-child grouping
    const buildTree = (nodeId, visited = new Set()) => {
      if (!nodeId) return null;
      const key = String(nodeId);
      if (visited.has(key)) return null; // Prevent cycles - each person appears only once
      visited.add(key);

      const node = nodeMap.get(key);
      if (!node || !node.id) return null;

      // Get spouse if exists
      const spouseInfo = spouseMap.get(key);
      let spouse = null;
      let maritalStatus = 'married';
      
      if (spouseInfo && !visited.has(spouseInfo.spouseId)) {
        const spouseNode = nodeMap.get(spouseInfo.spouseId);
        if (spouseNode && spouseNode.id) {
          maritalStatus = spouseInfo.marital_status || 'married';
          spouse = {
            ...(spouseNode.data || {}),
            id: spouseNode.id,
            spouse: null, // Prevent infinite recursion
            children: [],
            marital_status: maritalStatus,
          };
          visited.add(spouseInfo.spouseId); // Mark spouse as visited to prevent duplicates
        }
      }

      // Get children for this parent pair (or single parent)
      const children = new Set();
      const pairKey = spouseInfo 
        ? [key, spouseInfo.spouseId].sort().join('_')
        : key + '_';
      
      if (parentPairMap.has(pairKey)) {
        parentPairMap.get(pairKey).children.forEach(childId => children.add(childId));
      }

      // Build children recursively
      const childrenArray = Array.from(children)
        .map((childId) => buildTree(childId, new Set(visited)))
        .filter(Boolean);

      return {
        ...(node.data || {}),
        id: node.id,
        spouse: spouse,
        children: childrenArray,
        marital_status: maritalStatus,
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
    if (!treeStructure || !data) {
      if (svgRef.current && containerRef.current) {
        const width = containerRef.current?.clientWidth || 800;
        const height = 600;
        d3.select(svgRef.current).attr('width', width).attr('height', height);
      }
      return;
    }

    const containerWidth = containerRef.current?.clientWidth || 1000;
    const nodeWidth = 160;
    const nodeHeight = 80;
    const nodeSpacingX = 220;
    const levelSpacingY = 180;
    const spouseGap = 40;
    const padding = 150;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Build hierarchy for layout (supports multi-root by keeping dummy __root__)
    const rootData = treeStructure;
    const root = d3.hierarchy(rootData, (node) => node?.children || []);

    const treeLayout = d3
      .tree()
      .nodeSize([nodeSpacingX, levelSpacingY])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.4));

    treeLayout(root);

    const allNodes = root.descendants();
    const drawableNodes = allNodes.filter(
      (n) => n.data && n.data.id && n.data.id !== '__root__'
    );

    if (drawableNodes.length === 0) {
      svg.attr('width', containerWidth).attr('height', 600);
      return;
    }

    const minX = d3.min(drawableNodes, (d) => d.x) ?? 0;
    const maxX = d3.max(drawableNodes, (d) => d.x) ?? 0;
    const minY = d3.min(drawableNodes, (d) => d.y) ?? 0;
    const maxY = d3.max(drawableNodes, (d) => d.y) ?? 0;

    const contentWidth = maxX - minX + padding * 2 + nodeWidth;
    const contentHeight = maxY - minY + padding * 2 + nodeHeight;

    const svgWidth = Math.max(containerWidth, contentWidth);
    const svgHeight = Math.max(600, contentHeight);

    svg.attr('width', svgWidth).attr('height', svgHeight);

    const g = svg.append('g');

    const xOffset = padding - minX;
    const yOffset = padding - minY;

    const getCoupleCenterX = (node) => node.x + xOffset;
    const getNodeTopY = (node) => node.y + yOffset - nodeHeight / 2;
    const getNodeBottomY = (node) => node.y + yOffset + nodeHeight / 2;
    const hasSpouse = (node) => node.data?.spouse && node.data.spouse.id;

    const addNameBlock = (group, person, centerX) => {
      if (!person) return;
      const name = person.full_name || person.label || 'Unknown';
      const maxCharsPerLine = 20;
      const words = name.split(' ');
      const lines = [];
      let currentLine = '';

      words.forEach((word) => {
        if ((currentLine + word).length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) lines.push(currentLine);
      if (lines.length === 0) lines.push(name.substring(0, maxCharsPerLine));

      lines.slice(0, 2).forEach((line, index) => {
        group
          .append('text')
          .attr('x', centerX)
          .attr('dy', index === 0 ? -10 : 2)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#333')
          .text(line.length > maxCharsPerLine ? `${line.substring(0, maxCharsPerLine - 3)}...` : line);
      });

      if (person.date_of_birth) {
        try {
          const birthYear = new Date(person.date_of_birth).getFullYear();
          if (!Number.isNaN(birthYear)) {
            const dateText = person.date_of_death
              ? `${birthYear} - ${new Date(person.date_of_death).getFullYear()}`
              : `b. ${birthYear}`;
            group
              .append('text')
              .attr('x', centerX)
              .attr('dy', 20)
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px')
              .attr('fill', '#666')
              .text(dateText);
          }
        } catch (err) {
          // ignore invalid dates
        }
      }
    };

    const links = root
      .links()
      .filter((link) => link.target.data && link.target.data.id && link.target.data.id !== '__root__');

    links.forEach((link) => {
      const sourceIsRoot = !link.source.data || link.source.data.id === '__root__';
      const startX = sourceIsRoot ? getCoupleCenterX(link.target) : getCoupleCenterX(link.source);
      const startY = sourceIsRoot ? getNodeTopY(link.target) - 40 : getNodeBottomY(link.source);
      const endX = getCoupleCenterX(link.target);
      const endY = getNodeTopY(link.target);
      const midY = startY + (endY - startY) / 2;

      g.append('path')
        .attr('d', `M${startX},${startY} V${midY} H${endX} V${endY}`)
        .attr('fill', 'none')
        .attr('stroke', '#424242')
        .attr('stroke-width', 2.4)
        .attr('stroke-linecap', 'round');
    });

    const nodes = g
      .selectAll('.node')
      .data(drawableNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x + xOffset},${d.y + yOffset})`);

    nodes.each(function (nodeDatum) {
      const group = d3.select(this);
      const spousePresent = hasSpouse(nodeDatum);
      const maritalStatus =
        nodeDatum.data?.marital_status || nodeDatum.data?.spouse?.marital_status || 'married';
      const isDivorced = maritalStatus === 'divorced';
      const isWidowed = maritalStatus === 'widowed';

      const primaryRectX = spousePresent ? -(nodeWidth + spouseGap / 2) : -nodeWidth / 2;
      const spouseRectX = spouseGap / 2;
      const primaryCenterX = spousePresent ? -(nodeWidth / 2 + spouseGap / 2) : 0;
      const spouseCenterX = nodeWidth / 2 + spouseGap / 2;

      const getFill = (isSpouseRect = false) => {
        if (!spousePresent && !isSpouseRect) return '#ffffff';
        if (isDivorced) return '#ffebee';
        if (isWidowed) return '#f5f5f5';
        return spousePresent ? '#fff3e0' : '#ffffff';
      };

      const getStroke = () => {
        if (isDivorced) return '#d32f2f';
        if (isWidowed) return '#757575';
        return spousePresent ? '#ff9800' : '#1976d2';
      };

      group
        .append('rect')
        .attr('x', primaryRectX)
        .attr('y', -nodeHeight / 2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', getFill(false))
        .attr('stroke', getStroke())
        .attr('stroke-width', 3)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))')
        .style('cursor', onPersonClick ? 'pointer' : 'default')
        .on('click', () => handleNodeClick(nodeDatum.data.id));

      addNameBlock(group, nodeDatum.data, primaryCenterX);

      if (spousePresent) {
        group
          .append('rect')
          .attr('x', spouseRectX)
          .attr('y', -nodeHeight / 2)
          .attr('width', nodeWidth)
          .attr('height', nodeHeight)
          .attr('rx', 10)
          .attr('fill', getFill(true))
          .attr('stroke', getStroke())
          .attr('stroke-width', 3)
          .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))')
          .style('cursor', onPersonClick ? 'pointer' : 'default')
          .on('click', () => handleNodeClick(nodeDatum.data.spouse.id));

        addNameBlock(group, nodeDatum.data.spouse, spouseCenterX);

        group
          .append('line')
          .attr('x1', -spouseGap / 2)
          .attr('y1', 0)
          .attr('x2', spouseGap / 2)
          .attr('y2', 0)
          .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
          .attr('stroke-width', isDivorced ? 2.5 : 3)
          .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : '0');
      }
    });
  }, [treeStructure, data, handleNodeClick, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: '#f5f5f5' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
    </Box>
  );
};

export default VerticalTreeView;

