# Database Setup Guide

## Error: ECONNREFUSED on port 5432

This error means PostgreSQL is not running or not accessible.

## Quick Fixes

### Option 1: Start PostgreSQL Service (Windows)

1. **Open Services:**
   - Press `Win + R`
   - Type `services.msc` and press Enter
   - Look for "postgresql" service

2. **Start the service:**
   - Right-click on PostgreSQL service
   - Click "Start"
   - Wait for it to start

### Option 2: Start PostgreSQL via Command Line

**As Administrator:**
```powershell
# Check if PostgreSQL service exists
Get-Service -Name "*postgres*"

# Start PostgreSQL service (replace with actual service name)
Start-Service postgresql-x64-14  # Adjust version number as needed
```

### Option 3: Start PostgreSQL Manually

If PostgreSQL is installed but not as a service:

```powershell
# Navigate to PostgreSQL bin directory (adjust path)
cd "C:\Program Files\PostgreSQL\14\bin"

# Start PostgreSQL
.\pg_ctl.exe -D "C:\Program Files\PostgreSQL\14\data" start
```

## Verify PostgreSQL is Running

### Test Connection:
```powershell
# Test if PostgreSQL is accessible
psql -U postgres -h localhost -p 5432
```

Or test with your DATABASE_URL:
```powershell
psql "postgresql://user:password@localhost:5432/familytree"
```

## Create Database (if it doesn't exist)

1. **Connect to PostgreSQL:**
   ```powershell
   psql -U postgres
   ```

2. **Create database:**
   ```sql
   CREATE DATABASE familytree;
   ```

3. **Exit:**
   ```sql
   \q
   ```

## Check Your DATABASE_URL

Make sure your `backend\.env` file has the correct connection string:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/familytree
```

**Common formats:**
- `postgresql://postgres:yourpassword@localhost:5432/familytree`
- `postgresql://postgres@localhost:5432/familytree` (if no password)
- `postgresql://user:pass@127.0.0.1:5432/familytree`

## Alternative: Use Different Port

If PostgreSQL is running on a different port, update your `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5433/familytree
```

## Install PostgreSQL (if not installed)

If PostgreSQL is not installed:

1. **Download:** https://www.postgresql.org/download/windows/
2. **Install** with default settings
3. **Remember** the password you set for the `postgres` user
4. **Update** `DATABASE_URL` in `backend\.env` with your password

## Quick Test

After starting PostgreSQL, test the connection:

```powershell
# Test connection
psql -U postgres -c "SELECT version();"
```

If this works, your backend should connect successfully.

## Troubleshooting

### Port 5432 already in use
- Another PostgreSQL instance might be running
- Check: `netstat -ano | findstr :5432`
- Stop conflicting service

### Permission denied
- Check PostgreSQL user permissions
- Verify username/password in DATABASE_URL

### Database doesn't exist
- Create it: `CREATE DATABASE familytree;`
- Or update DATABASE_URL to use an existing database

---

**Once PostgreSQL is running, restart your backend server and it should connect successfully!**

