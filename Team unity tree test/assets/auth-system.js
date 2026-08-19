(function (root) {
  const STORAGE_KEY = 'team-unity-auth-users';
  const DELETED_KEY = 'team-unity-deleted-users';
  const SESSION_KEY = 'team-unity-current-user';
  const DEFAULT_NAME_COLOR = '#f59e0b';
  const AUTH_API_URL = (root.AUTH_API_URL || '/api/auth/state');

  function getMemory() {
    root.__teamUnityAuthMemory = root.__teamUnityAuthMemory || {};
    return root.__teamUnityAuthMemory;
  }

  function readSharedState() {
    if (typeof XMLHttpRequest === 'undefined' || !/^https?:\/\//i.test(AUTH_API_URL) && AUTH_API_URL.charAt(0) !== '/') {
      return null;
    }

    try {
      const request = new XMLHttpRequest();
      request.open('GET', AUTH_API_URL, false);
      request.setRequestHeader('Accept', 'application/json');
      request.send();
      if (request.status >= 200 && request.status < 300) {
        const state = JSON.parse(request.responseText);
        return { users: state.users || {}, deletedUsers: state.deletedUsers || {} };
      }
    } catch (error) {
      // Use the browser store while the shared service is unavailable.
    }

    return null;
  }

  function writeSharedState(users, deletedUsers) {
    try {
      const request = new XMLHttpRequest();
      request.open('PUT', AUTH_API_URL, false);
      request.setRequestHeader('Content-Type', 'application/json');
      request.send(JSON.stringify({ users, deletedUsers }));
      return request.status >= 200 && request.status < 300;
    } catch (error) {
      return false;
    }
  }

  function persistDeletedUsers(data) {
    const state = readSharedState();
    if (state && writeSharedState(state.users, data)) return true;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DELETED_KEY, JSON.stringify(data));
        return true;
      }
    } catch (error) {
      // Fall through.
    }

    getMemory()[DELETED_KEY] = data;
    return true;
  }

  function safeRead() {
    const sharedState = readSharedState();
    if (sharedState) return sharedState.users;

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      }
    } catch (error) {
      // Fall back to in-memory store.
    }

    return getMemory()[STORAGE_KEY] || {};
  }

  function safeWrite(data) {
    const sharedState = readSharedState();
    if (sharedState && writeSharedState(data, sharedState.deletedUsers)) return true;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      }
    } catch (error) {
      // Fall back to in-memory store.
    }

    getMemory()[STORAGE_KEY] = data;
    return true;
  }

  function getSessionUser() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const sessionUser = sessionStorage.getItem(SESSION_KEY);
        if (sessionUser) return sessionUser;
      }
      if (typeof localStorage !== 'undefined') {
        const legacyUser = localStorage.getItem(SESSION_KEY) || '';
        if (legacyUser && typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(SESSION_KEY, legacyUser);
          localStorage.removeItem(SESSION_KEY);
        }
        return legacyUser;
      }
    } catch (error) {
      // Fall through.
    }

    return getMemory()[SESSION_KEY] || '';
  }

  function setSessionUser(username) {
    const value = String(username || '').trim();

    try {
      if (typeof sessionStorage !== 'undefined') {
        if (!value) {
          sessionStorage.removeItem(SESSION_KEY);
        } else {
          sessionStorage.setItem(SESSION_KEY, value);
        }
        if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
        return true;
      }
    } catch (error) {
      // Fall through.
    }

    if (!value) {
      delete getMemory()[SESSION_KEY];
    } else {
      getMemory()[SESSION_KEY] = value;
    }

    return true;
  }

  function generateRandomToken(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  function normalizeUsername(username) {
    return String(username || '').trim();
  }

  function normalizeNameColor(color) {
    const value = String(color || '').trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_NAME_COLOR;
  }

  function canonicalUsername(username) {
    return normalizeUsername(username).toLowerCase();
  }

  function createUser(username) {
    const cleaned = normalizeUsername(username);

    if (!cleaned) {
      return { success: false, message: 'Username is required.' };
    }

    const users = safeRead();
    const userKey = canonicalUsername(cleaned);
    if (users[userKey]) {
      if (users[userKey].isAdmin && canonicalUsername(cleaned) === 'kanjigar') {
        return { success: true, user: users[userKey] };
      }
      return { success: false, message: 'That username already exists.' };
    }

    const isAdminAccount = canonicalUsername(cleaned) === 'kanjigar';

    users[userKey] = {
      username: cleaned,
      isAdmin: isAdminAccount,
      isAllowed: isAdminAccount || false,
      token: isAdminAccount ? 'KANJIGAR-ADMIN' : generateRandomToken(),
      tokenUsed: false,
      tokenCreatedAt: isAdminAccount ? new Date().toISOString() : null,
      tokenUsedAt: null,
      reason: isAdminAccount ? 'Admin account' : 'Pending admin approval',
      createdAt: new Date().toISOString(),
      sessionActive: false,
      nameColor: DEFAULT_NAME_COLOR,
    };

    if (!safeWrite(users)) {
      return { success: false, message: 'Browser storage is unavailable.' };
    }

    return { success: true, user: users[cleaned] };
  }

  function getUser(username) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)] || null;
    if (user) user.nameColor = normalizeNameColor(user.nameColor);
    return user;
  }

  function listUsers() {
    const users = Object.values(safeRead()).sort((a, b) => a.username.localeCompare(b.username));
    return users.map((user) => ({
      ...user,
      isAdmin: Boolean(user.isAdmin),
      nameColor: normalizeNameColor(user.nameColor),
    }));
  }

  function setNameColor(username, color) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const value = String(color || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      return { success: false, message: 'Choose a valid color.' };
    }

    user.nameColor = value.toLowerCase();
    if (!safeWrite(users)) {
      return { success: false, message: 'Could not save name color.' };
    }

    return { success: true, message: `Name color updated for user "${username}".`, user };
  }

  function ensureAdminAccount() {
    const users = safeRead();
    const adminName = 'kanjigar';

    if (!users[adminName]) {
      users[adminName] = {
        username: 'kanjigar',
        isAdmin: true,
        isAllowed: true,
        token: 'KANJIGAR-ADMIN',
        tokenUsed: false,
        tokenCreatedAt: new Date().toISOString(),
        tokenUsedAt: null,
        reason: 'Admin account',
        createdAt: new Date().toISOString(),
        sessionActive: false,
        nameColor: DEFAULT_NAME_COLOR,
      };
      safeWrite(users);
    }

    return users[adminName];
  }

  function setUserAccess(username, payload = {}) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const nextAllow = Boolean(payload.isAllowed);
    const nextToken = String(payload.token || '').trim();
    const nextReason = String(payload.reason || '').trim();

    user.isAllowed = nextAllow;
    user.reason = nextReason;

    if (nextAllow && nextToken) {
      user.token = nextToken;
      user.tokenUsed = false;
      user.tokenCreatedAt = new Date().toISOString();
      user.tokenUsedAt = null;
    } else {
      user.token = '';
      user.tokenUsed = false;
      user.tokenCreatedAt = null;
      user.tokenUsedAt = null;
    }

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not save access changes.' };
    }

    return { success: true, user };
  }

  function signIn(username, token) {
    const cleaned = normalizeUsername(username);
    const suppliedToken = String(token || '').trim();
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (user.tokenUsed) {
      if (user.sessionActive) {
        setSessionUser(cleaned);
        return { success: true, user };
      }

      return {
        success: false,
        message: 'This token has already been used. Please contact the admin for a new one.',
      };
    }

    if (user.isAdmin && user.token === 'KANJIGAR-ADMIN') {
      user.tokenUsed = true;
      user.tokenUsedAt = new Date().toISOString();
      user.token = '';
      user.isAllowed = true;
      user.sessionActive = true;
      if (!safeWrite(users)) {
        return { success: false, message: 'Could not save sign-in.' };
      }
      setSessionUser(cleaned);
      return { success: true, user };
    }

    if (!user.isAllowed) {
      return {
        success: false,
        message: user.reason ? `Access denied. Reason: ${user.reason}` : 'Access denied. You do not have a valid token.',
      };
    }

    if (!user.token) {
      return {
        success: false,
        message: 'No active token assigned. Please ask an admin for access.',
      };
    }

    if (user.token !== suppliedToken) {
      return { success: false, message: 'Incorrect token.' };
    }

    user.tokenUsed = true;
    user.tokenUsedAt = new Date().toISOString();
    user.token = '';
    user.isAllowed = true;
    user.sessionActive = true;

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not save sign-in.' };
    }

    setSessionUser(cleaned);

    return { success: true, user };
  }

  function signOut() {
    const username = getSessionUser();
    if (!username) {
      return { success: true };
    }

    const users = safeRead();
    const user = users[canonicalUsername(username)];
    if (user) {
      user.sessionActive = false;
      safeWrite(users);
    }

    setSessionUser('');
    return { success: true };
  }

  function promoteToAdmin(username) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (user.isAdmin) {
      return { success: true, message: 'User is already an admin.', user };
    }

    user.isAdmin = true;
    user.isAllowed = true;

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not save admin promotion.' };
    }

    return { success: true, message: `${user.username} is now an admin.`, user };
  }

  function demoteFromAdmin(username) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (!user.isAdmin) {
      return { success: true, message: 'User is already a regular user.', user };
    }

    user.isAdmin = false;

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not save demotion.' };
    }

    return { success: true, message: `${user.username} is now a regular user.`, user };
  }

  function deleteUser(username, reason = '') {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const userKey = canonicalUsername(cleaned);

    if (!users[userKey]) {
      return { success: false, message: 'User not found.' };
    }

    const user = users[userKey];
    const reasonText = String(reason || '').trim();
    const message = reasonText
      ? `User "${username}" deleted. Reason: ${reasonText}`
      : `User "${username}" deleted.`;

    const deletedUsers = getDeletedUsers();
    deletedUsers[userKey] = {
      ...user,
      deletedAt: new Date().toISOString(),
      deleteReason: reasonText,
    };
    persistDeletedUsers(deletedUsers);

    delete users[userKey];

    if (getSessionUser() && canonicalUsername(getSessionUser()) === userKey) {
      setSessionUser('');
    }

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not delete user.' };
    }

    return { success: true, message };
  }

  function getDeletedUsers() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(DELETED_KEY);
        return raw ? JSON.parse(raw) : {};
      }
    } catch (error) {
      // Fall back to in-memory store.
    }

    return getMemory()[DELETED_KEY] || {};
  }

  function permanentlyDeleteUser(username) {
    const cleaned = normalizeUsername(username);
    const userKey = canonicalUsername(cleaned);
    
    // Only kanjigar can permanently delete
    const currentUser = getSessionUser();
    if (canonicalUsername(currentUser) !== 'kanjigar') {
      return { success: false, message: 'Only admin can permanently delete users.' };
    }

    try {
      const deletedUsers = JSON.parse(localStorage.getItem(DELETED_KEY) || '{}');
      delete deletedUsers[userKey];
      localStorage.setItem(DELETED_KEY, JSON.stringify(deletedUsers));
    } catch (error) {
      const memory = getMemory();
      const deletedUsers = memory[DELETED_KEY] || {};
      delete deletedUsers[userKey];
      memory[DELETED_KEY] = deletedUsers;
    }

    return { success: true, message: `User "${username}" permanently deleted.` };
  }

  function revokeUserToken(username) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    user.token = '';
    user.tokenUsed = false;
    user.tokenCreatedAt = null;
    user.tokenUsedAt = null;

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not revoke token.' };
    }

    return { success: true, message: `Token revoked for user "${username}".`, user };
  }

  function setCustomToken(username, customToken) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const token = String(customToken || '').trim();
    if (!token) {
      return { success: false, message: 'Token cannot be empty.' };
    }

    user.token = token;
    user.tokenUsed = false;
    user.tokenCreatedAt = new Date().toISOString();
    user.tokenUsedAt = null;
    user.isAllowed = true;

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not set custom token.' };
    }

    return { success: true, message: `Custom token set for user "${username}".`, user };
  }

  function generateNewToken(username) {
    const cleaned = normalizeUsername(username);
    const users = safeRead();
    const user = users[canonicalUsername(cleaned)];

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const newToken = generateRandomToken();
    user.token = newToken;
    user.tokenUsed = false;
    user.tokenCreatedAt = new Date().toISOString();
    user.tokenUsedAt = null;
    user.isAllowed = true;

    if (!safeWrite(users)) {
      return { success: false, message: 'Could not generate new token.' };
    }

    return { success: true, message: `New token generated for user "${username}".`, user, token: newToken };
  }

  const api = {
    STORAGE_KEY,
    DELETED_KEY,
    SESSION_KEY,
    createUser,
    getUser,
    listUsers,
    ensureAdminAccount,
    setUserAccess,
    signIn,
    signOut,
    getSessionUser,
    setSessionUser,
    generateRandomToken,
    promoteToAdmin,
    demoteFromAdmin,
    deleteUser,
    getDeletedUsers,
    permanentlyDeleteUser,
    revokeUserToken,
    setCustomToken,
    generateNewToken,
    setNameColor,
    DEFAULT_NAME_COLOR,
  };

  ensureAdminAccount();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AuthManager = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
