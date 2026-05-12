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
import { setupSwipePager } from '../swipe-pager.js';

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
  if (isPreview) {
    screen.classList.add('home-preview');
  }

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

  // 3면 페이저 인디케이터 자리 — nextActiveDay 결정된 다음에 계산하므로 일단 빈 자리
  // (실제 계산은 nextActiveDay 정의 뒤에서)

  // 세 세션 카드
  const sessionsHtml = SESSION_ORDER.map(type => {
    if (type === currentSessionType) {
      return renderMainCard(day, type, todayISO, sessionTimes[type], isPreview);
    } else {
      return renderOtherCard(type, todayISO, sessionTimes[type], isPreview);
    }
  }).join('');

  // 위쪽 힌트 바에 이미 흐름이 있으니 아래 버튼은 안 둠 (중복 방지)

  // 탭바 — 미리보기 모드에서는 안 보임 (위쪽 힌트의 "오늘"이 그 역할)
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

  // 좌우 힌트 바
  // 오늘 모드: 왼쪽 "여정" / 오른쪽 "다음 날"
  // 미리보기 모드: 왼쪽 "오늘" / 오른쪽 "다음 자리" (다음 활성 자리가 있으면)
  let nextActiveDay = null;
  try {
    nextActiveDay = await getNextActiveDay(lessonId, dayIndex, weekPace);
  } catch (e) {
    nextActiveDay = null;
  }

  // 3면 페이저 인디케이터 — nextActiveDay 결정된 후 계산
  const pageIndicator = renderPageIndicator();

  const swipeHintHtml = `
    <div class="home-swipe-hints">
      <button class="home-swipe-hint home-swipe-hint-left" id="hint-left" aria-label="${isPreview ? '오늘로 돌아가기' : '여정 보기'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="home-swipe-hint-label">${isPreview ? '오늘' : '여정'}</span>
      </button>
      ${nextActiveDay ? `
        <button class="home-swipe-hint home-swipe-hint-right" id="hint-right" aria-label="다음 자리">
          <span class="home-swipe-hint-label">${isPreview ? '다음 자리' : '다음 날'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      ` : ''}
    </div>
  `;

  screen.innerHTML = `
    ${swipeHintHtml}

    <div class="home-greeting">
      <h1 class="home-greeting-title">${greetingMain}</h1>
      <p class="home-greeting-sub">${greetingSub}</p>
      ${pageIndicator}
    </div>

    <div class="home-sessions">
      ${sessionsHtml}
    </div>

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

  // 위쪽 힌트 바 — 좌우 버튼
  const hintLeft = screen.querySelector('#hint-left');
  if (hintLeft) {
    hintLeft.addEventListener('click', () => {
      if (isPreview) {
        navigateTo('#home');
      } else {
        navigateTo('#journey');
      }
    });
  }

  const hintRight = screen.querySelector('#hint-right');
  if (hintRight) {
    hintRight.addEventListener('click', () => {
      if (nextActiveDay) {
        navigateTo(`#home/preview/${nextActiveDay.lessonId}/${nextActiveDay.dayIndex}`);
      }
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

    // 앱이 background에서 돌아올 때도 즉시 체크 (iOS는 background에서 setInterval 멈춤)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionAndGreeting();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup);
  }

  // ============= 좌우 스와이프 =============
  // 두 화면이 동시에 슬라이드되는 짜임 (placeholder 사용)
  setupSwipePager(screen, {
    leftBg: '#D5CFA0',     // 여정 (올리브 크림)
    rightBg: '#C8D4DD',    // 다음 자리 (포그 블루)
    leftLabel: isPreview ? '오늘' : '여정',
    rightLabel: isPreview ? '다음 자리' : '다음 날',
    onCommitLeft: () => {
      if (isPreview) {
        navigateTo('#home');
      } else {
        navigateTo('#journey');
      }
    },
    onCommitRight: nextActiveDay
      ? () => navigateTo(`#home/preview/${nextActiveDay.lessonId}/${nextActiveDay.dayIndex}`)
      : null,
  });

  return screen;

  // ============================================
  // 3면 페이저 인디케이터
  // 왼편(여정) ─ 가운데(오늘) ─ 오른편(다음 날)
  // 미리보기 모드면 가운데 자리가 미리보기 자리
  // ============================================
  function renderPageIndicator() {
    // 현재 자리 — 어느 면에 있는지
    // 오늘 모드: 가운데 (1)
    // 미리보기 모드: 오른편 (2)
    // (왼편 = 0은 여정 화면이라 home에서는 안 나옴)
    const currentPage = isPreview ? 2 : 1;

    // 오른편이 보일지 여부 — 다음 활성 자리가 있을 때만
    const hasRight = !!nextActiveDay;

    // 왼편(여정)은 항상 있음
    const dots = [];
    for (let i = 0; i < 3; i++) {
      let cls = 'home-page-dot';
      if (i === currentPage) cls += ' home-page-dot-current';
      // 오른편 점은 다음 자리 없으면 안 보임 — 단 미리보기 모드에서는 자기 자리니까 보임
      if (i === 2 && !hasRight && currentPage !== 2) cls += ' home-page-dot-hidden';
      dots.push(`<span class="${cls}"></span>`);
    }

    return `<div class="home-page-indicator">${dots.join('')}</div>`;
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
      // 옛 결: verses (한 절), 새 결: passage (배열 — 첫 절만 미리보기)
      let verseText = '';
      if (day.verses && day.verses.saebeon) {
        verseText = day.verses.saebeon;
      } else if (day.passage && day.passage.saebeon) {
        const arr = day.passage.saebeon;
        verseText = Array.isArray(arr) ? arr[0] : arr;
      }
      previewHtml = `
        <p class="card-section-label">${isPreview ? '미리보는 ' : '오늘의 '}${sessionLabel} 세션</p>
        <p class="card-verse-text">${verseText}</p>
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
    // hint — 그 날의 그 세션 hint를 우선, 없으면 기본 hint
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
// (스와이프 페이저는 placeholder 짜임이라 인접 화면 미리 그릴 필요 없음)
// ============================================
