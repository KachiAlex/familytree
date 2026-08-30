import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  layoutConfig,
  treeStyles 
} from '../../config/treeConfig';

const HorizontalTreeView = ({ data, onPersonClick }) => {
  const svgRef = useRef();
  const [showLegend, setShowLegend] = useState(true);
  const containerRef = useRef();

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

    const generations = new Map();
    persons.forEach((_, id) => generations.set(id, 0));

    // Iterative rank refinement to satisfy constraints:
    // 1. Generation(child) >= Generation(parent) + 1
    // 2. Generation(spouse1) == Generation(spouse2)
    for (let i = 0; i < 25; i++) {
      let changed = false;
      
      // Parent-Child constraint
      childrenByParent.forEach((childIds, parentId) => {
        const pGen = generations.get(parentId);
        childIds.forEach(childId => {
          const cGen = generations.get(childId);
          if (cGen < pGen + 1) {
            generations.set(childId, pGen + 1);
            changed = true;
          }
        });
      });

      // Spouse constraint
      spouses.forEach((spouseList, personId) => {
        const gen1 = generations.get(personId);
        spouseList.forEach(spouseInfo => {
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

    const levelMap = new Map();
    generations.forEach((gen, id) => {
      if (!levelMap.has(gen)) levelMap.set(gen, []);
      levelMap.get(gen).push(id);
    });

    const { nodeHeight, levelSpacing, siblingSpacing, familyUnitGap, padding } = layoutConfig;
    const positions = new Map();
    
    // Sort generations to process left-to-right
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    
    // Vertical distribution within each level
    sortedLevels.forEach(level => {
      const personIds = levelMap.get(level);
      const x = padding + level * levelSpacing;
      
      // Group spouses together for vertical layout
      const processed = new Set();
      let currentY = padding;

      personIds.forEach(id => {
        if (processed.has(id)) return;
        
        // Find all connected spouses at this level
        const spouseGroup = [id];
        processed.add(id);
        
        const findSpouses = (pid) => {
          const sList = spouses.get(pid) || [];
          sList.forEach(sInfo => {
            if (!processed.has(sInfo.spouseId) && generations.get(sInfo.spouseId) === level) {
              processed.add(sInfo.spouseId);
              spouseGroup.push(sInfo.spouseId);
              findSpouses(sInfo.spouseId);
            }
          });
        };
        findSpouses(id);

        // Position the spouse group
        spouseGroup.forEach((memberId, idx) => {
          positions.set(memberId, { 
            x,
            y: currentY + idx * (nodeHeight + siblingSpacing), 
            level 
          });
        });
        
        currentY += spouseGroup.length * (nodeHeight + siblingSpacing) + familyUnitGap;
      });
    });

    return { positions, levelMap };
  }, [personsData]);

  useEffect(() => {
    const { persons, childrenByParent, spouses } = personsData;
    if (persons.size === 0) return;

    const {
      nodeWidth,
      nodeHeight,
      circleRadius,
      padding,
      connectionLineOpacity,
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

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs.append('pattern')
      .attr('id', 'dotGridHorizontal')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('circle')
      .attr('cx', 2)
      .attr('cy', 2)
      .attr('r', 1)
      .attr('fill', treeStyles.dotGridColor);

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
      .on('click', (event, id) => onPersonClick && onPersonClick(id));

    nodeGroups.each(function(id) {
      const group = d3.select(this);
      const person = persons.get(id);
      if (!person) return;

      const level = positions.get(id).level;
      const levelIndex = Math.min(level, generationColors.background.length - 1);
      const spouseList = spouses.get(id) || [];
      const hasSpouse = spouseList.length > 0;
      const isDivorced = hasDivorcedRelationship(id);

      group.append('circle')
        .attr('r', circleRadius)
        .attr('fill', generationColors.background[levelIndex])
        .attr('stroke', generationColors.border[levelIndex])
        .attr('stroke-width', 2);

      if (hasSpouse && !isDivorced) {
        group.append('line')
          .attr('x1', circleRadius + 2)
          .attr('y1', 0)
          .attr('x2', circleRadius + 15)
          .attr('y2', 0)
          .attr('stroke', spouseBarColor)
          .attr('stroke-width', 4)
          .attr('stroke-linecap', 'round');
      }

      group.append('text')
        .attr('y', circleRadius + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .attr('fill', textColor)
        .text(person.name);

      if (person.data.date_of_birth) {
        const birthYear = new Date(person.data.date_of_birth).getFullYear();
        if (!Number.isNaN(birthYear)) {
          const dateText = person.data.date_of_death
            ? `${birthYear} - ${new Date(person.data.date_of_death).getFullYear()}` 
            : `b. ${birthYear}`;
          group.append('text')
            .attr('y', circleRadius + 35)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', textSoftColor)
            .text(dateText);
        }
      }
    });
  }, [personsData, computeLayout, onPersonClick, data]);

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
