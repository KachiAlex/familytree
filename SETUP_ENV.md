# Environment Setup Guide

## ✅ Frontend Dependencies Installed

Frontend dependencies have been installed successfully. The frontend server should now start.

## ✅ Backend .env File Created

A `.env` file has been created in the `backend/` folder with default values.

## ⚠️ IMPORTANT: Update Your Database Connection

**You MUST update the `DATABASE_URL` in `backend\.env` with your actual PostgreSQL connection string.**

### Current .env file location:
```
C:\familytree\backend\.env
```

### Required Updates:

1. **Update DATABASE_URL:**
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/familytree
   ```
   
   Replace:
   - `username` with your PostgreSQL username
   - `password` with your PostgreSQL password
   - `localhost:5432` with your database host and port (if different)
   - `familytree` with your database name

2. **Update JWT_SECRET (for production):**
   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars-12345
   ```
   
   Generate a secure random string (at least 32 characters) for production use.

### Example .env file:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/familytree
JWT_SECRET=my-super-secret-jwt-key-for-development-only-12345678901234567890
FRONTEND_URL=http://localhost:3000
```

## 🚀 Starting the Servers

After updating the `.env` file:

1. **Backend will auto-restart** (nodemon watches for changes)
   - Or manually restart: Press `rs` in the backend terminal

2. **Frontend should start** in its terminal window
   - If not, run: `cd frontend && npm start`

## ✅ Verify Setup

Once both servers are running:

1. **Check backend health:**
   ```
   http://localhost:5000/api/health
   ```

2. **Access frontend:**
   ```
   http://localhost:3000
   ```

## 🔧 Database Setup

If you haven't created the database yet:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE familytree;

-- Exit
\q
```

The backend will automatically create all tables on first startup.

## 📝 Next Steps

1. Update `DATABASE_URL` in `backend\.env`
2. Ensure PostgreSQL is running
3. Backend server should auto-restart (nodemon)
4. Frontend server should start automatically
5. Visit http://localhost:3000 to access the application

