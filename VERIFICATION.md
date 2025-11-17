# Server Verification Guide

## ✅ Environment Updated

Great! You've updated the `.env` file with your database connection.

## 🔍 Verify Servers Are Running

### Check Backend Server

Open a browser or use curl:
```
http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "version": "1.0.0",
  "database": "connected"
}
```

**If you see "database": "connected"** - ✅ Everything is working!

**If you see "database": "disconnected"** - Check your DATABASE_URL in `.env`

### Check Frontend Server

Open in browser:
```
http://localhost:3000
```

You should see the login/registration page.

## 🚀 What to Expect

### Backend Terminal
- Should show: `✅ Database initialized successfully`
- Should show: `🚀 Server running on port 5000`
- Should show: `✅ Database connection established`

### Frontend Terminal
- Should show: `Compiled successfully!`
- Should show: `webpack compiled`
- Browser should open automatically at http://localhost:3000

## 🐛 Troubleshooting

### Backend Issues

**Error: "database": "disconnected"**
- Verify PostgreSQL is running
- Check DATABASE_URL format in `.env`
- Test connection: `psql $DATABASE_URL`

**Error: "Config validation error"**
- Check JWT_SECRET is at least 32 characters
- Verify all required fields in `.env`

**Error: "relation does not exist"**
- Database tables will be created automatically on first startup
- Check backend terminal for "Database initialized successfully"

### Frontend Issues

**Port 3000 already in use**
- Frontend will prompt for alternative port (usually 3001)
- Or kill process using port 3000

**Compilation errors**
- Check for syntax errors in console
- Try clearing cache: `cd frontend && npm start -- --reset-cache`

## ✅ Success Checklist

- [ ] Backend health check returns "ok" with "database": "connected"
- [ ] Frontend loads at http://localhost:3000
- [ ] Can see login/registration page
- [ ] No errors in backend terminal
- [ ] No errors in frontend terminal

## 🎉 Next Steps

Once both servers are running:

1. **Register a new family** at http://localhost:3000/register
2. **Create your first family tree**
3. **Add family members**
4. **Explore the tree visualizations**

---

**Your African Family Tree application is ready to use!** 🌳

