# Setup Guide - African Family Tree

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** or **yarn** (comes with Node.js)
- **AWS Account** (for S3 storage) - Optional for development

## Step 1: Database Setup

1. **Install PostgreSQL** if you haven't already

2. **Create a database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE familytree;

# Exit psql
\q
```

3. **Note your database connection string:**
```
postgresql://username:password@localhost:5432/familytree
```

## Step 2: Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your settings
```

4. **Configure `.env` file:**
```env
PORT=5000
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/familytree
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=familytree-media
AWS_REGION=us-east-1
NODE_ENV=development
```

**Note:** For local development without AWS S3, you can use a local file storage solution or mock the S3 service.

5. **Initialize database tables:**
```bash
npm run migrate
```

This will create all necessary tables in your PostgreSQL database.

6. **Start the backend server:**
```bash
npm run dev
```

The backend API will be available at `http://localhost:5000`

## Step 3: Frontend Setup

1. **Open a new terminal and navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
# Copy the example file (if it exists)
# Or create .env file manually
```

4. **Configure `.env` file:**
```env
REACT_APP_API_URL=http://localhost:5000
```

5. **Start the frontend development server:**
```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## Step 4: Verify Installation

1. **Backend Health Check:**
   - Visit: `http://localhost:5000/api/health`
   - Should return: `{"status":"ok","message":"African Family Tree API is running"}`

2. **Frontend:**
   - Visit: `http://localhost:3000`
   - You should see the login page

## Step 5: Create Your First Account

1. Click "Register" on the login page
2. Fill in your details
3. After registration, you'll be logged in automatically
4. Create your first family tree!

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify your database credentials in `.env`
- Check that the database exists: `psql -U postgres -l`

### Port Already in Use

- Backend: Change `PORT` in `backend/.env`
- Frontend: React will prompt to use a different port

### AWS S3 Issues (Optional)

For development, you can:
1. Use a local file storage solution
2. Mock the S3 service
3. Use a test S3 bucket with public access

### Module Not Found Errors

- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Development Workflow

### Running Both Servers

From the root directory:
```bash
npm run dev
```

This runs both backend and frontend concurrently.

### Database Migrations

If you need to reset the database:
```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE familytree;"
psql -U postgres -c "CREATE DATABASE familytree;"

# Run migrations again
cd backend
npm run migrate
```

## Next Steps

- Explore the API endpoints at `http://localhost:5000/api`
- Check the README.md for feature documentation
- Start building your family tree!

## Support

For issues or questions, check:
- Backend logs in the terminal
- Browser console for frontend errors
- Database logs for connection issues

