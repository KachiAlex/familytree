/**
 * Family Tree Configuration
 * 
 * This file contains the standard configuration for all family trees.
 * This structure serves as the base template for every family created in the system.
 * 
 * All families will use this configuration by default, ensuring consistency
 * across the platform.
 */

// Generation-based color scheme (Professional Blue Gradient)
// This color scheme helps visually distinguish different generations in the family tree
export const generationColors = {
  background: [
    '#e3f2fd', // Level 0: Light blue (ancestors/root)
    '#bbdefb', // Level 1: Lighter blue
    '#90caf9', // Level 2: Sky blue
    '#64b5f6', // Level 3: Bright blue
    '#42a5f5', // Level 4: Medium blue
    '#2196f3', // Level 5: Standard blue
    '#1e88e5', // Level 6+: Deep blue
  ],
  border: [
    '#1565c0', // Level 0: Deep blue border
    '#1976d2', // Level 1: Blue border
    '#0288d1', // Level 2: Teal-blue border
    '#0277bd', // Level 3: Darker teal border
    '#01579b', // Level 4: Deep teal border
    '#004d40', // Level 5: Teal-green border
    '#00695c', // Level 6+: Dark teal border
  ]
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

// Marital status colors
export const maritalStatusColors = {
  married: {
    background: '#fff3e0',
    border: '#ff9800',
    label: 'Married'
  },
  divorced: {
    background: '#ffebee',
    border: '#d32f2f',
    label: 'Divorced'
  },
  widowed: {
    background: '#f5f5f5',
    border: '#757575',
    label: 'Widowed'
  },
  single: {
    background: '#ffffff',
    border: '#1976d2',
    label: 'Single (No Spouse)'
  }
};

// Layout parameters
export const layoutConfig = {
  nodeWidth: 160,
  nodeHeight: 80,
  levelSpacing: 200,
  siblingSpacing: 50,
  spouseSpacing: 120, // Equal spacing between all spouses
  familyUnitGap: 100, // Gap between different family units on same level
  padding: 150,
  connectionLineOpacity: 0.6, // Transparency for parent-child connection lines
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

