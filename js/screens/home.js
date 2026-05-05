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
import { getDay, getLesson } from '../content.js';
import {
  getCurrentSessionType,
  getSessionLabel,
  formatCurrentTime,
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

  // 새 과 시작 시점 체크 — 첫째 날인데 아직 속도 확인 안 했으면 pace-check로
  // (1과 첫째 날은 온보딩에서 보통 속도를 정했으니 LAST_PACE_CHECK_LESSON이 1로 자동 설정됨)
  const lastPaceCheck = Storage.getLastPaceCheckLesson();
  if (dayIndex === 1 && lessonId > lastPaceCheck) {
    // 1과인 경우 — 온보딩에서 속도를 정했으므로 자동으로 OK
    if (lessonId === 1) {
      Storage.setLastPaceCheckLesson(1);
    } else {
      // 2과 이상 — 속도 확인 필요
      navigateTo('#pace-check');
      return screen;
    }
  }

  // 콘텐츠
  let day, lesson;
  try {
    day = await getDay(lessonId, dayIndex);
    lesson = await getLesson(lessonId);
  } catch (e) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">콘텐츠를 불러오는 중 문제가 있어요.</p>
    </div>`;
    return screen;
  }

  if (!day) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <h2 class="title" style="text-align: center;">여정의 끝까지 오셨어요</h2>
      <p class="body-large" style="margin-top: 16px;">풍성한 삶으로 첫걸음을<br/>모두 함께 걸으셨습니다.</p>
    </div>`;
    return screen;
  }

  // 현재 시간대 (강조될 세션)
  const currentSessionType = getCurrentSessionType();

  // 인사말
  const userName = Storage.getUserName();
  const today = formatKoreanDate();
  const todayISO = getTodayISO();
  const currentTime = formatCurrentTime();
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

  // 세 세션을 항상 같은 순서로 그리되, 현재 시간대는 메인 카드로 강조
  const sessionsHtml = SESSION_ORDER.map(type => {
    if (type === currentSessionType) {
      return renderMainCard(day, type, todayISO, sessionTimes[type]);
    } else {
      return renderOtherCard(type, todayISO, sessionTimes[type]);
    }
  }).join('');

  screen.innerHTML = `
    <div class="home-greeting">
      <p class="home-date">${today}</p>
      <h1 class="home-greeting-title" id="current-time">${currentTime}</h1>
      <p class="home-greeting-sub">${greetingSub}</p>
    </div>

    <div class="home-sessions">
      ${sessionsHtml}
    </div>

    <button class="home-other-days-btn" id="btn-other-days">
      <span>여정 전체 보기</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

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

  // 여정 전체 보기 버튼
  const otherDaysBtn = screen.querySelector('#btn-other-days');
  if (otherDaysBtn) {
    otherDaysBtn.addEventListener('click', () => {
      navigateTo('#journey');
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
      if (tabName === 'record') navigateTo('#record');
      else if (tabName === 'settings') navigateTo('#settings');
    });
  });

  // 시간 자동 업데이트 (1분마다)
  // 다음 분 시작에 맞춰 첫 업데이트, 그 후 60초마다
  // 시간이 흘러서 시간대(아침/낮/저녁)가 바뀌면 화면 다시 그림
  const now = new Date();
  const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  let intervalId = null;

  function updateTimeAndCheckSession() {
    const timeEl = screen.querySelector('#current-time');
    if (timeEl) timeEl.textContent = formatCurrentTime();
    // 시간대가 바뀌었으면 화면 다시 그리기
    const newSessionType = getCurrentSessionType();
    if (newSessionType !== currentSessionType) {
      // 현재 화면 다시 렌더 (라우팅 트리거)
      navigateTo('#home');
    }
  }

  const timeoutId = setTimeout(() => {
    updateTimeAndCheckSession();
    intervalId = setInterval(updateTimeAndCheckSession, 60000);
  }, msUntilNextMinute);

  // 화면 떠날 때 타이머 cleanup
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);

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

    // 마침 시 헤더 우측에 작은 체크 (다른 카드들과 통일)
    const doneCheck = isDone ? `
      <span class="home-card-check">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    ` : '';

    return `
      <div class="home-card ${isDone ? 'home-card-done' : ''}">
        <div class="home-card-header">
          <div class="home-card-header-left">
            <span class="home-card-lesson-num">${lessonId}과</span>
            <span class="home-card-lesson-title">${lesson.title}</span>
          </div>
          <div class="home-card-header-right">
            ${doneCheck}
            <span class="home-card-progress">${day.dayIndex} / 6</span>
          </div>
        </div>

        <p class="home-card-day-label">${day.dayLabel}</p>

        <div class="home-card-divider"></div>

        ${previewHtml}

        <button class="btn home-card-btn" id="btn-start-main">${buttonLabel}</button>
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

    // 마침 상태 체크 아이콘 (있으면)
    const checkIcon = isDone ? `
      <span class="home-other-card-check">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    ` : '';

    return `
      <button class="home-other-card ${isDone ? 'home-other-card-done' : ''}" data-session="${sessionType}">
        <div class="home-other-card-row">
          <span class="home-other-card-label-group">
            ${checkIcon}
            <span class="home-other-card-label">${sessionLabel}</span>
          </span>
          <span class="home-other-card-time">${timeLabel}</span>
        </div>
        <p class="home-other-card-hint">${hint}</p>
      </button>
    `;
  }
}
