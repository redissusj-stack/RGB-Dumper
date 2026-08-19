# Deploy to Render (One Click)

Click this button to deploy the auth backend to Render in 2 minutes:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/redissusj-stack/RGB-Dumper)

After deployment completes:
1. Copy the service URL (e.g., `https://rgb-dumper-auth-api.onrender.com`)
2. The frontend will automatically connect to it
3. Account creation will work globally

**What happens:**
- Render creates a web service running the Python auth server
- It persists account data automatically
- The GitHub Pages frontend connects to it via CORS
- Users can create accounts, admins can approve, users can sign in

**Cost**: Free (Render's free tier supports this app)

---

If the button doesn't work, create manually:
1. Go to https://render.com
2. New → Web Service
3. Connect repo: `redissusj-stack/RGB-Dumper`
4. Name: `rgb-dumper-auth-api`
5. Start Command: `cd "Team unity tree test" && python3 auth-server.py`
6. Plan: Free
7. Deploy
