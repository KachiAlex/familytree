import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Helper function to load image from URL and convert to base64
 * @param {string} url - Image URL
 * @returns {Promise<string>} Base64 data URL
 */
const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('No URL provided'));
      return;
    }

    // Create an image element
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Create canvas to convert image to base64
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataURL);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      // If CORS fails, try fetching as blob
      fetch(url)
        .then((response) => response.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    };

    img.src = url;
  });
};

/**
 * Export family tree data to PDF
 * @param {Object} treeData - Tree data with nodes and edges
 * @param {Object} familyInfo - Family information
 * @param {string} format - 'tree' | 'book' | 'summary'
 * @param {Function} onProgress - Optional progress callback
 */
export const exportFamilyTreeToPDF = async (treeData, familyInfo, format = 'summary', onProgress) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredHeight = 20) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrap
  const addText = (text, x, y, maxWidth, fontSize = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text || '', maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.4);
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const title = familyInfo?.family_name || 'Family Tree';
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Family info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (familyInfo?.clan_name) {
    doc.text(`Clan: ${familyInfo.clan_name}`, margin, yPosition);
    yPosition += 7;
  }
  if (familyInfo?.village_origin) {
    doc.text(`Village Origin: ${familyInfo.village_origin}`, margin, yPosition);
    yPosition += 7;
  }
  yPosition += 5;

  // Export date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Exported on: ${new Date().toLocaleDateString()}`, margin, yPosition);
  yPosition += 10;

  if (format === 'summary') {
    // Summary format - table of all persons
    const persons = treeData.nodes.map((node) => node.data);
    
    // Create table data
    const tableData = persons.map((person) => [
      person.full_name || 'Unknown',
      person.gender || '',
      person.date_of_birth ? new Date(person.date_of_birth).toLocaleDateString() : '',
      person.date_of_death ? new Date(person.date_of_death).toLocaleDateString() : '',
      person.clan_name || '',
      person.village_origin || '',
      person.place_of_birth || '',
      person.occupation || '',
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['Name', 'Gender', 'Birth', 'Death', 'Clan', 'Village', 'Place of Birth', 'Occupation']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  } else if (format === 'book') {
    // Book format - detailed person profiles
    const persons = treeData.nodes.map((node) => node.data);
    
    for (let index = 0; index < persons.length; index++) {
      const person = persons[index];
      
      if (index > 0) {
        checkPageBreak(50);
        doc.addPage();
        yPosition = margin;
      }

      // Add profile photo if available
      if (person.profile_photo_url) {
        try {
          const imageData = await loadImageAsBase64(person.profile_photo_url);
          const imageWidth = 60;
          const imageHeight = 60;
          const imageX = pageWidth - margin - imageWidth;
          const imageY = yPosition;

          // Check if we need a new page for the image
          if (yPosition + imageHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }

          doc.addImage(imageData, 'JPEG', imageX, yPosition, imageWidth, imageHeight);
          yPosition += imageHeight + 5;
        } catch (error) {
          console.warn('Failed to load profile photo:', error);
          // Continue without photo
        }
      }

      // Person name
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      yPosition += addText(person.full_name || 'Unknown', margin, yPosition, pageWidth - 2 * margin, 16);

      yPosition += 5;

      // Person details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const details = [];
      if (person.gender) details.push(`Gender: ${person.gender}`);
      if (person.date_of_birth) details.push(`Date of Birth: ${new Date(person.date_of_birth).toLocaleDateString()}`);
      if (person.date_of_death) details.push(`Date of Death: ${new Date(person.date_of_death).toLocaleDateString()}`);
      if (person.place_of_birth) details.push(`Place of Birth: ${person.place_of_birth}`);
      if (person.clan_name) details.push(`Clan: ${person.clan_name}`);
      if (person.village_origin) details.push(`Village Origin: ${person.village_origin}`);
      if (person.occupation) details.push(`Occupation: ${person.occupation}`);

      details.forEach((detail) => {
        yPosition += addText(detail, margin, yPosition, pageWidth - 2 * margin, 10);
        yPosition += 5;
      });

      // Biography
      if (person.biography) {
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        yPosition += addText('Biography:', margin, yPosition, pageWidth - 2 * margin, 10);
        doc.setFont('helvetica', 'normal');
        yPosition += 5;
        yPosition += addText(person.biography, margin, yPosition, pageWidth - 2 * margin, 10);
      }

      yPosition += 10;

      // Progress callback
      if (onProgress) {
        onProgress((index + 1) / persons.length);
      }
    }
  } else if (format === 'tree') {
    // Tree format - simplified tree structure
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Family Tree Structure', margin, yPosition);
    yPosition += 10;

    // Build a simple text representation of the tree
    const rootNodes = treeData.rootNodes || [];
    const nodeMap = new Map(treeData.nodes.map((n) => [n.id, n.data]));
    const childrenMap = new Map();
    
    treeData.edges
      .filter((e) => e.type === 'parent')
      .forEach((edge) => {
        if (!childrenMap.has(edge.source)) {
          childrenMap.set(edge.source, []);
        }
        childrenMap.get(edge.source).push(edge.target);
      });

    const printTree = (nodeId, level = 0) => {
      const person = nodeMap.get(nodeId);
      if (!person) return;

      checkPageBreak(10);
      const indent = '  '.repeat(level);
      const name = person.full_name || 'Unknown';
      yPosition += addText(`${indent}${name}`, margin, yPosition, pageWidth - 2 * margin, 10);

      const children = childrenMap.get(nodeId) || [];
      children.forEach((childId) => {
        printTree(childId, level + 1);
      });
    };

    rootNodes.forEach((rootId) => {
      printTree(rootId, 0);
      yPosition += 5;
    });
  }

  // Save the PDF
  const fileName = `family_tree_${familyInfo?.family_id || 'export'}_${format}_${Date.now()}.pdf`;
  doc.save(fileName);
};

/**
 * Export a single person profile to PDF
 * @param {Object} person - Person data
 * @param {Array} relationships - Relationships (parents, children, spouses)
 */
export const exportPersonProfileToPDF = async (person, relationships = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Helper function to add text with word wrap
  const addText = (text, x, y, maxWidth, fontSize = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text || '', maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.4);
  };

  // Add profile photo if available
  if (person.profile_photo_url) {
    try {
      const imageData = await loadImageAsBase64(person.profile_photo_url);
      const imageWidth = 80;
      const imageHeight = 80;
      const imageX = pageWidth - margin - imageWidth;
      const imageY = yPosition;

      doc.addImage(imageData, 'JPEG', imageX, yPosition, imageWidth, imageHeight);
      yPosition += imageHeight + 10;
    } catch (error) {
      console.warn('Failed to load profile photo:', error);
      // Continue without photo
    }
  }

  // Person name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  yPosition += addText(person.full_name || 'Unknown', margin, yPosition, pageWidth - 2 * margin, 20);

  yPosition += 10;

  // Personal Information
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  yPosition += addText('Personal Information', margin, yPosition, pageWidth - 2 * margin, 14);
  yPosition += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const details = [];
  if (person.gender) details.push(`Gender: ${person.gender}`);
  if (person.date_of_birth) details.push(`Date of Birth: ${new Date(person.date_of_birth).toLocaleDateString()}`);
  if (person.date_of_death) details.push(`Date of Death: ${new Date(person.date_of_death).toLocaleDateString()}`);
  if (person.place_of_birth) details.push(`Place of Birth: ${person.place_of_birth}`);
  if (person.clan_name) details.push(`Clan: ${person.clan_name}`);
  if (person.village_origin) details.push(`Village Origin: ${person.village_origin}`);
  if (person.occupation) details.push(`Occupation: ${person.occupation}`);

  details.forEach((detail) => {
    yPosition += addText(detail, margin, yPosition, pageWidth - 2 * margin, 10);
    yPosition += 5;
  });

  // Biography
  if (person.biography) {
    yPosition += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    yPosition += addText('Biography', margin, yPosition, pageWidth - 2 * margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPosition += 5;
    yPosition += addText(person.biography, margin, yPosition, pageWidth - 2 * margin, 10);
  }

  // Relationships
  if (relationships.parents?.length > 0 || relationships.children?.length > 0 || relationships.spouses?.length > 0) {
    yPosition += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    yPosition += addText('Family Relationships', margin, yPosition, pageWidth - 2 * margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPosition += 5;

    if (relationships.parents?.length > 0) {
      yPosition += addText('Parents:', margin, yPosition, pageWidth - 2 * margin, 10);
      relationships.parents.forEach((parent) => {
        yPosition += addText(`  - ${parent.full_name || 'Unknown'}`, margin, yPosition, pageWidth - 2 * margin, 10);
        yPosition += 3;
      });
      yPosition += 3;
    }

    if (relationships.spouses?.length > 0) {
      yPosition += addText('Spouses:', margin, yPosition, pageWidth - 2 * margin, 10);
      relationships.spouses.forEach((spouse) => {
        yPosition += addText(`  - ${spouse.full_name || 'Unknown'}`, margin, yPosition, pageWidth - 2 * margin, 10);
        yPosition += 3;
      });
      yPosition += 3;
    }

    if (relationships.children?.length > 0) {
      yPosition += addText('Children:', margin, yPosition, pageWidth - 2 * margin, 10);
      relationships.children.forEach((child) => {
        yPosition += addText(`  - ${child.full_name || 'Unknown'}`, margin, yPosition, pageWidth - 2 * margin, 10);
        yPosition += 3;
      });
    }
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on ${new Date().toLocaleString()}`, margin, pageHeight - 10);

  // Save the PDF
  const fileName = `person_${person.person_id || 'profile'}_${Date.now()}.pdf`;
  doc.save(fileName);
};

