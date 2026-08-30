import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  layoutConfig,
  treeStyles 
} from '../../config/treeConfig';

const HorizontalTreeView = ({ data, onPersonClick, onSetFocalPerson }) => {
  const svgRef = useRef();
  const [showLegend, setShowLegend] = useState(true);
  const containerRef = useRef();
  
  const focalPersonId = data?.focalPersonId;

  const personsData = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const persons = new Map();
    const childrenByParent = new Map();
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

    // Determine relevant nodes based on focal person
    const relevantNodes = new Set();
    if (focalPersonId && persons.has(focalPersonId)) {
      const queue = [focalPersonId];
      relevantNodes.add(focalPersonId);
      
      const focalSpouses = spouses.get(focalPersonId) || [];
      focalSpouses.forEach(s => relevantNodes.add(s.spouseId));

      let head = 0;
      while(head < queue.length) {
        const id = queue[head++];
        
        const parents = parentsByChild.get(id) || [];
        parents.forEach(p => {
          if (!relevantNodes.has(p)) {
            relevantNodes.add(p);
            queue.push(p);
          }
        });

        const children = childrenByParent.get(id) || [];
        children.forEach(c => {
          if (!relevantNodes.has(c)) {
            relevantNodes.add(c);
            queue.push(c);
          }
        });

        const sList = spouses.get(id) || [];
        sList.forEach(s => {
          if (!relevantNodes.has(s.spouseId)) {
            relevantNodes.add(s.spouseId);
            queue.push(s.spouseId);
          }
        });
      }
    } else {
      persons.forEach((_, id) => relevantNodes.add(id));
    }

    const generations = new Map();
    relevantNodes.forEach(id => generations.set(id, 0));

    // Iterative rank refinement
    for (let i = 0; i < 25; i++) {
      let changed = false;
      
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

    if (generations.size > 0) {
      const minGen = Math.min(...Array.from(generations.values()));
      generations.forEach((gen, id) => generations.set(id, gen - minGen));
    }

    const levelMap = new Map();
    generations.forEach((gen, id) => {
      if (!levelMap.has(gen)) levelMap.set(gen, []);
      levelMap.get(gen).push(id);
    });

    const { nodeHeight, levelSpacing, siblingSpacing, familyUnitGap, padding } = layoutConfig;
    const positions = new Map();
    
    // Pass 1: Initial positioning
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    const levelHeights = new Map(); // level -> nextAvailableY
    sortedLevels.forEach(l => levelHeights.set(l, padding));

    const visited = new Set();
    const positionNode = (id, level, yHint) => {
      if (visited.has(id)) return;
      visited.add(id);

      const x = padding + level * levelSpacing;
      const currentY = Math.max(yHint, levelHeights.get(level) || padding);
      positions.set(id, { x, y: currentY, level });

      // Position spouses
      const spouseList = spouses.get(id) || [];
      let spouseY = currentY;
      spouseList.forEach(sInfo => {
        if (!visited.has(sInfo.spouseId) && generations.get(sInfo.spouseId) === level) {
          visited.add(sInfo.spouseId);
          spouseY += nodeHeight + siblingSpacing;
          positions.set(sInfo.spouseId, { x, y: spouseY, level });
        }
      });
      
      levelHeights.set(level, spouseY + nodeHeight + familyUnitGap);

      // Position children
      const children = childrenByParent.get(id) || [];
      if (children.length > 0) {
        let childY = currentY;
        children.forEach(childId => {
          positionNode(childId, level + 1, childY);
          childY = (positions.get(childId)?.y || childY) + nodeHeight + siblingSpacing;
        });
      }
    };

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

    persons.forEach((_, id) => {
      if (!visited.has(id)) positionNode(id, generations.get(id), padding);
    });

    // Pass 2: Center parents vertically over children
    for (let i = sortedLevels.length - 1; i >= 0; i--) {
      const level = sortedLevels[i];
      const ids = levelMap.get(level);
      
      ids.forEach(id => {
        const children = childrenByParent.get(id) || [];
        if (children.length > 0) {
          const childYs = children
            .map(cid => positions.get(cid)?.y)
            .filter(y => y !== undefined);
          
          if (childYs.length > 0) {
            const avgChildY = childYs.reduce((a, b) => a + b, 0) / childYs.length;
            const pos = positions.get(id);
            if (pos) pos.y = avgChildY;

            // Shift spouses too
            const spouseList = spouses.get(id) || [];
            spouseList.forEach((sInfo, idx) => {
              const sPos = positions.get(sInfo.spouseId);
              if (sPos && sPos.level === level) {
                sPos.y = avgChildY + (idx + 1) * (nodeHeight + siblingSpacing);
              }
            });
          }
        }
      });
    }

    // Pass 3: Resolve overlaps and finalize
    sortedLevels.forEach(level => {
      const levelNodes = Array.from(positions.entries())
        .filter(([_, p]) => p.level === level)
        .sort((a, b) => a[1].y - b[1].y);
      
      let minY = padding;
      levelNodes.forEach(([_, pos]) => {
        if (pos.y < minY) pos.y = minY;
        minY = pos.y + nodeHeight + siblingSpacing;
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
      connectionLineOpacity,
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
        if ((currentLine + " " + word).length < width / 5) {
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
      .attr('id', 'dotGridHorizontal')
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
          .attr('id', `avatar-h-${id}`)
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

    const contentWidth = maxX - minX + padding * 2 + nodeWidth + 150;
    const contentHeight = maxY - minY + padding * 2 + nodeHeight;

    const svgWidth = Math.max(containerRef.current?.clientWidth || 1200, contentWidth);
    const svgHeight = Math.max(800, contentHeight);

    svg.attr('width', svgWidth).attr('height', svgHeight);

    svg.append('rect')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('fill', treeStyles.backgroundColor);

    svg.append('rect')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('fill', 'url(#dotGridHorizontal)');

    const g = svg.append('g');
    const zoom = d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    svg.call(zoom);

    const xOffset = padding - minX;
    const yOffset = padding - minY;

    childrenByParent.forEach((childIds, parentId) => {
      const parentPos = positions.get(parentId);
      if (!parentPos) return;

      const childPositions = childIds
        .map(cid => ({ id: cid, pos: positions.get(cid) }))
        .filter(p => p.pos);

      if (childPositions.length === 0) return;

      const parentRightX = parentPos.x + xOffset + circleRadius;
      const parentCenterY = parentPos.y + yOffset;
      const childLeftX = Math.min(...childPositions.map(p => p.pos.x)) + xOffset - circleRadius;
      const childTopY = Math.min(...childPositions.map(p => p.pos.y)) + yOffset;
      const childBottomY = Math.max(...childPositions.map(p => p.pos.y)) + yOffset;
      const midX = parentRightX + (childLeftX - parentRightX) / 2;

      g.append('line')
        .attr('x1', parentRightX)
        .attr('y1', parentCenterY)
        .attr('x2', midX)
        .attr('y2', parentCenterY)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('opacity', connectionLineOpacity);

      g.append('line')
        .attr('x1', midX)
        .attr('y1', childTopY)
        .attr('x2', midX)
        .attr('y2', childBottomY)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('opacity', connectionLineOpacity);

      childPositions.forEach(({ pos: childPos }) => {
        const childCenterY = childPos.y + yOffset;
        g.append('line')
          .attr('x1', midX)
          .attr('y1', childCenterY)
          .attr('x2', childLeftX)
          .attr('y2', childCenterY)
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

        const personCenterX = personPos.x + xOffset;
        const y1 = Math.min(personPos.y + yOffset, spousePos.y + yOffset);
        const y2 = Math.max(personPos.y + yOffset, spousePos.y + yOffset);

        g.append('line')
          .attr('x1', personCenterX)
          .attr('y1', y1 + circleRadius)
          .attr('x2', personCenterX)
          .attr('y2', y2 - circleRadius)
          .attr('stroke', lineColor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', spouseInfo.marital_status === 'divorced' ? '4,4' : 'none');
      });
    });

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

    nodeGroups.on('click', (event, id) => {
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
          .attr('r', circleRadius)
          .attr('fill', person.data?.profile_photo_url ? `url(#avatar-h-${id})` : generationColors.background[levelIndex])
          .attr('stroke', generationColors.border[levelIndex])
          .attr('stroke-width', 2);
      }

      if (hasSpouse) {
        group.append('line')
          .attr('x1', circleRadius + 2)
          .attr('y1', 0)
          .attr('x2', circleRadius + 15)
          .attr('y2', 0)
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
          .attr('fill', '#D79A1E')
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

export default HorizontalTreeView;
