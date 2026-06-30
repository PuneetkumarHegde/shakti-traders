/* ============================================================
   auth.js — simple local authentication
   Username: shakti  Password: 122333
============================================================ */

const AUTH = {
  USERNAME: 'shakti',
  PASSWORD: '122333',
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
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
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

function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  refreshDashboard();
  renderPurchaseTable();
  renderSellingTable();
}
