# Troubleshooting Connection Errors

## Error: `ERR_CONNECTION_REFUSED` on port 5000

This means the **backend server is not running**.

## Quick Fix

### Step 1: Check PostgreSQL is Running

The backend needs PostgreSQL to start. First, make sure PostgreSQL is running:

**Check PostgreSQL:**
```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

If it fails, start PostgreSQL:
1. Open Services (`Win + R` → `services.msc`)
2. Find PostgreSQL service
3. Right-click → Start

### Step 2: Start Backend Server

**In a new terminal:**
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

### Step 3: Verify Backend is Running

**Test the health endpoint:**
```powershell
curl http://localhost:5000/api/health
```

Or visit in browser: http://localhost:5000/api/health

**Expected response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

## Other Console Warnings (Not Errors)

These are just warnings and won't break your app:

1. **React DevTools** - Just a suggestion, not an error
2. **Content script warnings** - Browser extension, ignore
3. **React Router warnings** - Deprecation warnings for future version
4. **Lusha plugin error** - Browser extension, ignore

## Complete Startup Checklist

- [ ] PostgreSQL is running (port 5432)
- [ ] Backend server is running (port 5000)
- [ ] Frontend server is running (port 3000)
- [ ] Backend health check returns "ok"
- [ ] Frontend can access http://localhost:3000

## Quick Start Commands

**Terminal 1 - Backend:**
```powershell
cd C:\familytree\backend
npm run dev:backend
```

**Terminal 2 - Frontend:**
```powershell
cd C:\familytree\frontend
npm start
```

## If Backend Won't Start

**Common issues:**

1. **PostgreSQL not running**
   - Error: `ECONNREFUSED` on port 5432
   - Fix: Start PostgreSQL service

2. **Database doesn't exist**
   - Error: `database "familytree" does not exist`
   - Fix: Create database: `CREATE DATABASE familytree;`

3. **Wrong DATABASE_URL**
   - Error: `password authentication failed`
   - Fix: Check password in `backend\.env`

4. **Port 5000 already in use**
   - Error: `EADDRINUSE: address already in use`
   - Fix: Change PORT in `backend\.env` or kill process using port 5000

---

**Once the backend is running, refresh your browser and the frontend should connect!**

