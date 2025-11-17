/**
 * GEDCOM Export Utility
 * Converts family tree data to GEDCOM 5.5.5 format
 */

/**
 * Format a date for GEDCOM (YYYY-MM-DD or just year)
 */
const formatGEDCOMDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0].replace(/-/g, '');
  } catch {
    return '';
  }
};

/**
 * Escape GEDCOM text (handle special characters)
 */
const escapeGEDCOMText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .trim();
};

/**
 * Generate GEDCOM file content from family tree data
 * @param {Object} treeData - Tree data with nodes and edges
 * @param {Object} familyInfo - Family information
 * @returns {string} GEDCOM file content
 */
export const generateGEDCOM = (treeData, familyInfo) => {
  const lines = [];
  const persons = treeData.nodes.map((node) => ({ ...node.data, person_id: node.id }));
  const relationships = treeData.edges.filter((e) => e.type === 'parent');
  const spouseRelationships = treeData.edges.filter((e) => e.type === 'spouse');

  // Header
  lines.push('0 HEAD');
  lines.push('1 SOUR FamilyTree App');
  lines.push('2 VERS 1.0');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.5');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');
  lines.push('1 DATE');
  lines.push(`2 TIME ${new Date().toISOString().split('T')[1].split('.')[0]}`);
  lines.push(`1 FILE ${familyInfo?.family_name || 'family_tree'}.ged`);
  lines.push('');

  // Map person IDs to GEDCOM IDs (use @I1@ format)
  const personIdMap = new Map();
  persons.forEach((person, index) => {
    const gedcomId = `I${index + 1}`;
    personIdMap.set(person.person_id, gedcomId);
  });

  // Map families (spouse pairs with children)
  const familyMap = new Map();
  let familyCounter = 1;

  // Process spouse relationships to create families
  spouseRelationships.forEach((spouseRel) => {
    const familyId = `F${familyCounter++}`;
    const husbandId = personIdMap.get(spouseRel.source);
    const wifeId = personIdMap.get(spouseRel.target);
    
    // Determine husband and wife based on gender
    const person1 = persons.find((p) => p.person_id === spouseRel.source);
    const person2 = persons.find((p) => p.person_id === spouseRel.target);
    
    let husband = null;
    let wife = null;
    
    if (person1?.gender === 'male') {
      husband = husbandId;
      wife = wifeId;
    } else if (person2?.gender === 'male') {
      husband = wifeId;
      wife = husbandId;
    } else {
      // Default: first is husband, second is wife
      husband = husbandId;
      wife = wifeId;
    }

    familyMap.set(familyId, {
      husband,
      wife,
      children: [],
    });
  });

  // Add children to families
  relationships.forEach((rel) => {
    const childId = personIdMap.get(rel.target);
    const parentId = personIdMap.get(rel.source);
    
    // Find which family this child belongs to
    for (const [, family] of familyMap.entries()) {
      if (family.husband === parentId || family.wife === parentId) {
        if (!family.children.includes(childId)) {
          family.children.push(childId);
        }
        break;
      }
    }
  });

  // Generate INDI (Individual) records
  persons.forEach((person, index) => {
    const gedcomId = personIdMap.get(person.person_id) || `I${index + 1}`;
    lines.push(`0 @${gedcomId}@ INDI`);

    // Name
    if (person.full_name) {
      const nameParts = person.full_name.split(' ');
      const givenName = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || '';
      lines.push(`1 NAME ${givenName} /${surname}/`);
      if (surname) {
        lines.push('2 GIVN ' + givenName);
        lines.push('2 SURN ' + surname);
      }
    }

    // Gender
    if (person.gender) {
      const sex = person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : 'U';
      lines.push(`1 SEX ${sex}`);
    }

    // Birth
    if (person.date_of_birth || person.place_of_birth) {
      lines.push('1 BIRT');
      if (person.date_of_birth) {
        const date = formatGEDCOMDate(person.date_of_birth);
        if (date) {
          lines.push(`2 DATE ${date}`);
        }
      }
      if (person.place_of_birth) {
        lines.push(`2 PLAC ${escapeGEDCOMText(person.place_of_birth)}`);
      }
    }

    // Death
    if (person.date_of_death || person.place_of_death) {
      lines.push('1 DEAT');
      if (person.date_of_death) {
        const date = formatGEDCOMDate(person.date_of_death);
        if (date) {
          lines.push(`2 DATE ${date}`);
        }
      }
      if (person.place_of_death) {
        lines.push(`2 PLAC ${escapeGEDCOMText(person.place_of_death)}`);
      }
    }

    // Occupation
    if (person.occupation) {
      lines.push(`1 OCCU ${escapeGEDCOMText(person.occupation)}`);
    }

    // Notes
    if (person.biography) {
      lines.push('1 NOTE');
      const noteLines = escapeGEDCOMText(person.biography).split(/\s+/);
      let currentLine = '';
      noteLines.forEach((word) => {
        if ((currentLine + ' ' + word).length > 200) {
          if (currentLine) lines.push(`2 CONT ${currentLine}`);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      });
      if (currentLine) lines.push(`2 CONT ${currentLine}`);
    }

    // Clan and Village as notes
    if (person.clan_name || person.village_origin) {
      lines.push('1 NOTE');
      if (person.clan_name) {
        lines.push(`2 CONT Clan: ${escapeGEDCOMText(person.clan_name)}`);
      }
      if (person.village_origin) {
        lines.push(`2 CONT Village Origin: ${escapeGEDCOMText(person.village_origin)}`);
      }
    }

    lines.push('');
  });

  // Generate FAM (Family) records
  familyMap.forEach((family, familyId) => {
    lines.push(`0 @${familyId}@ FAM`);

    if (family.husband) {
      lines.push(`1 HUSB @I${family.husband}@`);
    }
    if (family.wife) {
      lines.push(`1 WIFE @I${family.wife}@`);
    }

    family.children.forEach((childId) => {
      lines.push(`1 CHIL @I${childId}@`);
    });

    lines.push('');
  });

  // Trailer
  lines.push('0 TRLR');

  return lines.join('\n');
};

