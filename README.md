# African Family Tree - Genealogy Platform

A dynamic genealogy engine designed specifically for African families, combining modern technology with traditional oral history preservation.

## 🌍 Core Value Proposition

- **Build family lineage** (past → present → future)
- **Upload documents, stories, photos, and oral history**
- **Invite relatives to collaborate**
- **Visualize connections** with multiple dynamic tree views
- **Preserve ancestry** for generations

## ✨ Unique Features

### Multiple Visualization Modes
- **Vertical Tree View** - Traditional cascading family tree
- **Horizontal Tree View** - User-centered with parents/children/siblings
- **Radial (Circular) View** - User in center, ancestors in rings outward
- **Timeline View** - Chronological events and milestones

### African Cultural Features
- **Clan System Support** - Igbo (Umunna), Yoruba (Idile), Hausa lineage tracking
- **Village/Town Origin** - Geographic ancestry tracking
- **Migration History Maps** - Visual migration patterns
- **Oral Story Archives** - Audio interview storage and transcription
- **Elder Verification** - Trust layers for ancestral information

### Collaboration & Verification
- Invite family members to contribute
- Approval system for conflicting information
- Document verification
- Audio confirmation from elders

## 🏗️ Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with graph relationship mapping
- **AWS S3** for media storage (photos, audio, documents)
- **JWT** authentication

### Frontend
- **React** 18
- **D3.js** / **React Flow** for tree visualizations
- **Material-UI** for modern UI components
- **React Router** for navigation

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- PostgreSQL (v12+)
- npm or yarn

### Installation

1. **Install all dependencies:**
```bash
npm run install-all
```

2. **Set up environment variables:**

Create `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/familytree
JWT_SECRET=your-secret-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
```

Create `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000
```

3. **Set up database:**
```bash
cd backend
npm run migrate
```

4. **Start development servers:**
```bash
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📁 Project Structure

```
familytree/
├── backend/
│   ├── src/
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── services/        # External services (S3, etc.)
│   │   └── utils/           # Helper functions
│   ├── migrations/          # Database migrations
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── TreeViews/   # Visualization components
│   │   │   ├── Person/      # Person management
│   │   │   └── Documents/   # Document uploads
│   │   ├── pages/           # Page components
│   │   ├── services/        # API calls
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Helper functions
│   └── public/
└── README.md
```

## 🎯 Roadmap

- [x] Project structure setup
- [ ] Core API endpoints
- [ ] Database models and migrations
- [ ] Authentication system
- [ ] Person management UI
- [ ] Tree visualization components
- [ ] Document upload system
- [ ] Collaboration features
- [ ] Cultural features (clan systems)
- [ ] Oral history audio features
- [ ] AI story generation (future)
- [ ] Mobile app (React Native)

## 📝 License

MIT

