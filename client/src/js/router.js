// router.js - Page and tab navigation

let currentPage = 0;
let currentTab = 0;

export function getCurrentPage() {
  return currentPage;
}

export function switchPage(pageNum) {
  currentPage = pageNum;
  const pages = document.querySelectorAll('.page');
  const navItems = document.querySelectorAll('.nav-item');

  pages.forEach(p => p.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));

  if (pages[pageNum]) pages[pageNum].classList.add('active');
  if (navItems[pageNum]) navItems[pageNum].classList.add('active');

  const titles = ['村务首页', '积分超市', '通知公告', '个人中心', '后台管理'];
  document.getElementById('headerTitle').textContent = titles[pageNum] || '村务首页';

  const showBalance = pageNum === 1 || pageNum === 4;
  document.getElementById('balanceCardWrap').style.display = showBalance ? 'block' : 'none';

  // Dispatch event for page-specific rendering
  window.dispatchEvent(new CustomEvent('page-changed', { detail: { page: pageNum } }));
}

export function switchTab(tabNum) {
  currentTab = tabNum;
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', i === tabNum);
  });
  document.querySelectorAll('.tab-content').forEach((c, i) => {
    c.classList.toggle('active', i === tabNum);
  });
  window.dispatchEvent(new CustomEvent('tab-changed', { detail: { tab: tabNum } }));
}
