# Quick Fix: PostgreSQL Connection Error

## Problem
```
ECONNREFUSED ::1:5432
ECONNREFUSED 127.0.0.1:5432
```

This means **PostgreSQL is not running**.

## Solution Steps

### Step 1: Check if PostgreSQL Service Exists

Open PowerShell as Administrator and run:
```powershell
Get-Service | Where-Object { $_.Name -like "*postgres*" }
```

### Step 2: Start PostgreSQL Service

If you see a PostgreSQL service, start it:
```powershell
# Replace 'postgresql-x64-14' with your actual service name
Start-Service postgresql-x64-14
```

Or use Services GUI:
1. Press `Win + R`
2. Type `services.msc`
3. Find "postgresql" service
4. Right-click → Start

### Step 3: Verify PostgreSQL is Running

Test connection:
```powershell
# If psql is in PATH
psql -U postgres -c "SELECT version();"
```

Or check service status:
```powershell
Get-Service | Where-Object { $_.Name -like "*postgres*" } | Select-Object Name, Status
```

### Step 4: Restart Backend

Once PostgreSQL is running, restart your backend:
```powershell
cd C:\familytree\backend
npm run dev:backend
```

## If PostgreSQL is Not Installed

### Option A: Install PostgreSQL

1. **Download:** https://www.postgresql.org/download/windows/
2. **Install** with default settings
3. **Remember** the password for `postgres` user
4. **Update** `backend\.env` with your password

### Option B: Use Docker (Alternative)

If you have Docker installed:
```powershell
docker run --name postgres-familytree -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=familytree -p 5432:5432 -d postgres
```

Then update `DATABASE_URL` in `backend\.env`:
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/familytree
```

## Your Current Configuration

Your `.env` file has:
```
DATABASE_URL=postgresql://postgres:Dabonega$reus2660@localhost:5432/familytree
```

**Note:** The `$` in your password might need escaping. Try:
```env
DATABASE_URL=postgresql://postgres:Dabonega%24reus2660@localhost:5432/familytree
```

Or wrap in quotes if your connection string parser supports it.

## Quick Test

After starting PostgreSQL, test:
```powershell
# Test if port 5432 is listening
Test-NetConnection -ComputerName localhost -Port 5432
```

If it shows "TcpTestSucceeded : True", PostgreSQL is running!

---

**Once PostgreSQL is running, your backend will connect automatically!**

