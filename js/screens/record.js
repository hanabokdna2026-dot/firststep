/**
 * 기록 화면
 *
 * URL: #record
 *
 * 사용자가 그동안 적은 한 마디 기도들을 모아 보기.
 * 과/일/세션 정보와 함께. 가장 최근 것부터.
 */

import Storage from '../storage.js';
import { getDay } from '../content.js';

const SESSION_LABELS = {
  morning: '아침',
  evening: '저녁',
};

export default async function renderRecord({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  // 모든 기도 가져와서 정렬
  // 시간순 (과 → 일 → 세션 순으로 자연스럽게 정렬)
  const prayers = Storage.getAllPrayers();
  prayers.sort((a, b) => {
    if (a.lessonId !== b.lessonId) return b.lessonId - a.lessonId;  // 최신 과 먼저
    if (a.dayIndex !== b.dayIndex) return b.dayIndex - a.dayIndex;
    // 같은 날 안에서는 저녁이 먼저 (시간상 더 늦음)
    if (a.sessionType === 'evening' && b.sessionType === 'morning') return -1;
    if (a.sessionType === 'morning' && b.sessionType === 'evening') return 1;
    return 0;
  });

  // 각 기도에 대한 본문 정보(말씀 구절) 가져오기
  // 효율을 위해 과별로 한 번씩만 가져오기
  const dayDataCache = {};
  async function getDayData(lessonId, dayIndex) {
    const key = `${lessonId}:${dayIndex}`;
    if (!dayDataCache[key]) {
      dayDataCache[key] = await getDay(lessonId, dayIndex);
    }
    return dayDataCache[key];
  }

  // 기도 카드 HTML 만들기
  let recordsHtml;
  if (prayers.length === 0) {
    recordsHtml = `
      <div class="record-empty">
        <p class="record-empty-title">아직 기도가 없어요</p>
        <p class="record-empty-body">아침이나 저녁 세션에서 한 마디씩<br/>적어두면 여기에 모여요.</p>
      </div>
    `;
  } else {
    const cards = await Promise.all(prayers.map(async p => {
      const day = await getDayData(p.lessonId, p.dayIndex);
      const verseRef = day ? day.verseRef : '';
      const dayLabel = day ? day.dayLabel : '';
      const sessionLabel = SESSION_LABELS[p.sessionType] || '';

      return `
        <div class="record-card">
          <div class="record-card-meta">
            <span class="record-card-lesson">${p.lessonId}과 · ${dayLabel}</span>
            <span class="record-card-session">${sessionLabel}</span>
          </div>
          <p class="record-card-verse">${verseRef}</p>
          <p class="record-card-prayer">${escapeHtml(p.text)}</p>
        </div>
      `;
    }));
    recordsHtml = cards.join('');
  }

  screen.innerHTML = `
    <div class="screen-inner-with-tabs">
      <div class="record-header">
        <p class="eyebrow">기록</p>
        <h2 class="title-small">한 마디씩 적은 기도</h2>
      </div>

      <div class="record-list">
        ${recordsHtml}
      </div>
    </div>

    <nav class="home-tabbar">
      <button class="home-tab" data-tab="today">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
          <path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="home-tab-label">오늘</span>
      </button>
      <button class="home-tab home-tab-active" data-tab="record">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 5V21L12 17L4 21V5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span class="home-tab-label">기록</span>
      </button>
      <button class="home-tab" data-tab="settings">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="home-tab-label">설정</span>
      </button>
    </nav>
  `;

  screen.querySelectorAll('.home-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName === 'record') return;
      if (tabName === 'today') navigateTo('#home');
      else if (tabName === 'settings') navigateTo('#settings');
    });
  });

  return screen;
}

// XSS 방지를 위한 HTML escape
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br/>');
}
