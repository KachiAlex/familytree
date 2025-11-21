# Spouse Visual Architecture - Proposed Solutions

## Problem
Spouses are appearing as siblings because they're positioned on the same level with similar spacing, making it difficult to distinguish marital relationships from sibling relationships.

## Proposed Architectural Solutions

### Option 1: **Family Unit Grouping with Visual Container** (RECOMMENDED)
**Concept**: Group a person with their spouses in a visual "family unit" container.

**Implementation**:
- Draw a subtle background box/rectangle around each person + their spouses
- Use a light background color (e.g., light orange/yellow tint) for the family unit
- Position spouses much closer to their partner (20-30px spacing) vs siblings (40px+ spacing)
- Add a subtle border around the family unit
- Draw marriage lines INSIDE the container, making them more prominent

**Visual Example**:
```
┌─────────────────────────────────────────┐  ← Family Unit Container
│  [Marycelin] ←→ [Dr. Ogechukwu] → [Ann] │  ← Spouses grouped together
└─────────────────────────────────────────┘
         │
         ↓ (children)
```

**Pros**:
- Clear visual distinction
- Maintains horizontal layout
- Easy to understand at a glance

**Cons**:
- Requires more complex rendering logic
- May need to adjust spacing calculations

---

### Option 2: **Closer Spacing + Visual Indicators**
**Concept**: Keep current layout but make spouses visually distinct.

**Implementation**:
- Reduce spacing between spouses to 20px (vs 40px for siblings)
- Add a subtle connecting bracket or arc above/below the couple
- Use different border colors for spouses (e.g., orange border for married, red for divorced)
- Make marriage lines thicker and more prominent
- Add a small "marriage icon" or symbol between spouses

**Pros**:
- Simpler to implement
- Minimal layout changes

**Cons**:
- May still be confusing if many siblings are present
- Less clear visual grouping

---

### Option 3: **Vertical Sub-levels**
**Concept**: Slightly offset spouses vertically (not a full level, but a sub-level).

**Implementation**:
- Spouses positioned at Y + 10px (slight vertical offset)
- Siblings remain at exact same Y
- Visual connection lines show the relationship
- Background grouping for clarity

**Pros**:
- Clear vertical distinction
- Easy to see relationships

**Cons**:
- May look cluttered
- Breaks the "same level" rule for spouses

---

### Option 4: **Combined Approach** (BEST SOLUTION)
**Concept**: Combine Option 1 + Option 2 for maximum clarity.

**Implementation**:
1. **Family Unit Container**: Draw a subtle rounded rectangle around person + spouses
2. **Close Spacing**: Spouses 20-25px apart, siblings 50px+ apart
3. **Visual Indicators**:
   - Light background tint for family unit
   - Thicker, more prominent marriage lines
   - Different border styles for spouses
4. **Clear Separation**: Larger gap (80-100px) between different family units on same level

**Layout Structure**:
```
Level 1:
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ [Sibling 1]          │    │ [Mary] ←→ [Oge] → [Ann] │    │ [Sibling 2]          │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
     (no container)          (family unit container)      (no container)
```

**Spacing Rules**:
- Within family unit: 20-25px between spouses
- Between family units: 80-100px gap
- Between siblings (no spouses): 50px

---

## Recommended Implementation: Option 4 (Combined Approach)

### Step 1: Identify Family Units
Group people with their spouses into "family units" during layout computation.

### Step 2: Position Family Units
- Position family units as single entities
- Spouses within unit are positioned close together
- Larger gaps between different family units

### Step 3: Visual Rendering
- Draw background container for family units
- Render marriage lines prominently
- Use visual indicators (colors, borders)

### Step 4: Sibling Positioning
- Siblings without spouses get standard spacing
- Siblings with spouses are part of family units

---

## Code Structure Changes Needed

1. **Layout Algorithm**: Add "family unit" concept
2. **Positioning Logic**: Group spouses together before positioning
3. **Rendering**: Add container drawing for family units
4. **Spacing Constants**: Different spacing for spouses vs siblings

