import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  layoutConfig,
  treeStyles 
} from '../../config/treeConfig';

const VerticalTreeView = ({ data, onPersonClick, onSetFocalPerson }) => {
  const svgRef = useRef();
  const [showLegend, setShowLegend] = useState(true);
  const containerRef = useRef();
  
  const focalPersonId = data?.focalPersonId;

  // Build data structure with relationships
  const personsData = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const persons = new Map();
    const childrenByParent = new Map(); // parentId -> [childIds]
    const spouses = new Map(); // personId -> Set of { spouseId, marital_status }

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
        if (!spouses.has(sourceId)) spouses.set(sourceId, new Set());
        if (!spouses.has(targetId)) spouses.set(targetId, new Set());
        spouses.get(sourceId).add(JSON.stringify({ spouseId: targetId, marital_status: maritalStatus }));
        spouses.get(targetId).add(JSON.stringify({ spouseId: sourceId, marital_status: maritalStatus }));
      }
    });

    // Parse the JSON sets back into arrays of objects
    const finalSpouses = new Map();
    spouses.forEach((spouseSet, id) => {
      finalSpouses.set(id, Array.from(spouseSet).map(s => JSON.parse(s)));
    });

    return { persons, childrenByParent, spouses: finalSpouses };
  }, [data]);

  // Compute layout positions for VERTICAL view
  const computeLayout = useCallback(() => {
    const { persons, childrenByParent, spouses } = personsData;
    if (persons.size === 0) return { positions: new Map(), levelMap: new Map() };

    // Build relationship maps for bidirectional traversal
    const parentsByChild = new Map();
    childrenByParent.forEach((childIds, parentId) => {
      childIds.forEach(childId => {
        if (!parentsByChild.has(childId)) parentsByChild.set(childId, []);
        parentsByChild.get(childId).push(parentId);
      });
    });

    // Determine relevant nodes based on focal person (ancestors + descendants)
    const relevantNodes = new Set();
    if (focalPersonId && persons.has(focalPersonId)) {
      const queue = [focalPersonId];
      relevantNodes.add(focalPersonId);
      
      // Add spouses of focal person
      const focalSpouses = spouses.get(focalPersonId) || [];
      focalSpouses.forEach(s => relevantNodes.add(s.spouseId));

      // Simple traversal to find all connected nodes in this family graph
      let head = 0;
      while(head < queue.length) {
        const id = queue[head++];
        
        // Up to parents
        const parents = parentsByChild.get(id) || [];
        parents.forEach(p => {
          if (!relevantNodes.has(p)) {
            relevantNodes.add(p);
            queue.push(p);
          }
        });

        // Down to children
        const children = childrenByParent.get(id) || [];
        children.forEach(c => {
          if (!relevantNodes.has(c)) {
            relevantNodes.add(c);
            queue.push(c);
          }
        });

        // Spouses
        const sList = spouses.get(id) || [];
        sList.forEach(s => {
          if (!relevantNodes.has(s.spouseId)) {
            relevantNodes.add(s.spouseId);
            queue.push(s.spouseId);
          }
        });
      }
    } else {
      // If no focal person, use all nodes
      persons.forEach((_, id) => relevantNodes.add(id));
    }

    const generations = new Map();
    relevantNodes.forEach(id => generations.set(id, 0));

    // Iterative rank refinement
    for (let i = 0; i < 25; i++) {
      let changed = false;
      
      // Parent-Child constraint
      childrenByParent.forEach((childIds, parentId) => {
        if (!relevantNodes.has(parentId)) return;
        const pGen = generations.get(parentId);
        childIds.forEach(childId => {
          if (!relevantNodes.has(childId)) return;
          const cGen = generations.get(childId);
          if (cGen < pGen + 1) {
            generations.set(childId, pGen + 1);
            changed = true;
          }
        });
      });

      // Spouse constraint
      spouses.forEach((spouseList, personId) => {
        if (!relevantNodes.has(personId)) return;
        const gen1 = generations.get(personId);
        spouseList.forEach(spouseInfo => {
          if (!relevantNodes.has(spouseInfo.spouseId)) return;
          const gen2 = generations.get(spouseInfo.spouseId);
          if (gen1 !== gen2) {
            const maxGen = Math.max(gen1, gen2);
            generations.set(personId, maxGen);
            generations.set(spouseInfo.spouseId, maxGen);
            changed = true;
          }
        });
      });

      if (!changed) break;
    }

    // Normalize generations so root starts at 0 if we re-centered
    if (generations.size > 0) {
      const minGen = Math.min(...Array.from(generations.values()));
      generations.forEach((gen, id) => generations.set(id, gen - minGen));
    }

    const levelMap = new Map();
    generations.forEach((gen, id) => {
      if (!levelMap.has(gen)) levelMap.set(gen, []);
      levelMap.get(gen).push(id);
    });

    const { nodeWidth, levelSpacing, siblingSpacing, familyUnitGap, padding } = layoutConfig;
    const positions = new Map();
    
    // Pass 1: Initial X positioning based on hierarchy
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    const levelWidths = new Map(); // level -> nextAvailableX
    sortedLevels.forEach(l => levelWidths.set(l, padding));

    // Helper to position a node and its descendants recursively
    const visited = new Set();
    const positionNode = (id, level, xHint) => {
      if (visited.has(id)) return;
      visited.add(id);

      const currentX = Math.max(xHint, levelWidths.get(level) || padding);
      positions.set(id, { x: currentX, y: padding + level * levelSpacing, level });
      
      // Position spouses immediately next to each other
      const spouseList = spouses.get(id) || [];
      let spouseX = currentX;
      spouseList.forEach(sInfo => {
        if (!visited.has(sInfo.spouseId) && generations.get(sInfo.spouseId) === level) {
          visited.add(sInfo.spouseId);
          spouseX += nodeWidth + siblingSpacing;
          positions.set(sInfo.spouseId, { x: spouseX, y: padding + level * levelSpacing, level });
        }
      });
      
      levelWidths.set(level, spouseX + nodeWidth + familyUnitGap);

      // Position children below
      const children = childrenByParent.get(id) || [];
      if (children.length > 0) {
        let childX = currentX;
        children.forEach(childId => {
          positionNode(childId, level + 1, childX);
          childX = (positions.get(childId)?.x || childX) + nodeWidth + siblingSpacing;
        });
      }
    };

    // Start positioning from roots
    const roots = Array.from(persons.keys()).filter(id => {
      let hasParent = false;
      childrenByParent.forEach(cIds => {
        if (cIds.includes(id)) hasParent = true;
      });
      return !hasParent;
    });

    roots.forEach(rootId => {
      positionNode(rootId, 0, padding);
    });

    // Handle any missed nodes
    persons.forEach((_, id) => {
      if (!visited.has(id)) positionNode(id, generations.get(id), padding);
    });

    // Pass 2: Center parents over children
    // Go from bottom up
    for (let i = sortedLevels.length - 1; i >= 0; i--) {
      const level = sortedLevels[i];
      const ids = levelMap.get(level);
      
      ids.forEach(id => {
        const children = childrenByParent.get(id) || [];
        if (children.length > 0) {
          const childXs = children
            .map(cid => positions.get(cid)?.x)
            .filter(x => x !== undefined);
          
          if (childXs.length > 0) {
            const avgChildX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
            const pos = positions.get(id);
            if (pos) pos.x = avgChildX;

            // Shift spouses too
            const spouseList = spouses.get(id) || [];
            spouseList.forEach((sInfo, idx) => {
              const sPos = positions.get(sInfo.spouseId);
              if (sPos && sPos.level === level) {
                sPos.x = avgChildX + (idx + 1) * (nodeWidth + siblingSpacing);
              }
            });
          }
        }
      });
    }

    // Pass 3: Resolve overlaps and finalize
    // (Simple shift to the right if overlap occurs)
    sortedLevels.forEach(level => {
      const levelNodes = Array.from(positions.entries())
        .filter(([_, p]) => p.level === level)
        .sort((a, b) => a[1].x - b[1].x);
      
      let minX = padding;
      levelNodes.forEach(([_, pos]) => {
        if (pos.x < minX) pos.x = minX;
        minX = pos.x + nodeWidth + siblingSpacing;
      });
    });

    return { positions, levelMap };
  }, [personsData, focalPersonId]);

  useEffect(() => {
    const { persons, childrenByParent, spouses } = personsData;
    if (persons.size === 0) return;

    const {
      nodeWidth,
      nodeHeight,
      circleRadius,
      padding,
      connectionLineOpacity
    } = layoutConfig;

    const {
      backgroundColor,
      dotGridColor,
      lineColor,
      spouseBarColor,
      textColor,
      textSoftColor
    } = treeStyles;

    const hasDivorcedRelationship = (personId) => {
      if (!data || !data.edges) return false;
      const personIdStr = String(personId);
      return data.edges.some(edge => {
        if (!edge || edge.type !== 'spouse') return false;
        const sourceId = String(edge.source);
        const targetId = String(edge.target);
        const maritalStatus = edge.marital_status || 'married';
        return (sourceId === personIdStr || targetId === personIdStr) && maritalStatus === 'divorced';
      });
    };

    const wrapText = (text, width) => {
      if (!text) return [];
      const words = text.split(/\s+/);
      const lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if ((currentLine + " " + word).length < width / 5) { // Rough character limit based on width
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    
    // Grid pattern
    defs.append('pattern')
      .attr('id', 'dotGridVertical')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('circle')
      .attr('cx', 2)
      .attr('cy', 2)
      .attr('r', 1)
      .attr('fill', dotGridColor);

    // Create patterns for person avatars
    persons.forEach((person, id) => {
      if (person.data?.profile_photo_url) {
        defs.append('pattern')
          .attr('id', `avatar-v-${id}`)
          .attr('width', 1)
          .attr('height', 1)
          .attr('patternContentUnits', 'objectBoundingBox')
          .append('image')
          .attr('xlink:href', person.data.profile_photo_url)
          .attr('width', 1)
          .attr('height', 1)
          .attr('preserveAspectRatio', 'xMidYMid slice');
      }
    });

    const { positions } = computeLayout();
    if (positions.size === 0) return;

    const allPositions = Array.from(positions.values());
    const minX = Math.min(...allPositions.map(p => p.x));
    const maxX = Math.max(...allPositions.map(p => p.x));
    const minY = Math.min(...allPositions.map(p => p.y));
    const maxY = Math.max(...allPositions.map(p => p.y));

    const contentWidth = maxX - minX + padding * 2 + nodeWidth;
    const contentHeight = maxY - minY + padding * 2 + nodeHeight + 100;

    const svgWidth = Math.max(containerRef.current?.clientWidth || 1200, contentWidth);
    const svgHeight = Math.max(800, contentHeight);

    svg.attr('width', svgWidth).attr('height', svgHeight);

    svg.append('rect')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('fill', backgroundColor);

    svg.append('rect')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('fill', 'url(#dotGridVertical)');

    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .wheelDelta((event) => {
        // Normalize trackpad scroll speed (default is usually too fast)
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode === 2 ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    const xOffset = padding - minX;
    const yOffset = padding - minY;

    // Connections
    childrenByParent.forEach((childIds, parentId) => {
      const parentPos = positions.get(parentId);
      if (!parentPos) return;

      const childPositions = childIds
        .map(cid => ({ id: cid, pos: positions.get(cid) }))
        .filter(p => p.pos);

      if (childPositions.length === 0) return;

      const parentCenterX = parentPos.x + xOffset;
      const parentBottomY = parentPos.y + yOffset + circleRadius;
      const childTopY = Math.min(...childPositions.map(p => p.pos.y)) + yOffset - circleRadius;
      const childMinX = Math.min(...childPositions.map(p => p.pos.x)) + xOffset;
      const childMaxX = Math.max(...childPositions.map(p => p.pos.x)) + xOffset;
      const midY = parentBottomY + (childTopY - parentBottomY) / 2;

      g.append('line')
        .attr('x1', parentCenterX)
        .attr('y1', parentBottomY)
        .attr('x2', parentCenterX)
        .attr('y2', midY)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('opacity', connectionLineOpacity);

      g.append('line')
        .attr('x1', childMinX)
        .attr('y1', midY)
        .attr('x2', childMaxX)
        .attr('y2', midY)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('opacity', connectionLineOpacity);

      childPositions.forEach(({ pos: childPos }) => {
        const childCenterX = childPos.x + xOffset;
        g.append('line')
          .attr('x1', childCenterX)
          .attr('y1', midY)
          .attr('x2', childCenterX)
          .attr('y2', childTopY)
          .attr('stroke', lineColor)
          .attr('stroke-width', 2)
          .attr('opacity', connectionLineOpacity);
      });
    });

    spouses.forEach((spouseList, personId) => {
      const personPos = positions.get(personId);
      if (!personPos) return;

      spouseList.forEach(spouseInfo => {
        const spousePos = positions.get(spouseInfo.spouseId);
        if (!spousePos || personId >= spouseInfo.spouseId) return;

        const personCenterY = personPos.y + yOffset;
        const x1 = Math.min(personPos.x + xOffset, spousePos.x + xOffset);
        const x2 = Math.max(personPos.x + xOffset, spousePos.x + xOffset);

        g.append('line')
          .attr('x1', x1 + circleRadius)
          .attr('y1', personCenterY)
          .attr('x2', x2 - circleRadius)
          .attr('y2', personCenterY)
          .attr('stroke', lineColor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', spouseInfo.marital_status === 'divorced' ? '4,4' : 'none');
      });
    });

    // Nodes
    const nodeGroups = g.selectAll('.node')
      .data(Array.from(positions.keys()))
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', id => {
        const pos = positions.get(id);
        return `translate(${pos.x + xOffset},${pos.y + yOffset})`;
      })
      .style('cursor', 'pointer')
      .on('mouseover', function() {
        d3.select(this).select('circle')
          .transition()
          .duration(200)
          .attr('r', circleRadius + 3)
          .attr('stroke-width', 3);
      })
      .on('mouseout', function() {
        d3.select(this).select('circle')
          .transition()
          .duration(200)
          .attr('r', circleRadius)
          .attr('stroke-width', 2);
      });

    // Handle clicks
    nodeGroups.on('click', (event, id) => {
      // Toggle focal person on alt/option click or just provide a menu?
      // For now, let's just make regular click go to profile, 
      // and maybe a double click or specific icon for focus.
      if (event.shiftKey) {
        if (onSetFocalPerson) onSetFocalPerson(id);
      } else {
        if (onPersonClick) onPersonClick(id);
      }
    });

    nodeGroups.each(function(id) {
      const group = d3.select(this);
      const person = persons.get(id);
      if (!person) return;

      const levelIndex = Math.min(positions.get(id).level, generationColors.background.length - 1);
      const spouseList = spouses.get(id) || [];
      const hasSpouse = spouseList.length > 0;
      const isDivorced = hasDivorcedRelationship(id);

      // Add focus indicator if this is the focal person
      if (id === focalPersonId) {
        group.append('circle')
          .attr('r', circleRadius + 5)
          .attr('fill', 'none')
          .attr('stroke', '#D79A1E')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,2');
      }

      // Draw node circle
      group.append('circle')
        .attr('r', circleRadius)
        .attr('fill', person.data?.profile_photo_url ? `url(#avatar-v-${id})` : generationColors.background[levelIndex])
        .attr('stroke', generationColors.border[levelIndex])
        .attr('stroke-width', 2);

      if (hasSpouse) {
        group.append('line')
          .attr('x1', 0)
          .attr('y1', circleRadius + 2)
          .attr('x2', 0)
          .attr('y2', circleRadius + 15)
          .attr('stroke', spouseBarColor)
          .attr('stroke-width', 4)
          .attr('stroke-linecap', 'round')
          .attr('stroke-dasharray', isDivorced ? '2,2' : 'none');
      }

      const nameLines = wrapText(person.name, 100);
      const title = person.data.traditional_title || person.data.title;
      
      let textYOffset = circleRadius + 25;

      if (title) {
        group.append('text')
          .attr('y', textYOffset)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('font-weight', '700')
          .attr('font-family', "'IBM Plex Mono', monospace")
          .attr('fill', '#D79A1E') // Gold color for titles
          .text(title.toUpperCase());
        textYOffset += 12;
      }

      nameLines.forEach((line, i) => {
        group.append('text')
          .attr('y', textYOffset + (i * 14))
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .attr('fill', textColor)
          .text(line);
      });

      if (person.data.date_of_birth) {
        const birthYear = new Date(person.data.date_of_birth).getFullYear();
        if (!Number.isNaN(birthYear)) {
          const dateText = person.data.date_of_death
            ? `${birthYear} - ${new Date(person.data.date_of_death).getFullYear()}` 
            : `b. ${birthYear}`;
          group.append('text')
            .attr('y', textYOffset + (nameLines.length * 14) + 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', textSoftColor)
            .text(dateText);
        }
      }

      // Add "Story Snippet" indicator if biography exists
      if (person.data.biography || person.data.legacy_story) {
        group.append('text')
          .attr('x', circleRadius - 5)
          .attr('y', -circleRadius + 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', '#D79A1E')
          .text('📜')
          .style('pointer-events', 'none');
      }
    });
  }, [personsData, computeLayout, onPersonClick, data, focalPersonId, onSetFocalPerson]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: treeStyles.backgroundColor, position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
      {showLegend && (
        <Paper elevation={4} sx={{ position: 'fixed', bottom: 16, left: 16, padding: 1.5, width: 260, backgroundColor: 'white', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 'bold', color: treeStyles.textColor }}>Generation Levels</Typography>
            <Chip label="Hide" onClick={() => setShowLegend(false)} size="small" sx={{ cursor: 'pointer', height: 24, fontSize: '0.75rem', backgroundColor: treeStyles.backgroundColor }} />
          </Box>
          <Divider sx={{ my: 1 }} />
          {generationLabels.map((label, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: generationColors.background[index], border: `1px solid ${generationColors.border[index]}`, borderRadius: '50%', mr: 1.5 }} />
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: treeStyles.textSoftColor }}>{label}</Typography>
            </Box>
          ))}
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.75, color: treeStyles.textSoftColor, fontSize: '0.8rem' }}>Indicators</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box sx={{ width: 24, height: 4, backgroundColor: treeStyles.spouseBarColor, borderRadius: '2px', mr: 1.5 }} />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: treeStyles.textSoftColor }}>Spouse</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box sx={{ width: 24, height: 2, backgroundColor: treeStyles.lineColor, borderRadius: '1px', mr: 1.5 }} />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: treeStyles.textSoftColor }}>Relationship</Typography>
          </Box>
        </Paper>
      )}
      {!showLegend && <Chip label="Show Legend" onClick={() => setShowLegend(true)} size="small" sx={{ position: 'fixed', bottom: 16, left: 16, cursor: 'pointer', zIndex: 1000, backgroundColor: 'white' }} />}
    </Box>
  );
};

export default VerticalTreeView;
