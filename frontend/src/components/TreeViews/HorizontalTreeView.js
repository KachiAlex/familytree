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
    const parentPairMap = new Map(); // Map parent pair (sorted IDs) to children
    
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
    
    // Build parent pair map - group children by their parent pairs
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

    const buildTree = (nodeId, visited = new Set()) => {
      const key = String(nodeId);
      if (visited.has(key)) return null; // Prevent cycles - each person appears only once
      visited.add(key);

      const node = nodeMap.get(key);
      if (!node) return null;

      // Get spouse if exists
      const spouseInfo = spouseMap.get(key);
      let spouse = null;
      let maritalStatus = 'married';
      
      if (spouseInfo && !visited.has(spouseInfo.spouseId)) {
        const spouseNode = nodeMap.get(spouseInfo.spouseId);
        if (spouseNode) {
          maritalStatus = spouseInfo.marital_status || 'married';
          spouse = {
            ...spouseNode.data,
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
    if (!treeStructure || !data) {
      if (svgRef.current && containerRef.current) {
        const width = containerRef.current?.clientWidth || 1200;
        const height = 800;
        d3.select(svgRef.current)
          .attr('width', width)
          .attr('height', height);
      }
      return;
    }

    const containerWidth = containerRef.current?.clientWidth || 1200;
    const containerHeight = containerRef.current?.clientHeight || 800;
    const nodeWidth = 160;
    const nodeHeight = 80;
    const levelSpacingX = 250; // Horizontal spacing between generations (left to right)
    const siblingSpacingY = 40; // Vertical spacing between siblings
    const spouseGap = 40;
    const padding = 150;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Organize nodes by generation (depth)
    const organizeByGeneration = (node, depth = 0, visited = new Set(), generationMap = new Map()) => {
      if (!node || !node.id || node.id === '__root__') return generationMap;
      if (visited.has(node.id)) return generationMap;
      visited.add(node.id);
      
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
    
    // Get all root nodes
    const rootNodes = treeStructure && treeStructure.id === '__root__' && treeStructure.children
      ? treeStructure.children
      : [treeStructure].filter(Boolean);
    
    const generationMap = new Map();
    rootNodes.forEach((root) => {
      organizeByGeneration(root, 0, new Set(), generationMap);
    });

    const depths = Array.from(generationMap.keys()).sort((a, b) => a - b);
    if (depths.length === 0) {
      svg.attr('width', containerWidth).attr('height', containerHeight);
      return;
    }

    // Build parent-child mapping for sibling grouping
    const parentToChildren = new Map();
    const childToParent = new Map();
    
    const buildParentChildMap = (node, parentPairKey = null) => {
      if (!node || !node.id || node.id === '__root__') return;
      
      if (parentPairKey) {
        if (!parentToChildren.has(parentPairKey)) {
          parentToChildren.set(parentPairKey, []);
        }
        parentToChildren.get(parentPairKey).push(node.id);
        childToParent.set(node.id, parentPairKey);
      }
      
      if (node.children && node.children.length > 0) {
        const pairKey = node.spouse && node.spouse.id
          ? [node.id, node.spouse.id].sort().join('_')
          : node.id + '_';
        
        node.children.forEach((child) => {
          buildParentChildMap(child, pairKey);
        });
      }
    };
    
    rootNodes.forEach((root) => buildParentChildMap(root));

    // Calculate positions: right-to-left approach (deepest generation first)
    const nodePositions = []; // Array of {id, x, y, data, hasSpouse, marital_status}
    
    // Process from deepest generation to root (right to left for horizontal view)
    for (let i = depths.length - 1; i >= 0; i--) {
      const depth = depths[i];
      const nodesAtDepth = generationMap.get(depth) || [];
      const x = padding + depth * levelSpacingX;
      
      // Group siblings together
      const siblingGroups = new Map(); // parentPairKey -> [nodeIds]
      const processed = new Set();
      const standaloneNodes = [];
      
      nodesAtDepth.forEach((node) => {
        if (processed.has(node.id)) return;
        
        const parentKey = childToParent.get(node.id);
        if (parentKey) {
          if (!siblingGroups.has(parentKey)) {
            siblingGroups.set(parentKey, []);
          }
          siblingGroups.get(parentKey).push(node);
          processed.add(node.id);
          
          // Add spouse if exists
          if (node.spouse && node.spouse.id && !processed.has(node.spouse.id)) {
            const spouseNode = nodesAtDepth.find(n => n.id === node.spouse.id);
            if (spouseNode) {
              siblingGroups.get(parentKey).push(spouseNode);
              processed.add(spouseNode.id);
            }
          }
        } else {
          standaloneNodes.push(node);
          processed.add(node.id);
          
          // Add spouse if exists
          if (node.spouse && node.spouse.id && !processed.has(node.spouse.id)) {
            const spouseNode = nodesAtDepth.find(n => n.id === node.spouse.id);
            if (spouseNode) {
              standaloneNodes.push(spouseNode);
              processed.add(spouseNode.id);
            }
          }
        }
      });
      
      // Position siblings vertically, then center parents to their left
      let currentY = padding;
      const siblingGroupPositions = [];
      
      // First, position all sibling groups
      siblingGroups.forEach((siblings, parentKey) => {
        siblings.forEach((sibling) => {
          const maritalStatus = sibling.marital_status || 'married';
          siblingGroupPositions.push({
            id: sibling.id,
            x: x,
            y: currentY,
            data: sibling,
            hasSpouse: !!sibling.spouse,
            marital_status: maritalStatus,
            parentKey: parentKey,
          });
          currentY += nodeHeight + siblingSpacingY;
        });
        currentY += siblingSpacingY * 2; // Extra spacing between sibling groups
      });
      
      // Position standalone nodes (root nodes or nodes without parents)
      standaloneNodes.forEach((node) => {
        // If this node has children, center it to the left of them
        let y = currentY;
        if (node.children && node.children.length > 0) {
          const pairKey = node.spouse && node.spouse.id
            ? [node.id, node.spouse.id].sort().join('_')
            : node.id + '_';
          const childrenIds = parentToChildren.get(pairKey) || [];
          const childPositions = nodePositions.filter(p => childrenIds.includes(p.id));
          
          if (childPositions.length > 0) {
            const minChildY = Math.min(...childPositions.map(p => p.y));
            const maxChildY = Math.max(...childPositions.map(p => p.y));
            y = (minChildY + maxChildY) / 2;
          }
        }
        
        const maritalStatus = node.marital_status || 'married';
        nodePositions.push({
          id: node.id,
          x: x,
          y: y,
          data: node,
          hasSpouse: !!node.spouse,
          marital_status: maritalStatus,
        });
        
        // Add spouse below node (vertically for horizontal view)
        if (node.spouse && node.spouse.id) {
          const spouseNode = nodesAtDepth.find(n => n.id === node.spouse.id);
          if (spouseNode) {
            const isDivorced = maritalStatus === 'divorced';
            const spouseY = isDivorced ? y + nodeHeight + 60 : y + nodeHeight + spouseGap;
            nodePositions.push({
              id: spouseNode.id,
              x: x,
              y: spouseY,
              data: spouseNode,
              hasSpouse: true,
              isSpouse: true,
              marital_status: maritalStatus,
            });
          }
        }
        
        currentY = Math.max(currentY, y + nodeHeight * 2 + spouseGap + siblingSpacingY);
      });
      
      // Add sibling group positions
      nodePositions.push(...siblingGroupPositions);
    }
    
    // Update positions for parents to center them to the left of their children
    for (let i = 0; i < depths.length - 1; i++) {
      const depth = depths[i];
      const nodesAtDepth = generationMap.get(depth) || [];
      
      nodesAtDepth.forEach((node) => {
        if (node.children && node.children.length > 0) {
          const pairKey = node.spouse && node.spouse.id
            ? [node.id, node.spouse.id].sort().join('_')
            : node.id + '_';
          const childrenIds = parentToChildren.get(pairKey) || [];
          const childPositions = nodePositions.filter(p => childrenIds.includes(p.id));
          
          if (childPositions.length > 0) {
            const minChildY = Math.min(...childPositions.map(p => p.y));
            const maxChildY = Math.max(...childPositions.map(p => p.y));
            const centerY = (minChildY + maxChildY) / 2;
            
            // Update parent position
            const parentPos = nodePositions.find(p => p.id === node.id);
            if (parentPos) {
              parentPos.y = centerY;
            }
            
            // Update spouse position
            if (node.spouse && node.spouse.id) {
              const spousePos = nodePositions.find(p => p.id === node.spouse.id);
              if (spousePos) {
                const maritalStatus = node.marital_status || 'married';
                const isDivorced = maritalStatus === 'divorced';
                spousePos.y = isDivorced ? centerY + nodeHeight + 60 : centerY + nodeHeight + spouseGap;
              }
            }
          }
        }
      });
    }

    if (nodePositions.length === 0) {
      svg.attr('width', containerWidth).attr('height', containerHeight);
      return;
    }

    // Calculate SVG dimensions
    const minX = Math.min(...nodePositions.map(p => p.x));
    const maxX = Math.max(...nodePositions.map(p => p.x));
    const minY = Math.min(...nodePositions.map(p => p.y));
    const maxY = Math.max(...nodePositions.map(p => p.y));

    const contentWidth = maxX - minX + padding * 2 + nodeWidth;
    const contentHeight = maxY - minY + padding * 2 + nodeHeight;

    const svgWidth = Math.max(containerWidth, contentWidth);
    const svgHeight = Math.max(containerHeight, contentHeight);

    svg.attr('width', svgWidth).attr('height', svgHeight);

    const g = svg.append('g');
    const xOffset = padding - minX;
    const yOffset = padding - minY;

    const positionMap = new Map(nodePositions.map(p => [p.id, p]));

    // Draw links
    const drawLinks = (node) => {
      if (!node || !node.id || node.id === '__root__') {
        if (node && node.id === '__root__' && node.children) {
          node.children.forEach((child) => drawLinks(child));
        }
        return;
      }
      
      const parentPos = positionMap.get(node.id);
      if (!parentPos) return;
      
      // Draw spouse link (vertical for horizontal view)
      if (node.spouse && node.spouse.id && node.id < node.spouse.id) {
        const spousePos = positionMap.get(node.spouse.id);
        if (spousePos) {
          const maritalStatus = node.spouse.marital_status || node.marital_status || 'married';
          const isDivorced = maritalStatus === 'divorced';
          const isWidowed = maritalStatus === 'widowed';
          
          g.append('line')
            .attr('x1', parentPos.x + xOffset)
            .attr('y1', parentPos.y + yOffset + nodeHeight / 2)
            .attr('x2', spousePos.x + xOffset)
            .attr('y2', spousePos.y + yOffset - nodeHeight / 2)
            .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
            .attr('stroke-width', isDivorced ? 2.5 : 3)
            .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');
        }
      }
      
      // Draw links to children
      if (node.children && node.children.length > 0) {
        const childrenIds = node.children.map(c => c.id).filter(Boolean);
        const childPositions = nodePositions.filter(p => childrenIds.includes(p.id));
        
        if (childPositions.length > 0) {
          const minChildY = Math.min(...childPositions.map(p => p.y));
          const maxChildY = Math.max(...childPositions.map(p => p.y));
          const parentCenterY = parentPos.y + yOffset + nodeHeight / 2;
          const parentRightX = parentPos.x + xOffset + nodeWidth / 2;
          const childLeftX = childPositions[0].x + xOffset - nodeWidth / 2;
          const midX = parentRightX + (childLeftX - parentRightX) / 2;
          
          // Horizontal line from parent to the right
          g.append('line')
            .attr('x1', parentRightX)
            .attr('y1', parentCenterY)
            .attr('x2', midX)
            .attr('y2', parentCenterY)
            .attr('stroke', '#424242')
            .attr('stroke-width', 2.5);
          
          // Vertical line connecting siblings
          g.append('line')
            .attr('x1', midX)
            .attr('y1', minChildY + yOffset)
            .attr('x2', midX)
            .attr('y2', maxChildY + yOffset)
            .attr('stroke', '#424242')
            .attr('stroke-width', 2.5);
          
          // Horizontal lines from vertical line to each child
          childPositions.forEach((childPos) => {
            const childCenterY = childPos.y + yOffset + nodeHeight / 2;
            g.append('line')
              .attr('x1', midX)
              .attr('y1', childCenterY)
              .attr('x2', childLeftX)
              .attr('y2', childCenterY)
              .attr('stroke', '#424242')
              .attr('stroke-width', 2.5);
          });
        }
        
        node.children.forEach((child) => drawLinks(child));
      }
    };

    rootNodes.forEach((root) => drawLinks(root));

    // Draw nodes
    const addNameBlock = (group, person, centerX, centerY) => {
      if (!person) return;
      const name = person.full_name || person.label || 'Unknown';
      const maxCharsPerLine = 18;
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
          .attr('y', centerY + (index === 0 ? -8 : 8))
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
              .attr('y', centerY + 20)
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

    const nodes = g
      .selectAll('.node')
      .data(nodePositions.filter(p => p && p.id && p.id !== '__root__'))
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x + xOffset},${d.y + yOffset})`);

    nodes.each(function (d) {
      const group = d3.select(this);
      const spousePresent = d.hasSpouse;
      const maritalStatus = d.marital_status || 'married';
      const isDivorced = maritalStatus === 'divorced';
      const isWidowed = maritalStatus === 'widowed';

      const getFill = () => {
        if (!spousePresent) return '#ffffff';
        if (isDivorced) return '#ffebee';
        if (isWidowed) return '#f5f5f5';
        return '#fff3e0';
      };

      const getStroke = () => {
        if (isDivorced) return '#d32f2f';
        if (isWidowed) return '#757575';
        return spousePresent ? '#ff9800' : '#1976d2';
      };

      group
        .append('rect')
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', getFill())
        .attr('stroke', getStroke())
        .attr('stroke-width', 3)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))')
        .style('cursor', onPersonClick ? 'pointer' : 'default')
        .on('click', () => handleNodeClick(d.data.id));

      addNameBlock(group, d.data, 0, 0);
    });
  }, [treeStructure, data, handleNodeClick, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: '#f5f5f5' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
    </Box>
  );
};

export default HorizontalTreeView;
