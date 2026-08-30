import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { 
  generationColors, 
  generationLabels, 
  maritalStatusColors,
  layoutConfig,
  treeStyles 
} from '../../config/treeConfig';

const VerticalTreeView = ({ data, onPersonClick }) => {
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
    // CRITICAL: We now follow both children AND spouse relationships to ensure everyone in a component is discovered
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
      
      // Also add spouse to queue (same level)
      const spouseInfo = spouses.get(id);
      if (spouseInfo && !visited.has(spouseInfo.spouseId)) {
        queue.push({ id: spouseInfo.spouseId, level: level });
      }
    }

    // Final discovery: some people might still be missing if they are in completely disconnected islands
    // with no identified roots (e.g. loops, though rare).
    persons.forEach((person, id) => {
      if (!visited.has(id)) {
        // Start a new BFS for this island
        queue.push({ id, level: 0 });
        while (queue.length > 0) {
          const { id: islandId, level: islandLevel } = queue.shift();
          if (visited.has(islandId)) continue;
          visited.add(islandId);
          
          levels.set(islandId, islandLevel);
          if (!levelMap.has(islandLevel)) levelMap.set(islandLevel, []);
          levelMap.get(islandLevel).push(islandId);
          
          const islandChildren = childrenByParent.get(islandId) || [];
          islandChildren.forEach(childId => {
            if (!visited.has(childId)) queue.push({ id: childId, level: islandLevel + 1 });
          });
          const islandSpouseInfo = spouses.get(islandId);
          if (islandSpouseInfo && !visited.has(islandSpouseInfo.spouseId)) {
            queue.push({ id: islandSpouseInfo.spouseId, level: islandLevel });
          }
        }
      }
    });

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
    const familyUnits = new Map(); // personId -> { personId, spouseIds: [], isRoot: boolean }
    const personToUnit = new Map(); // personId -> unit personId
    
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
    });
    
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
              childX = motherX;
            } else {
              // Subsequent siblings to the right
              childX += nodeWidth + siblingSpacing;
              positions.set(childId, { x: childX, y: childY, level: childLevel });
            }
          });
          
          currentX = Math.max(currentX, childX + nodeWidth + siblingSpacing * 2);
        }
      });
    });
    
    // STEP 3: Position family units as groups (person + spouses together)
    sortedLevels.forEach((level) => {
      const personIds = levelMap.get(level);
      let unitX = padding;
      
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
        // Find the person with the most spouses to use as the center
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
        
        // Get the center person's position (should already be positioned)
        let centerPersonX = unitX;
        const centerPersonPos = positions.get(centerPersonId);
        if (centerPersonPos) {
          centerPersonX = centerPersonPos.x;
        } else {
          // Position center person if not positioned
          positions.set(centerPersonId, {
            x: centerPersonX,
            y: padding + level * levelSpacing,
            level
          });
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
        
        // Position all spouses with equal spacing relative to the CENTER person
        // IMPORTANT: Always reposition spouses even if they were positioned in STEP 2
        let leftX = centerPersonX;
        leftSpouses.forEach((spouseId) => {
          leftX = leftX - nodeWidth - spouseSpacing;
          positions.set(spouseId, {
            x: leftX,
            y: padding + level * levelSpacing,
            level
          });
        });
        
        // Position spouses to the RIGHT with same spacing
        let rightX = centerPersonX;
        rightSpouses.forEach((spouseId) => {
          rightX = rightX + nodeWidth + spouseSpacing;
          positions.set(spouseId, {
            x: rightX,
            y: padding + level * levelSpacing,
            level
          });
        });
        
        // Calculate unit width and move to next position
        const unitRight = Math.max(centerPersonX, rightX);
        unitX = unitRight + familyUnitGap;
      });
    });
    
    // STEP 3.5: Center fathers above their children (mean average position)
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
        
        // Also adjust positions of ALL spouses to maintain family unit grouping
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
              }
              
              // Also adjust other spouses in this unit
              unit.spouseIds.forEach(spouseId => {
                if (spouseId !== id && !adjustedSpouses.has(spouseId)) {
                  const spousePos = positions.get(spouseId);
                  if (spousePos && spousePos.level === level) {
                    spousePos.x += deltaX;
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
    const {
      nodeWidth,
      nodeHeight,
      circleRadius,
      levelSpacing,
      siblingSpacing,
      spouseSpacing,
      familyUnitGap,
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

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Define dot grid pattern
    const defs = svg.append('defs');
    defs.append('pattern')
      .attr('id', 'dotGrid')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('circle')
      .attr('cx', 2)
      .attr('cy', 2)
      .attr('r', 1)
      .attr('fill', dotGridColor);

    const { positions, levelMap } = computeLayout();
    if (positions.size === 0) return;

    // Calculate tree bounds
    const xValues = Array.from(positions.values()).map((p) => p.x);
    const yValues = Array.from(positions.values()).map((p) => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const treeWidth = maxX - minX + nodeWidth + padding * 2;
    const treeHeight = maxY - minY + nodeHeight + padding * 2 + 100; // Extra room for names below bottom nodes

    const containerWidth = containerRef.current?.clientWidth || 1200;
    const containerHeight = Math.max(800, treeHeight);
    const svgWidth = Math.max(containerWidth, treeWidth);
    const svgHeight = treeHeight;

    svg.attr('width', svgWidth).attr('height', svgHeight);

    // Main background and dot grid
    svg.append('rect')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('fill', backgroundColor);

    svg.append('rect')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('fill', 'url(#dotGrid)');

    const xOffset = (svgWidth - (maxX - minX + nodeWidth)) / 2 - minX;
    const yOffset = padding;

    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    svg.call(zoom);

    // Initial positioning to center the tree
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0));

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
        .attr('fill', 'rgba(193, 98, 45, 0.08)')
        .attr('stroke', 'rgba(193, 98, 45, 0.3)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .lower(); // Send to back
    });

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
      const childTopY = childPositions[0].pos.y + yOffset - circleRadius;
      const motherCenterX = motherPos.x + xOffset;
      const motherBottomY = motherPos.y + yOffset + circleRadius;
      const midY = motherBottomY + (childTopY - motherBottomY) / 2;

      // Vertical line from mother down to mid point
      g.append('line')
        .attr('x1', motherCenterX)
        .attr('y1', motherBottomY)
        .attr('x2', motherCenterX)
        .attr('y2', midY)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('opacity', connectionLineOpacity);

      // Horizontal line connecting siblings
      g.append('line')
        .attr('x1', minChildX + xOffset)
        .attr('y1', midY)
        .attr('x2', maxChildX + xOffset)
        .attr('y2', midY)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('opacity', connectionLineOpacity);

      // Vertical lines from horizontal line to each child
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
                .attr('stroke', '#5A5042')
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '5,5');

              // Horizontal connector from father to mother
              g.append('line')
                .attr('x1', Math.min(fatherCenterX, motherCenterX))
                .attr('y1', motherTopY)
                .attr('x2', Math.max(fatherCenterX, motherCenterX))
                .attr('y2', motherTopY)
                .attr('stroke', '#5C5346')
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
        .attr('stroke', isDivorced ? '#C1622D' : isWidowed ? '#5C5346' : '#D79A1E')
        .attr('stroke-width', isDivorced ? 2.5 : 3)
        .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');

      g.append('line')
        .attr('x1', x1)
        .attr('y1', y + 2)
        .attr('x2', x2)
        .attr('y2', y + 2)
        .attr('stroke', isDivorced ? '#C1622D' : isWidowed ? '#5C5346' : '#D79A1E')
        .attr('stroke-width', isDivorced ? 2.5 : 3)
        .attr('stroke-dasharray', isDivorced ? '8,4' : isWidowed ? '4,4' : 'none');

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
          .attr('stroke', '#C1622D')
          .attr('stroke-width', 2);
        
        // Draw diagonal slash line at 45-degree angle across the horizontal connection
        // Top-left to bottom-right
        g.append('line')
          .attr('x1', midX - slashLength / 2)
          .attr('y1', y - slashLength / 2)
          .attr('x2', midX + slashLength / 2)
          .attr('y2', y + slashLength / 2)
          .attr('stroke', '#C1622D')
          .attr('stroke-width', 5)
          .attr('stroke-linecap', 'round');
        
        // Bottom-left to top-right (X pattern for better visibility)
        g.append('line')
          .attr('x1', midX - slashLength / 2)
          .attr('y1', y + slashLength / 2)
          .attr('x2', midX + slashLength / 2)
          .attr('y2', y - slashLength / 2)
          .attr('stroke', '#C1622D')
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
        if (!pos) {
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

      // Draw node circle
      group
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', circleRadius)
        .attr('fill', backgroundColor)
        .attr('stroke', borderColor)
        .attr('stroke-width', 2);

      // Add spouse indicator bar if married
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

      // Add name text below the circle
      const name = person.name;
      group
        .append('text')
        .attr('x', 0)
        .attr('y', circleRadius + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('fill', textColor)
        .text(name);

      // Add date text below name
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
              .attr('y', circleRadius + 35)
              .attr('text-anchor', 'middle')
              .attr('font-size', '11px')
              .attr('fill', textSoftColor)
              .text(dateText);
          }
        } catch (err) {}
      }

    });
  }, [personsData, computeLayout, getMotherId, onPersonClick, data]);
  // Using shared configuration from treeConfig.js (generationColors, generationLabels, maritalStatusColors imported at top)

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: '600px', overflow: 'auto', bgcolor: treeStyles.backgroundColor, position: 'relative' }}>
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
            backgroundColor: treeStyles.backgroundColor,
            zIndex: 1000,
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 'bold', color: treeStyles.textColor }}>
              Generation Levels
            </Typography>
            <Chip
              label="Hide"
              onClick={() => setShowLegend(false)}
              size="small"
              sx={{
                cursor: 'pointer',
                height: 24,
                fontSize: '0.75rem',
                backgroundColor: treeStyles.backgroundColor,
                '&:hover': { backgroundColor: treeStyles.dotGridColor }
              }}
            />
          </Box>
          
          <Divider sx={{ my: 1 }} />
          
          {generationLabels.map((label, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: generationColors.background[index],
                  border: `1px solid ${generationColors.border[index]}`,
                  borderRadius: '50%',
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: treeStyles.textSoftColor }}>
                {label}
              </Typography>
            </Box>
          ))}
          
          <Divider sx={{ my: 1 }} />
          
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.75, color: treeStyles.textSoftColor, fontSize: '0.8rem' }}>
            Indicators
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 24,
                height: 4,
                backgroundColor: treeStyles.spouseBarColor,
                borderRadius: '2px',
                mr: 1.5,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: treeStyles.textSoftColor }}>
              Spouse
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 24,
                height: 2,
                backgroundColor: treeStyles.lineColor,
                borderRadius: '1px',
                mr: 1.5,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: treeStyles.textSoftColor }}>
              Relationship
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
