// Auth Configuration
// This works in three modes:
// 1. With Render backend deployed (full shared functionality)
// 2. With localStorage fallback (works locally, syncs via GitHub)
// 3. With GitHub raw content (read-only, for testing)

window.AUTH_CONFIG = {
  // Primary backend (deploy to Render for production)
  primaryBackend: 'https://rgb-dumper-auth-api.onrender.com/api/auth/state',
  
  // Fallback: GitHub-hosted auth file (read-only for now)
  githubBackend: 'https://raw.githubusercontent.com/redissusj-stack/RGB-Dumper/main/auth-users.json',
  
  // Use localStorage as cache/fallback
  useLocalStorage: true,
  
  // Detect where we're running
  isGitHubPages: window.location.hostname.includes('github.io'),
  isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// Set AUTH_API_URL for compatibility with existing code
window.AUTH_API_URL = window.AUTH_CONFIG.isGitHubPages 
  ? window.AUTH_CONFIG.primaryBackend 
  : '/api/auth/state';
