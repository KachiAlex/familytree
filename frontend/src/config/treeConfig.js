/**
 * Family Tree Configuration
 * 
 * This file contains the standard configuration for all family trees.
 * This structure serves as the base template for every family created in the system.
 * 
 * All families will use this configuration by default, ensuring consistency
 * across the platform.
 */

// Generation-based color scheme (Redesign palette: indigo, leaf, gold)
export const generationColors = {
  background: [
    '#22345E', // Level 0: Indigo (root/ancestors)
    '#3A4F82', // Level 1: Lighter indigo
    '#4A5F92', // Level 2: Muted indigo
    '#3F6644', // Level 3: Leaf green
    '#4A7654', // Level 4: Muted leaf
    '#C7930A', // Level 5: Gold
    '#D6A21A', // Level 6+: Light gold
  ],
  border: [
    '#1A274A', // Level 0: Dark indigo border
    '#2A3F6A', // Level 1: Darker indigo border
    '#3A4F82', // Level 2: Indigo border
    '#2F4F34', // Level 3: Dark leaf border
    '#3F6644', // Level 4: Leaf border
    '#9A7008', // Level 5: Dark gold border
    '#B8840A', // Level 6+: Gold border
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

