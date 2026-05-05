/**
 * 일 목록 화면
 *
 * URL: #days/:lessonId
 *
 * 그 과의 6일 카드를 한눈에 볼 수 있음.
 * - 진행 중인 일은 강조
 * - 마친 일은 체크 표시
 * - 어떤 일이든 누르면 그 일의 아침 세션으로 진입
 *   (다른 날 마쳐도 진도는 안 움직임 - session-complete에서 처리)
 */

import Storage from '../storage.js';
import { getLesson } from '../content.js';

export default async function renderDays({ navigateTo, param }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  const lessonId = parseInt(param, 10) || Storage.getCurrentLesson();
  const currentLesson = Storage.getCurrentLesson();
  const currentDay = Storage.getCurrentDay();

  // 콘텐츠
  let lesson;
  try {
    lesson = await getLesson(lessonId);
  } catch (e) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">콘텐츠를 불러올 수 없어요.</p>
    </div>`;
    return screen;
  }

  if (!lesson) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">이 과는 아직 없어요.</p>
    </div>`;
    return screen;
  }

  // 6일 카드 만들기
  const dayCards = lesson.days.map(day => {
    const isCurrent = (lessonId === currentLesson && day.dayIndex === currentDay);
    const fullyDone = Storage.isDayFullyDone(lessonId, day.dayIndex);
    const started = Storage.isDayStarted(lessonId, day.dayIndex);

    let statusBadge = '';
    let cardClass = 'days-day-card';

    if (fullyDone) {
      cardClass += ' days-day-card-done';
      statusBadge = `
        <span class="days-day-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      `;
    } else if (started) {
      cardClass += ' days-day-card-started';
      statusBadge = '<span class="days-day-status-text">진행 중</span>';
    }

    if (isCurrent) {
      cardClass += ' days-day-card-current';
    }

    return `
      <button class="${cardClass}" data-day="${day.dayIndex}">
        <div class="days-day-card-header">
          <span class="days-day-label">${day.dayLabel}</span>
          ${statusBadge}
        </div>
        <p class="days-day-verse">${day.verses.saebeon}</p>
        <p class="days-day-ref">— ${day.verseRef}</p>
        ${isCurrent ? '<p class="days-day-current-mark">지금 이 자리</p>' : ''}
      </button>
    `;
  }).join('');

  screen.innerHTML = `
    <div class="screen-inner-with-tabs">
      <div class="days-header">
        <button class="days-back" id="btn-back">‹ 홈</button>
      </div>

      <div class="days-title-row">
        <p class="eyebrow">${lessonId}과</p>
        <h2 class="title-small days-lesson-title">${lesson.title}</h2>
        ${lesson.coreMessage ? `<p class="days-core-message">${lesson.coreMessage}</p>` : ''}
      </div>

      <p class="days-list-label">여섯 날의 만남</p>

      <div class="days-list">
        ${dayCards}
      </div>

      <p class="subtle days-hint">어떤 날이든 누르면 그 날의 본문을 만날 수 있어요.<br/>다른 날을 마쳐도 진도는 그대로 둡니다.</p>
    </div>
  `;

  // 뒤로
  screen.querySelector('#btn-back').addEventListener('click', () => {
    navigateTo('#home');
  });

  // 일 카드 클릭 — 그 일의 아침 세션으로
  screen.querySelectorAll('.days-day-card').forEach(card => {
    card.addEventListener('click', () => {
      const dayIndex = card.dataset.day;
      // 진행 중인 일이면 일반 세션으로, 다른 일이면 override path로
      if (lessonId === currentLesson && parseInt(dayIndex, 10) === currentDay) {
        navigateTo('#session/morning');
      } else {
        navigateTo(`#session/morning/${lessonId}/${dayIndex}`);
      }
    });
  });

  return screen;
}