/**
 * Export GEDCOM to file
 * @param {Object} treeData - Tree data
 * @param {Object} familyInfo - Family information
 */
export const exportGEDCOM = (treeData, familyInfo) => {
  const gedcomContent = generateGEDCOM(treeData, familyInfo);
  const blob = new Blob([gedcomContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${familyInfo?.family_name || 'family_tree'}_${Date.now()}.ged`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Parse GEDCOM file content
 * @param {string} gedcomContent - GEDCOM file content
 * @returns {Object} Parsed data with persons and relationships
 */
export const parseGEDCOM = (gedcomContent) => {
  const lines = gedcomContent.split(/\r?\n/);
  const persons = [];
  const families = [];
  const personMap = new Map();
  const familyMap = new Map();

  let currentRecord = null;
  let currentTag = null;

  lines.forEach((line) => {
    const match = line.match(/^(\d+)\s+(@?[^@\s]+@?)\s*(.*)$/);
    if (!match) return;

    const level = parseInt(match[1], 10);
    const tag = match[2];
    const value = match[3] || '';

    // New record
    if (level === 0 && tag.startsWith('@') && tag.endsWith('@')) {
      const recordType = value.trim();
      const recordId = tag;

      if (recordType === 'INDI') {
        currentRecord = { id: recordId, type: 'person', data: {} };
        persons.push(currentRecord);
        personMap.set(recordId, currentRecord);
      } else if (recordType === 'FAM') {
        currentRecord = { id: recordId, type: 'family', data: {} };
        families.push(currentRecord);
        familyMap.set(recordId, currentRecord);
      } else {
        currentRecord = null;
      }
      return;
    }

    if (!currentRecord) return;

    // Process tags
    if (level === 1) {
      currentTag = tag;
      
      if (currentRecord.type === 'person') {
        if (tag === 'NAME') {
          const nameMatch = value.match(/^([^/]+)\s*\/?([^/]*)\/?\s*(.*)$/);
          if (nameMatch) {
            const given = nameMatch[1].trim();
            const surname = nameMatch[2].trim();
            currentRecord.data.full_name = `${given} ${surname}`.trim();
          } else {
            currentRecord.data.full_name = value.trim();
          }
        } else if (tag === 'SEX') {
          const sex = value.trim();
          currentRecord.data.gender = sex === 'M' ? 'male' : sex === 'F' ? 'female' : 'other';
        } else if (tag === 'OCCU') {
          currentRecord.data.occupation = value.trim();
        }
      } else if (currentRecord.type === 'family') {
        if (tag === 'HUSB') {
          currentRecord.data.husband = value.trim();
        } else if (tag === 'WIFE') {
          currentRecord.data.wife = value.trim();
        } else if (tag === 'CHIL') {
          if (!currentRecord.data.children) {
            currentRecord.data.children = [];
          }
          currentRecord.data.children.push(value.trim());
        }
      }
    } else if (level === 2 && currentTag) {
      if (currentRecord.type === 'person') {
        if (currentTag === 'BIRT' && tag === 'DATE') {
          currentRecord.data.date_of_birth = value.trim();
        } else if (currentTag === 'BIRT' && tag === 'PLAC') {
          currentRecord.data.place_of_birth = value.trim();
        } else if (currentTag === 'DEAT' && tag === 'DATE') {
          currentRecord.data.date_of_death = value.trim();
        } else if (currentTag === 'DEAT' && tag === 'PLAC') {
          currentRecord.data.place_of_death = value.trim();
        } else if (currentTag === 'NOTE' && tag === 'CONT') {
          if (!currentRecord.data.biography) {
            currentRecord.data.biography = '';
          }
          currentRecord.data.biography += ' ' + value.trim();
        }
      }
    }
  });

  // Build relationships
  const relationships = [];
  const spouseRelationships = [];

  families.forEach((family) => {
    const { husband, wife, children } = family.data;

    // Spouse relationship
    if (husband && wife) {
      spouseRelationships.push({
        spouse1_id: husband,
        spouse2_id: wife,
      });
    }

    // Parent-child relationships
    if (children) {
      children.forEach((childId) => {
        const childPerson = personMap.get(childId);
        if (childPerson) {
        if (husband) {
          relationships.push({
            parent_id: husband,
            child_id: childId,
          });
        }
        if (wife) {
          relationships.push({
            parent_id: wife,
            child_id: childId,
          });
        }
        }
      });
    }
  });

  return {
    persons: persons.map((p) => ({
      ...p.data,
      person_id: p.id,
    })),
    relationships,
    spouseRelationships,
  };
};

