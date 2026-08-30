/**
 * Family Tree Configuration
 * 
 * This file contains the standard configuration for all family trees.
 * This structure serves as the base template for every family created in the system.
 * 
 * All families will use this configuration by default, ensuring consistency
 * across the platform.
 */

// Generation-based color scheme (Indigo gradient for nodes)
export const generationColors = {
  background: [
    '#22345E', // Level 0: Dark Indigo (root)
    '#3A4F82', // Level 1: Indigo
    '#5D72A3', // Level 2: Medium Indigo/Blue
    '#8497C4', // Level 3: Light Indigo/Blue
    '#ABBDD6', // Level 4: Very Light Blue
    '#D2DEE8', // Level 5: Extra Light Blue
    '#E9F0F5', // Level 6+: Ghost Blue
  ],
  border: [
    '#1A284A', // Level 0
    '#2A3D6B', // Level 1
    '#4A5B8B', // Level 2
    '#6D81B1', // Level 3
    '#94A7C9', // Level 4
    '#B8C8DB', // Level 5
    '#DDE6F0', // Level 6+
  ]
};

// Tree background and line colors
export const treeStyles = {
  backgroundColor: '#FBF7F0', // Soft beige/white background
  dotGridColor: '#E2D8C6',    // Light beige dots
  lineColor: '#E7DCC8',       // Beige connection lines
  spouseBarColor: '#D79A1E',  // Gold/Orange spouse indicator
  textColor: '#22345E',       // Indigo text
  textSoftColor: '#5A5042',   // Muted brown text
};

// Generation level labels
export const generationLabels = [
  'Level 0 (Root/Ancestors)',
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6+'
];

// Marital status colors (Redesign palette)
export const maritalStatusColors = {
  married: {
    background: '#F7E5D8',
    border: '#C1622D',
    label: 'Married'
  },
  divorced: {
    background: '#EAEEF6',
    border: '#22345E',
    label: 'Divorced'
  },
  widowed: {
    background: '#E7EFE6',
    border: '#3F6644',
    label: 'Widowed'
  },
  single: {
    background: '#FBF7F0',
    border: '#E7DCC8',
    label: 'Single (No Spouse)'
  }
};

// Layout parameters
export const layoutConfig = {
  nodeWidth: 60,   // Circle diameter
  nodeHeight: 60,  // Circle diameter
  circleRadius: 28,
  levelSpacing: 180,
  siblingSpacing: 100,
  spouseSpacing: 120,
  familyUnitGap: 180,
  padding: 120,
  connectionLineOpacity: 1.0, 
};

// Default view type
export const DEFAULT_VIEW_TYPE = 'vertical';

// Tree view features enabled by default
export const defaultTreeFeatures = {
  generationColorCoding: true,
  colorLegend: true,
  divorceIndicators: true,
  familyUnitGrouping: true,
  spouseSpacing: true,
  fatherCentering: true,
};

/**
 * Get color for a specific generation level
 * @param {number} level - The generation level (0-based)
 * @returns {Object} - Object with background and border colors
 */
export const getGenerationColor = (level) => {
  const levelIndex = Math.min(level, generationColors.background.length - 1);
  return {
    background: generationColors.background[levelIndex],
    border: generationColors.border[levelIndex]
  };
};

/**
 * Get marital status color
 * @param {string} status - Marital status ('married', 'divorced', 'widowed', 'single')
 * @returns {Object} - Object with background, border, and label
 */
export const getMaritalStatusColor = (status) => {
  return maritalStatusColors[status] || maritalStatusColors.single;
};

