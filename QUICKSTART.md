# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
# From the root directory
npm run install-all
```

### 2. Set Up Database

```bash
# Create PostgreSQL database
createdb familytree

# Or using psql
psql -U postgres
CREATE DATABASE familytree;
\q
```

### 3. Configure Environment

**Backend** (`backend/.env`):
```env
PORT=5000
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/familytree
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

**Frontend** (`frontend/.env`):
```env
REACT_APP_API_URL=http://localhost:5000
```

**Note:** AWS S3 is optional for development. You can mock it or use local storage.

### 4. Initialize Database

```bash
cd backend
npm run migrate
```

### 5. Start Development Servers

```bash
# From root directory
npm run dev
```

Or separately:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 6. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

### 7. Create Your First Account

1. Go to http://localhost:3000
2. Click "Register"
3. Fill in your details
4. Create your first family tree!

## 📝 First Steps After Setup

1. **Create a Family Tree**
   - Click "Create Family Tree" on dashboard
   - Enter family name, clan name (optional), village origin (optional)

2. **Add Family Members**
   - Click "Add Person" in the family tree view
   - Fill in details (name, dates, clan, etc.)
   - Add biography/story

3. **Create Relationships**
   - View person details
   - Add relationships (parent, spouse, sibling, etc.)

4. **Upload Documents**
   - Add photos, certificates, or audio recordings
   - Link to family members

5. **Record Oral History**
   - Add stories with optional audio
   - Preserve family narratives

6. **Invite Family Members**
   - Go to Family Settings
   - Invite relatives via email
   - They can contribute to the tree

## 🎨 Explore Tree Views

Switch between different visualization modes:
- **Vertical** - Traditional tree view
- **Horizontal** - Interactive node view
- **Radial** - Circular genealogy view
- **Timeline** - Chronological events

## 🆘 Troubleshooting

### Database Connection Error
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `backend/.env`
- Ensure database exists: `psql -l | grep familytree`

### Port Already in Use
- Backend: Change `PORT` in `backend/.env`
- Frontend: React will prompt for alternative port

### Module Not Found
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS Errors
- Ensure backend is running on port 5000
- Check `REACT_APP_API_URL` in `frontend/.env`

## 📚 Next Steps

- Read [FEATURES.md](./FEATURES.md) for complete feature list
- Check [SETUP.md](./SETUP.md) for detailed setup instructions
- Review [README.md](./README.md) for project overview

## 💡 Tips

- Start with a small family tree to test features
- Use the timeline view to see chronological events
- Upload photos to make the tree more visual
- Record oral history while elders are available
- Invite family members to collaborate

Happy genealogy building! 🌳

