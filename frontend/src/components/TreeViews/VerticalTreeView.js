import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';

const VerticalTreeView = ({ data, onPersonClick }) => {
  console.log('🔵 VerticalTreeView component loaded', data);
  const svgRef = useRef();
  const containerRef = useRef();

  // Build data structure with relationships
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
    if (parentIds.length === 1) return parentIds[0]; // Single parent
    
    // Check gender to find mother
    for (const parentId of parentIds) {
      const parent = persons.get(parentId);
      if (parent && parent.data?.gender === 'female') {
        return parentId;
      }
    }
    
    // If no female found, check if any parent has a spouse that's female
    for (const parentId of parentIds) {
      const spouseInfo = spouses.get(parentId);
      if (spouseInfo) {
        const spouse = persons.get(spouseInfo.spouseId);
        if (spouse && spouse.data?.gender === 'female') {
          return spouseInfo.spouseId;
        }
      }
    }
    
    // Fallback: return first parent
    return parentIds[0];
  }, []);

  // Compute layout positions - SIMPLIFIED ALGORITHM
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
        // Check if this person is a spouse of someone who HAS parents
        // If so, they're not a true root - they'll get their spouse's level
        const spouseInfo = spouses.get(id);
        if (spouseInfo) {
          const spouseId = spouseInfo.spouseId;
          let spouseHasParent = false;
          childrenByParent.forEach((childIds, parentId) => {
            if (childIds.includes(spouseId)) {
              spouseHasParent = true;
            }
          });
          
          // Only treat as root if spouse also has no parents
          if (!spouseHasParent) {
            roots.push(id);
          }
        } else {
          // No spouse, no parents = true root
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

    // CRITICAL FIX: Ensure spouses are on the same level
    // Multiple passes to propagate spouse levels correctly
    let maxIterations = 10; // Prevent infinite loops
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
          // This person has no level, but spouse does - assign spouse's level
          levels.set(id, spouseLevel);
          if (!levelMap.has(spouseLevel)) {
            levelMap.set(spouseLevel, []);
          }
          levelMap.get(spouseLevel).push(id);
          changed = true;
        } else if (spouseLevel === undefined && currentLevel !== undefined) {
          // Spouse has no level, but this person does - assign this person's level
          levels.set(spouseId, currentLevel);
          if (!levelMap.has(currentLevel)) {
            levelMap.set(currentLevel, []);
          }
          levelMap.get(currentLevel).push(spouseId);
          changed = true;
        } else if (currentLevel !== undefined && spouseLevel !== undefined && currentLevel !== spouseLevel) {
          // Both have levels but different - use the one that makes sense (usually the one with parents)
          // If one has parents and the other doesn't, use the one with parents
          const idHasParents = Array.from(childrenByParent.values()).some(childIds => childIds.includes(id));
          const spouseHasParents = Array.from(childrenByParent.values()).some(childIds => childIds.includes(spouseId));
          
          let targetLevel;
          if (idHasParents && !spouseHasParents) {
            targetLevel = currentLevel;
          } else if (spouseHasParents && !idHasParents) {
            targetLevel = spouseLevel;
          } else {
            // Both or neither have parents - use the deeper level
            targetLevel = Math.max(currentLevel, spouseLevel);
          }
          
          if (targetLevel !== currentLevel || targetLevel !== spouseLevel) {
            // Remove from old levels
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
            
            // Set new levels
            levels.set(id, targetLevel);
            levels.set(spouseId, targetLevel);
            
            // Add to new level
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
    const nodeWidth = 160;
    const levelSpacing = 200;
    const siblingSpacing = 50; // Spacing between siblings (increased for clarity)
    const spouseSpacing = 25; // Spacing between spouses (closer together)
    const divorcedSpacing = 100; // Spacing for divorced spouses (more distance)
    const familyUnitGap = 100; // Gap between different family units on same level
    const padding = 150;
    
    // Identify family units: person + their spouses grouped together
    const familyUnits = new Map(); // personId -> { personId, spouseIds: [], isRoot: boolean }
    const personToUnit = new Map(); // personId -> unit personId
    
    console.log('[FAMILY UNITS] Building family units from spouses map...');
    console.log('[FAMILY UNITS] Total spouses entries:', spouses.size);
    
    persons.forEach((person, id) => {
      const spouseInfo = spouses.get(id);
      if (spouseInfo) {
        const spouseId = spouseInfo.spouseId;
        const personName = persons.get(id)?.name || id;
        const spouseName = persons.get(spouseId)?.name || spouseId;
        console.log(`[FAMILY UNITS] Found spouse relationship: ${personName} <-> ${spouseName} [${spouseInfo.marital_status || 'married'}]`);
        
        // Check if either person is already in a unit
        if (personToUnit.has(id) || personToUnit.has(spouseId)) {
          // Add to existing unit
          const unitId = personToUnit.get(id) || personToUnit.get(spouseId);
          const unit = familyUnits.get(unitId);
          if (!unit.spouseIds.includes(spouseId) && unit.personId !== spouseId) {
            unit.spouseIds.push(spouseId);
            personToUnit.set(spouseId, unitId);
            console.log(`[FAMILY UNITS] Added ${spouseName} to existing unit ${unitId}`);
          }
          if (!unit.spouseIds.includes(id) && unit.personId !== id) {
            unit.spouseIds.push(id);
            personToUnit.set(id, unitId);
            console.log(`[FAMILY UNITS] Added ${personName} to existing unit ${unitId}`);
          }
        } else {
          // Create new family unit - use the person with lower ID as the unit root
          const unitId = id < spouseId ? id : spouseId;
          const otherId = id < spouseId ? spouseId : id;
          familyUnits.set(unitId, {
            personId: unitId,
            spouseIds: [otherId],
            isRoot: false
          });
          personToUnit.set(unitId, unitId);
          personToUnit.set(otherId, unitId);
          console.log(`[FAMILY UNITS] Created new unit ${unitId} with ${personName} and ${spouseName}`);
        }
      } else if (!personToUnit.has(id)) {
        // Person with no spouse - they are their own unit
        familyUnits.set(id, {
          personId: id,
          spouseIds: [],
          isRoot: false
        });
        personToUnit.set(id, id);
      }
    });
    
    console.log('[FAMILY UNITS] Total family units created:', familyUnits.size);

    // Group children by their mother
    const childrenByMother = new Map(); // motherId -> [childIds]
    childrenByParent.forEach((childIds, parentId) => {
      childIds.forEach(childId => {
        // Find all parents of this child
        const allParents = [];
        childrenByParent.forEach((pChildIds, pId) => {
          if (pChildIds.includes(childId)) {
            allParents.push(pId);
          }
        });
        
        // Determine which parent is the mother
        const motherId = getMotherId(allParents, persons, spouses);
        if (motherId) {
          if (!childrenByMother.has(motherId)) {
            childrenByMother.set(motherId, []);
          }
          childrenByMother.get(motherId).push(childId);
        }
      });
    });

    // Debug: Log the structure
    console.log('=== LAYOUT DEBUG START ===');
    console.log('Total persons:', persons.size);
    console.log('Root nodes:', roots.map(id => persons.get(id)?.name || id));
    console.log('Levels after spouse fix:', Array.from(levelMap.keys()).sort((a, b) => a - b));
    
    // Log all levels and who's in them
    Array.from(levelMap.keys()).sort((a, b) => a - b).forEach(level => {
      const peopleAtLevel = levelMap.get(level).map(id => {
        const person = persons.get(id);
        const spouseInfo = spouses.get(id);
        const spouseName = spouseInfo ? persons.get(spouseInfo.spouseId)?.name : null;
        return `${person?.name || id}${spouseName ? ` (spouse: ${spouseName})` : ''}`;
      });
      console.log(`Level ${level}:`, peopleAtLevel);
    });
    
    console.log('Children by mother:', Array.from(childrenByMother.entries()).map(([mid, cids]) => ({
      mother: persons.get(mid)?.name || mid,
      children: cids.map(cid => persons.get(cid)?.name || cid)
    })));
    
    // Log all spouse relationships
    console.log('Spouse relationships:');
    const loggedSpouses = new Set();
    spouses.forEach((spouseInfo, id) => {
      if (!loggedSpouses.has(id) && !loggedSpouses.has(spouseInfo.spouseId)) {
        const person1 = persons.get(id);
        const person2 = persons.get(spouseInfo.spouseId);
        const level1 = levels.get(id);
        const level2 = levels.get(spouseInfo.spouseId);
        console.log(`  ${person1?.name || id} (level ${level1}) <-> ${person2?.name || spouseInfo.spouseId} (level ${level2}) [${spouseInfo.marital_status || 'married'}]`);
        loggedSpouses.add(id);
        loggedSpouses.add(spouseInfo.spouseId);
      }
    });
    
    // STEP 1: Position ONLY true root nodes (from roots array)
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    let currentX = padding;
    
    // Only position true roots
    const rootsSet = new Set(roots);
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      const y = padding + level * levelSpacing;
      
      personIds.forEach((id) => {
        // Only position if this is a true root
        if (rootsSet.has(id) && !positions.has(id)) {
          positions.set(id, { x: currentX, y, level });
          currentX += nodeWidth + siblingSpacing * 2;
          console.log(`[STEP 1] Positioned root: ${persons.get(id)?.name || id} at X:${currentX - nodeWidth - siblingSpacing * 2}`);
        }
      });
    });
    
    // STEP 2: Position children under their mothers (top to bottom)
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      const y = padding + level * levelSpacing;
      
      personIds.forEach((id) => {
        // Check if this person is a mother with children
        const children = childrenByMother.get(id) || [];
        if (children.length > 0) {
          // Ensure mother is positioned
          let motherX = currentX;
          const parents = [];
          childrenByParent.forEach((childIds, parentId) => {
            if (childIds.includes(id)) {
              parents.push(parentId);
            }
          });
          
          // Try to align with parent
          for (const parentId of parents) {
            const parentPos = positions.get(parentId);
            if (parentPos) {
              motherX = parentPos.x;
              break;
            }
          }
          
          // Position mother if not already positioned
          if (!positions.has(id)) {
            positions.set(id, { x: motherX, y, level });
            console.log(`[STEP 2] Positioned mother: ${persons.get(id)?.name || id} at X:${motherX}`);
          } else {
            motherX = positions.get(id).x;
          }
          
          // Position children directly under mother
          let childX = motherX;
          let firstChildIndex = 0;
          children.forEach((childId, index) => {
            // Skip if already positioned
            if (positions.has(childId)) {
              // If this is the first child and it's already positioned, use its position
              if (index === 0) {
                const existingPos = positions.get(childId);
                childX = existingPos.x;
                firstChildIndex = index + 1;
              }
              return;
            }
            
            const childLevel = levels.get(childId);
            if (childLevel === undefined) return;
            
            const childY = padding + childLevel * levelSpacing;
            
            if (index === firstChildIndex) {
              // First unpositioned child directly under mother
              positions.set(childId, { x: motherX, y: childY, level: childLevel });
              console.log(`[STEP 2] Positioned child: ${persons.get(childId)?.name || childId} under mother at X:${motherX}`);
              childX = motherX;
            } else {
              // Subsequent siblings to the right
              childX += nodeWidth + siblingSpacing;
              positions.set(childId, { x: childX, y: childY, level: childLevel });
              console.log(`[STEP 2] Positioned sibling: ${persons.get(childId)?.name || childId} at X:${childX}`);
            }
          });
          
          currentX = Math.max(currentX, childX + nodeWidth + siblingSpacing * 2);
        }
      });
    });
    
    // STEP 3: Position family units as groups (person + spouses together)
    console.log('[STEP 3] Starting family unit positioning...');
    console.log('[STEP 3] Family units map:', Array.from(familyUnits.entries()).map(([uid, unit]) => ({
      unitId: uid,
      person: persons.get(unit.personId)?.name || unit.personId,
      spouses: unit.spouseIds.map(sid => persons.get(sid)?.name || sid)
    })));
    console.log('[STEP 3] Person to unit map:', Array.from(personToUnit.entries()).slice(0, 10).map(([pid, uid]) => ({
      person: persons.get(pid)?.name || pid,
      unitId: uid
    })));
    
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      let unitX = padding;
      
      console.log(`[STEP 3] Processing level ${level} with ${personIds.length} people`);
      
      // Group people at this level by their family units
      const unitsAtLevel = new Map(); // unitId -> { personId, spouseIds: [] }
      const processed = new Set();
      
      personIds.forEach((id) => {
        if (processed.has(id)) return;
        
        const unitId = personToUnit.get(id);
        if (!unitId) return;
        
        const unit = familyUnits.get(unitId);
        if (!unit) return;
        
        // Check if all members of this unit are at this level
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
          
          // Mark all members as processed
          unitMembers.forEach(mid => processed.add(mid));
        }
      });
      
      // Position each family unit
      unitsAtLevel.forEach((unit, unitId) => {
        const mainPersonName = persons.get(unit.personId)?.name || unit.personId;
        console.log(`[STEP 3] Processing family unit for ${mainPersonName} with ${unit.spouseIds.length} spouses`);
        
        // Get the main person's position (should already be positioned)
        let mainPersonX = unitX;
        const mainPersonPos = positions.get(unit.personId);
        if (mainPersonPos) {
          mainPersonX = mainPersonPos.x;
          console.log(`[STEP 3] Main person ${mainPersonName} already positioned at X:${mainPersonX}`);
        } else {
          // Position main person if not positioned
          positions.set(unit.personId, {
            x: mainPersonX,
            y: padding + level * levelSpacing,
            level
          });
          console.log(`[STEP 3] Positioned main person ${mainPersonName} at X:${mainPersonX}`);
        }
        
        // Separate spouses by marital status
        const divorcedSpouses = [];
        const marriedSpouses = [];
        
        unit.spouseIds.forEach(spouseId => {
          const spouseInfo = spouses.get(unit.personId);
          if (spouseInfo && spouseInfo.spouseId === spouseId) {
            const maritalStatus = spouseInfo.marital_status || 'married';
            if (maritalStatus === 'divorced') {
              divorcedSpouses.push(spouseId);
            } else {
              marriedSpouses.push(spouseId);
            }
          } else {
            // Check reverse direction
            const reverseSpouseInfo = spouses.get(spouseId);
            if (reverseSpouseInfo && reverseSpouseInfo.spouseId === unit.personId) {
              const maritalStatus = reverseSpouseInfo.marital_status || 'married';
              if (maritalStatus === 'divorced') {
                divorcedSpouses.push(spouseId);
              } else {
                marriedSpouses.push(spouseId);
              }
            }
          }
        });
        
        // Position divorced spouses to the LEFT (more spacing for visual separation)
        let leftX = mainPersonX;
        divorcedSpouses.forEach((spouseId) => {
          leftX = leftX - nodeWidth - divorcedSpacing;
          positions.set(spouseId, {
            x: leftX,
            y: padding + level * levelSpacing,
            level
          });
          const spouseName = persons.get(spouseId)?.name || spouseId;
          console.log(`[STEP 3] Positioned divorced spouse (left): ${spouseName} at X:${leftX}`);
        });
        
        // Position married spouses to the RIGHT (closer spacing)
        let rightX = mainPersonX;
        marriedSpouses.forEach((spouseId) => {
          rightX = rightX + nodeWidth + spouseSpacing;
          positions.set(spouseId, {
            x: rightX,
            y: padding + level * levelSpacing,
            level
          });
          const spouseName = persons.get(spouseId)?.name || spouseId;
          console.log(`[STEP 3] Positioned married spouse (right): ${spouseName} at X:${rightX}`);
        });
        
        console.log(`[STEP 3] Family unit for ${mainPersonName}: ${divorcedSpouses.length} divorced, ${marriedSpouses.length} married`);
        
        // Calculate unit width and move to next position
        const unitRight = Math.max(mainPersonX, rightX);
        unitX = unitRight + familyUnitGap;
      });
    });
    
    // STEP 4: Position any remaining unpositioned nodes
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      const y = padding + level * levelSpacing;
      
      personIds.forEach((id) => {
        if (positions.has(id)) return;
        
        // Find parents
        const parents = [];
        childrenByParent.forEach((childIds, parentId) => {
          if (childIds.includes(id)) {
            parents.push(parentId);
          }
        });
        
        if (parents.length > 0) {
          // Position under first positioned parent
          for (const parentId of parents) {
            const parentPos = positions.get(parentId);
            if (parentPos) {
              positions.set(id, { x: parentPos.x, y, level });
              console.log(`[STEP 4] Positioned fallback: ${persons.get(id)?.name || id} under parent at X:${parentPos.x}`);
              break;
            }
          }
        }
      });
    });
    
    // STEP 5: Final fallback - ensure ALL nodes are positioned (even orphaned ones)
    let fallbackX = padding;
    persons.forEach((person, id) => {
      if (!positions.has(id)) {
        // Find the highest level to place orphaned nodes
        const maxLevel = sortedLevels.length > 0 ? Math.max(...sortedLevels) + 1 : 0;
        positions.set(id, {
          x: fallbackX,
          y: padding + maxLevel * levelSpacing,
          level: maxLevel
        });
        console.log(`[STEP 5] Positioned orphaned node: ${person.name || id} at X:${fallbackX}, level:${maxLevel}`);
        fallbackX += nodeWidth + siblingSpacing * 2;
        
        // Also add to levelMap if not already there
        if (!levelMap.has(maxLevel)) {
          levelMap.set(maxLevel, []);
        }
        if (!levelMap.get(maxLevel).includes(id)) {
          levelMap.get(maxLevel).push(id);
        }
      }
    });
    
    console.log('=== LAYOUT DEBUG END ===');
    console.log(`Total persons: ${persons.size}, Positioned: ${positions.size}`);

    return { positions, levelMap };
  }, [personsData, getMotherId]);

  useEffect(() => {
    const { persons, childrenByParent, spouses } = personsData;
    if (persons.size === 0) {
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
    const padding = 150;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { positions } = computeLayout();

    console.log(`🔵 Rendering: ${persons.size} persons, ${positions.size} positions`);

    if (positions.size === 0) {
      console.warn('⚠️ No positions calculated, cannot render tree');
      svg.attr('width', containerWidth).attr('height', 600);
      return;
    }

    // Calculate SVG dimensions
    const allPositions = Array.from(positions.values());
    if (allPositions.length === 0) {
      console.warn('⚠️ No positions in array, cannot calculate dimensions');
      svg.attr('width', containerWidth).attr('height', 600);
      return;
    }
    
    const minX = Math.min(...allPositions.map(p => p.x));
    const maxX = Math.max(...allPositions.map(p => p.x));
    const minY = Math.min(...allPositions.map(p => p.y));
    const maxY = Math.max(...allPositions.map(p => p.y));
    
    console.log(`🔵 SVG bounds: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);

    const contentWidth = maxX - minX + padding * 2 + nodeWidth;
    const contentHeight = maxY - minY + padding * 2 + nodeHeight;

    const svgWidth = Math.max(containerWidth, contentWidth);
    const svgHeight = Math.max(600, contentHeight);

    svg.attr('width', svgWidth).attr('height', svgHeight);

    const g = svg.append('g');
    const xOffset = padding - minX;
    const yOffset = padding - minY;

    // Draw family unit containers (background grouping for spouses)
    const { persons: personsDataMap, spouses: spousesDataMap } = personsData;
    const familyUnitsMap = new Map();
    const personToUnitMap = new Map();
    
    // Rebuild family units for rendering
    personsDataMap.forEach((person, id) => {
      const spouseInfo = spousesDataMap.get(id);
      if (spouseInfo) {
        const spouseId = spouseInfo.spouseId;
        if (personToUnitMap.has(id) || personToUnitMap.has(spouseId)) {
          const unitId = personToUnitMap.get(id) || personToUnitMap.get(spouseId);
          const unit = familyUnitsMap.get(unitId);
          if (!unit.spouseIds.includes(spouseId) && unit.personId !== spouseId) {
            unit.spouseIds.push(spouseId);
            personToUnitMap.set(spouseId, unitId);
          }
          if (!unit.spouseIds.includes(id) && unit.personId !== id) {
            unit.spouseIds.push(id);
            personToUnitMap.set(id, unitId);
          }
        } else {
          const unitId = id < spouseId ? id : spouseId;
          const otherId = id < spouseId ? spouseId : id;
          familyUnitsMap.set(unitId, {
            personId: unitId,
            spouseIds: [otherId]
          });
          personToUnitMap.set(unitId, unitId);
          personToUnitMap.set(otherId, unitId);
        }
      } else if (!personToUnitMap.has(id)) {
        personToUnitMap.set(id, id);
      }
    });
    
    // Draw containers for family units with multiple members
    familyUnitsMap.forEach((unit, unitId) => {
      if (unit.spouseIds.length === 0) return; // Skip single-person units
      
      const unitMembers = [unit.personId, ...unit.spouseIds];
      const memberPositions = unitMembers
        .map(mid => ({ id: mid, pos: positions.get(mid) }))
        .filter(m => m.pos);
      
      if (memberPositions.length < 2) return; // Need at least 2 for a container
      
      const minX = Math.min(...memberPositions.map(m => m.pos.x));
      const maxX = Math.max(...memberPositions.map(m => m.pos.x));
      const y = memberPositions[0].pos.y;
      
      // Draw rounded rectangle container
      const containerPadding = 15;
      const containerWidth = maxX - minX + nodeWidth + containerPadding * 2;
      const containerHeight = nodeHeight + containerPadding * 2;
      
      g.append('rect')
        .attr('x', minX + xOffset - nodeWidth / 2 - containerPadding)
        .attr('y', y + yOffset - nodeHeight / 2 - containerPadding)
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .attr('rx', 12)
        .attr('ry', 12)
        .attr('fill', 'rgba(255, 152, 0, 0.08)') // Light orange tint
        .attr('stroke', 'rgba(255, 152, 0, 0.3)') // Light orange border
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .lower(); // Send to back
    });

    // Helper function to determine which parent is the mother
    const getMotherId = (parentIds) => {
      if (parentIds.length === 0) return null;
      if (parentIds.length === 1) return parentIds[0]; // Single parent
      
      // Check gender to find mother
      for (const parentId of parentIds) {
        const parent = persons.get(parentId);
        if (parent && parent.data.gender === 'female') {
          return parentId;
        }
      }
      
      // If no female found, check if any parent has a spouse that's female
      for (const parentId of parentIds) {
        const spouseInfo = spouses.get(parentId);
        if (spouseInfo) {
          const spouse = persons.get(spouseInfo.spouseId);
          if (spouse && spouse.data.gender === 'female') {
            return spouseInfo.spouseId;
          }
        }
      }
      
      // Fallback: return first parent
      return parentIds[0];
    };

    // Group children by their mother for proper connection drawing
    const childrenByMother = new Map(); // motherId -> [childIds]
    childrenByParent.forEach((childIds, parentId) => {
      childIds.forEach(childId => {
        // Find all parents of this child
        const allParents = [];
        childrenByParent.forEach((pChildIds, pId) => {
          if (pChildIds.includes(childId)) {
            allParents.push(pId);
          }
        });
        
        // Determine which parent is the mother
        const motherId = getMotherId(allParents, persons, spouses);
        if (motherId) {
          if (!childrenByMother.has(motherId)) {
            childrenByMother.set(motherId, []);
          }
          childrenByMother.get(motherId).push(childId);
        }
      });
    });

    // Draw parent-child connections - children connect to their specific mother
    childrenByMother.forEach((childIds, motherId) => {
      const motherPos = positions.get(motherId);
      if (!motherPos) return;

      // Get all child positions
      const childPositions = childIds
        .map(cid => ({ id: cid, pos: positions.get(cid) }))
        .filter(p => p.pos);

      if (childPositions.length === 0) return;

      const minChildX = Math.min(...childPositions.map(p => p.pos.x));
      const maxChildX = Math.max(...childPositions.map(p => p.pos.x));
      const childTopY = childPositions[0].pos.y + yOffset - nodeHeight / 2;
      const motherCenterX = motherPos.x + xOffset + nodeWidth / 2;
      const motherBottomY = motherPos.y + yOffset + nodeHeight / 2;
      const midY = motherBottomY + (childTopY - motherBottomY) / 2;

      // Vertical line from mother down to mid point
      g.append('line')
        .attr('x1', motherCenterX)
        .attr('y1', motherBottomY)
        .attr('x2', motherCenterX)
        .attr('y2', midY)
        .attr('stroke', '#424242')
        .attr('stroke-width', 2.5);

      // Horizontal line connecting siblings
      g.append('line')
        .attr('x1', minChildX + xOffset)
        .attr('y1', midY)
        .attr('x2', maxChildX + xOffset)
        .attr('y2', midY)
        .attr('stroke', '#424242')
        .attr('stroke-width', 2.5);

      // Vertical lines from horizontal line to each child
      childPositions.forEach(({ pos: childPos }) => {
        const childCenterX = childPos.x + xOffset + nodeWidth / 2;
        g.append('line')
          .attr('x1', childCenterX)
          .attr('y1', midY)
          .attr('x2', childCenterX)
          .attr('y2', childTopY)
          .attr('stroke', '#424242')
          .attr('stroke-width', 2.5);
      });
    });

    // Draw spouse connections with X symbol for divorced
    const { spouses: spousesForRendering } = personsData;
    spousesForRendering.forEach((spouseInfo, personId) => {
      const personPos = positions.get(personId);
      const spousePos = positions.get(spouseInfo.spouseId);
      if (!personPos || !spousePos) return;
      if (personId >= spouseInfo.spouseId) return; // Draw once per pair

      const maritalStatus = spouseInfo.marital_status || 'married';
      const isDivorced = maritalStatus === 'divorced';
      const isWidowed = maritalStatus === 'widowed';

      // Determine which person is on left and right
      const personCenterX = personPos.x + xOffset + nodeWidth / 2;
      const spouseCenterX = spousePos.x + xOffset + nodeWidth / 2;
      const x1 = Math.min(personCenterX, spouseCenterX);
      const x2 = Math.max(personCenterX, spouseCenterX);
      const y = personPos.y + yOffset;

      // Draw double line for marriage (connecting the centers of the nodes)
      g.append('line')
        .attr('x1', x1)
        .attr('y1', y - 2)
        .attr('x2', x2)
        .attr('y2', y - 2)
        .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
        .attr('stroke-width', isDivorced ? 2.5 : 3)
        .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');

      g.append('line')
        .attr('x1', x1)
        .attr('y1', y + 2)
        .attr('x2', x2)
        .attr('y2', y + 2)
        .attr('stroke', isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800')
        .attr('stroke-width', isDivorced ? 2.5 : 3)
        .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');

      // Add X symbol for divorced (cancel icon on the line)
      if (isDivorced) {
        const midX = (x1 + x2) / 2;
        const iconSize = 16;
        
        // Draw a circle background for better visibility
        g.append('circle')
          .attr('cx', midX)
          .attr('cy', y)
          .attr('r', iconSize + 2)
          .attr('fill', '#ffffff')
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 2.5);
        
        // Draw X symbol using lines (more reliable than text)
        const offset = iconSize * 0.7;
        // Top-left to bottom-right line
        g.append('line')
          .attr('x1', midX - offset)
          .attr('y1', y - offset)
          .attr('x2', midX + offset)
          .attr('y2', y + offset)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 3)
          .attr('stroke-linecap', 'round');
        
        // Top-right to bottom-left line
        g.append('line')
          .attr('x1', midX + offset)
          .attr('y1', y - offset)
          .attr('x2', midX - offset)
          .attr('y2', y + offset)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 3)
          .attr('stroke-linecap', 'round');
      }
    });

    // Draw nodes
    const nodeIds = Array.from(positions.keys());
    console.log(`🔵 Rendering ${nodeIds.length} nodes`);
    
    const nodeGroups = g
      .selectAll('.node')
      .data(nodeIds)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (id) => {
        const pos = positions.get(id);
        if (!pos) {
          console.warn(`⚠️ No position found for node ${id}`);
          return `translate(0,0)`;
        }
        return `translate(${pos.x + xOffset},${pos.y + yOffset})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event, id) => {
        if (onPersonClick) {
          onPersonClick(id);
        }
      });

    let renderedCount = 0;
    nodeGroups.each(function (id) {
      const group = d3.select(this);
      const person = persons.get(id);
      if (!person) {
        console.warn(`⚠️ Person data not found for id: ${id}`);
        return;
      }
      renderedCount++;

      const spouseInfo = spouses.get(id);
      const hasSpouse = !!spouseInfo;
      const maritalStatus = spouseInfo?.marital_status || 'married';
      const isDivorced = maritalStatus === 'divorced';
      const isWidowed = maritalStatus === 'widowed';

      // Draw node rectangle
      group
        .append('rect')
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', hasSpouse ? (isDivorced ? '#ffebee' : isWidowed ? '#f5f5f5' : '#fff3e0') : '#ffffff')
        .attr('stroke', hasSpouse ? (isDivorced ? '#d32f2f' : isWidowed ? '#757575' : '#ff9800') : '#1976d2')
        .attr('stroke-width', 3)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))');

      // Add name text
      const name = person.name;
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
    });
    
    console.log(`🔵 Successfully rendered ${renderedCount} nodes`);
  }, [personsData, computeLayout, getMotherId, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: '#f5f5f5' }}>
      <svg ref={svgRef} style={{ display: 'block', minWidth: '100%', minHeight: '600px' }}></svg>
    </Box>
  );
};

export default VerticalTreeView;
