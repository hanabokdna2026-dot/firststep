/**
 * 홈 화면
 *
 * 매일 사용자가 켤 때 보는 메인 화면.
 *
 * 두 모드:
 * - 기본 (오늘): 사용자의 현재 진도, 시간대 인사말, 진도 점
 * - 미리보기 (다른 날짜): 여정 화면에서 누른 다른 날의 자리
 *   화면 구조는 같지만 인사말이 "여정에서 ○과 ○일째 자리"로 바뀜
 *   세션 시작 누르면 진도 이동 확인 다이얼로그
 *
 * URL: #home (기본) / #home/preview/{lessonId}/{dayIndex} (미리보기)
 */

import Storage from '../storage.js';
import { getDay, getLesson, getActiveDayIndices, getDisplayDayLabel, getNextActiveDay } from '../content.js';
import {
  getCurrentSessionType,
  getSessionLabel,
  formatKoreanShortTime,
  getTodayISO,
  getTimeGreeting,
  getTimeOfDayClass,
} from '../time.js';

const SESSION_ORDER = ['morning', 'midday', 'evening'];

const SESSION_HINTS = {
  morning: '오늘의 말씀을 처음 만납니다',
  midday: '짧은 단락을 흘려 읽습니다',
  evening: '하루를 돌아보며 다시 만납니다',
};

