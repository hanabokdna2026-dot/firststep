/**
 * 홈 화면
 *
 * 매일 사용자가 켤 때 보는 메인 화면.
 *
 * 구성:
 * - 상단: 오늘 날짜, 인사말, 이름
 * - 메인 카드: 현재 시간대 세션 (강조됨, 본문 미리보기 + 시작 버튼)
 * - 부 카드 2개: 다른 두 세션 (직접 시작 가능)
 * - 하단 탭: 오늘 / 기록 / 설정
 *
 * 사용자는 시간대와 무관하게 어떤 세션이든 들어갈 수 있어요.
 * 다만 현재 시간대가 시각적으로 강조됨.
 */

import Storage from '../storage.js';
import { getDay } from '../content.js';
import {
  getCurrentSessionType,
  getSessionLabel,
  getSessionGreeting,
  formatKoreanDate,
  formatKoreanShortTime,
  getTodayISO,
} from '../time.js';

const SESSION_ORDER = ['morning', 'midday', 'evening'];

const SESSION_HINTS = {
  morning: '오늘의 말씀을 처음 만납니다',
  midday: '짧은 단락을 흘려 읽습니다',
  evening: '하루를 돌아보며 다시 만납니다',
};

export default async function renderHome({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  // 진도 정보
  const lessonId = Storage.getCurrentLesson();
  const dayIndex = Storage.getCurrentDay();

  // 콘텐츠
  let day;
  try {
    day = await getDay(lessonId, dayIndex);
  } catch (e) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">콘텐츠를 불러오는 중 문제가 있어요.</p>
    </div>`;
    return screen;
  }

  if (!day) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <h2 class="title" style="text-align: center;">여정의 끝까지 오셨어요</h2>
      <p class="body-large" style="margin-top: 16px;">풍성한 첫걸음을<br/>모두 함께 걸으셨습니다.</p>
    </div>`;
    return screen;
  }

  // 현재 시간대 (강조될 세션)
  const currentSessionType = getCurrentSessionType();

  // 인사말
  const greeting = getSessionGreeting(currentSessionType);
  const userName = Storage.getUserName();
  const today = formatKoreanDate();
  const todayISO = getTodayISO();
  const greetingSub = userName
    ? `${userName}님, 오늘도 함께 걸어요`
    : '오늘도 함께 걸어요';

  // 알림 시간
  const notifyTimes = Storage.getNotifyTimes();
  const sessionTimes = {
    morning: notifyTimes.morning,
    midday: notifyTimes.midday,
    evening: notifyTimes.evening,
  };

  // 메인 카드 (현재 시간대) HTML
  const mainCardHtml = renderMainCard(day, currentSessionType, todayISO, sessionTimes[currentSessionType]);

  // 다른 두 세션 (작은 카드들)
  const otherSessions = SESSION_ORDER.filter(t => t !== currentSessionType);
  const otherCardsHtml = otherSessions.map(type =>
    renderOtherCard(type, todayISO, sessionTimes[type])
  ).join('');

  screen.innerHTML = `
    <div class="home-greeting">
      <p class="home-date">${today}</p>
      <h1 class="home-greeting-title">${greeting}</h1>
      <p class="home-greeting-sub">${greetingSub}</p>
    </div>

    <div class="home-main">
      ${mainCardHtml}
    </div>

    <div class="home-other-sessions">
      ${otherCardsHtml}
    </div>

    <nav class="home-tabbar">
      <button class="home-tab home-tab-active" data-tab="today">
        <span class="home-tab-dot"></span>
        <span class="home-tab-label">오늘</span>
      </button>
      <button class="home-tab" data-tab="record">
        <span class="home-tab-dot"></span>
        <span class="home-tab-label">기록</span>
      </button>
      <button class="home-tab" data-tab="settings">
        <span class="home-tab-dot"></span>
        <span class="home-tab-label">설정</span>
      </button>
    </nav>
  `;

  // 메인 시작 버튼
  const mainStartBtn = screen.querySelector('#btn-start-main');
  if (mainStartBtn) {
    mainStartBtn.addEventListener('click', () => {
      navigateTo('#session/' + currentSessionType);
    });
  }

  // 다른 세션 카드들 클릭
  screen.querySelectorAll('.home-other-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.session;
      navigateTo('#session/' + type);
    });
  });

  // 탭
  screen.querySelectorAll('.home-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName === 'today') return;
      if (tabName === 'record') {
        alert('기록 화면은 다음 단계에 만들어요.');
      } else if (tabName === 'settings') {
        if (confirm('설정 화면은 다음 단계에 만들어요.\n\n지금은 데이터 초기화만 가능해요. 초기화할까요?')) {
          Storage.clearAll();
          navigateTo('#welcome');
        }
      }
    });
  });

  return screen;

  // ============================================
  // 메인 카드 (현재 시간대 강조)
  // ============================================
  function renderMainCard(day, sessionType, todayISO, sessionTime) {
    const sessionLabel = getSessionLabel(sessionType);
    const isDone = Storage.isSessionDone(todayISO, sessionType);
    const timeLabel = formatKoreanShortTime(sessionTime);

    let previewHtml;
    if (sessionType === 'midday') {
      previewHtml = `
        <p class="card-section-label">오늘의 ${sessionLabel} 세션</p>
        <p class="card-passage-ref">${day.midday.passageRef}</p>
        <p class="card-passage-hint">짧은 단락을 흘려 읽습니다.</p>
      `;
    } else {
      previewHtml = `
        <p class="card-section-label">오늘의 ${sessionLabel} 세션</p>
        <p class="card-verse-text">${day.verses.saebeon}</p>
        <p class="card-verse-ref">— ${day.verseRef}</p>
      `;
    }

    const buttonLabel = isDone ? `다시 만나기` : `시작하기`;

    return `
      <div class="home-card">
        <div class="home-card-header">
          <span class="home-card-lesson">${Storage.getCurrentLesson()}과 · ${day.dayLabel}</span>
          <span class="home-card-progress">${day.dayIndex} / 6</span>
        </div>

        <div class="home-card-divider"></div>

        ${previewHtml}

        <button class="btn home-card-btn" id="btn-start-main">${buttonLabel}</button>

        ${isDone ? '<p class="home-card-done">이미 마쳤어요. 다시 만나도 좋아요.</p>' : ''}
      </div>
    `;
  }

  // ============================================
  // 다른 세션 카드 (작게)
  // ============================================
  function renderOtherCard(sessionType, todayISO, sessionTime) {
    const sessionLabel = getSessionLabel(sessionType);
    const isDone = Storage.isSessionDone(todayISO, sessionType);
    const timeLabel = formatKoreanShortTime(sessionTime);
    const hint = SESSION_HINTS[sessionType];

    return `
      <button class="home-other-card ${isDone ? 'home-other-card-done' : ''}" data-session="${sessionType}">
        <div class="home-other-card-row">
          <span class="home-other-card-label">${sessionLabel}</span>
          <span class="home-other-card-time">${timeLabel}</span>
        </div>
        <p class="home-other-card-hint">${hint}</p>
        ${isDone ? '<p class="home-other-card-status">마침</p>' : ''}
      </button>
    `;
  }
}
