# Implementation To-Do List

## Phase 1: Sharing & Interoperability (Critical) 🔴

### 1.1 PDF Export
- [ ] Install PDF generation library (jsPDF or @react-pdf/renderer)
- [ ] Create PDF export service/utility
- [ ] Design PDF templates:
  - [ ] Family tree summary (compact tree view)
  - [ ] Person profile page (detailed info with photo)
  - [ ] Family book format (all persons with details)
- [ ] Add PDF export button to FamilyTree page
- [ ] Add PDF export option to PersonDetail page
- [ ] Handle large families (pagination/chunking)
- [ ] Include photos in PDF (if possible)
- [ ] Test PDF generation with various data sizes

### 1.2 GEDCOM Import/Export
- [ ] Research and install GEDCOM library (gedcom.js or similar)
- [ ] Create GEDCOM export function:
  - [ ] Map Firestore persons to GEDCOM INDI records
  - [ ] Map relationships to GEDCOM FAM records
  - [ ] Include dates, places, notes
  - [ ] Handle missing data gracefully
- [ ] Create GEDCOM import function:
  - [ ] Parse GEDCOM file
  - [ ] Validate data structure
  - [ ] Map GEDCOM records to Firestore schema
  - [ ] Handle duplicates (detect and merge or skip)
  - [ ] Create import preview/confirmation dialog
- [ ] Add GEDCOM export button to FamilyTree page
- [ ] Add GEDCOM import button to FamilyTree page
- [ ] Add import progress indicator
- [ ] Error handling and validation
- [ ] Test with sample GEDCOM files

---

## Phase 2: Geography & Verification 🟡

### 2.1 Migration Maps & Geography
- [ ] Extend person schema to track place history (array of locations with dates)
- [ ] Create migration history data structure
- [ ] Install map library (Leaflet or Mapbox)
- [ ] Create MigrationMapView component:
  - [ ] Display map with markers for birth/death locations
  - [ ] Timeline slider to show movement over time
  - [ ] Color-coded markers by generation
  - [ ] Click markers to see person details
- [ ] Add migration map tab to FamilyTree page
- [ ] Create geographic distribution charts
- [ ] Add location autocomplete (Google Places API or similar)
- [ ] Store coordinates for locations

### 2.2 Elder Verification Workflow
- [ ] Add verification fields to Firestore:
  - [ ] `verified_by` (user_id)
  - [ ] `verified_at` (timestamp)
  - [ ] `verification_status` (pending/verified/rejected)
  - [ ] `verification_notes`
- [ ] Create verification UI:
  - [ ] "Verify" button for elders/admins
  - [ ] Verification dialog with notes
  - [ ] Verification badge/indicator
- [ ] Add conflict resolution:
  - [ ] Track edit history
  - [ ] Show pending changes
  - [ ] Approve/reject edits dialog
  - [ ] Notification system for conflicts
- [ ] Update security rules for verification
- [ ] Add verification filter to views

---

## Phase 3: UX Polish & Performance 🟢

### 3.1 UI/UX Improvements
- [ ] Replace all remaining `alert()` calls with Snackbar
- [ ] Add skeleton loaders:
  - [ ] PersonDetail page
  - [ ] FamilyTree page
  - [ ] Dashboard
  - [ ] Tree views
- [ ] Implement dark mode:
  - [ ] Add theme toggle
  - [ ] Create dark theme palette
  - [ ] Persist theme preference
  - [ ] Test all components in dark mode
- [ ] Improve mobile responsiveness:
  - [ ] Test all pages on mobile
  - [ ] Fix layout issues
  - [ ] Optimize touch interactions
  - [ ] Mobile-friendly tree views
- [ ] Better error messages:
  - [ ] User-friendly error text
  - [ ] Actionable error messages
  - [ ] Error recovery suggestions

### 3.2 Performance Optimizations
- [ ] Image optimization:
  - [ ] Compress images on upload
  - [ ] Generate thumbnails
  - [ ] Lazy load images
  - [ ] Use WebP format where supported
- [ ] Lazy loading:
  - [ ] Code splitting for routes
  - [ ] Lazy load tree view components
  - [ ] Lazy load heavy libraries
- [ ] Virtual scrolling:
  - [ ] Implement for large person lists
  - [ ] Virtual scrolling for tree nodes
- [ ] Caching:
  - [ ] Cache family tree data
  - [ ] Cache person details
  - [ ] Implement cache invalidation
- [ ] Pagination:
  - [ ] Paginate large family trees
  - [ ] Infinite scroll for documents/stories

---

## Phase 4: Future Features 🔵

### 4.1 AI Features (Planning)
- [ ] Research AI APIs for:
  - [ ] Relationship suggestions
  - [ ] Story transcription
  - [ ] Duplicate detection
- [ ] Design data structures for AI features
- [ ] Create placeholder components
- [ ] Document integration points

### 4.2 Email Automation (Readiness)
- [ ] Keep email function structure ready
- [ ] Document email service options
- [ ] Create email templates
- [ ] Test email sending locally
- [ ] Document Blaze plan upgrade process

---

## Testing & Documentation

- [ ] Write unit tests for new features
- [ ] Integration tests for PDF/GEDCOM
- [ ] Update user documentation
- [ ] Create feature guides
- [ ] Update API documentation (if needed)

---

## Current Status

**Active:** Phase 1 - PDF Export & GEDCOM Import/Export
**Next:** Phase 2 - Migration Maps & Verification
**Estimated Completion:** TBD

