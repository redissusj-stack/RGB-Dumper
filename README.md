# Team Unity Tree Sprite Cutter
Your local RGB dumper and Team Unity Tree sprite tools.

## 🚀 Quick Start

**Web App (GitHub Pages)**: https://redissusj-stack.github.io/RGB-Dumper/

**Problem**: Account creation doesn't work without the backend

**Solution**: Deploy the auth backend (takes 2 minutes):

### Deploy Backend to Render (Free)
1. Go to https://render.com and sign up (free)
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Authorize and select this repository
5. Fill in:
   - **Name**: `rgb-dumper-auth-api`
   - **Start Command**: `cd "Team unity tree test" && python3 auth-server.py`
   - **Plan**: Free
6. Click "Create Web Service"
7. Wait ~2 minutes for deployment
8. **DONE!** The app will automatically use your deployed backend

After deployment, account creation will work globally from any region.

## GitHub Pages

The site is deployed by `.github/workflows/pages.yml`.

1. Push the repository to GitHub.
2. Open **Settings > Pages**.
3. Set **Build and deployment > Source** to **GitHub Actions**.
4. Open the URL shown in the workflow deployment, normally:
	`https://redissusj-stack.github.io/RGB-Dumper/`

The first deployment can take a minute after the push. The workflow publishes the app from `Team unity tree test/`.
