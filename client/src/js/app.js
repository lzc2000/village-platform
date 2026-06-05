// app.js - Main application logic and page rendering

import { showToast, formatTime, pad, openModal, closeModal } from './utils.js';
import {
  getProductsAPI, exchangeProductAPI, getPointsHistoryAPI,
  earnPointsAPI, getLeaderboardAPI, getAnnouncementsAPI,
  createAnnouncementAPI, markReadAPI, getAdminStatsAPI,
  getAdminUsersAPI, adjustBalanceAPI, updateProductAPI, deleteAnnouncementAPI
} from './api.js';
import { getUser, isOfficial, openEditForm, closeEditForm, saveEditForm, handleLogout } from './auth.js';
import { switchPage, switchTab, getCurrentPage } from './router.js';

// ==================== State ====================
let products = [];
let balance = 0;

function getUserBalance() {
  const u = getUser();
  return u ? u.balance : 0;
}

// ==================== Balance Display ====================
export function renderBalance(animate = false) {
  const u = getUser();
  balance = u ? u.balance : 0;
  const el = document.getElementById('balanceNum');
  const el2 = document.getElementById('profileBalance');
  const el3 = document.getElementById('pointsBalance');
  const el4 = document.getElementById('headerName');
  if (el) el.textContent = balance;
  if (el2) el2.textContent = balance;
  if (el3) el3.textContent = balance;
  if (el4 && u) el4.textContent = u.name;

  if (animate && el) {
    el.classList.remove('bounce');
    void el.offsetWidth;
    el.classList.add('bounce');
    setTimeout(() => el.classList.remove('bounce'), 600);
  }

  updateAdminBalanceDisplay();
}

// ==================== Products / Supermarket ====================
export async function renderProducts() {
  try {
    const data = await getProductsAPI();
    products = data.products;
  } catch (e) {
    products = [];
    return;
  }

  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const bal = getUserBalance();
  grid.innerHTML = products.map(p => {
    const noStock = p.stock <= 0;
    const noPts = !noStock && bal < p.points;
    let btnTxt = '立即兑换';
    let disabled = '';
    if (noStock) { btnTxt = '已兑完'; disabled = 'disabled'; }
    else if (noPts) { btnTxt = '积分不足'; disabled = 'disabled'; }
    return `
    <div class="product-card">
      <div class="product-emoji">${p.emoji}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-pts">
        <span class="product-pts-n">${p.points}</span>
        <span class="product-pts-u">积分</span>
      </div>
      <div class="product-stock">库存 ${p.stock}</div>
      <button class="btn-ex" ${disabled} onclick="window._openExchangeModal(${p.id})">${btnTxt}</button>
    </div>`;
  }).join('');
}

window._openExchangeModal = function(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.stock <= 0 || getUserBalance() < p.points) return;
  const remain = getUserBalance() - p.points;
  document.getElementById('mEmoji').textContent = p.emoji;
  document.getElementById('mTitle').textContent = `兑换 ${p.name}`;
  document.getElementById('mDesc').textContent = '确认兑换此商品？积分将立即扣减。';
  document.getElementById('mCost').textContent = `-${p.points} 积分`;
  document.getElementById('mRemain').textContent = `兑换后剩余：${remain} 分`;
  document.getElementById('mConfirm').onclick = () => doExchange(id);
  openModal('modalOverlay');
};

export async function doExchange(id) {
  try {
    const data = await exchangeProductAPI(id);
    closeModal('modalOverlay');
    // Update local user balance
    const u = getUser();
    if (u) u.balance = data.balance;
    renderBalance(true);
    await renderProducts();
    await renderHistory();
    if (getCurrentPage() === 3) await renderProfileInfo();
    if (getCurrentPage() === 4) await renderAdminDashboard();
    showToast(`🎉 兑换成功！剩余积分：${data.balance}`);
  } catch (e) {
    closeModal('modalOverlay');
    showToast(e.message || '兑换失败');
  }
}

