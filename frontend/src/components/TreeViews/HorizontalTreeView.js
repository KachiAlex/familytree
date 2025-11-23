import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  maritalStatusColors,
  layoutConfig 
} from '../../config/treeConfig';

const HorizontalTreeView = ({ data, onPersonClick }) => {
  console.log('🔵 HorizontalTreeView component loaded', data);
  const svgRef = useRef();
  const [showLegend, setShowLegend] = useState(true);
  const containerRef = useRef();

  // Build data structure with relationships (same as VerticalTreeView)
  const personsData = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const validNodes = data.nodes.filter((node) => node && node.id != null);
    if (validNodes.length === 0) return { persons: new Map(), childrenByParent: new Map(), spouses: new Map() };

    const persons = new Map();
    const childrenByParent = new Map(); // parentId -> [childIds]
    const spouses = new Map(); // personId -> { spouseId, marital_status }

    // Build persons map
    validNodes.forEach((node) => {
      const id = String(node.id);
      persons.set(id, {
        id,
        name: node.data?.full_name || node.data?.label || 'Unknown',
        data: node.data || {},
      });
    });

    // Build relationships
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

  // Helper function to determine which parent is the mother
  const getMotherId = useCallback((parentIds, persons, spouses) => {
    if (parentIds.length === 0) return null;
    if (parentIds.length === 1) return parentIds[0];
    
    for (const parentId of parentIds) {
      const parent = persons.get(parentId);
      if (parent && parent.data?.gender === 'female') {
        return parentId;
      }
    }
    
    for (const parentId of parentIds) {
      const spouseInfo = spouses.get(parentId);
      if (spouseInfo) {
        const spouse = persons.get(spouseInfo.spouseId);
        if (spouse && spouse.data?.gender === 'female') {
          return spouseInfo.spouseId;
        }
      }
    }
    
    return parentIds[0];
  }, []);

  // Compute layout positions for HORIZONTAL view (left to right)
  // This is adapted from VerticalTreeView but with X and Y swapped
  const computeLayout = useCallback(() => {
    const { persons, childrenByParent, spouses } = personsData;
    if (persons.size === 0) return { positions: new Map(), levelMap: new Map() };

    const positions = new Map(); // personId -> {x, y, level}
    const levelMap = new Map(); // level -> [personIds]
    
    // Find TRUE root nodes (no parents AND not a spouse of someone with parents)
    const roots = [];
    persons.forEach((person, id) => {
      let hasParent = false;
      childrenByParent.forEach((childIds, parentId) => {
        if (childIds.includes(id)) {
          hasParent = true;
        }
      });
      
      if (!hasParent) {
        const spouseInfo = spouses.get(id);
        if (spouseInfo) {
          const spouseId = spouseInfo.spouseId;
          let spouseHasParent = false;
          childrenByParent.forEach((childIds, parentId) => {
            if (childIds.includes(spouseId)) {
              spouseHasParent = true;
            }
          });
          
          if (!spouseHasParent) {
            roots.push(id);
          }
        } else {
          roots.push(id);
        }
      }
    });

    if (roots.length === 0) return { positions, levelMap };

    // Compute levels using BFS (parent-child relationships)
    const levels = new Map();
    const queue = roots.map(id => ({ id, level: 0 }));
    const visited = new Set();

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      levels.set(id, level);
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level).push(id);

      // Add children to queue
      const children = childrenByParent.get(id) || [];
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }

    // CRITICAL FIX: Ensure spouses are on the same level (same as vertical)
    let maxIterations = 10;
    let iteration = 0;
    while (iteration < maxIterations) {
      let changed = false;
      const personIds = Array.from(persons.keys());
      
      for (const id of personIds) {
        const spouseInfo = spouses.get(id);
        if (!spouseInfo) continue;
        
        const spouseId = spouseInfo.spouseId;
        const currentLevel = levels.get(id);
        const spouseLevel = levels.get(spouseId);
        
        if (currentLevel === undefined && spouseLevel !== undefined) {
          levels.set(id, spouseLevel);
          if (!levelMap.has(spouseLevel)) {
            levelMap.set(spouseLevel, []);
          }
          levelMap.get(spouseLevel).push(id);
          changed = true;
        } else if (spouseLevel === undefined && currentLevel !== undefined) {
          levels.set(spouseId, currentLevel);
          if (!levelMap.has(currentLevel)) {
            levelMap.set(currentLevel, []);
          }
          levelMap.get(currentLevel).push(spouseId);
          changed = true;
        } else if (currentLevel !== undefined && spouseLevel !== undefined && currentLevel !== spouseLevel) {
          const idHasParents = Array.from(childrenByParent.values()).some(childIds => childIds.includes(id));
          const spouseHasParents = Array.from(childrenByParent.values()).some(childIds => childIds.includes(spouseId));
          
          let targetLevel;
          if (idHasParents && !spouseHasParents) {
            targetLevel = currentLevel;
          } else if (spouseHasParents && !idHasParents) {
            targetLevel = spouseLevel;
          } else {
            targetLevel = Math.max(currentLevel, spouseLevel);
          }
          
          if (targetLevel !== currentLevel || targetLevel !== spouseLevel) {
            if (currentLevel !== targetLevel) {
              const oldLevel1 = levelMap.get(currentLevel);
              if (oldLevel1) {
                const idx1 = oldLevel1.indexOf(id);
                if (idx1 > -1) oldLevel1.splice(idx1, 1);
              }
            }
            if (spouseLevel !== targetLevel) {
              const oldLevel2 = levelMap.get(spouseLevel);
              if (oldLevel2) {
                const idx2 = oldLevel2.indexOf(spouseId);
                if (idx2 > -1) oldLevel2.splice(idx2, 1);
              }
            }
            
            levels.set(id, targetLevel);
            levels.set(spouseId, targetLevel);
            
            if (!levelMap.has(targetLevel)) {
              levelMap.set(targetLevel, []);
            }
            if (!levelMap.get(targetLevel).includes(id)) {
              levelMap.get(targetLevel).push(id);
            }
            if (!levelMap.get(targetLevel).includes(spouseId)) {
              levelMap.get(targetLevel).push(spouseId);
            }
            changed = true;
          }
        }
      }
      
      if (!changed) break;
      iteration++;
    }

    // Layout parameters
    const { nodeHeight, levelSpacing, siblingSpacing, spouseSpacing, familyUnitGap, padding } = layoutConfig;
    
    // Identify family units (same as vertical)
    const familyUnits = new Map();
    const personToUnit = new Map();
    
    const spouseRelationships = new Map();
    spouses.forEach((spouseInfo, personId) => {
      if (!spouseRelationships.has(personId)) {
        spouseRelationships.set(personId, new Set());
      }
      spouseRelationships.get(personId).add(spouseInfo.spouseId);
      
      if (!spouseRelationships.has(spouseInfo.spouseId)) {
        spouseRelationships.set(spouseInfo.spouseId, new Set());
      }
      spouseRelationships.get(spouseInfo.spouseId).add(personId);
    });
    
    const unitVisited = new Set();
    
    const findConnectedGroup = (startId, group) => {
      if (unitVisited.has(startId)) return;
      unitVisited.add(startId);
      group.add(startId);
      
      const personSpouses = spouseRelationships.get(startId);
      if (personSpouses) {
        personSpouses.forEach(spouseId => {
          if (!unitVisited.has(spouseId)) {
            findConnectedGroup(spouseId, group);
          }
        });
      }
    };
    
    const connectedGroups = [];
    persons.forEach((person, id) => {
      if (unitVisited.has(id)) return;
      
      const personSpouses = spouseRelationships.get(id);
      if (personSpouses && personSpouses.size > 0) {
        const group = new Set();
        findConnectedGroup(id, group);
        if (group.size > 0) {
          connectedGroups.push(Array.from(group));
        }
      } else {
        familyUnits.set(id, {
          personId: id,
          spouseIds: [],
          isRoot: false
        });
        personToUnit.set(id, id);
      }
    });
    
    connectedGroups.forEach(group => {
      let centerPersonId = group[0];
      let maxSpouseCount = spouseRelationships.get(centerPersonId)?.size || 0;
      
      group.forEach(personId => {
        const spouseCount = spouseRelationships.get(personId)?.size || 0;
        if (spouseCount > maxSpouseCount) {
          maxSpouseCount = spouseCount;
          centerPersonId = personId;
        }
      });
      
      const spouseIds = group.filter(id => id !== centerPersonId);
      
      familyUnits.set(centerPersonId, {
        personId: centerPersonId,
        spouseIds: spouseIds,
        isRoot: false
      });
      
      group.forEach(personId => {
        personToUnit.set(personId, centerPersonId);
      });
    });

    // Group children by their mother
    const childrenByMother = new Map();
    childrenByParent.forEach((childIds, parentId) => {
      childIds.forEach(childId => {
        const allParents = [];
        childrenByParent.forEach((pChildIds, pId) => {
          if (pChildIds.includes(childId)) {
            allParents.push(pId);
          }
        });
        
        const motherId = getMotherId(allParents, persons, spouses);
        if (motherId) {
          if (!childrenByMother.has(motherId)) {
            childrenByMother.set(motherId, []);
          }
          childrenByMother.get(motherId).push(childId);
        }
      });
    });

    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    
    console.log('🔵 [HORIZONTAL LAYOUT] Starting layout computation...');
    console.log('🔵 [HORIZONTAL LAYOUT] Total persons:', persons.size);
    console.log('🔵 [HORIZONTAL LAYOUT] Root nodes:', roots.map(id => persons.get(id)?.name || id));
    console.log('🔵 [HORIZONTAL LAYOUT] Levels:', sortedLevels);
    
    // STEP 1: Position ONLY true root nodes (leftmost column, X = padding)
    let currentY = padding;
    const rootsSet = new Set(roots);
    
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      
      personIds.forEach((id) => {
        if (rootsSet.has(id) && !positions.has(id)) {
          positions.set(id, { x: padding, y: currentY, level });
          console.log(`🔵 [STEP 1] Positioned root: ${persons.get(id)?.name || id} at X:${padding}, Y:${currentY}`);
          currentY += nodeHeight + siblingSpacing * 2;
        }
      });
    });
    
    // STEP 2: Position children under their mothers (to the right) AND position siblings
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      const childX = padding + level * levelSpacing; // X increases with level (left to right)
      
      personIds.forEach((id) => {
        // Skip if already positioned (e.g., as a root)
        if (positions.has(id)) return;
        
        const children = childrenByMother.get(id) || [];
        if (children.length > 0) {
          // Ensure mother is positioned
          let motherY = currentY;
          const parents = [];
          childrenByParent.forEach((childIds, parentId) => {
            if (childIds.includes(id)) {
              parents.push(parentId);
            }
          });
          
          for (const parentId of parents) {
            const parentPos = positions.get(parentId);
            if (parentPos) {
              motherY = parentPos.y;
              break;
            }
          }
          
          if (!positions.has(id)) {
            const parentLevel = level - 1;
            const parentX = padding + parentLevel * levelSpacing;
            positions.set(id, { x: parentX, y: motherY, level: parentLevel });
            console.log(`🔵 [STEP 2] Positioned mother: ${persons.get(id)?.name || id} at X:${parentX}, Y:${motherY}`);
          } else {
            motherY = positions.get(id).y;
          }
          
          // Position children to the right (at child's level, X increases)
          const childX = padding + level * levelSpacing;
          let childY = motherY;
          let firstChildIndex = 0;
          
          children.forEach((childId, index) => {
            if (positions.has(childId)) {
              if (index === 0) {
                const existingPos = positions.get(childId);
                childY = existingPos.y;
                firstChildIndex = index + 1;
              }
              return;
            }
            
            const childLevel = levels.get(childId);
            if (childLevel === undefined) return;
            
            const childXPos = padding + childLevel * levelSpacing;
            
            if (index === firstChildIndex) {
              positions.set(childId, { x: childXPos, y: motherY, level: childLevel });
              childY = motherY;
              console.log(`🔵 [STEP 2] Positioned child: ${persons.get(childId)?.name || childId} under mother at X:${childXPos}, Y:${motherY}`);
            } else {
              childY += nodeHeight + siblingSpacing;
              positions.set(childId, { x: childXPos, y: childY, level: childLevel });
              console.log(`🔵 [STEP 2] Positioned sibling: ${persons.get(childId)?.name || childId} at X:${childXPos}, Y:${childY}`);
            }
          });
          
          currentY = Math.max(currentY, childY + nodeHeight + siblingSpacing * 2);
        } else {
          // No children - position as sibling (to the right of previous siblings at this level)
          const siblingX = padding + level * levelSpacing;
          let siblingY = currentY;
          
          // Check if there are already positioned people at this level
          const existingY = Array.from(positions.values())
            .filter(p => p.level === level)
            .map(p => p.y);
          if (existingY.length > 0) {
            siblingY = Math.max(...existingY) + nodeHeight + siblingSpacing;
          }
          
          positions.set(id, { x: siblingX, y: siblingY, level });
          console.log(`🔵 [STEP 2] Positioned sibling (no children): ${persons.get(id)?.name || id} at X:${siblingX}, Y:${siblingY}`);
          currentY = Math.max(currentY, siblingY + nodeHeight + siblingSpacing * 2);
        }
      });
    });
    
    console.log(`🔵 [STEP 2 COMPLETE] Positioned ${positions.size} people so far`);
    
    // STEP 3: Position family units (spouses together)
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      let unitX = padding;
      
      const unitsAtLevel = new Map();
      const processed = new Set();
      
      personIds.forEach((id) => {
        if (processed.has(id)) return;
        
        const unitId = personToUnit.get(id);
        if (!unitId) return;
        
        const unit = familyUnits.get(unitId);
        if (!unit) return;
        
        const unitMembers = [unit.personId, ...unit.spouseIds];
        const membersAtLevel = unitMembers.filter(mid => {
          const memberLevel = levels.get(mid);
          return memberLevel === level;
        });
        
        if (membersAtLevel.length > 0) {
          unitsAtLevel.set(unitId, {
            personId: unit.personId,
            spouseIds: unit.spouseIds.filter(sid => {
              const spouseLevel = levels.get(sid);
              return spouseLevel === level;
            })
          });
          
          unitMembers.forEach(mid => processed.add(mid));
        }
      });
      
      unitsAtLevel.forEach((unit, unitId) => {
        const allUnitMembers = [unit.personId, ...unit.spouseIds];
        let centerPersonId = unit.personId;
        let maxSpouseCount = unit.spouseIds.length;
        
        unit.spouseIds.forEach(spouseId => {
          let count = 0;
          allUnitMembers.forEach(memberId => {
            if (memberId !== spouseId) {
              const memberSpouseInfo = spouses.get(memberId);
              if (memberSpouseInfo && memberSpouseInfo.spouseId === spouseId) count++;
              const reverseSpouseInfo = spouses.get(spouseId);
              if (reverseSpouseInfo && reverseSpouseInfo.spouseId === memberId) count++;
            }
          });
          if (count > maxSpouseCount) {
            maxSpouseCount = count;
            centerPersonId = spouseId;
          }
        });
        
        let centerPersonX = unitX;
        const centerPersonPos = positions.get(centerPersonId);
        if (centerPersonPos) {
          centerPersonX = centerPersonPos.x;
        } else {
          positions.set(centerPersonId, {
            x: centerPersonX,
            y: padding + level * levelSpacing,
            level
          });
        }
        
        const spousesToPosition = allUnitMembers.filter(id => id !== centerPersonId);
        const spouseWithChildren = [];
        
        spousesToPosition.forEach(spouseId => {
          const children = childrenByMother.get(spouseId) || [];
          spouseWithChildren.push({ id: spouseId, childCount: children.length });
        });
        
        spouseWithChildren.sort((a, b) => a.childCount - b.childCount);
        
        const leftSpouses = [];
        const rightSpouses = [];
        
        if (spouseWithChildren.length === 1) {
          if (spouseWithChildren[0].childCount > 0) {
            rightSpouses.push(spouseWithChildren[0].id);
          } else {
            leftSpouses.push(spouseWithChildren[0].id);
          }
        } else if (spouseWithChildren.length === 2) {
          leftSpouses.push(spouseWithChildren[0].id);
          rightSpouses.push(spouseWithChildren[1].id);
        } else {
          const midPoint = Math.ceil(spouseWithChildren.length / 2);
          spouseWithChildren.slice(0, midPoint).forEach(s => leftSpouses.push(s.id));
          spouseWithChildren.slice(midPoint).forEach(s => rightSpouses.push(s.id));
        }
        
        // Position spouses - for horizontal view: same X (same generation), different Y (stacked vertically)
        // Spouse with more children goes below (higher Y), fewer children goes above (lower Y)
        const centerY = centerPersonPos ? centerPersonPos.y : padding + level * levelSpacing;
        
        // Position left spouses (fewer children) above center person
        let topY = centerY;
        leftSpouses.forEach((spouseId) => {
          topY = topY - nodeHeight - spouseSpacing;
          positions.set(spouseId, {
            x: centerPersonX,
            y: topY,
            level
          });
        });
        
        // Position right spouses (more children) below center person
        let bottomY = centerY;
        rightSpouses.forEach((spouseId) => {
          bottomY = bottomY + nodeHeight + spouseSpacing;
          positions.set(spouseId, {
            x: centerPersonX,
            y: bottomY,
            level
          });
        });
        
        // Move to next unit position (same X, just track for spacing)
        unitX = centerPersonX + familyUnitGap;
      });
    });
    
    // STEP 3.5: Center fathers to the left of their children (mean average Y position)
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      
      personIds.forEach((id) => {
        const person = persons.get(id);
        if (!person) return;
        
        const isMale = person.data?.gender === 'male';
        if (!isMale) return;
        
        const children = [];
        childrenByParent.forEach((childIds, parentId) => {
          if (parentId === id) {
            children.push(...childIds);
          }
        });
        
        if (children.length === 0) return;
        
        const childPositions = children
          .map(childId => positions.get(childId))
          .filter(pos => pos !== undefined);
        
        if (childPositions.length === 0) return;
        
        // Calculate mean average Y position of children (for horizontal: Y is vertical position)
        const avgY = childPositions.reduce((sum, pos) => sum + pos.y, 0) / childPositions.length;
        
        const currentPos = positions.get(id);
        if (!currentPos) return;
        
        const oldY = currentPos.y;
        const deltaY = avgY - oldY;
        
        currentPos.y = avgY;
        positions.set(id, currentPos);
        
        // Adjust all spouses in all units containing this person
        if (Math.abs(deltaY) > 1) {
          const adjustedSpouses = new Set();
          
          const mainUnitId = personToUnit.get(id);
          if (mainUnitId) {
            const mainUnit = familyUnits.get(mainUnitId);
            if (mainUnit) {
              const allUnitMembers = [mainUnit.personId, ...mainUnit.spouseIds];
              allUnitMembers.forEach(memberId => {
                if (memberId !== id && !adjustedSpouses.has(memberId)) {
                  const memberPos = positions.get(memberId);
                  if (memberPos && memberPos.level === level) {
                    memberPos.y += deltaY;
                    positions.set(memberId, memberPos);
                    adjustedSpouses.add(memberId);
                  }
                }
              });
            }
          }
          
          familyUnits.forEach((unit, unitPersonId) => {
            if (unit.spouseIds.includes(id) && !adjustedSpouses.has(unitPersonId)) {
              const mainPersonPos = positions.get(unitPersonId);
              if (mainPersonPos && mainPersonPos.level === level) {
                mainPersonPos.y += deltaY;
                positions.set(unitPersonId, mainPersonPos);
                adjustedSpouses.add(unitPersonId);
              }
              
              unit.spouseIds.forEach(spouseId => {
                if (spouseId !== id && !adjustedSpouses.has(spouseId)) {
                  const spousePos = positions.get(spouseId);
                  if (spousePos && spousePos.level === level) {
                    spousePos.y += deltaY;
                    positions.set(spouseId, spousePos);
                    adjustedSpouses.add(spouseId);
                  }
                }
              });
            }
          });
        }
      });
    });
    
    // STEP 4: Position any remaining unpositioned nodes
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      const x = padding + level * levelSpacing;
      
      personIds.forEach((id) => {
        if (positions.has(id)) return;
        
        const parents = [];
        childrenByParent.forEach((childIds, parentId) => {
          if (childIds.includes(id)) {
            parents.push(parentId);
          }
        });
        
        if (parents.length > 0) {
          for (const parentId of parents) {
            const parentPos = positions.get(parentId);
            if (parentPos) {
              positions.set(id, { x, y: parentPos.y, level });
              break;
            }
          }
        }
      });
    });
    
    // STEP 5: Final fallback - ensure ALL nodes are positioned
    let fallbackY = padding;
    persons.forEach((person, id) => {
      if (!positions.has(id)) {
        const maxLevel = sortedLevels.length > 0 ? Math.max(...sortedLevels) + 1 : 0;
        positions.set(id, {
          x: padding + maxLevel * levelSpacing,
          y: fallbackY,
          level: maxLevel
        });
        fallbackY += nodeHeight + siblingSpacing * 2;
        
        if (!levelMap.has(maxLevel)) {
          levelMap.set(maxLevel, []);
        }
        if (!levelMap.get(maxLevel).includes(id)) {
          levelMap.get(maxLevel).push(id);
        }
      }
    });

    console.log(`🔵 [HORIZONTAL LAYOUT COMPLETE] Total positioned: ${positions.size} out of ${persons.size}`);
    console.log(`🔵 [HORIZONTAL LAYOUT] Position ranges - X: [${Math.min(...Array.from(positions.values()).map(p => p.x))}, ${Math.max(...Array.from(positions.values()).map(p => p.x))}], Y: [${Math.min(...Array.from(positions.values()).map(p => p.y))}, ${Math.max(...Array.from(positions.values()).map(p => p.y))}]`);
    
    return { positions, levelMap };
  }, [personsData, getMotherId]);

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

    const containerWidth = containerRef.current?.clientWidth || 1200;
    const containerHeight = containerRef.current?.clientHeight || 800;
    const { nodeWidth, nodeHeight, padding, connectionLineOpacity } = layoutConfig;

    // Helper function to check if a person has ANY divorced relationship
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

    const { positions } = computeLayout();

    if (positions.size === 0) {
      svg.attr('width', containerWidth).attr('height', containerHeight);
      return;
    }

    // Calculate SVG dimensions
    const allPositions = Array.from(positions.values());
    const minX = Math.min(...allPositions.map(p => p.x));
    const maxX = Math.max(...allPositions.map(p => p.x));
    const minY = Math.min(...allPositions.map(p => p.y));
    const maxY = Math.max(...allPositions.map(p => p.y));

    const contentWidth = maxX - minX + padding * 2 + nodeWidth;
    const contentHeight = maxY - minY + padding * 2 + nodeHeight;

    const svgWidth = Math.max(containerWidth, contentWidth);
    const svgHeight = Math.max(containerHeight, contentHeight);

    svg.attr('width', svgWidth).attr('height', svgHeight);

    const g = svg.append('g');
    const xOffset = padding - minX;
    const yOffset = padding - minY;

    // Draw parent-child connections (horizontal: parent left, children right)
    childrenByParent.forEach((childIds, parentId) => {
      const parentPos = positions.get(parentId);
      if (!parentPos) return;

      const childPositions = childIds
        .map(cid => ({ id: cid, pos: positions.get(cid) }))
        .filter(p => p.pos);

      if (childPositions.length === 0) return;

      const parentRightX = parentPos.x + xOffset + nodeWidth / 2;
      const parentCenterY = parentPos.y + yOffset + nodeHeight / 2;
      const childLeftX = Math.min(...childPositions.map(p => p.pos.x)) + xOffset - nodeWidth / 2;
      const childTopY = Math.min(...childPositions.map(p => p.pos.y)) + yOffset;
      const childBottomY = Math.max(...childPositions.map(p => p.pos.y)) + yOffset;
      const midX = parentRightX + (childLeftX - parentRightX) / 2;

      // Get generation color for connection lines
      const childLevel = childPositions[0]?.pos?.level ?? parentPos.level + 1;
      const levelIndex = Math.min(childLevel, generationColors.border.length - 1);
      const connectionColor = generationColors.border[levelIndex];

      // Horizontal line from parent to the right
      g.append('line')
        .attr('x1', parentRightX)
        .attr('y1', parentCenterY)
        .attr('x2', midX)
        .attr('y2', parentCenterY)
        .attr('stroke', connectionColor)
        .attr('stroke-width', 2.5)
        .attr('opacity', connectionLineOpacity);

      // Vertical line connecting siblings
      g.append('line')
        .attr('x1', midX)
        .attr('y1', childTopY)
        .attr('x2', midX)
        .attr('y2', childBottomY)
        .attr('stroke', connectionColor)
        .attr('stroke-width', 2.5)
        .attr('opacity', connectionLineOpacity);

      // Horizontal lines from vertical line to each child
      childPositions.forEach(({ pos: childPos }) => {
        const childCenterY = childPos.y + yOffset + nodeHeight / 2;
        g.append('line')
          .attr('x1', midX)
          .attr('y1', childCenterY)
          .attr('x2', childLeftX)
          .attr('y2', childCenterY)
          .attr('stroke', connectionColor)
          .attr('stroke-width', 2.5)
          .attr('opacity', connectionLineOpacity);
      });
    });

    // Draw spouse connections (vertical for horizontal view)
    spouses.forEach((spouseInfo, personId) => {
      const personPos = positions.get(personId);
      const spousePos = positions.get(spouseInfo.spouseId);
      if (!personPos || !spousePos) return;
      if (personId >= spouseInfo.spouseId) return; // Draw once per pair

      const maritalStatus = spouseInfo.marital_status || 'married';
      const isDivorced = maritalStatus === 'divorced';
      const isWidowed = maritalStatus === 'widowed';

      const personCenterX = personPos.x + xOffset + nodeWidth / 2;
      const y1 = Math.min(personPos.y + yOffset + nodeHeight / 2, spousePos.y + yOffset + nodeHeight / 2);
      const y2 = Math.max(personPos.y + yOffset + nodeHeight / 2, spousePos.y + yOffset + nodeHeight / 2);
      const midY = (y1 + y2) / 2;

      // Draw vertical line connecting spouses
      g.append('line')
        .attr('x1', personCenterX)
        .attr('y1', y1)
        .attr('x2', personCenterX)
        .attr('y2', y2)
        .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
        .attr('stroke-width', isDivorced ? 2.5 : 3)
        .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');

      // Add diagonal slash for divorced relationships
      if (isDivorced) {
        const slashLength = 40;
        const circleRadius = 25;
        
        g.append('circle')
          .attr('cx', personCenterX)
          .attr('cy', midY)
          .attr('r', circleRadius)
          .attr('fill', '#ffffff')
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 2);
        
        g.append('line')
          .attr('x1', personCenterX - slashLength / 2)
          .attr('y1', midY - slashLength / 2)
          .attr('x2', personCenterX + slashLength / 2)
          .attr('y2', midY + slashLength / 2)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 5)
          .attr('stroke-linecap', 'round');
        
        g.append('line')
          .attr('x1', personCenterX - slashLength / 2)
          .attr('y1', midY + slashLength / 2)
          .attr('x2', personCenterX + slashLength / 2)
          .attr('y2', midY - slashLength / 2)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 5)
          .attr('stroke-linecap', 'round');
      }
    });

    // Draw nodes
    const nodeIds = Array.from(positions.keys());
    const nodeGroups = g
      .selectAll('.node')
      .data(nodeIds)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (id) => {
        const pos = positions.get(id);
        return `translate(${pos.x + xOffset},${pos.y + yOffset})`;
      })
      .style('cursor', onPersonClick ? 'pointer' : 'default')
      .on('click', (event, id) => {
        if (onPersonClick) {
          onPersonClick(id);
        }
      });

    let renderedCount = 0;
    nodeGroups.each(function (id) {
      const group = d3.select(this);
      const person = persons.get(id);
      if (!person) return;
      renderedCount++;

      const spouseInfo = spouses.get(id);
      const hasSpouse = !!spouseInfo;
      const isDivorced = hasDivorcedRelationship(id);
      const maritalStatus = spouseInfo?.marital_status || 'married';
      const isWidowed = maritalStatus === 'widowed';

      const personPos = positions.get(id);
      const level = personPos?.level ?? 0;
      
      const levelIndex = Math.min(level, generationColors.background.length - 1);
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

      // Draw node rectangle
      group
        .append('rect')
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', backgroundColor)
        .attr('stroke', borderColor)
        .attr('stroke-width', 3)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))');

      // Add name text
      const name = person.name;
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
          .attr('x', 0)
          .attr('y', index === 0 ? -10 : 2)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#333')
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
              .attr('y', 20)
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px')
              .attr('fill', '#666')
              .text(dateText);
          }
        } catch (err) {
          // ignore invalid dates
        }
      }

      // Add divorce indicator badge
      if (isDivorced && hasSpouse) {
        const badgeX = nodeWidth / 2 - 45;
        const badgeY = -nodeHeight / 2 + 8;
        
        group
          .append('rect')
          .attr('x', badgeX - 30)
          .attr('y', badgeY - 8)
          .attr('width', 60)
          .attr('height', 16)
          .attr('rx', 8)
          .attr('fill', '#d32f2f')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1);
        
        group
          .append('text')
          .attr('x', badgeX)
          .attr('y', badgeY + 2)
          .attr('text-anchor', 'middle')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .attr('fill', '#ffffff')
          .text('DIVORCED');
      }
    });
    
    console.log(`🔵 Successfully rendered ${renderedCount} nodes`);
  }, [personsData, computeLayout, getMotherId, onPersonClick, data]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: '#f5f5f5', position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
      
      {/* Color Legend Panel - Bottom Left Corner (same as vertical view) */}
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
            Generation Levels
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
              Parent-Child
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
              Married
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
              Divorced
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

export default HorizontalTreeView;
