import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  maritalStatusColors,
  layoutConfig 
} from '../../config/treeConfig';

const VerticalTreeView = ({ data, onPersonClick }) => {
  console.log('🔵 VerticalTreeView component loaded', data);
  const svgRef = useRef();
  const [showLegend, setShowLegend] = useState(true);
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

    // Layout parameters - using shared configuration
    const { nodeWidth, levelSpacing, siblingSpacing, spouseSpacing, familyUnitGap, padding } = layoutConfig;
    
    // Identify family units: person + ALL their spouses grouped together
    // Strategy: For each person with spouses, create a unit with that person as the main person
    const familyUnits = new Map(); // personId -> { personId, spouseIds: [], isRoot: boolean }
    const personToUnit = new Map(); // personId -> unit personId
    
    console.log('[FAMILY UNITS] Building family units from spouses map...');
    console.log('[FAMILY UNITS] Total spouses entries:', spouses.size);
    
    // First pass: collect all spouse relationships (bidirectional)
    const spouseRelationships = new Map(); // personId -> Set of spouseIds
    spouses.forEach((spouseInfo, personId) => {
      if (!spouseRelationships.has(personId)) {
        spouseRelationships.set(personId, new Set());
      }
      spouseRelationships.get(personId).add(spouseInfo.spouseId);
      
      // Also add reverse relationship
      if (!spouseRelationships.has(spouseInfo.spouseId)) {
        spouseRelationships.set(spouseInfo.spouseId, new Set());
      }
      spouseRelationships.get(spouseInfo.spouseId).add(personId);
    });
    
    // Second pass: merge connected spouse groups into single units
    // Use DFS to find all connected people through spouse relationships
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
    
    // Find all connected groups
    const connectedGroups = [];
    persons.forEach((person, id) => {
      if (unitVisited.has(id)) return;
      
      const personSpouses = spouseRelationships.get(id);
      if (personSpouses && personSpouses.size > 0) {
        // This person has spouses - find their connected group
        const group = new Set();
        findConnectedGroup(id, group);
        if (group.size > 0) {
          connectedGroups.push(Array.from(group));
        }
      } else {
        // Person with no spouse - they are their own unit
        familyUnits.set(id, {
          personId: id,
          spouseIds: [],
          isRoot: false
        });
        personToUnit.set(id, id);
      }
    });
    
    // Create units for each connected group
    connectedGroups.forEach(group => {
      // Find the person in this group with the most spouses (to be the center)
      let centerPersonId = group[0];
      let maxSpouseCount = spouseRelationships.get(centerPersonId)?.size || 0;
      
      group.forEach(personId => {
        const spouseCount = spouseRelationships.get(personId)?.size || 0;
        if (spouseCount > maxSpouseCount) {
          maxSpouseCount = spouseCount;
          centerPersonId = personId;
        }
      });
      
      // All other people in the group are spouses of the center person
      const spouseIds = group.filter(id => id !== centerPersonId);
      
      familyUnits.set(centerPersonId, {
        personId: centerPersonId,
        spouseIds: spouseIds,
        isRoot: false
      });
      
      // Mark all people in this group as belonging to this unit
      group.forEach(personId => {
        personToUnit.set(personId, centerPersonId);
      });
      
      const centerPersonName = persons.get(centerPersonId)?.name || centerPersonId;
      const spouseNames = spouseIds.map(sid => persons.get(sid)?.name || sid).join(', ');
      console.log(`[FAMILY UNITS] Created merged unit for ${centerPersonName} with spouses: ${spouseNames}`);
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
        
        // Find the person with the most spouses to use as the center
        // This ensures that if someone has multiple spouses, they're centered
        const allUnitMembers = [unit.personId, ...unit.spouseIds];
        let centerPersonId = unit.personId;
        let maxSpouseCount = unit.spouseIds.length;
        
        // Check if any spouse has more spouses than the main person
        unit.spouseIds.forEach(spouseId => {
          // Count how many spouses this person has in the unit
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
        
        const centerPersonName = persons.get(centerPersonId)?.name || centerPersonId;
        console.log(`[STEP 3] Using ${centerPersonName} as center person (has ${maxSpouseCount} spouses in unit)`);
        
        // Get the center person's position (should already be positioned)
        let centerPersonX = unitX;
        const centerPersonPos = positions.get(centerPersonId);
        if (centerPersonPos) {
          centerPersonX = centerPersonPos.x;
          console.log(`[STEP 3] Center person ${centerPersonName} already positioned at X:${centerPersonX}`);
        } else {
          // Position center person if not positioned
          positions.set(centerPersonId, {
            x: centerPersonX,
            y: padding + level * levelSpacing,
            level
          });
          console.log(`[STEP 3] Positioned center person ${centerPersonName} at X:${centerPersonX}`);
        }
        
        // Separate spouses by number of children
        // Spouse with MORE children goes to the RIGHT, spouse with FEWER children goes to the LEFT
        const spouseWithChildren = [];
        
        // Separate spouses into those on the left and right of the center person
        // All spouses except the center person should be positioned
        const spousesToPosition = allUnitMembers.filter(id => id !== centerPersonId);
        
        // Count children for each spouse (only count children where this spouse is the MOTHER)
        spousesToPosition.forEach(spouseId => {
          const children = childrenByMother.get(spouseId) || [];
          const spouseName = persons.get(spouseId)?.name || spouseId;
          console.log(`[STEP 3] Spouse ${spouseName} has ${children.length} children (as mother)`);
          spouseWithChildren.push({ id: spouseId, childCount: children.length });
        });
        
        // Sort by child count: fewer children first (will go left), more children last (will go right)
        spouseWithChildren.sort((a, b) => a.childCount - b.childCount);
        
        // Separate into left (fewer children) and right (more children)
        const leftSpouses = [];
        const rightSpouses = [];
        
        // If there are 2 spouses, put the one with fewer children on LEFT, more on RIGHT
        // If there's only 1 spouse, check if they have children to decide placement
        if (spouseWithChildren.length === 1) {
          // Single spouse: if they have children, put them on RIGHT, otherwise LEFT
          if (spouseWithChildren[0].childCount > 0) {
            rightSpouses.push(spouseWithChildren[0].id);
          } else {
            leftSpouses.push(spouseWithChildren[0].id);
          }
        } else if (spouseWithChildren.length === 2) {
          // Two spouses: fewer children on LEFT, more children on RIGHT
          leftSpouses.push(spouseWithChildren[0].id);
          rightSpouses.push(spouseWithChildren[1].id);
        } else {
          // More than 2 spouses: split evenly, fewer children on left
          const midPoint = Math.ceil(spouseWithChildren.length / 2);
          spouseWithChildren.slice(0, midPoint).forEach(s => leftSpouses.push(s.id));
          spouseWithChildren.slice(midPoint).forEach(s => rightSpouses.push(s.id));
        }
        
        console.log(`[STEP 3] Left spouses (fewer children): ${leftSpouses.map(id => persons.get(id)?.name || id).join(', ')}`);
        console.log(`[STEP 3] Right spouses (more children): ${rightSpouses.map(id => persons.get(id)?.name || id).join(', ')}`);
        
        // Position all spouses with equal spacing relative to the CENTER person
        // IMPORTANT: Always reposition spouses even if they were positioned in STEP 2
        let leftX = centerPersonX;
        leftSpouses.forEach((spouseId) => {
          const oldPos = positions.get(spouseId);
          leftX = leftX - nodeWidth - spouseSpacing;
          positions.set(spouseId, {
            x: leftX,
            y: padding + level * levelSpacing,
            level
          });
          const spouseName = persons.get(spouseId)?.name || spouseId;
          const oldX = oldPos ? oldPos.x : 'not positioned';
          console.log(`[STEP 3] Positioned spouse (left, fewer children): ${spouseName} from X:${oldX} to X:${leftX} (spacing: ${spouseSpacing}px)`);
        });
        
        // Position spouses to the RIGHT with same spacing
        let rightX = centerPersonX;
        rightSpouses.forEach((spouseId) => {
          const oldPos = positions.get(spouseId);
          rightX = rightX + nodeWidth + spouseSpacing;
          positions.set(spouseId, {
            x: rightX,
            y: padding + level * levelSpacing,
            level
          });
          const spouseName = persons.get(spouseId)?.name || spouseId;
          const oldX = oldPos ? oldPos.x : 'not positioned';
          console.log(`[STEP 3] Positioned spouse (right, more children): ${spouseName} from X:${oldX} to X:${rightX} (spacing: ${spouseSpacing}px)`);
        });
        
        console.log(`[STEP 3] Final positions - Center: ${centerPersonName} at X:${centerPersonX}, Left spouses: ${leftSpouses.length}, Right spouses: ${rightSpouses.length}, Spacing: ${spouseSpacing}px`);
        
        console.log(`[STEP 3] Family unit for ${mainPersonName}: ${leftSpouses.length} left (fewer children), ${rightSpouses.length} right (more children)`);
        
        // Calculate unit width and move to next position
        const unitRight = Math.max(centerPersonX, rightX);
        unitX = unitRight + familyUnitGap;
      });
    });
    
    // STEP 3.5: Center fathers above their children (mean average position)
    console.log('[STEP 3.5] Centering fathers above their children...');
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      
      personIds.forEach((id) => {
        const person = persons.get(id);
        if (!person) return;
        
        // Check if this is a father (male with children)
        const isMale = person.data?.gender === 'male';
        if (!isMale) return;
        
        // Find all children of this father
        const children = [];
        childrenByParent.forEach((childIds, parentId) => {
          if (parentId === id) {
            children.push(...childIds);
          }
        });
        
        if (children.length === 0) return;
        
        // Get positions of all positioned children
        const childPositions = children
          .map(childId => positions.get(childId))
          .filter(pos => pos !== undefined);
        
        if (childPositions.length === 0) return;
        
        // Calculate mean average X position of children
        const avgX = childPositions.reduce((sum, pos) => sum + pos.x, 0) / childPositions.length;
        
        // Get current position of father
        const currentPos = positions.get(id);
        if (!currentPos) return;
        
        const oldX = currentPos.x;
        const deltaX = avgX - oldX;
        
        // Update father's X position to center above children
        currentPos.x = avgX;
        positions.set(id, currentPos);
        console.log(`[STEP 3.5] Centered father ${person.name || id} from X:${oldX} to X:${avgX} (average of ${childPositions.length} children, delta: ${deltaX})`);
        
        // Also adjust positions of ALL spouses to maintain family unit grouping
        // Find ALL family units that contain this person (as main person or as spouse)
        if (Math.abs(deltaX) > 1) {
          const adjustedSpouses = new Set(); // Track which spouses we've already adjusted
          
          // Find all units where this person is the main person
          const mainUnitId = personToUnit.get(id);
          if (mainUnitId) {
            const mainUnit = familyUnits.get(mainUnitId);
            if (mainUnit) {
              const allUnitMembers = [mainUnit.personId, ...mainUnit.spouseIds];
              allUnitMembers.forEach(memberId => {
                if (memberId !== id && !adjustedSpouses.has(memberId)) {
                  const memberPos = positions.get(memberId);
                  if (memberPos && memberPos.level === level) {
                    memberPos.x += deltaX;
                    positions.set(memberId, memberPos);
                    adjustedSpouses.add(memberId);
                    const memberName = persons.get(memberId)?.name || memberId;
                    console.log(`[STEP 3.5] Adjusted ${memberName} position by ${deltaX} to maintain family unit (main unit)`);
                  }
                }
              });
            }
          }
          
          // Find all units where this person is a spouse
          familyUnits.forEach((unit, unitPersonId) => {
            if (unit.spouseIds.includes(id) && !adjustedSpouses.has(unitPersonId)) {
              // Adjust the main person of this unit
              const mainPersonPos = positions.get(unitPersonId);
              if (mainPersonPos && mainPersonPos.level === level) {
                mainPersonPos.x += deltaX;
                positions.set(unitPersonId, mainPersonPos);
                adjustedSpouses.add(unitPersonId);
                const mainPersonName = persons.get(unitPersonId)?.name || unitPersonId;
                console.log(`[STEP 3.5] Adjusted ${mainPersonName} position by ${deltaX} to maintain family unit (spouse unit)`);
              }
              
              // Also adjust other spouses in this unit
              unit.spouseIds.forEach(spouseId => {
                if (spouseId !== id && !adjustedSpouses.has(spouseId)) {
                  const spousePos = positions.get(spouseId);
                  if (spousePos && spousePos.level === level) {
                    spousePos.x += deltaX;
                    positions.set(spouseId, spousePos);
                    adjustedSpouses.add(spouseId);
                    const spouseName = persons.get(spouseId)?.name || spouseId;
                    console.log(`[STEP 3.5] Adjusted ${spouseName} position by ${deltaX} to maintain family unit (spouse unit)`);
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

    // Helper function to check if a person has ANY divorced relationship
    // (since a person can have multiple spouses with different marital statuses)
    // We need to check all edges, not just the spouses map which only stores one relationship
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

    const containerWidth = containerRef.current?.clientWidth || 1000;
    // Use shared configuration from treeConfig.js
    const { nodeWidth, nodeHeight, padding, connectionLineOpacity } = layoutConfig;

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

      // Get generation color for connection lines (based on child level)
      const childLevel = childPositions[0]?.pos?.level ?? motherPos.level + 1;
      const levelIndex = Math.min(childLevel, generationColors.border.length - 1);
      const connectionColor = generationColors.border[levelIndex];
      const connectionOpacity = connectionLineOpacity; // From config

      // Vertical line from mother down to mid point
      g.append('line')
        .attr('x1', motherCenterX)
        .attr('y1', motherBottomY)
        .attr('x2', motherCenterX)
        .attr('y2', midY)
        .attr('stroke', connectionColor)
        .attr('stroke-width', 2.5)
        .attr('opacity', connectionOpacity);

      // Horizontal line connecting siblings
      g.append('line')
        .attr('x1', minChildX + xOffset)
        .attr('y1', midY)
        .attr('x2', maxChildX + xOffset)
        .attr('y2', midY)
        .attr('stroke', connectionColor)
        .attr('stroke-width', 2.5)
        .attr('opacity', connectionOpacity);

      // Vertical lines from horizontal line to each child
      childPositions.forEach(({ pos: childPos }) => {
        const childCenterX = childPos.x + xOffset + nodeWidth / 2;
        g.append('line')
          .attr('x1', childCenterX)
          .attr('y1', midY)
          .attr('x2', childCenterX)
          .attr('y2', childTopY)
          .attr('stroke', connectionColor)
          .attr('stroke-width', 2.5)
          .attr('opacity', connectionOpacity);
      });
      
      // Connect mother to father if they're not already close together
      // Find the father (spouse of mother who is male and has the same children)
      const motherSpouseInfo = spouses.get(motherId);
      if (motherSpouseInfo) {
        const fatherId = motherSpouseInfo.spouseId;
        const father = persons.get(fatherId);
        const fatherPos = positions.get(fatherId);
        
        // Check if father is male and has the same children
        if (father && father.data?.gender === 'male' && fatherPos) {
          const fatherChildren = childrenByParent.get(fatherId) || [];
          const hasCommonChildren = childIds.some(cid => fatherChildren.includes(cid));
          
          if (hasCommonChildren) {
            const fatherCenterX = fatherPos.x + xOffset + nodeWidth / 2;
            const fatherBottomY = fatherPos.y + yOffset + nodeHeight / 2;
            const motherTopY = motherPos.y + yOffset - nodeHeight / 2;
            
            // Only draw connection if parents are far apart (more than 2 node widths)
            const distance = Math.abs(fatherCenterX - motherCenterX);
            if (distance > nodeWidth * 2) {
              // Draw line from father to mother
              g.append('line')
                .attr('x1', fatherCenterX)
                .attr('y1', fatherBottomY)
                .attr('x2', fatherCenterX)
                .attr('y2', motherTopY)
                .attr('stroke', '#424242')
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '5,5');
              
              // Horizontal connector from father to mother
              g.append('line')
                .attr('x1', Math.min(fatherCenterX, motherCenterX))
                .attr('y1', motherTopY)
                .attr('x2', Math.max(fatherCenterX, motherCenterX))
                .attr('y2', motherTopY)
                .attr('stroke', '#424242')
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '5,5');
            }
          }
        }
      }
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

      // Add diagonal slash line for divorced relationships (slashing across the connection)
      if (isDivorced) {
        const midX = (x1 + x2) / 2;
        const slashLength = 40; // Increased length for better visibility
        const circleRadius = 25; // White background circle radius
        
        // Draw white background circle for better visibility
        g.append('circle')
          .attr('cx', midX)
          .attr('cy', y)
          .attr('r', circleRadius)
          .attr('fill', '#ffffff')
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 2);
        
        // Draw diagonal slash line at 45-degree angle across the horizontal connection
        // Top-left to bottom-right
        g.append('line')
          .attr('x1', midX - slashLength / 2)
          .attr('y1', y - slashLength / 2)
          .attr('x2', midX + slashLength / 2)
          .attr('y2', y + slashLength / 2)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 5)
          .attr('stroke-linecap', 'round');
        
        // Bottom-left to top-right (X pattern for better visibility)
        g.append('line')
          .attr('x1', midX - slashLength / 2)
          .attr('y1', y + slashLength / 2)
          .attr('x2', midX + slashLength / 2)
          .attr('y2', y - slashLength / 2)
          .attr('stroke', '#d32f2f')
          .attr('stroke-width', 5)
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
      // Check if this person has ANY divorced relationship (not just the first spouse)
      const isDivorced = hasDivorcedRelationship(id);
      // Check for widowed status from the first spouse (or check all if needed)
      const maritalStatus = spouseInfo?.marital_status || 'married';
      const isWidowed = maritalStatus === 'widowed';

      // Get the person's level for generation-based coloring
      const personPos = positions.get(id);
      const level = personPos?.level ?? 0;
      
      // Get color based on level (cap at array length)
      const levelIndex = Math.min(level, generationColors.background.length - 1);
      let backgroundColor = generationColors.background[levelIndex];
      let borderColor = generationColors.border[levelIndex];
      
      // Override with marital status colors if applicable (but keep generation as base)
      if (hasSpouse) {
        if (isDivorced) {
          // Divorced: Use pink/red from config
          const divorcedColors = maritalStatusColors.divorced;
          backgroundColor = divorcedColors.background;
          borderColor = divorcedColors.border;
        } else if (isWidowed) {
          // Widowed: Use gray from config
          const widowedColors = maritalStatusColors.widowed;
          backgroundColor = widowedColors.background;
          borderColor = widowedColors.border;
        } else {
          // Married: Use orange from config
          const marriedColors = maritalStatusColors.married;
          backgroundColor = marriedColors.background;
          borderColor = marriedColors.border;
        }
      } else {
        // Single: Use generation colors
        backgroundColor = generationColors.background[levelIndex];
        borderColor = generationColors.border[levelIndex];
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

      // Add divorce indicator badge on the card
      if (isDivorced && hasSpouse) {
        // Draw a small badge in the top-right corner
        const badgeX = nodeWidth / 2 - 45;
        const badgeY = -nodeHeight / 2 + 8;
        
        // Background rectangle for badge
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
        
        // "DIVORCED" text
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

  // Generation color labels
  // Using shared configuration from treeConfig.js (generationColors, generationLabels, maritalStatusColors imported at top)

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
          
          <Divider sx={{ my: 1.5 }} />
          
          {/* Generation Levels */}
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
          
          {/* Marital Status */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.75, color: '#555', fontSize: '0.8rem' }}>
            Marital Status
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 20,
                backgroundColor: '#fff3e0',
                border: '2px solid #ff9800',
                borderRadius: '3px',
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
                height: 20,
                backgroundColor: '#ffebee',
                border: '2px solid #d32f2f',
                borderRadius: '3px',
                mr: 1,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              Divorced
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 20,
                backgroundColor: '#f5f5f5',
                border: '2px solid #757575',
                borderRadius: '3px',
                mr: 1,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              Widowed
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 20,
                backgroundColor: '#ffffff',
                border: '2px solid #1976d2',
                borderRadius: '3px',
                mr: 1,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              Single
            </Typography>
          </Box>
          
          <Divider sx={{ my: 1 }} />
          
          {/* Connection Lines */}
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
      
      {/* Show Legend Button (when hidden) - Bottom Left Corner */}
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

export default VerticalTreeView;
