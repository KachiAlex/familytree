# Quick PostgreSQL Setup

## 🚨 PostgreSQL is Not Installed

You need PostgreSQL to run the backend. Here are your options:

## ⚡ Fastest Option: Download & Install

1. **Download PostgreSQL:**
   - Go to: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Click "Download" for Windows x86-64
   - File size: ~200MB

2. **Install:**
   - Run the installer
   - **Set password for `postgres` user:** `Dabonega$reus2660` (or update .env later)
   - Port: **5432** (default)
   - Install location: Default is fine
   - Components: Install everything

3. **After Installation:**
   - PostgreSQL service starts automatically
   - Your backend should connect immediately
   - Type `rs` in backend terminal to restart

## 🐳 Alternative: Docker (If Installed)

If you have Docker Desktop:

```powershell
docker run --name postgres-familytree -e POSTGRES_PASSWORD=Dabonega$reus2660 -e POSTGRES_DB=familytree -p 5432:5432 -d postgres:15
```

## 📝 Your Current Configuration

Your `.env` file expects:
- **User:** `postgres`
- **Password:** `Dabonega$reus2660`
- **Database:** `familytree`
- **Port:** `5432`

When installing PostgreSQL, use these same values, or update your `.env` file.

## ✅ After Installation

1. **Verify PostgreSQL is running:**
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 5432
   ```

2. **Create database (if needed):**
   ```powershell
   psql -U postgres
   CREATE DATABASE familytree;
   \q
   ```

3. **Restart backend:**
   - In backend terminal, type `rs`
   - Should see: `✅ Database connection established`

---

**Install PostgreSQL now, then restart your backend!**

