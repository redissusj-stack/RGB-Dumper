// Set the remote auth API URL before auth-system.js loads
window.AUTH_API_URL = (function() {
  // Detect if we're on GitHub Pages
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  if (isGitHubPages) {
    // Use the deployed Render backend
    return 'https://rgb-dumper-auth-api.onrender.com/api/auth/state';
  }
  
  // Local development or Codespace
  return '/api/auth/state';
})();
