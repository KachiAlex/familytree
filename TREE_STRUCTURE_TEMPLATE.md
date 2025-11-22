# Family Tree Structure Template

## Overview

This document describes the **standard family tree structure** that serves as the base template for all families created in the African Family Tree platform. Every new family automatically uses this structure, ensuring consistency and a professional appearance across the entire platform.

## Default Configuration

### View Type
- **Default View**: `vertical` (VerticalTreeView)
- All families start with the vertical tree view as the primary visualization
- Users can switch to other views (horizontal, radial, 3D, timeline, migration map) but vertical is the standard

### Location
- Configuration file: `frontend/src/config/treeConfig.js`
- Main component: `frontend/src/components/TreeViews/VerticalTreeView.js`

## Features Included by Default

### 1. Generation-Based Color Coding
- **Professional Blue Gradient** scheme
- Each generation level has a distinct color:
  - Level 0 (Root/Ancestors): Light blue (#e3f2fd) with deep blue border (#1565c0)
  - Level 1: Lighter blue (#bbdefb) with blue border (#1976d2)
  - Level 2: Sky blue (#90caf9) with teal-blue border (#0288d1)
  - Level 3: Bright blue (#64b5f6) with darker teal border (#0277bd)
  - Level 4+: Progressively deeper blues
- Connection lines match the child's generation color

### 2. Marital Status Indicators
- **Married**: Orange background (#fff3e0) with orange border (#ff9800)
- **Divorced**: Pink background (#ffebee) with red border (#d32f2f)
  - Includes diagonal X indicator on connection line
  - "DIVORCED" badge on person cards
- **Widowed**: Gray background (#f5f5f5) with gray border (#757575)
- **Single**: White background with blue border (#1976d2)

### 3. Color Legend Panel
- Interactive legend panel in bottom-left corner
- Shows all generation levels, marital statuses, and connection types
- Collapsible with "Hide" button
- Always available via "Show Legend" button when hidden

### 4. Layout Algorithm
- **Vertical hierarchy**: Ancestors at top, descendants below
- **Spouse positioning**: Spouses positioned side-by-side with equal spacing (120px)
- **Child positioning**: Children connect to their specific mother
- **Father centering**: Fathers centered above their children
- **Family unit grouping**: Spouses grouped within visual containers (dashed orange rectangles)
- **Spacing**:
  - Node width: 160px
  - Node height: 80px
  - Level spacing: 200px
  - Sibling spacing: 50px
  - Spouse spacing: 120px
  - Family unit gap: 100px

### 5. Visual Enhancements
- Drop shadows on person cards
- Rounded corners (10px radius)
- Smooth connection lines
- Family unit containers with dashed orange borders
- Divorce indicators (diagonal X with white circle background)

## Implementation Details

### Configuration Structure

All configuration is centralized in `frontend/src/config/treeConfig.js`:

```javascript
// Generation colors
export const generationColors = { background: [...], border: [...] }

// Marital status colors
export const maritalStatusColors = { married: {...}, divorced: {...}, ... }

// Layout parameters
export const layoutConfig = { nodeWidth, nodeHeight, spacing, ... }

// Default view
export const DEFAULT_VIEW_TYPE = 'vertical'
```

### How It Works

1. **Family Creation**: When a new family is created (during registration or via dashboard), it automatically uses the vertical tree view
2. **Default View**: The `FamilyTree.js` component defaults to `viewType = 'vertical'`
3. **Shared Config**: All families use the same configuration from `treeConfig.js`
4. **Consistency**: Every family tree will have the same:
   - Color scheme
   - Layout algorithm
   - Visual indicators
   - Legend panel

## Customization

While the structure is standardized, families can:
- Switch between different view types (horizontal, radial, 3D, timeline, map)
- Filter by clan, village, or search terms
- Export to PDF or GEDCOM
- Add/edit/remove family members

However, the **vertical view structure and color coding remain consistent** across all families.

## Benefits

1. **Consistency**: All families have the same professional appearance
2. **Familiarity**: Users learn one interface that works for all families
3. **Maintainability**: Changes to the structure apply to all families automatically
4. **Professional**: Standardized, polished visual design
5. **Accessibility**: Color legend helps users understand the coding system

## Future Enhancements

The structure can be extended while maintaining backward compatibility:
- Additional generation levels (colors automatically extend)
- New marital statuses (add to config)
- Custom themes (can be added as options)
- Layout variations (while keeping vertical as default)

## Technical Notes

- The structure is encoded in the `VerticalTreeView` component
- Configuration is externalized to `treeConfig.js` for easy maintenance
- All families share the same codebase, ensuring consistency
- The structure is responsive and works on all screen sizes
- Performance optimized for large family trees

---

**Last Updated**: 2025-11-22
**Version**: 1.0
**Status**: Active - All new families use this structure by default

