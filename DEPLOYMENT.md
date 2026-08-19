# Deployment Guide

The RGB Dumper has two parts:
1. **Frontend** (static HTML/JS) - Hosted on GitHub Pages
2. **Backend** (Python auth server) - Needs to be deployed separately

## Problem
Account creation requests were failing because the frontend couldn't reach the auth API. GitHub Pages is static-only and cannot run Python code.

## Solution
Deploy the Python backend to a free service, then the frontend will connect to it automatically.

## Deployment Options

### Option 1: Deploy to Render.com (Recommended - Free Tier)
1. Go to https://render.com
2. Sign up with your GitHub account
3. Click "New +" → "Web Service"
4. Select "Deploy an existing repository"
5. Choose `redissusj-stack/RGB-Dumper`
6. Set the following:
   - **Name**: `rgb-dumper-auth`
   - **Environment**: Python 3
   - **Build Command**: (leave empty)
   - **Start Command**: `cd "Team unity tree test" && python3 auth-server.py`
   - **Plan**: Free
7. Click "Create Web Service"
8. Wait for deployment to complete
9. Copy the service URL (e.g., `https://rgb-dumper-auth.onrender.com`)
10. Update [`config.js`](Team%20unity%20tree%20test/config.js) line with your URL:
    ```javascript
    return 'https://rgb-dumper-auth.onrender.com/api/auth/state';
    ```
11. Commit and push the change

### Option 2: Deploy to Railway.app (Free Tier)
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `redissusj-stack/RGB-Dumper`
5. Set environment variable: `PORT=3000`
6. Deploy will start automatically
7. Get the public URL from Railway dashboard
8. Update `config.js` with your URL

### Option 3: Use the Codespace Test Server
The Python server is already running on:
```
https://redesigned-sniffle-j455g7969pjfp754-8765.app.github.dev/
```
**Note**: This only works while the Codespace is active. For a permanent solution, use Render or Railway.

## After Deployment
Once the backend is deployed:
1. The frontend will automatically connect to it
2. Users can create accounts from any region
3. Account approvals will persist in the backend's database
4. Admin panel will work for managing users

## Testing the Fix
1. Visit https://redissusj-stack.github.io/RGB-Dumper/
2. Go to Login → Create Account
3. Create a new account and save the token
4. Admin panel should show the pending request
5. Approve the account
6. User can now sign in
