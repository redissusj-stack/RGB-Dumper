(function () {
  function getCurrentUser() {
    return typeof AuthManager === 'undefined' ? '' : AuthManager.getSessionUser();
  }

  function getLoginPath() {
    const pathname = window.location.pathname || '';
    const isInPagesFolder = pathname.includes('/pages/');
    return isInPagesFolder ? '../auth-login.html' : 'auth-login.html';
  }

  function redirectIfNeeded() {
    // If AuthManager isn't ready yet, retry in a moment
    if (typeof AuthManager === 'undefined') {
      setTimeout(redirectIfNeeded, 100);
      return;
    }

    const currentUser = getCurrentUser();
    
    // If Kanjigar is signed in, always allow access (special admin case)
    if (currentUser && currentUser.toLowerCase() === 'kanjigar') {
      const user = AuthManager.getUser(currentUser);
      if (user && user.isAdmin) {
        return; // Let Kanjigar through
      }
    }

    if (!currentUser) {
      window.location.href = getLoginPath();
      return;
    }

    const user = AuthManager.getUser(currentUser);
    if (!user) {
      window.location.href = getLoginPath();
      return;
    }

    // Allow if they have active session or are approved
    if (!user.sessionActive && !user.isAllowed) {
      window.location.href = getLoginPath();
      return;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', redirectIfNeeded);
  }
})();
