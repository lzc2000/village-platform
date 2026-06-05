// auth.js - Authentication and user session management

import { loginAPI, registerAPI, getMeAPI, updateMeAPI } from './api.js';
import { showToast } from './utils.js';

// Current user state (set after login/register or fetch from /me)
export let currentUser = null;

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!getToken() && !!currentUser;
}

export function isOfficial() {
  return currentUser && currentUser.role === 'official';
}

export function getToken() {
  return localStorage.getItem('vp_token');
}

function saveSession(token, user) {
  localStorage.setItem('vp_token', token);
  localStorage.setItem('vp_user', JSON.stringify(user));
  currentUser = user;
}

export function clearSession() {
  localStorage.removeItem('vp_token');
  localStorage.removeItem('vp_user');
  currentUser = null;
}

export async function initAuth() {
  const token = getToken();
  if (!token) {
    showAuthPage();
    return false;
  }
  try {
    const data = await getMeAPI();
    currentUser = data.user;
    return true;
  } catch (e) {
    clearSession();
    showAuthPage();
    return false;
  }
}

export async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showToast('请填写用户名和密码');
    return;
  }

  try {
    const data = await loginAPI(username, password);
    saveSession(data.token, data.user);
    hideAuthPage();
  } catch (e) {
    showToast(e.message || '登录失败');
  }
}

export async function handleRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const name = document.getElementById('regName').value.trim();
  const role = document.getElementById('regRole').value;
  const id_card = document.getElementById('regIdCard').value.trim();
  const address = document.getElementById('regAddress').value.trim();

  if (!username || !password || !name) {
    showToast('请填写用户名、密码和姓名');
    return;
  }
  if (password.length < 4) {
    showToast('密码至少4位');
    return;
  }

  try {
    const data = await registerAPI({ username, password, name, role, id_card, address });
    saveSession(data.token, data.user);
    hideAuthPage();
  } catch (e) {
    showToast(e.message || '注册失败');
  }
}

export function handleLogout() {
  if (!confirm('确认退出登录？')) return;
  clearSession();
  window.location.reload();
}

// UI toggle
export function showAuthPage() {
  document.getElementById('authPage').style.display = 'flex';
  document.getElementById('appMain').style.display = 'none';
}

export function hideAuthPage() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('appMain').style.display = 'flex';
  // Trigger main app initialization
  window.dispatchEvent(new CustomEvent('auth-ready'));
}

export function toggleAuthMode() {
  const isLogin = document.getElementById('authFormLogin').style.display !== 'none';
  document.getElementById('authFormLogin').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authFormRegister').style.display = isLogin ? 'block' : 'none';
  document.getElementById('authTitle').textContent = isLogin ? '注册账号' : '登录';
  document.getElementById('authToggleText').textContent = isLogin ? '已有账号？去登录' : '没有账号？去注册';
}

// Profile editing
export function openEditForm() {
  document.getElementById('editName').value = currentUser.name;
  document.getElementById('editID').value = currentUser.id_card || '';
  document.getElementById('editAddr').value = currentUser.address || '';
  document.getElementById('editModalOverlay').classList.add('show');
}

export function closeEditForm() {
  document.getElementById('editModalOverlay').classList.remove('show');
}

export async function saveEditForm() {
  const name = document.getElementById('editName').value.trim();
  const id_card = document.getElementById('editID').value.trim();
  const address = document.getElementById('editAddr').value.trim();

  if (!name) {
    showToast('姓名不能为空');
    return;
  }

  try {
    const data = await updateMeAPI({ name, id_card, address });
    currentUser = data.user;
    localStorage.setItem('vp_user', JSON.stringify(currentUser));
    closeEditForm();
    showToast('✅ 信息已保存');
    window.dispatchEvent(new CustomEvent('profile-updated'));
  } catch (e) {
    showToast(e.message || '保存失败');
  }
}
