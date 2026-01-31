# Neon Database Setup for Vercel Deployment

## Problem Solved
Your 500 error was caused by SQLite not working on Vercel's serverless environment. We've switched to Neon (PostgreSQL) which is Vercel's recommended database solution.

## Setup Steps

### 1. Create Neon Account & Database
1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project
3. Create a database (note the connection string)

### 2. Get Database URL
In your Neon dashboard:
- Go to your project
- Click "Connection Details"
- Copy the **connection string** (it looks like: `postgresql://user:password@host/database`)

### 3. Add to Vercel Environment Variables
1. Go to your Vercel dashboard
2. Select your project (`tfs-hub`)
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Neon connection string
   - **Environment**: `Production`, `Preview`, `Development`

### 4. Redeploy
After adding the environment variable, Vercel will automatically redeploy your app.

## Testing
Once deployed:
1. Try creating a new product (should work now)
2. Check that login still works
3. Verify API endpoints work

## Database Schema
The following tables will be created automatically:
- `users` - User accounts
- `products` - Product licenses
- `whitelist` - Game whitelisting
- `usage_logs` - Usage tracking
- `roblox_sessions` - Roblox user sessions

## Troubleshooting
- **Still getting 500 errors?** Check your Neon connection string format
- **Connection refused?** Verify your Neon database is active
- **Environment variable not found?** Make sure you added it to all environments

## Local Development
For local testing, you can either:
1. Use the same Neon database for local dev
2. Set up a local PostgreSQL instance
3. The app will show connection errors until DATABASE_URL is set