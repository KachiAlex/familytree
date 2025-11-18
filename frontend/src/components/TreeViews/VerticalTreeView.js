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
      // Set minimum dimensions even if no data
      if (svgRef.current && containerRef.current) {
        const width = containerRef.current?.clientWidth || 800;
        const height = 600;
        d3.select(svgRef.current)
          .attr('width', width)
          .attr('height', height);
      }
      return;
    }

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

    // First, organize nodes by generation/depth
    const organizeByGeneration = (node, depth = 0, visited = new Set(), generationMap = new Map()) => {
      if (!node || !node.id || node.id === '__root__') return generationMap;
      if (visited.has(node.id)) return generationMap;
      visited.add(node.id);
      
      // Add node to its generation level
      if (!generationMap.has(depth)) {
        generationMap.set(depth, []);
      }
      generationMap.get(depth).push(node);
      
      // Add spouse to same generation
      if (node.spouse && node.spouse.id && !visited.has(node.spouse.id)) {
        visited.add(node.spouse.id);
        generationMap.get(depth).push({
          ...node.spouse,
          isSpouse: true,
          spouseOf: node.id,
        });
      }
      
      // Process children at next generation level
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          organizeByGeneration(child, depth + 1, new Set(visited), generationMap);
        });
      }
      
      return generationMap;
    };
    
    // Get all root nodes (if __root__ exists, use its children)
    const rootNodes = treeStructure && treeStructure.id === '__root__' && treeStructure.children
      ? treeStructure.children
      : [treeStructure].filter(Boolean);
    
    // Organize all nodes by generation
    const generationMap = new Map();
    rootNodes.forEach((root) => {
      organizeByGeneration(root, 0, new Set(), generationMap);
    });
    
    // Layout parameters
    const nodeWidth = 180;
    const nodeHeight = 150; // Vertical spacing between generations
    const spouseSpacing = 30;
    const divorcedSpacing = 100;
    const siblingSpacing = 60;
    
    // Calculate positions for each generation
    const allPositions = [];
    const depths = Array.from(generationMap.keys());
    if (depths.length === 0) {
      console.warn('No generations found in tree');
      return;
    }
    const maxDepth = Math.max(...depths);
    
    // Start from the deepest generation and work up (bottom-up approach)
    for (let depth = maxDepth; depth >= 0; depth--) {
      const nodesAtDepth = generationMap.get(depth) || [];
      if (nodesAtDepth.length === 0) continue;
      
      // Calculate Y position for this generation
      const y = 50 + (maxDepth - depth) * nodeHeight;
      
      // Group nodes by their parent pairs to position siblings together
      const nodeGroups = [];
      const processed = new Set();
      
      nodesAtDepth.forEach((node) => {
        if (processed.has(node.id)) return;
        processed.add(node.id);
        
        const group = [node];
        
        // Add spouse to same group if exists
        if (node.spouse && node.spouse.id && !processed.has(node.spouse.id)) {
          const spouseNode = nodesAtDepth.find(n => n.id === node.spouse.id);
          if (spouseNode) {
            group.push(spouseNode);
            processed.add(spouseNode.id);
          }
        } else if (node.isSpouse && node.spouseOf) {
          // This is a spouse, find its partner
          const partnerNode = nodesAtDepth.find(n => n.id === node.spouseOf);
          if (partnerNode && !processed.has(partnerNode.id)) {
            group.unshift(partnerNode);
            processed.add(partnerNode.id);
          }
        }
        
        nodeGroups.push(group);
      });
      
      // Calculate X positions for each group
      // First pass: calculate positions (children are already positioned since we go bottom-up)
      const groupPositions = [];
      const tempPositions = [];
      
      nodeGroups.forEach((group) => {
        const mainNode = group[0];
        const spouseNode = group.length > 1 ? group[1] : null;
        
        // If this node has children, center it above them
        let centerX = 0;
        let hasChildren = false;
        
        if (mainNode.children && mainNode.children.length > 0) {
          // Find children positions from allPositions (already calculated for deeper generations)
          const childPositions = allPositions.filter(p => {
            if (!mainNode.children) return false;
            return mainNode.children.some(child => child && child.id === p.id);
          });
          
          if (childPositions.length > 0) {
            const minChildX = Math.min(...childPositions.map(p => p.x));
            const maxChildX = Math.max(...childPositions.map(p => p.x));
            centerX = (minChildX + maxChildX) / 2;
            hasChildren = true;
          }
        }
        
        // If no children, position sequentially
        if (!hasChildren) {
          if (tempPositions.length > 0) {
            const lastPos = tempPositions[tempPositions.length - 1];
            const lastGroupWidth = lastPos.hasSpouse 
              ? (lastPos.marital_status === 'divorced' ? nodeWidth * 2 + divorcedSpacing : nodeWidth * 2 + spouseSpacing)
              : nodeWidth;
            centerX = lastPos.x + lastGroupWidth + siblingSpacing;
          } else {
            centerX = 100;
          }
        }
        
        const maritalStatus = mainNode.marital_status || 'married';
        const isDivorced = maritalStatus === 'divorced';
        
        // Position main node
        const mainPos = {
          id: mainNode.id,
          x: centerX,
          y: y,
          data: mainNode,
          hasSpouse: !!spouseNode,
          marital_status: maritalStatus,
        };
        groupPositions.push(mainPos);
        tempPositions.push(mainPos);
        
        // Position spouse if exists
        if (spouseNode) {
          const spouseX = isDivorced
            ? centerX + nodeWidth + divorcedSpacing
            : centerX + nodeWidth + spouseSpacing;
          
          const spousePos = {
            id: spouseNode.id,
            x: spouseX,
            y: y,
            data: spouseNode,
            hasSpouse: true,
            isSpouse: true,
            marital_status: maritalStatus,
          };
          groupPositions.push(spousePos);
          tempPositions.push(spousePos);
        }
      });
      
      allPositions.push(...groupPositions);
    }
    
    // Filter out duplicates by keeping only first occurrence of each ID
    const seenIds = new Set();
    const uniquePositions = allPositions.filter(p => {
      if (!p || !p.id || seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });
    
    if (uniquePositions.length === 0) {
      console.warn('No positions generated for tree');
      return; // Exit early if no positions
    }
    
    const positionMap = new Map(uniquePositions.map(p => [p.id, p]));

    // Draw links for parent-child relationships
    const drawLinks = (node) => {
      if (!node || !node.id || node.id === '__root__') {
        // If root node, draw links for its children
        if (node && node.id === '__root__' && node.children) {
          node.children.forEach((child) => drawLinks(child));
        }
        return;
      }
      
      const parentPos = positionMap.get(node.id);
      if (!parentPos) return;
      
      // Draw link to spouse if exists (only draw once per pair)
      if (node && node.spouse && node.spouse.id && node.id < node.spouse.id) {
        const spousePos = positionMap.get(node.spouse.id);
        if (spousePos) {
          const maritalStatus = node.spouse.marital_status || node.marital_status || 'married';
          const isDivorced = maritalStatus === 'divorced';
          const isWidowed = maritalStatus === 'widowed';
          
          // Draw spouse connection line with different styles based on status
          g.append('line')
            .attr('x1', parentPos.x + 90) // Start from right edge of first node
            .attr('y1', parentPos.y)
            .attr('x2', spousePos.x - 90) // End at left edge of second node
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
            
            // Draw vertical line from parent(s) down to child level
            g.append('line')
              .attr('x1', parentCenterX)
              .attr('y1', parentPos.y + 40)
              .attr('x2', parentCenterX)
              .attr('y2', childPos.y - 40)
              .attr('stroke', '#424242')
              .attr('stroke-width', 2.5)
              .attr('opacity', 0.8);
            
            // Draw horizontal line from center to child
            g.append('line')
              .attr('x1', parentCenterX)
              .attr('y1', childPos.y - 40)
              .attr('x2', childPos.x)
              .attr('y2', childPos.y - 40)
              .attr('stroke', '#424242')
              .attr('stroke-width', 2.5)
              .attr('opacity', 0.8);
          }
          drawLinks(child);
        });
      }
    };

    drawLinks(treeStructure);

    // Draw nodes - use unique positions to prevent duplicates
    const nodes = g
      .selectAll('.node')
      .data(uniquePositions.filter(p => p && p.id && p.id !== '__root__' && p.data))
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

      // Check if bounds are valid
      if (bounds.minX !== Infinity && bounds.maxX !== -Infinity && 
          bounds.minY !== Infinity && bounds.maxY !== -Infinity) {
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
      } else {
        // Fallback: ensure minimum dimensions
        svg.attr('width', width).attr('height', height);
        g.attr('transform', `translate(${width / 2},${height / 2})`);
      }
    } else {
      // No positions - ensure minimum dimensions
      svg.attr('width', width).attr('height', height);
      g.attr('transform', `translate(${width / 2},${height / 2})`);
    }
  }, [treeStructure, data, handleNodeClick, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: '#f5f5f5' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
    </Box>
  );
};

export default VerticalTreeView;