export default async function renderHome({ navigateTo, param, extra }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  // 미리보기 모드 판단 — URL에서 preview/lesson/day 파라미터
  const isPreview = param === 'preview' && extra && extra.length >= 2;
  const previewLesson = isPreview ? Number(extra[0]) : null;
  const previewDay = isPreview ? Number(extra[1]) : null;

  // 어떤 자리를 보여줄지 결정
  const lessonId = isPreview ? previewLesson : Storage.getCurrentLesson();
  const dayIndex = isPreview ? previewDay : Storage.getCurrentDay();

  // 새 과 시작 시점 체크 (오늘 모드에서만)
  if (!isPreview) {
    const lastPaceCheck = Storage.getLastPaceCheckLesson();
    if (dayIndex === 1 && lessonId > lastPaceCheck) {
      if (lessonId === 1) {
        Storage.setLastPaceCheckLesson(1);
      } else {
        navigateTo('#pace-check');
        return screen;
      }
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

  // 속도와 활성 자리
  const weekPace = Storage.getWeekPace();
  const activeDayIndices = getActiveDayIndices(lesson, weekPace);
  const displayDayLabel = getDisplayDayLabel(dayIndex, activeDayIndices);
  const totalDaysThisWeek = activeDayIndices.length;
  const currentSlot = activeDayIndices.indexOf(dayIndex) + 1;  // 1-based

  // 시간대 분류 (배경 색조)
  const timeClass = getTimeOfDayClass();
  screen.classList.add('home-' + timeClass);

  // 현재 시간대 (강조될 세션) — 미리보기 모드는 항상 morning을 메인으로
  const currentSessionType = isPreview ? 'morning' : getCurrentSessionType();

  // 인사말
  const userName = Storage.getUserName();
  const todayISO = getTodayISO();

  let greetingMain, greetingSub;
  if (isPreview) {
    greetingMain = `여정에서 만나는 자리`;
    greetingSub = `${lessonId}과 ${displayDayLabel}을 둘러봅니다`;
  } else {
    greetingMain = getTimeGreeting();
    greetingSub = userName
      ? `${userName}님, 오늘도 함께 걸어요`
      : '오늘도 함께 걸어요';
  }

  // 알림 시간
  const notifyTimes = Storage.getNotifyTimes();
  const sessionTimes = {
    morning: notifyTimes.morning,
    midday: notifyTimes.midday,
    evening: notifyTimes.evening,
  };

  // 진도 점 (활성 자리 수만큼) — 미리보기 모드는 그 자리까지 표시
  const progressDots = renderProgressDots();

  // 세 세션 카드
  const sessionsHtml = SESSION_ORDER.map(type => {
    if (type === currentSessionType) {
      return renderMainCard(day, type, todayISO, sessionTimes[type], isPreview);
    } else {
      return renderOtherCard(type, todayISO, sessionTimes[type], isPreview);
    }
  }).join('');

  // 미리보기 모드면 "오늘로 돌아가기" 버튼, 아니면 "여정 전체 보기"
  const bottomActionHtml = isPreview ? `
    <button class="home-other-days-btn" id="btn-back-today">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="margin-right: 6px;">
        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>오늘로 돌아가기</span>
    </button>
  ` : `
    <button class="home-other-days-btn" id="btn-other-days">
      <span>여정 전체 보기</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  // 탭바 — 미리보기 모드에서는 안 보임 (오늘로 돌아가기 버튼만)
  const tabbarHtml = isPreview ? '' : `
    <nav class="home-tabbar">
      <button class="home-tab home-tab-active" data-tab="today">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
          <path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="home-tab-label">오늘</span>
      </button>
      <button class="home-tab" data-tab="record">
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

  screen.innerHTML = `
    <div class="home-greeting">
      <h1 class="home-greeting-title">${greetingMain}</h1>
      <p class="home-greeting-sub">${greetingSub}</p>
      ${progressDots}
    </div>

    <div class="home-sessions">
      ${sessionsHtml}
    </div>

    ${bottomActionHtml}

    ${tabbarHtml}
  `;

  // ============= 이벤트 =============

  // 메인 시작 버튼
  const mainStartBtn = screen.querySelector('#btn-start-main');
  if (mainStartBtn) {
    mainStartBtn.addEventListener('click', () => {
      if (isPreview) {
        confirmJumpAndStart(currentSessionType);
      } else {
        navigateTo('#session/' + currentSessionType);
      }
    });
  }

  // 여정 전체 보기 버튼 (오늘 모드에서만)
  const otherDaysBtn = screen.querySelector('#btn-other-days');
  if (otherDaysBtn) {
    otherDaysBtn.addEventListener('click', () => {
      navigateTo('#journey');
    });
  }

  // 오늘로 돌아가기 버튼 (미리보기 모드에서만)
  const backTodayBtn = screen.querySelector('#btn-back-today');
  if (backTodayBtn) {
    backTodayBtn.addEventListener('click', () => {
      navigateTo('#home');
    });
  }

  // 다른 세션 카드들 클릭
  screen.querySelectorAll('.home-other-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.session;
      if (isPreview) {
        confirmJumpAndStart(type);
      } else {
        navigateTo('#session/' + type);
      }
    });
  });

  // 미리보기 모드 — 진도 이동 확인
  function confirmJumpAndStart(sessionType) {
    const sessionLabel = getSessionLabel(sessionType);
    const ok = confirm(
      `${lessonId}과 ${displayDayLabel} ${sessionLabel} 자리로 옮겨가시겠어요?\n\n` +
      `현재 진도가 이 자리로 이동합니다.`
    );
    if (ok) {
      Storage.setCurrentLesson(lessonId);
      Storage.setCurrentDay(dayIndex);
      navigateTo('#session/' + sessionType);
    }
  }

  // 탭
  screen.querySelectorAll('.home-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName === 'today') return;
      if (tabName === 'record') navigateTo('#record');
      else if (tabName === 'settings') navigateTo('#settings');
    });
  });

  // ============= 시간대 자동 갱신 (오늘 모드에서만) =============
  if (!isPreview) {
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId = null;

    function checkSessionAndGreeting() {
      // 시간대(아침/낮/저녁)가 바뀌었으면 화면 다시 그리기
      const newSessionType = getCurrentSessionType();
      const newTimeClass = getTimeOfDayClass();
      if (newSessionType !== currentSessionType || newTimeClass !== timeClass) {
        navigateTo('#home');
      }
    }

    const timeoutId = setTimeout(() => {
      checkSessionAndGreeting();
      intervalId = setInterval(checkSessionAndGreeting, 60000);
    }, msUntilNextMinute);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup);
  }

  // ============= 좌우 스와이프 =============
  setupSwipe(screen, async (direction) => {
    if (direction === 'left') {
      // 왼쪽으로 밀면 — 여정 화면으로 (오늘 모드에서만)
      if (!isPreview) {
        slideOutTo(screen, 'left');
        setTimeout(() => navigateTo('#journey'), 280);
      }
    } else if (direction === 'right') {
      // 오른쪽으로 밀면 — 다음 활성 자리 미리보기로
      const next = await getNextActiveDay(lessonId, dayIndex, weekPace);
      if (next) {
        slideOutTo(screen, 'right');
        setTimeout(() => navigateTo(`#home/preview/${next.lessonId}/${next.dayIndex}`), 280);
      }
    }
  });

  return screen;

  // ============================================
  // 진도 점 (활성 자리 수만큼)
  // ============================================
  function renderProgressDots() {
    let dots = '';
    for (let i = 1; i <= totalDaysThisWeek; i++) {
      let cls = 'home-progress-dot';
      if (i < currentSlot) cls += ' home-progress-dot-done';
      else if (i === currentSlot) cls += ' home-progress-dot-current';
      dots += `<span class="${cls}"></span>`;
    }
    return `
      <div class="home-progress">
        <div class="home-progress-dots">${dots}</div>
        <p class="home-progress-label">${lessonId}과 · ${currentSlot} / ${totalDaysThisWeek}</p>
      </div>
    `;
  }

  // ============================================
  // 메인 카드 (현재 시간대 강조)
  // ============================================
  function renderMainCard(day, sessionType, todayISO, sessionTime, isPreview) {
    const sessionLabel = getSessionLabel(sessionType);
    const isDone = isPreview ? false : Storage.isSessionDone(todayISO, sessionType);

    let previewHtml;
    if (sessionType === 'midday') {
      previewHtml = `
        <p class="card-section-label">${isPreview ? '미리보는 ' : '오늘의 '}${sessionLabel} 세션</p>
        <p class="card-passage-ref">${day.midday.homeHint || day.midday.passageRef || '오늘 통독을 이어갑니다'}</p>
        <p class="card-passage-hint">짧은 단락을 흘려 읽습니다.</p>
      `;
    } else {
      previewHtml = `
        <p class="card-section-label">${isPreview ? '미리보는 ' : '오늘의 '}${sessionLabel} 세션</p>
        <p class="card-verse-text">${day.verses.saebeon}</p>
        <p class="card-verse-ref">— ${day.verseRef}</p>
      `;
    }

    const buttonLabel = isPreview ? '이 자리부터 시작하기' : (isDone ? '다시 만나기' : '시작하기');

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
          </div>
        </div>

        <p class="home-card-day-label">${displayDayLabel}</p>

        <div class="home-card-divider"></div>

        ${previewHtml}

        <button class="btn home-card-btn" id="btn-start-main">${buttonLabel}</button>
      </div>
    `;
  }

  // ============================================
  // 다른 세션 카드 (작게)
  // ============================================
  function renderOtherCard(sessionType, todayISO, sessionTime, isPreview) {
    const sessionLabel = getSessionLabel(sessionType);
    const isDone = isPreview ? false : Storage.isSessionDone(todayISO, sessionType);
    const timeLabel = formatKoreanShortTime(sessionTime);
    // hint — 그 날의 그 세션 결을 우선, 없으면 기본 hint
    const hint = (day[sessionType] && day[sessionType].homeHint) || SESSION_HINTS[sessionType];

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

// ============================================
// 좌우 스와이프 처리 헬퍼
// ============================================

/**
 * 화면에 좌우 스와이프 이벤트 등록.
 *
 * - 화면 너비의 25% 이상 + 가로가 세로보다 큰 결일 때만 인식
 * - 카드 안의 버튼 등 다른 요소의 click이 부드럽게 작동하도록 — 작은 움직임은 무시
 * - 스와이프 도중 화면이 손가락 따라 살짝 움직이는 결로 자연스럽게
 */
function setupSwipe(screen, onSwipe) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isTracking = false;
  let isDragging = false;

  const SWIPE_THRESHOLD_RATIO = 0.25;  // 화면 너비의 25%
  const MAX_VERTICAL_DRIFT = 80;       // 세로로 너무 많이 움직이면 스와이프 아님
  const MAX_DURATION = 600;            // ms — 너무 느리게 끌면 스와이프 아님

  screen.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    // textarea, button, input 안에서는 스와이프 안 함
    const target = e.target;
    if (target.matches('textarea, input, button, .home-card-btn, .home-other-card')) {
      // 카드 안에서도 스와이프는 가능해야 함
      // 다만 이런 요소 자체의 동작을 방해하면 안 됨
      // → 시작은 추적하되, 큰 가로 움직임이 있을 때만 dragging으로 전환
    }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isTracking = true;
    isDragging = false;
  }, { passive: true });

  screen.addEventListener('touchmove', (e) => {
    if (!isTracking || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // 가로 이동이 세로보다 클 때만 dragging
    if (!isDragging && Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      isDragging = true;
    }

    if (isDragging) {
      // 스크롤 방지
      // (passive: true라 직접 preventDefault는 못 하지만, 이미 가로 결로 인식됐으면 OK)
      // 화면이 손가락 따라 살짝 움직이는 결
      const damped = dx * 0.5;
      screen.style.transform = `translateX(${damped}px)`;
      screen.style.transition = 'none';
    }
  }, { passive: true });

  screen.addEventListener('touchend', (e) => {
    if (!isTracking) return;
    isTracking = false;

    const touch = (e.changedTouches && e.changedTouches[0]) || null;
    if (!touch) {
      resetTransform(screen);
      return;
    }

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const duration = Date.now() - touchStartTime;
    const screenWidth = window.innerWidth;
    const threshold = screenWidth * SWIPE_THRESHOLD_RATIO;

    // 스와이프 조건
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    const isFarEnough = Math.abs(dx) >= threshold;
    const notTooMuchVertical = Math.abs(dy) <= MAX_VERTICAL_DRIFT;
    const fastEnough = duration <= MAX_DURATION;

    if (isDragging && isHorizontal && isFarEnough && notTooMuchVertical && fastEnough) {
      // 스와이프 인식 — 방향
      const direction = dx < 0 ? 'left' : 'right';
      // transform은 그대로 두고 onSwipe 호출 (slideOutTo가 마저 처리)
      onSwipe(direction);
    } else {
      // 원래 자리로 (애니메이션)
      resetTransform(screen);
    }

    isDragging = false;
  }, { passive: true });

  screen.addEventListener('touchcancel', () => {
    isTracking = false;
    isDragging = false;
    resetTransform(screen);
  }, { passive: true });
}

function resetTransform(screen) {
  screen.style.transition = 'transform 0.25s ease-out';
  screen.style.transform = '';
}

/**
 * 화면을 한쪽으로 슬라이드시키며 사라지게.
 * direction: 'left' 또는 'right'
 */
function slideOutTo(screen, direction) {
  const distance = window.innerWidth;
  const target = direction === 'left' ? -distance : distance;
  screen.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
  screen.style.transform = `translateX(${target}px)`;
  screen.style.opacity = '0';
}
