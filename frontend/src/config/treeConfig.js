/**
 * Family Tree Configuration
 * 
 * This file contains the standard configuration for all family trees.
 * This structure serves as the base template for every family created in the system.
 * 
 * All families will use this configuration by default, ensuring consistency
 * across the platform.
 */

// Generation-based color scheme (Redesign palette only: indigo, clay, leaf, gold)
export const generationColors = {
  background: [
    '#22345E', // Level 0: Indigo (root/ancestors)
    '#3A4F82', // Level 1: Indigo-light
    '#B8541F', // Level 2: Clay
    '#3F6644', // Level 3: Leaf
    '#C7930A', // Level 4: Gold
    '#22345E', // Level 5: Indigo (cycle)
    '#3F6644', // Level 6+: Leaf (cycle)
  ],
  border: [
    '#22345E', // Level 0
    '#22345E', // Level 1
    '#8a3d15', // Level 2: Clay dark
    '#3F6644', // Level 3
    '#C7930A', // Level 4
    '#22345E', // Level 5
    '#3F6644', // Level 6+
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

// Marital status colors (Redesign palette)
export const maritalStatusColors = {
  married: {
    background: '#F4E0D2',
    border: '#B8541F',
    label: 'Married'
  },
  divorced: {
    background: '#E8ECF4',
    border: '#22345E',
    label: 'Divorced'
  },
  widowed: {
    background: '#E4EDE4',
    border: '#3F6644',
    label: 'Widowed'
  },
  single: {
    background: '#FFFDF9',
    border: '#D8BF92',
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

