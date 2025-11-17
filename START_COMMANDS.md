# How to Start the Servers

## Option 1: Start Both Servers Together (Recommended)

From the **root directory** (`C:\familytree`):
```powershell
npm run dev
```

This will start both backend and frontend servers concurrently.

## Option 2: Start Servers Separately

### Backend Server

From the **backend directory**:
```powershell
cd backend
npm run dev
```

Or use the alias:
```powershell
npm run dev:backend
```

### Frontend Server

From the **frontend directory**:
```powershell
cd frontend
npm start
```

Or use the alias:
```powershell
npm run dev:frontend
```

## Available Scripts

### Root Directory (`C:\familytree`)
- `npm run dev` - Start both servers
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run install-all` - Install all dependencies

### Backend Directory (`C:\familytree\backend`)
- `npm start` - Start server (production mode)
- `npm run dev` - Start server with nodemon (development)
- `npm run dev:backend` - Alias for `npm run dev`
- `npm run migrate` - Run database migrations

### Frontend Directory (`C:\familytree\frontend`)
- `npm start` - Start development server
- `npm run dev` - Alias for `npm start`
- `npm run dev:frontend` - Alias for `npm start`
- `npm run build` - Build for production
- `npm test` - Run tests

## Quick Start

1. **Open two terminal windows**

2. **Terminal 1 - Backend:**
   ```powershell
   cd C:\familytree\backend
   npm run dev
   ```

3. **Terminal 2 - Frontend:**
   ```powershell
   cd C:\familytree\frontend
   npm start
   ```

## Access the Application

Once both servers are running:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

