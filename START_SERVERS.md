# Starting the Servers

## Quick Start

I've started both servers in separate PowerShell windows. You should see:

1. **Backend Server Window** - Running on port 5000
2. **Frontend Server Window** - Running on port 3000

## Important: .env File Required

⚠️ **The backend server requires a `.env` file to start properly.**

If you see errors about missing environment variables, create `backend\.env` with:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/familytree
JWT_SECRET=your-secret-key-must-be-at-least-32-characters-long
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## Access the Application

Once both servers are running:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

## Alternative: Use the Startup Script

You can also use the provided PowerShell script:

```powershell
.\start-servers.ps1
```

## Manual Start (if needed)

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm start
```

## Troubleshooting

### Backend won't start
- Check if `.env` file exists in `backend/` folder
- Verify PostgreSQL is running
- Check if port 5000 is available

### Frontend won't start
- Check if port 3000 is available
- Run `npm install` in frontend folder if dependencies are missing

### Port already in use
- Change `PORT` in backend `.env` file
- Frontend will prompt for alternative port automatically

