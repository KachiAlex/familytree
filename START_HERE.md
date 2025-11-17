# 🚀 Start Here - Get Your Servers Running

## Current Status
- ❌ PostgreSQL is NOT running (port 5432)
- ❌ Backend is NOT running (port 5000)
- ✅ Frontend is running (port 3000) but can't connect to backend

## Step-by-Step Fix

### Step 1: Start PostgreSQL

**Option A: Using Services (Easiest)**
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "PostgreSQL" service (might be named like `postgresql-x64-14`)
4. Right-click → **Start**
5. Wait for status to change to "Running"

**Option B: Using PowerShell (as Administrator)**
```powershell
# Find PostgreSQL service
Get-Service | Where-Object { $_.Name -like "*postgres*" }

# Start it (replace with actual service name)
Start-Service postgresql-x64-14
```

### Step 2: Verify PostgreSQL is Running

```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

Should show: `TcpTestSucceeded : True`

### Step 3: Start Backend Server

**Open a NEW terminal window:**
```powershell
cd C:\familytree\backend
npm run dev:backend
```

**You should see:**
```
✅ Database connection established
✅ Database initialized successfully
✅ Database indexes created successfully
🚀 Server running on port 5000
```

### Step 4: Verify Backend is Running

**Test in browser or PowerShell:**
```
http://localhost:5000/api/health
```

Should return JSON with `"status": "ok"` and `"database": "connected"`

### Step 5: Refresh Frontend

Once backend is running:
- Refresh your browser at http://localhost:3000
- The connection error should be gone
- You should be able to register/login

## Quick Command Summary

```powershell
# Terminal 1 - Backend
cd C:\familytree\backend
npm run dev:backend

# Terminal 2 - Frontend (if not already running)
cd C:\familytree\frontend
npm start
```

## Troubleshooting

### If PostgreSQL won't start:
- Check if it's installed
- Try restarting your computer
- Check Windows Event Viewer for errors

### If Backend shows database errors:
- Make sure PostgreSQL is running first
- Check your `DATABASE_URL` in `backend\.env`
- Verify database exists: `psql -U postgres -c "SELECT 1;"`

### If port 5000 is already in use:
- Change `PORT=5001` in `backend\.env`
- Update `REACT_APP_API_URL=http://localhost:5001` in `frontend\.env`

---

**Once both PostgreSQL and Backend are running, your frontend will work!** ✅

