/**
 * 여정 전체 보기 화면
 *
 * URL: #journey
 *
 * 풍성한 삶으로 첫걸음 전체 9과를 카드로 보여줌.
 * 과 카드를 누르면 그 자리에서 6일이 펼쳐짐 (아코디언).
 *
 * 진행 상태:
 * - 현재 과 → amber 강조 + "지금 이 자리"
 * - 시작한 과(일부 마침) → "진행 중"
 * - 완료된 과(모든 일 마침) → 체크 아이콘 + 옅게
 * - 아직 안 온 과 → 옅게, 콘텐츠 있으면 미리보기 가능
 *
 * 콘텐츠가 아직 없는 과는 "준비 중"으로 표시.
 */

import Storage from '../storage.js';
import { getLesson, CURRICULUM_OUTLINE, getActiveDayIndices, getDisplayDayLabel } from '../content.js';

export default async function renderJourney({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen journey-screen';

  const currentLesson = Storage.getCurrentLesson();
  const currentDay = Storage.getCurrentDay();

  // 어떤 과가 펼쳐져 있는지 (기본: 현재 과)
  let expandedLessonId = currentLesson;

  // 각 과의 콘텐츠를 한 번만 가져오는 캐시
  const lessonCache = {};
  async function getCachedLesson(lessonId) {
    if (lessonCache[lessonId] === undefined) {
      try {
        lessonCache[lessonId] = await getLesson(lessonId);
      } catch (e) {
        lessonCache[lessonId] = null;
      }
    }
    return lessonCache[lessonId];
  }

  // 화면 그리기
  async function render() {
    // 모든 과의 데이터 미리 로드
    const lessons = await Promise.all(
      CURRICULUM_OUTLINE.map(async outline => {
        const data = await getCachedLesson(outline.id);
        return { ...outline, data };
      })
    );

    const lessonCards = lessons.map(lesson => renderLessonCard(lesson)).join('');

    screen.innerHTML = `
      <div class="screen-inner-with-tabs">
        <div class="journey-header">
          <button class="journey-back" id="btn-back">‹ 홈</button>
        </div>

        <div class="journey-title-row">
          <p class="eyebrow">여정 전체</p>
          <h2 class="title-small">풍성한 삶으로 첫걸음</h2>
          <p class="journey-intro">하나님과 함께 걸어갈<br/>열 번의 한 주</p>
        </div>

        <div class="journey-list">
          ${lessonCards}
        </div>

        <p class="subtle journey-hint">아무 과나 눌러서 미리 봐도 좋아요.<br/>다른 날을 마쳐도 진도는 그대로 둡니다.</p>
      </div>
    `;

    // 뒤로
    screen.querySelector('#btn-back').addEventListener('click', () => {
      navigateTo('#home');
    });

    // 과 카드 토글
    screen.querySelectorAll('[data-lesson-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.lessonToggle, 10);
        if (expandedLessonId === id) {
          // 이미 펼쳐져 있으면 닫기
          expandedLessonId = null;
        } else {
          expandedLessonId = id;
        }
        render();
      });
    });

    // 세션 버튼 클릭 — 다른 자리는 그 날의 홈 미리보기로, 같은 자리는 바로 세션 진입
    screen.querySelectorAll('[data-session-type]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lessonId = parseInt(btn.dataset.sessionLesson, 10);
        const dayIndex = parseInt(btn.dataset.sessionDay, 10);
        const sessionType = btn.dataset.sessionType;

        // 현재 진도와 같은 자리면 그 세션으로 직접 진입
        if (lessonId === currentLesson && dayIndex === currentDay) {
          navigateTo('#session/' + sessionType);
          return;
        }

        // 다른 자리 — 그 날의 홈 미리보기로
        navigateTo(`#home/preview/${lessonId}/${dayIndex}`);
      });
    });
  }

  // ============================================
  // 한 과 카드 (헤더 + 펼침 시 6일)
  // ============================================
  function renderLessonCard(lesson) {
    const isCurrent = lesson.id === currentLesson;
    const isExpanded = expandedLessonId === lesson.id;
    const hasContent = !!lesson.data;

    // 진행 상태 계산
    let progressInfo;
    if (hasContent) {
      const fullyDoneDays = lesson.data.days.filter(d =>
        Storage.isDayFullyDone(lesson.id, d.dayIndex)
      ).length;
      const startedDays = lesson.data.days.filter(d =>
        Storage.isDayStarted(lesson.id, d.dayIndex)
      ).length;

      if (fullyDoneDays === 6) {
        progressInfo = { type: 'done', label: '마침' };
      } else if (startedDays > 0) {
        progressInfo = { type: 'started', label: `${fullyDoneDays} / 6` };
      } else if (isCurrent) {
        progressInfo = { type: 'current', label: '시작' };
      } else {
        progressInfo = { type: 'untouched', label: '' };
      }
    } else {
      progressInfo = { type: 'unavailable', label: '준비 중' };
    }

    // 헤더 우측 상태 표시
    let statusBadge = '';
    if (progressInfo.type === 'done') {
      statusBadge = `
        <span class="journey-lesson-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      `;
    } else if (progressInfo.type === 'started') {
      statusBadge = `<span class="journey-lesson-progress">${progressInfo.label}</span>`;
    } else if (progressInfo.type === 'current' && !isExpanded) {
      statusBadge = `<span class="journey-lesson-current-mark">지금 이 자리</span>`;
    } else if (progressInfo.type === 'unavailable') {
      statusBadge = `<span class="journey-lesson-unavailable">준비 중</span>`;
    }

    // 카드 클래스
    let cardClass = 'journey-lesson-card';
    if (isCurrent) cardClass += ' journey-lesson-card-current';
    if (progressInfo.type === 'done') cardClass += ' journey-lesson-card-done';
    if (!hasContent) cardClass += ' journey-lesson-card-unavailable';
    if (isExpanded) cardClass += ' journey-lesson-card-expanded';

    // 펼친 내용 — 6일 카드들 (콘텐츠가 있을 때만)
    let expandedHtml = '';
    if (isExpanded && hasContent) {
      const weekPace = Storage.getWeekPace();
      const activeDayIndices = getActiveDayIndices(lesson.data, weekPace);
      const dayCards = lesson.data.days.map(day =>
        renderDayCard(lesson.id, day, activeDayIndices)
      ).join('');
      expandedHtml = `
        <div class="journey-days-list">
          ${lesson.data.coreMessage ? `<p class="journey-core-message">${lesson.data.coreMessage}</p>` : ''}
          ${dayCards}
        </div>
      `;
    } else if (isExpanded && !hasContent) {
      expandedHtml = `
        <div class="journey-days-list">
          <p class="journey-unavailable-note">이 과의 내용은 아직 준비 중이에요.<br/>곧 만나실 수 있어요.</p>
        </div>
      `;
    }

    return `
      <div class="${cardClass}">
        <button class="journey-lesson-header" data-lesson-toggle="${lesson.id}">
          <div class="journey-lesson-info">
            <span class="journey-lesson-num">${lesson.id}과</span>
            <span class="journey-lesson-title">${lesson.title}</span>
          </div>
          <div class="journey-lesson-right">
            ${statusBadge}
            <svg class="journey-lesson-chevron ${isExpanded ? 'expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </button>
        ${expandedHtml}
      </div>
    `;
  }

  // ============================================
  // 한 일 카드 (펼친 과 안에서)
  // ============================================
  function renderDayCard(lessonId, day, activeDayIndices) {
    const isCurrent = (lessonId === currentLesson && day.dayIndex === currentDay);
    const fullyDone = Storage.isDayFullyDone(lessonId, day.dayIndex);
    const started = Storage.isDayStarted(lessonId, day.dayIndex);
    const isActive = activeDayIndices.includes(day.dayIndex);
    const displayLabel = isActive ? getDisplayDayLabel(day.dayIndex, activeDayIndices) : day.dayLabel;

    let badge = '';
    let cardClass = 'journey-day-card';

    if (!isActive) {
      cardClass += ' journey-day-card-inactive';
      badge = `<span class="journey-day-status journey-day-status-inactive">건너뛰는 자리</span>`;
    } else if (fullyDone) {
      cardClass += ' journey-day-card-done';
      badge = `
        <span class="journey-day-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      `;
    } else if (started) {
      badge = `<span class="journey-day-status">진행 중</span>`;
    }

    if (isCurrent) {
      cardClass += ' journey-day-card-current';
    }

    // 세 세션 작은 버튼들 — 비활성 자리는 버튼 안 그림
    let sessionButtons = '';
    if (isActive) {
      sessionButtons = ['morning', 'midday', 'evening'].map(type => {
        const isSessionDone = Storage.isDaySessionDone(lessonId, day.dayIndex, type);
        const labels = { morning: '아침', midday: '낮', evening: '저녁' };
        const checkIcon = isSessionDone ? `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        ` : '';
        return `
          <button class="journey-day-session-btn ${isSessionDone ? 'journey-day-session-btn-done' : ''}"
                  data-session-lesson="${lessonId}"
                  data-session-day="${day.dayIndex}"
                  data-session-type="${type}">
            ${checkIcon}
            <span>${labels[type]}</span>
          </button>
        `;
      }).join('');
    }

    return `
      <div class="${cardClass}">
        <div class="journey-day-header">
          <span class="journey-day-label">${displayLabel}</span>
          ${badge}
        </div>
        <p class="journey-day-verse">${day.verses.saebeon}</p>
        <p class="journey-day-ref">— ${day.verseRef}</p>
        ${isCurrent ? '<p class="journey-day-current-mark">지금 이 자리</p>' : ''}

        ${isActive ? `
          <div class="journey-day-sessions">
            ${sessionButtons}
          </div>
        ` : ''}
      </div>
    `;
  }

  await render();

  // 좌우 스와이프 — 왼쪽으로 밀면 홈으로
  const { setupSwipePager } = await import('../swipe-pager.js');
  setupSwipePager(screen, {
    onLeft: null,  // 여정 왼편엔 아무것도 없음
    onCommitLeft: null,
    onRight: async () => {
      const renderHome = (await import('./home.js')).default;
      return await renderHome({ navigateTo });
    },
    onCommitRight: () => {
      navigateTo('#home');
    },
  });

  return screen;
}
