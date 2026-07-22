/* ============================================================
   auth.js — Simple local authentication (UNCHANGED)
   Login credentials are hardcoded (not Supabase Auth).
   Session is still sessionStorage — that is correct;
   sessionStorage is fine for in-tab session management.
   Username: shakti  |  Password: 122333
============================================================ */

const AUTH = {
  USERNAME:    'shakti',
  PASSWORD:    '122333',
  SESSION_KEY: 'st_session',

  isLoggedIn() {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true';
  },
  login(username, password) {
    if (username === this.USERNAME && password === this.PASSWORD) {
      sessionStorage.setItem(this.SESSION_KEY, 'true');
      return true;
    }
    return false;
  },
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  }
};

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user    = document.getElementById('loginUser').value.trim();
  const pass    = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('loginError');

  if (AUTH.login(user, pass)) {
    errorEl.textContent = '';
    showApp();
  } else {
    errorEl.textContent = 'Invalid username or password.';
  }
});

document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.getElementById('quickLogout').addEventListener('click', doLogout);

function doLogout() {
  AUTH.logout();
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('loginForm').reset();
}

/* showApp is async because renderPurchaseTable / renderSellingTable
   / refreshDashboard now all await Supabase. */
async function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  showLoading(true);
  try {
    await refreshDashboard();
    await renderPurchaseTable();
    await renderSellingTable();
  } finally {
    showLoading(false);
  }
}
