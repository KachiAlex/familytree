# Install PostgreSQL - Quick Guide

## PostgreSQL is Not Installed

Your system doesn't have PostgreSQL installed or the service isn't configured.

## Option 1: Install PostgreSQL (Recommended)

### Using Windows Installer

1. **Download PostgreSQL:**
   - Visit: https://www.postgresql.org/download/windows/
   - Or use direct link: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Download the latest version (15.x or 16.x)

2. **Install PostgreSQL:**
   - Run the installer
   - **Important:** Remember the password you set for the `postgres` user
   - Use default port: **5432**
   - Install all components (including pgAdmin if you want a GUI)

3. **After Installation:**
   - PostgreSQL service should start automatically
   - Update your `backend\.env` with the password you set:
     ```env
     DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/familytree
     ```

4. **Create Database:**
   ```powershell
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE familytree;
   
   # Exit
   \q
   ```

5. **Restart Backend:**
   - In your backend terminal, type `rs` (nodemon restart)
   - Or stop (Ctrl+C) and run: `npm run dev:backend`

### Using Winget (Windows Package Manager)

If you have winget installed:
```powershell
winget install PostgreSQL.PostgreSQL
```

Then follow steps 3-5 above.

## Option 2: Use Docker (If You Have Docker)

If you have Docker Desktop installed:

```powershell
# Start PostgreSQL in Docker
docker run --name postgres-familytree `
  -e POSTGRES_PASSWORD=Dabonega$reus2660 `
  -e POSTGRES_DB=familytree `
  -p 5432:5432 `
  -d postgres:15

# Verify it's running
docker ps
```

Your existing `DATABASE_URL` should work:
```env
DATABASE_URL=postgresql://postgres:Dabonega$reus2660@localhost:5432/familytree
```

## Option 3: Use SQLite (Quick Alternative for Development)

If you want to get started quickly without PostgreSQL, I can modify the backend to use SQLite for development. This is easier but less production-ready.

**Would you like me to:**
- Help you install PostgreSQL? (Recommended)
- Set up Docker PostgreSQL?
- Modify the code to use SQLite for development?

## Verify Installation

After installing PostgreSQL, verify it's running:

```powershell
# Check service
Get-Service | Where-Object { $_.Name -like "*postgres*" }

# Test connection
Test-NetConnection -ComputerName localhost -Port 5432
```

Should show: `TcpTestSucceeded : True`

## Quick Install Commands

**Using Chocolatey (if installed):**
```powershell
choco install postgresql
```

**Using Scoop (if installed):**
```powershell
scoop install postgresql
```

---

**Once PostgreSQL is installed and running, your backend will start successfully!**

