# Quick Start Guide - After Installation

## ✅ Dependencies Installed Successfully!

All new packages are now installed:
- ✅ helmet (Security headers)
- ✅ morgan (Request logging)
- ✅ express-rate-limit (Rate limiting)
- ✅ joi (Environment validation)

## 🚀 Starting the Server

### 1. Make sure your `.env` file is configured:

Required variables:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/familytree
JWT_SECRET=your-secret-key-must-be-at-least-32-characters-long
NODE_ENV=development
PORT=5000
```

Optional variables:
```env
FRONTEND_URL=http://localhost:3000
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

**Important:** `JWT_SECRET` must be at least 32 characters long!

### 2. Start the development server:

```powershell
npm run dev
```

Or if nodemon isn't working:
```powershell
node server.js
```

### 3. Verify the server is running:

Open a new terminal and test:
```powershell
curl http://localhost:5000/api/health
```

Or visit in browser: `http://localhost:5000/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 1.23,
  "environment": "development",
  "version": "1.0.0",
  "database": "connected"
}
```

## 🔍 Troubleshooting

### Error: "Config validation error"
- Check your `.env` file
- Ensure `DATABASE_URL` and `JWT_SECRET` are set
- `JWT_SECRET` must be at least 32 characters

### Error: "Database connection failed"
- Verify PostgreSQL is running
- Check `DATABASE_URL` is correct
- Test connection: `psql $DATABASE_URL`

### Error: "nodemon is not recognized"
- Install nodemon globally: `npm install -g nodemon`
- Or use: `node server.js` instead

### Server starts but health check shows "degraded"
- Database connection issue
- Check database is running and accessible
- Verify connection string in `.env`

## ✨ What's New

Your server now has:
- 🔒 **Security headers** (Helmet)
- 📊 **Request logging** (Morgan)
- 🚦 **Rate limiting** (100 req/15min)
- ✅ **Environment validation** (Joi)
- 🏥 **Enhanced health checks**
- 🛡️ **Better error handling**
- ⚡ **Database indexes** (faster queries)
- 🔌 **Optimized connection pool**

## 📝 Next Steps

1. Test the API endpoints
2. Check the logs (Morgan will show request logs)
3. Test rate limiting (make 6 rapid login attempts)
4. Verify security headers: `curl -I http://localhost:5000/api/health`

---

**Your server is now production-ready with enterprise-grade security and performance!** 🎉