// ==================== Exchange History ====================
export async function renderHistory() {
  try {
    const data = await getPointsHistoryAPI(20);
    const exchanges = data.logs.filter(l => l.type === 'spend');
    const wrap = document.getElementById('historyWrap');
    const wrap2 = document.getElementById('profileExchangeWrap');
    if (!wrap && !wrap2) return;

    const html = !exchanges.length
      ? '<div class="empty-state"><div class="empty-state-icon">🛍️</div><div>还没有兑换记录</div></div>'
      : '<div class="card-list">' + exchanges.map(r => `
        <div class="card-item">
          <div class="card-item-left">
            <div class="card-item-icon">🎁</div>
            <div>
              <div class="card-item-title">${r.description}</div>
              <div class="card-item-sub">${formatTime(r.created_at)}</div>
            </div>
          </div>
          <div class="card-item-right">-${r.points} 分</div>
        </div>`).join('') + '</div>';

    if (wrap) wrap.innerHTML = html;
    if (wrap2) wrap2.innerHTML = html;
  } catch (e) {
    // silently fail
  }
}

// ==================== Points Detail ====================
export async function renderPointsDetail() {
  document.getElementById('pointsBalance').textContent = getUserBalance();
  const wrap = document.getElementById('pointsDetailWrap');
  if (!wrap) return;

  try {
    const data = await getPointsHistoryAPI(50);
    if (!data.logs.length) {
      wrap.innerHTML = '<div class="empty-state">暂无积分记录</div>';
      return;
    }
    wrap.innerHTML = '<div class="card-list">' + data.logs.map(r => `
      <div class="points-item">
        <div class="points-item-left">
          <div class="points-item-desc">${r.description}</div>
          <div class="points-item-time">${formatTime(r.created_at)}</div>
        </div>
        <div class="points-item-right ${r.type === 'earn' ? 'points-plus' : 'points-minus'}">
          ${r.type === 'earn' ? '+' : '-'}${r.points}
        </div>
      </div>`).join('') + '</div>';
  } catch (e) {
    wrap.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

// ==================== Leaderboard ====================
export async function renderLeaderboard() {
  const wrap = document.getElementById('lbList');
  if (!wrap) return;

  try {
    const data = await getLeaderboardAPI();
    const badgeLbl = i => ['🥇', '🥈', '🥉'][i] || (i + 1);
    const colors = ['#FFD700','#C8C8C8','#CD7F32','#F0EBE4','#F0EBE4'];
    const textColors = ['#5C3D00','#3A3A3A','#fff','#999','#999'];
    wrap.innerHTML = data.leaderboard.map((r, i) => `
      <div class="card-item" style="${r.is_me ? 'background:#FFF8E8;margin:0 -16px;padding:12px 16px;border-radius:10px;border-bottom:none' : ''}">
        <div class="card-item-left">
          <div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:${colors[i]||'#F0EBE4'};color:${textColors[i]||'#999'};margin-right:8px">${badgeLbl(i)}</div>
          <div>
            <div class="card-item-title">${r.name}${r.is_me ? '<span style="font-size:10px;background:#5B9A6B;color:#fff;padding:2px 7px;border-radius:10px;margin-left:6px;font-weight:500">我</span>' : ''}</div>
          </div>
        </div>
        <div class="card-item-right">${r.score}</div>
      </div>`).join('');
  } catch (e) {
    wrap.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

// ==================== Announcements ====================
export async function renderAnnouncements() {
  // Publish button (officials only)
  const btnWrap = document.getElementById('publishBtnWrap');
  if (btnWrap) {
    btnWrap.innerHTML = isOfficial()
      ? '<button class="btn-publish" onclick="window._openPublishForm()"><i class="fa-solid fa-pen"></i> 发布通知</button>'
      : '';
  }

  const wrap = document.getElementById('announcementsWrap');
  if (!wrap) return;

  try {
    const data = await getAnnouncementsAPI();
    const announcements = data.announcements;
    wrap.innerHTML = announcements.map(a => `
      <div class="announcement ${!a.is_read ? 'unread' : ''}" onclick="window._openAnnDetail(${a.id})">
        <div class="ann-title">${a.title}</div>
        <div class="ann-time">${formatTime(a.created_at)} · ${a.publisher_name}</div>
        <div class="ann-content">${a.content}</div>
      </div>`).join('');
    window._announcementsCache = announcements;
  } catch (e) {
    wrap.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

window._announcementsCache = [];

window._openAnnDetail = function(id) {
  const ann = window._announcementsCache.find(a => a.id === id);
  if (!ann) return;

  document.getElementById('detailTitle').textContent = ann.title;
  document.getElementById('detailTime').textContent = formatTime(ann.created_at) + ' · ' + ann.publisher_name;
  document.getElementById('detailContent').textContent = ann.content;

  let btnsHtml = '<button class="btn-modal-cancel" onclick="window._closeDetailModal()">关闭</button>';
  if (!ann.is_read) {
    btnsHtml += `<button class="btn-confirm" style="flex:2" onclick="window._markAsRead(${ann.id})"><i class="fa-solid fa-check"></i> 已读（+1分）</button>`;
  }
  document.getElementById('detailBtns').innerHTML = btnsHtml;
  openModal('detailModalOverlay');
};

window._closeDetailModal = () => closeModal('detailModalOverlay');

window._onDetailOverlayClick = (e) => {
  if (e.target === document.getElementById('detailModalOverlay')) closeModal('detailModalOverlay');
};

window._markAsRead = async function(id) {
  try {
    const data = await markReadAPI(id);
    const u = getUser();
    if (u) u.balance = data.balance;
    renderBalance(true);
    closeModal('detailModalOverlay');
    await renderAnnouncements();
    showToast('✨ 已读并获得 1 积分！');
  } catch (e) {
    showToast(e.message || '操作失败');
  }
};

window._openPublishForm = function() {
  document.getElementById('pubTitle').value = '';
  document.getElementById('pubContent').value = '';
  openModal('publishModalOverlay');
};

window._closePublishForm = () => closeModal('publishModalOverlay');

window._onPublishOverlayClick = (e) => {
  if (e.target === document.getElementById('publishModalOverlay')) closeModal('publishModalOverlay');
};

window._publishNotification = async function() {
  const title = document.getElementById('pubTitle').value.trim();
  const content = document.getElementById('pubContent').value.trim();
  if (!title || !content) { showToast('请填写标题和内容'); return; }
  try {
    await createAnnouncementAPI(title, content);
    closeModal('publishModalOverlay');
    await renderAnnouncements();
    showToast('📢 通知已发布！');
  } catch (e) {
    showToast(e.message || '发布失败');
  }
};

// ==================== Profile ====================
export function renderProfileInfo() {
  const u = getUser();
  if (!u) return;

  document.getElementById('profileName').textContent = u.name;
  document.getElementById('profileBalance').textContent = u.balance;
  document.getElementById('headerName').textContent = u.name;

  const roleDisplay = u.role === 'official' ? '村干部' : '村民';
  document.getElementById('profileInfoView').innerHTML = `
    <div class="card-item">
      <div class="card-item-title">姓名</div>
      <div class="card-item-right" style="font-size:14px;font-weight:400">${u.name}</div>
    </div>
    <div class="card-item">
      <div class="card-item-title">身份</div>
      <div class="card-item-right" style="font-size:14px;font-weight:400">${roleDisplay}</div>
    </div>
    <div class="card-item">
      <div class="card-item-title">证件号</div>
      <div class="card-item-right" style="font-size:12px;font-weight:400">${u.id_card || '未填写'}</div>
    </div>
    <div class="card-item">
      <div class="card-item-title">住址</div>
      <div class="card-item-right" style="font-size:13px;font-weight:400">${u.address || '未填写'}</div>
    </div>
    <div class="card-item">
      <div class="card-item-title">加入时间</div>
      <div class="card-item-right" style="font-size:12px;font-weight:400">${u.created_at ? u.created_at.substring(0, 10) : '-'}</div>
    </div>`;

  document.getElementById('profileExchanges').textContent = '...';
  getPointsHistoryAPI(100).then(data => {
    document.getElementById('profileExchanges').textContent =
      data.logs.filter(l => l.type === 'spend').length;
  }).catch(() => {});
}

// ==================== Earn Points ====================
window._simulateEarn = async function() {
  try {
    const data = await earnPointsAPI();
    const u = getUser();
    if (u) u.balance = data.balance;
    renderBalance(true);
    await renderProducts();
    if (getCurrentPage() === 3) renderProfileInfo();
    if (getCurrentPage() === 4) await renderAdminDashboard();
    showToast(`✨ 获得 ${data.points_earned} 积分！当前：${data.balance} 分`);
  } catch (e) {
    showToast(e.message || '赚积分失败');
  }
};

// ==================== Admin Panel ====================
async function renderAdminDashboard() {
  if (!isOfficial()) return;

  try {
    const data = await getAdminStatsAPI();
    document.getElementById('adminTotalUsers').textContent = data.total_users;
    document.getElementById('adminTotalExchanges').textContent = data.total_exchanges;
    document.getElementById('adminTotalPoints').textContent = data.total_points_issued;
  } catch (e) { /* ignore */ }

  await renderAdminUsers();
  await renderAdminProducts();
}

export async function searchAdminUsers(q) {
  await renderAdminUsers(q);
}

async function renderAdminUsers(q = '') {
  const wrap = document.getElementById('adminUsersWrap');
  if (!wrap) return;

  try {
    const data = await getAdminUsersAPI(q);
    wrap.innerHTML = data.users.map(u => `
      <div class="card-item">
        <div class="card-item-left">
          <div class="card-item-icon">👤</div>
          <div>
            <div class="card-item-title">${u.name} <span style="font-size:10px;background:#5B9A6B;color:#fff;padding:2px 7px;border-radius:10px;font-weight:500">${u.role === 'official' ? '村干部' : '村民'}</span></div>
            <div class="card-item-sub">@${u.username} · 积分: ${u.balance}</div>
          </div>
        </div>
        <button class="btn-read" onclick="window._adjustBalanceModal(${u.id}, '${u.name}', ${u.balance})" style="font-size:12px">调整积分</button>
      </div>`).join('');
  } catch (e) {
    wrap.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

async function renderAdminProducts() {
  const wrap = document.getElementById('adminProductsWrap');
  if (!wrap) return;

  try {
    const data = await getProductsAPI();
    wrap.innerHTML = data.products.map(p => `
      <div class="card-item">
        <div class="card-item-left">
          <div class="card-item-icon">${p.emoji}</div>
          <div>
            <div class="card-item-title">${p.name}</div>
            <div class="card-item-sub">${p.points} 积分 · 库存 ${p.stock}</div>
          </div>
        </div>
        <button class="btn-read" onclick="window._editProductModal(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.points}, ${p.stock})" style="font-size:12px">编辑</button>
      </div>`).join('');
    window._adminProductsData = data.products;
  } catch (e) {
    wrap.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

function updateAdminBalanceDisplay() {
  const el = document.getElementById('adminBalance');
  if (el) el.textContent = getUserBalance();
}

// Admin: adjust balance modal
window._adjustBalanceModal = function(userId, name, currentBalance) {
  document.getElementById('adjustUserId').value = userId;
  document.getElementById('adjustUserName').textContent = name;
  document.getElementById('adjustCurrentBalance').textContent = currentBalance;
  document.getElementById('adjustDelta').value = '';
  document.getElementById('adjustReason').value = '';
  openModal('adjustBalanceOverlay');
};

window._closeAdjustBalance = () => closeModal('adjustBalanceOverlay');

window._onAdjustOverlayClick = (e) => {
  if (e.target === document.getElementById('adjustBalanceOverlay')) closeModal('adjustBalanceOverlay');
};

window._doAdjustBalance = async function() {
  const userId = parseInt(document.getElementById('adjustUserId').value);
  const delta = parseInt(document.getElementById('adjustDelta').value) || 0;
  const reason = document.getElementById('adjustReason').value.trim();

  if (!delta) { showToast('请输入调整金额'); return; }
  if (!reason) { showToast('请填写调整原因'); return; }

  try {
    await adjustBalanceAPI(userId, delta, reason);
    closeModal('adjustBalanceOverlay');
    showToast('✅ 积分调整成功');
    await renderAdminUsers();
    if (getCurrentPage() === 4) await renderAdminDashboard();
  } catch (e) {
    showToast(e.message || '调整失败');
  }
};

// Admin: edit product modal
window._editProductModal = function(id, name, points, stock) {
  document.getElementById('editProductId').value = id;
  document.getElementById('editProductName').value = name;
  document.getElementById('editProductPoints').value = points;
  document.getElementById('editProductStock').value = stock;
  openModal('editProductOverlay');
};

window._closeEditProduct = () => closeModal('editProductOverlay');

window._onEditProductOverlayClick = (e) => {
  if (e.target === document.getElementById('editProductOverlay')) closeModal('editProductOverlay');
};

window._saveEditProduct = async function() {
  const id = parseInt(document.getElementById('editProductId').value);
  const name = document.getElementById('editProductName').value.trim();
  const points = parseInt(document.getElementById('editProductPoints').value) || 0;
  const stock = parseInt(document.getElementById('editProductStock').value) || 0;

  if (!name) { showToast('请输入商品名称'); return; }

  try {
    await updateProductAPI(id, { name, points, stock });
    closeModal('editProductOverlay');
    showToast('✅ 商品已更新');
    await renderProducts();
    await renderAdminProducts();
  } catch (e) {
    showToast(e.message || '更新失败');
  }
};

// Admin: delete announcement
window._deleteAnnouncement = async function(id) {
  if (!confirm('确认删除该公告？')) return;
  try {
    await deleteAnnouncementAPI(id);
    showToast('🗑️ 公告已删除');
    await renderAnnouncements();
  } catch (e) {
    showToast(e.message || '删除失败');
  }
};

// ==================== Main Init ====================
export async function initApp() {
  const u = getUser();
  if (!u) return;

  renderBalance();
  await renderProducts();
  await renderHistory();
  await renderLeaderboard();

  // Update nav visibility for officials
  updateNavVisibility();
}

function updateNavVisibility() {
  // Show admin tab if official
  const navContainer = document.querySelector('.nav');
  if (!navContainer) return;

  const existingAdmin = document.getElementById('navAdmin');
  if (isOfficial()) {
    if (!existingAdmin) {
      const adminNav = document.createElement('div');
      adminNav.className = 'nav-item';
      adminNav.id = 'navAdmin';
      adminNav.onclick = () => switchPage(4);
      adminNav.innerHTML = '<i class="fa-solid fa-gear"></i><span>后台管理</span>';
      navContainer.appendChild(adminNav);
    }
  } else {
    if (existingAdmin) existingAdmin.remove();
  }
}

// Event listeners for page changes
window.addEventListener('page-changed', async (e) => {
  const page = e.detail.page;
  if (page === 1) {
    await renderProducts();
    await renderHistory();
    await renderLeaderboard();
  }
  if (page === 2) {
    await renderAnnouncements();
  }
  if (page === 3) {
    renderProfileInfo();
    switchTab(0);
  }
  if (page === 4) {
    document.getElementById('adminBalance').textContent = getUserBalance();
    await renderAdminDashboard();
  }
});

window.addEventListener('tab-changed', async (e) => {
  const tab = e.detail.tab;
  if (tab === 1) await renderHistory();
  if (tab === 2) await renderPointsDetail();
});

window.addEventListener('profile-updated', () => {
  renderProfileInfo();
  renderBalance();
});

// Exchange modal helpers
window._closeExchangeModal = () => closeModal('modalOverlay');
window._onOverlayClick = (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal('modalOverlay');
};

// Expose switchPage/switchTab globally for onclick handlers
window.switchPage = switchPage;
window.switchTab = switchTab;
window._simulateEarn = window._simulateEarn;
window.handleLogout = handleLogout;

// Expose edit form functions
window.openEditForm = openEditForm;
window.closeEditForm = closeEditForm;
window.saveEditForm = saveEditForm;
window._onEditOverlayClick = (e) => {
  if (e.target === document.getElementById('editModalOverlay')) closeEditForm();
};
