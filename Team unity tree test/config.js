// Set the remote auth API URL before auth-system.js loads
// Update this URL to point to your deployed backend
window.AUTH_API_URL = (function() {
  // Try to detect if we're on GitHub Pages
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  if (isGitHubPages) {
    // Use the deployed backend URL (Render, Railway, etc.)
    // This will be set via environment or updated manually
    return window.__AUTH_BACKEND_URL || 'https://rgb-dumper-auth.onrender.com/api/auth/state';
  }
  
  // Local development or Codespace
  return '/api/auth/state';
})();
