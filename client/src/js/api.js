// api.js - Backend API communication layer

const BASE = '/api';

function getToken() {
  return localStorage.getItem('vp_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid - clear and redirect to login
      localStorage.removeItem('vp_token');
      localStorage.removeItem('vp_user');
      window.location.reload();
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ============== Auth API ==============
export async function loginAPI(username, password) {
  return request('POST', '/auth/login', { username, password });
}

export async function registerAPI(data) {
  return request('POST', '/auth/register', data);
}

export async function getMeAPI() {
  return request('GET', '/auth/me');
}

export async function updateMeAPI(data) {
  return request('PUT', '/auth/me', data);
}

// ============== Products API ==============
export async function getProductsAPI() {
  return request('GET', '/products');
}

export async function exchangeProductAPI(productId) {
  return request('POST', `/products/${productId}/exchange`);
}

// ============== Points API ==============
export async function getPointsHistoryAPI(limit = 50) {
  return request('GET', `/points/history?limit=${limit}`);
}

export async function earnPointsAPI(points = null) {
  const body = points ? { points, description: '完成任务' } : {};
  return request('POST', '/points/earn', body);
}

export async function getLeaderboardAPI() {
  return request('GET', '/points/leaderboard');
}

// ============== Announcements API ==============
export async function getAnnouncementsAPI() {
  return request('GET', '/announcements');
}

export async function createAnnouncementAPI(title, content) {
  return request('POST', '/announcements', { title, content });
}

export async function markReadAPI(annId) {
  return request('POST', `/announcements/${annId}/read`);
}

// ============== Admin API ==============
export async function getAdminStatsAPI() {
  return request('GET', '/admin/stats');
}

export async function getAdminUsersAPI(q = '') {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  return request('GET', '/admin/users' + query);
}

export async function adjustBalanceAPI(userId, delta, reason) {
  return request('PUT', `/admin/users/${userId}/balance`, { delta, reason });
}

export async function updateProductAPI(productId, data) {
  return request('PUT', `/admin/products/${productId}`, data);
}

export async function deleteAnnouncementAPI(annId) {
  return request('DELETE', `/admin/announcements/${annId}`);
}
