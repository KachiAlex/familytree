import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  maritalStatusColors,
  layoutConfig 
} from '../../config/treeConfig';

const RadialTreeView = ({ data, onPersonClick }) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [showLegend, setShowLegend] = useState(true);

  // Build data structure with relationships (similar to VerticalTreeView)
  const personsData = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const persons = new Map();
    const childrenByParent = new Map();
    const spouses = new Map();

    validNodes.forEach((node) => {
      const id = String(node.id);
      persons.set(id, {
        id,
        name: node.data?.full_name || node.data?.label || 'Unknown',
        data: node.data || {},
      });
    });

    (data.edges || []).forEach((edge) => {
      if (!edge || !edge.source || !edge.target) return;
      
      const sourceId = String(edge.source);
      const targetId = String(edge.target);

      if (edge.type === 'parent') {
        if (!childrenByParent.has(sourceId)) {
          childrenByParent.set(sourceId, []);
        }
        childrenByParent.get(sourceId).push(targetId);
      } else if (edge.type === 'spouse') {
        const maritalStatus = edge.marital_status || 'married';
        spouses.set(sourceId, { spouseId: targetId, marital_status: maritalStatus });
        spouses.set(targetId, { spouseId: sourceId, marital_status: maritalStatus });
      }
    });

    return { persons, childrenByParent, spouses };
  }, [data]);

  // Helper function to check if a person has ANY divorced relationship
  const hasDivorcedRelationship = useCallback((personId) => {
    if (!data || !data.edges) return false;
    const personIdStr = String(personId);
    return data.edges.some(edge => {
      if (!edge || edge.type !== 'spouse') return false;
      const sourceId = String(edge.source);
      const targetId = String(edge.target);
      const maritalStatus = edge.marital_status || 'married';
      return (sourceId === personIdStr || targetId === personIdStr) && maritalStatus === 'divorced';
    });
  }, [data]);

  useEffect(() => {
    const { persons, childrenByParent, spouses } = personsData;
    if (persons.size === 0) {
      if (svgRef.current && containerRef.current) {
        const width = containerRef.current?.clientWidth || 1200;
        const height = 800;
        d3.select(svgRef.current).attr('width', width).attr('height', height);
      }
      return;
    }

    const width = containerRef.current?.clientWidth || 1200;
    const height = containerRef.current?.clientHeight || 800;
    const radius = Math.min(width, height) / 2 - 100; // Leave space for labels

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Find root nodes (no parents)
    const hasParent = new Set();
    childrenByParent.forEach((childIds, parentId) => {
      childIds.forEach(childId => hasParent.add(childId));
    });

    const rootIds = Array.from(persons.keys()).filter(id => !hasParent.has(id));
    if (rootIds.length === 0) return;

    // Use first root as the center
    const rootId = rootIds[0];
    const rootPerson = persons.get(rootId);

    // Build hierarchy for radial layout
    const buildHierarchy = (nodeId, depth = 0) => {
      const person = persons.get(nodeId);
      if (!person) return null;

      const children = childrenByParent.get(nodeId) || [];
      const childNodes = children
        .map(childId => buildHierarchy(childId, depth + 1))
        .filter(Boolean);

      return {
        id: nodeId,
        name: person.name,
        data: person.data,
        depth,
        children: childNodes,
      };
    };

    const rootData = buildHierarchy(rootId);
    if (!rootData) return;

    const root = d3.hierarchy(rootData);

    // Use D3's radial tree layout
    const treeLayout = d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => {
        // Better separation for siblings
        if (a.parent === b.parent) {
          return 1.2; // Siblings
        }
        return 2 / a.depth; // Different branches
      });

    treeLayout(root);

    // Calculate node positions for spouses (same angle, slightly different radius)
    const nodePositions = new Map();
    root.descendants().forEach((d, i) => {
      const angle = d.x;
      const baseRadius = d.y;
      nodePositions.set(d.data.id, {
        angle,
        radius: baseRadius,
        depth: d.depth,
        node: d
      });

      // Position spouses at the same angle but slightly offset radius
      const spouseInfo = spouses.get(d.data.id);
      if (spouseInfo) {
        const spouseId = spouseInfo.spouseId;
        if (!nodePositions.has(spouseId)) {
          // Check if spouse is already in the tree
          const spouseInTree = root.descendants().find(desc => desc.data.id === spouseId);
          if (!spouseInTree) {
            // Spouse not in tree, position them
            nodePositions.set(spouseId, {
              angle,
              radius: baseRadius + 15, // Slightly further out
              depth: d.depth,
              node: null
            });
          }
        }
      }
    });

    // Draw links (parent-child connections)
    const links = root.links();
    g.selectAll('.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkRadial()
        .angle(d => d.x)
        .radius(d => d.y))
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const childDepth = d.target.depth;
        const levelIndex = Math.min(childDepth, generationColors.border.length - 1);
        return generationColors.border[levelIndex];
      })
      .attr('stroke-width', 2.5)
      .attr('opacity', layoutConfig.connectionLineOpacity);

    // Draw spouse connections (curved lines)
    spouses.forEach((spouseInfo, personId) => {
      const personPos = nodePositions.get(personId);
      const spousePos = nodePositions.get(spouseInfo.spouseId);
      
      if (!personPos || !spousePos) return;
      if (personId >= spouseInfo.spouseId) return; // Draw once per pair

      const maritalStatus = spouseInfo.marital_status || 'married';
      const isDivorced = maritalStatus === 'divorced';
      const isWidowed = maritalStatus === 'widowed';

      // Calculate positions
      const x1 = personPos.radius * Math.cos(personPos.angle - Math.PI / 2);
      const y1 = personPos.radius * Math.sin(personPos.angle - Math.PI / 2);
      const x2 = spousePos.radius * Math.cos(spousePos.angle - Math.PI / 2);
      const y2 = spousePos.radius * Math.sin(spousePos.angle - Math.PI / 2);

      // Draw curved line for spouses
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const controlX = midX + (Math.abs(x2 - x1) * 0.3);
      const controlY = midY + (Math.abs(y2 - y1) * 0.3);

      const path = d3.path();
      path.moveTo(x1, y1);
      path.quadraticCurveTo(controlX, controlY, x2, y2);

      g.append('path')
        .attr('d', path.toString())
        .attr('fill', 'none')
        .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
        .attr('stroke-width', isDivorced ? 2.5 : 3)
        .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');

      // Add diagonal slash for divorced relationships
      if (isDivorced) {
        const slashLength = 30;
        g.append('line')
          .attr('x1', midX - slashLength / 2)
          .attr('y1', midY - slashLength / 2)
          .attr('x2', midX + slashLength / 2)
          .attr('y2', midY + slashLength / 2)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 4)
          .attr('stroke-linecap', 'round');
        
        g.append('line')
          .attr('x1', midX - slashLength / 2)
          .attr('y1', midY + slashLength / 2)
          .attr('x2', midX + slashLength / 2)
          .attr('y2', midY - slashLength / 2)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 4)
          .attr('stroke-linecap', 'round');
      }
    });

    // Draw nodes
    const { nodeWidth, nodeHeight } = layoutConfig;
    const allNodeIds = Array.from(nodePositions.keys());
    
    const nodeGroups = g
      .selectAll('.node')
      .data(allNodeIds)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (id) => {
        const pos = nodePositions.get(id);
        const x = pos.radius * Math.cos(pos.angle - Math.PI / 2);
        const y = pos.radius * Math.sin(pos.angle - Math.PI / 2);
        return `translate(${x},${y})`;
      })
      .style('cursor', onPersonClick ? 'pointer' : 'default')
      .on('click', (event, id) => {
        if (onPersonClick) {
          onPersonClick(id);
        }
      });

    nodeGroups.each(function (id) {
      const group = d3.select(this);
      const person = persons.get(id);
      if (!person) return;

      const pos = nodePositions.get(id);
      const depth = pos.depth;
      const spouseInfo = spouses.get(id);
      const hasSpouse = !!spouseInfo;
      const isDivorced = hasDivorcedRelationship(id);
      const maritalStatus = spouseInfo?.marital_status || 'married';
      const isWidowed = maritalStatus === 'widowed';

      // Determine colors based on generation and marital status
      const levelIndex = Math.min(depth, generationColors.background.length - 1);
      let backgroundColor = generationColors.background[levelIndex];
      let borderColor = generationColors.border[levelIndex];
      
      if (hasSpouse) {
        if (isDivorced) {
          const divorcedColors = maritalStatusColors.divorced;
          backgroundColor = divorcedColors.background;
          borderColor = divorcedColors.border;
        } else if (isWidowed) {
          const widowedColors = maritalStatusColors.widowed;
          backgroundColor = widowedColors.background;
          borderColor = widowedColors.border;
        } else {
          const marriedColors = maritalStatusColors.married;
          backgroundColor = marriedColors.background;
          borderColor = marriedColors.border;
        }
      }

      // Draw node rectangle (rotated to face outward)
      group
        .append('rect')
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 8)
        .attr('fill', backgroundColor)
        .attr('stroke', borderColor)
        .attr('stroke-width', 3)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))')
        .attr('transform', `rotate(${(pos.angle * 180 / Math.PI)})`);

      // Add name text (rotated to be readable)
      const name = person.name;
      const maxCharsPerLine = 15;
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
          .attr('x', 0)
          .attr('y', index === 0 ? -8 : 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .attr('fill', '#333')
          .attr('transform', `rotate(${(pos.angle * 180 / Math.PI)})`)
          .text(line.length > maxCharsPerLine ? `${line.substring(0, maxCharsPerLine - 3)}...` : line);
      });

      // Add date text
      if (person.data.date_of_birth) {
        try {
          const birthYear = new Date(person.data.date_of_birth).getFullYear();
          if (!Number.isNaN(birthYear)) {
            const dateText = person.data.date_of_death
              ? `${birthYear} - ${new Date(person.data.date_of_death).getFullYear()}`
              : `b. ${birthYear}`;
            group
              .append('text')
              .attr('x', 0)
              .attr('y', 18)
              .attr('text-anchor', 'middle')
              .attr('font-size', '9px')
              .attr('fill', '#666')
              .attr('transform', `rotate(${(pos.angle * 180 / Math.PI)})`)
              .text(dateText);
          }
        } catch (err) {
          // ignore invalid dates
        }
      }

      // Add divorce indicator badge
      if (isDivorced && hasSpouse) {
        const badgeX = nodeWidth / 2 - 40;
        const badgeY = -nodeHeight / 2 + 6;
        
        group
          .append('rect')
          .attr('x', badgeX - 25)
          .attr('y', badgeY - 6)
          .attr('width', 50)
          .attr('height', 12)
          .attr('rx', 6)
          .attr('fill', '#d32f2f')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1)
          .attr('transform', `rotate(${(pos.angle * 180 / Math.PI)})`);
        
        group
          .append('text')
          .attr('x', badgeX)
          .attr('y', badgeY + 1)
          .attr('text-anchor', 'middle')
          .attr('font-size', '7px')
          .attr('font-weight', 'bold')
          .attr('fill', '#ffffff')
          .attr('transform', `rotate(${(pos.angle * 180 / Math.PI)})`)
          .text('DIVORCED');
      }
    });

    console.log(`🔵 [RADIAL] Rendered ${allNodeIds.length} nodes`);
  }, [personsData, hasDivorcedRelationship, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: '#f5f5f5', position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
      
      {/* Color Legend Panel - Bottom Left Corner */}
      {showLegend && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            padding: 1.5,
            width: 260,
            backgroundColor: 'white',
            zIndex: 1000,
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#333' }}>
              Color Legend
            </Typography>
            <Chip
              label="Hide"
              onClick={() => setShowLegend(false)}
              size="small"
              sx={{
                cursor: 'pointer',
                height: 24,
                fontSize: '0.75rem',
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            />
          </Box>
          
          <Divider sx={{ my: 1 }} />
          
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.75, color: '#555', fontSize: '0.8rem' }}>
            Generation Levels (Center → Outward)
          </Typography>
          {generationLabels.slice(0, 5).map((label, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 20,
                  backgroundColor: generationColors.background[index],
                  border: `2px solid ${generationColors.border[index]}`,
                  borderRadius: '3px',
                  mr: 1,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
                {label}
              </Typography>
            </Box>
          ))}
          {generationLabels.length > 5 && (
            <Typography variant="body2" sx={{ fontSize: '0.7rem', color: '#999', fontStyle: 'italic', ml: 5 }}>
              + {generationLabels.length - 5} more levels
            </Typography>
          )}
          
          <Divider sx={{ my: 1 }} />
          
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.75, color: '#555', fontSize: '0.8rem' }}>
            Marital Status
          </Typography>
          
          {Object.values(maritalStatusColors).map((statusColor, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 20,
                  backgroundColor: statusColor.background,
                  border: `2px solid ${statusColor.border}`,
                  borderRadius: '3px',
                  mr: 1,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
                {statusColor.label}
              </Typography>
            </Box>
          ))}
          
          <Divider sx={{ my: 1 }} />
          
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.75, color: '#555', fontSize: '0.8rem' }}>
            Connections
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 2,
                backgroundColor: generationColors.border[2],
                opacity: 0.6,
                borderRadius: '2px',
                mr: 1,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              Parent-Child (Radial)
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 2,
                backgroundColor: '#ff9800',
                borderRadius: '2px',
                mr: 1,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              Married (Curved)
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 2,
                backgroundColor: '#d32f2f',
                backgroundImage: 'repeating-linear-gradient(90deg, #d32f2f 0, #d32f2f 3px, transparent 3px, transparent 6px)',
                borderRadius: '2px',
                mr: 1,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              Divorced (Curved)
            </Typography>
          </Box>
        </Paper>
      )}
      
      {!showLegend && (
        <Chip
          label="Show Legend"
          onClick={() => setShowLegend(true)}
          size="small"
          sx={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            cursor: 'pointer',
            zIndex: 1000,
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            '&:hover': { backgroundColor: '#f5f5f5', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }
          }}
        />
      )}
    </Box>
  );
};

export default RadialTreeView;
