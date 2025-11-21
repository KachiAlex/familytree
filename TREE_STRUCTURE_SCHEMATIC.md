# Family Tree Structure Schematic

## Vertical Genealogical Layout

```
LEVEL 0 (Top - Great Grandfather)
┌─────────────────────────────┐
│  Dike Onumaegbu Akoma       │  ← ISOLATED (no spouse, no siblings)
│  (Great Grandfather)         │
└─────────────────────────────┘
              │
              │ (vertical line down)
              │
              ▼
LEVEL 1 (Son of Dike)
┌─────────────────────────────┐
│  Dr. Ogechukwu Akoma        │  ← Son of Dike
└─────────────────────────────┘
              │
              │ (vertical line down)
              │
              ▼
LEVEL 2 (Wives of Dr. Ogechukwu)
┌─────────────────────────────┐     [DIVORCED SPACING]     ┌─────────────────────────────┐
│  Marycelin Baba             │  ←─── 120px gap ────→     │  Ann Obilor Akoma           │
│  (Divorced from Dr. O.)     │                           │  (Wife of Dr. O.)           │
└─────────────────────────────┘                           └─────────────────────────────┘
              │                                                          │
              │ (vertical line down)                                     │ (vertical line down)
              │                                                          │
              ▼                                                          ▼
LEVEL 3 (Children of Marycelin & Dr. Ogechukwu)
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────────┐
│ Chiemele Akoma  │  │ Chinyere Akoma  │  │ Onyedikachi Akoma + Esther Isioma   │
│                 │  │                 │  │ Akoma (Mordi)                        │
│                 │  │                 │  │ [COLLAPSED: Spouse in same box]     │
└─────────────────┘  └─────────────────┘  └─────────────────────────────────────┘
                                                      │
                                                      │ (vertical line, 150px - CLOSER)
                                                      │ (centered under collapsed node)
                                                      │
                                                      ▼
LEVEL 4 (Children of Onyedikachi & Esther - positioned directly under couple)
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ Chimamanda Pandora Akoma    │  │ Ogechukwu King David Akoma  │  ← Siblings (same row)
│ b. 2020                     │  │ b. 2024                     │
└─────────────────────────────┘  └─────────────────────────────┘
         ↑
         │
         │ (Children positioned directly under collapsed couple, 150px spacing - CLOSER)
```

## Key Rules:

1. **Vertical Hierarchy:**
   - Ancestors go UP (higher Y coordinate)
   - Descendants go DOWN (lower Y coordinate)
   - Each generation is on its own LEVEL (same Y coordinate)

2. **Horizontal Alignment:**
   - Siblings appear on the SAME ROW (same Y coordinate)
   - Spouses appear on the SAME ROW, SIDE-BY-SIDE
   - Siblings are spaced horizontally with `siblingSpacing` (40px)

3. **Spouse Positioning & Collapsing:**
   - **Husband's Family Tree**: Spouse (wife) is collapsed INTO the husband's node
     - Display: "Husband Name + Wife Name" in single box
     - Example: "Onyedikachi Akoma + Esther Isioma Akoma (Mordi)"
   - **Wife's Family Tree**: Husband is collapsed INTO the wife's node
     - Display: "Wife Name + Husband Name" in single box
     - Example: "Esther Isioma Akoma (Mordi) + Onyedikachi Akoma"
   - **When NOT collapsed** (for divorced or separate display):
     - Married couples: `spouseSpacing` (40px) between them
     - Divorced couples: `divorcedSpacing` (120px) between them

4. **Parent-Child Connections:**
   - Vertical line from parent DOWN to children
   - If parent has multiple children, horizontal line connects all siblings
   - **Direct parent-child spacing**: 150px (reduced for closer relationships)
   - **Standard level spacing**: 200px (for generational levels)
   - Children are positioned directly BELOW their parent(s)
   - For collapsed couples: Children are centered under the collapsed node
   - Example: Onyedikachi & Esther's children are positioned directly under their collapsed node (150px spacing)

5. **Specific Structure for This Family:**
   - **Dike Onumaegbu Akoma**: ISOLATED at top (Level 0)
   - **Dr. Ogechukwu Akoma**: Directly under Dike (Level 1)
   - **Marycelin Baba & Ann Obilor Akoma**: Beside Dr. Ogechukwu, same level (Level 2)
     - Marycelin has 120px spacing (divorced)
     - Ann has 40px spacing (married)
   - **Chiemele, Chinyere, Onyedikachi+Esther**: Level 3, siblings on same row
     - Esther is COLLAPSED INTO Onyedikachi's node (husband's family tree)
     - Display: "Onyedikachi Akoma + Esther Isioma Akoma (Mordi)" in single box
   - **Chimamanda & Ogechukwu King David**: Under collapsed couple (Level 4), siblings on same row
     - Positioned directly under Onyedikachi+Esther collapsed node
     - **150px spacing** (reduced from 200px for closer parent-child relationship)
   - **Key**: 
     - Spouses are collapsed into their partner's node (husband's family = spouse in husband's box)
     - Children are positioned directly under the collapsed couple with reduced spacing (150px)

## Visual Connection Pattern:

```
Parent
  │
  │ (vertical line)
  │
  ├─────────────────┐ (horizontal line connecting siblings)
  │                 │
Child1            Child2
```

## Spouse Connection Pattern:

```
Person1 ────[40px]───→ Person2 (married)
Person1 ────[120px]───→ Person2 (divorced)
```

## Collapse Behavior:

- When a node is collapsed (`isCollapsed = true`):
  - Hide ALL children and descendants
  - Show only ONE box representing the person
  - Maintain connection line upward (to parents) if visible
  - Collapsing a parent hides ALL siblings into one collapsed node group

- When a node is expanded (`isCollapsed = false`):
  - Show spouse(s) beside the node
  - Show parents above the node
  - Show children directly below
  - Show siblings horizontally (nodes that share parents)

