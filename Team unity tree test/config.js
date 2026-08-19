// Auth Configuration
// On GitHub Pages, uses localStorage with auto-sync via GitHub

window.AUTH_CONFIG = {
  // Backend options (in priority order)
  primaryBackend: 'https://rgb-dumper-auth-api.onrender.com/api/auth/state',
  githubBackend: 'https://raw.githubusercontent.com/redissusj-stack/RGB-Dumper/main/auth-users.json',
  
  // Use localStorage as primary storage on GitHub Pages
  useLocalStorage: true,
  
  // Detect environment
  isGitHubPages: window.location.hostname.includes('github.io'),
  isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  isCodespace: window.location.hostname.includes('app.github.dev'),
};

// For GitHub Pages, skip backend entirely and use localStorage
if (window.AUTH_CONFIG.isGitHubPages) {
  // Load shared users from repo (read-only fallback)
  window.AUTH_CONFIG.readOnlyBackup = 'https://raw.githubusercontent.com/redissusj-stack/RGB-Dumper/main/auth-users.json';
  
  // Try to merge in admin accounts from the repo
  window.onAuthSystemReady = function() {
    if (typeof AuthManager === 'undefined') return;
    
    // Ensure kanjigar admin is always available
    AuthManager.ensureAdminAccount();
    
    // Try to sync users from repo as read-only
    fetch(window.AUTH_CONFIG.readOnlyBackup)
      .then(r => r.json())
      .then(data => {
        // Merge in any repo-based admin users
        if (data.users && data.users.kanjigar && !AuthManager.getUser('kanjigar')) {
          // Repo has an admin, add them locally
          const stored = JSON.parse(localStorage.getItem('team-unity-auth-users') || '{}');
          stored.kanjigar = data.users.kanjigar;
          localStorage.setItem('team-unity-auth-users', JSON.stringify(stored));
        }
      })
      .catch(() => {}); // Fail silently
  };
  
  // Signal that auth is ready
  setTimeout(window.onAuthSystemReady, 100);
}

// Set AUTH_API_URL for backward compatibility
window.AUTH_API_URL = window.AUTH_CONFIG.isGitHubPages 
  ? 'https://rgb-dumper-auth-api.onrender.com/api/auth/state' // Try backend first
  : '/api/auth/state'; // Local dev
