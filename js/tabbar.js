/**
 * 아래 탭 — 오늘 · 기록 · (모임) · 설정
 *
 * '모임' 탭은 모임을 이끄는 이끄미에게만 보임.
 * 이끄미인지는 이 기기에 기억해 둔 값으로 바로 판단 (인터넷 확인 없이).
 */

import { getLedCache } from './sync-meta.js';

const ICONS = {
  today: `<circle cx="12" cy="12" r="4" fill="currentColor"/>
          <path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  record: `<path d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 5V21L12 17L4 21V5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
  group: `<circle cx="9" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="16.5" cy="9.5" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M3.5 20C3.5 16.4 6 14 9 14C12 14 14.5 16.4 14.5 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M15.5 14.2C18.3 14.2 20.5 16.3 20.5 19.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  settings: `<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
};
const LABELS = { today: '오늘', record: '기록', group: '모임', settings: '설정' };
const ROUTES = { today: '#home', record: '#record', group: '#group', settings: '#settings' };

export function isLeader() {
  return getLedCache().length > 0;
}

export function tabbarHtml(active) {
  const tabs = ['today', 'record'];
  if (isLeader() || active === 'group') tabs.push('group');
  tabs.push('settings');
  return `
    <nav class="home-tabbar">
      ${tabs.map(t => `
        <button class="home-tab ${t === active ? 'home-tab-active' : ''}" data-tab="${t}">
          <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">${ICONS[t]}</svg>
          <span class="home-tab-label">${LABELS[t]}</span>
        </button>`).join('')}
    </nav>`;
}

export function bindTabbar(screen, navigateTo, active) {
  screen.querySelectorAll('.home-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.tab;
      if (t === active) return;
      if (ROUTES[t]) navigateTo(ROUTES[t]);
    });
  });
}
