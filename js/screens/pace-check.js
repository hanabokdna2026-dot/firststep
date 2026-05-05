/**
 * 새 과 시작 시 속도 확인 화면
 *
 * URL: #pace-check
 *
 * 사용자가 새 과를 시작할 때 한 번만 보임.
 * "기본 속도로" 누르면 평소 속도 그대로,
 * "이번 주만 ..." 누르면 이번 한 주만 다른 속도로.
 *
 * 이 화면은 home.js에서 자동으로 라우팅됨:
 * - 현재 과가 마지막 속도 확인한 과보다 크면 → 이 화면으로 보냄
 * - 사용자가 선택하면 LAST_PACE_CHECK_LESSON 업데이트하고 → #home
 */

import Storage from '../storage.js';
import { getLesson } from '../content.js';

const PACE_LABELS = {
  one: '한 과씩 천천히',
  two: '두 과씩 빠르게',
  three: '세 과씩 더 빠르게',
};

const PACE_DESCS = {
  one: '평소처럼 진행',
  two: '한 주에 두 과를 함께',
  three: '한 주에 세 과를 함께',
};

export default async function renderPaceCheck({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  const lessonId = Storage.getCurrentLesson();
  const defaultPace = Storage.getDefaultPace();

  // 현재 과 정보
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
    // 콘텐츠 끝까지 도달
    Storage.setLastPaceCheckLesson(lessonId);
    navigateTo('#home');
    return screen;
  }

  // 다른 두 속도 (기본 속도 외)
  const otherPaces = ['one', 'two', 'three'].filter(p => p !== defaultPace);

  // 핵심 메시지 (있으면 표시)
  const coreMessageHtml = lesson.coreMessage
    ? `<p class="pace-check-core-message">${lesson.coreMessage}</p>`
    : '';

  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">새 한 주</p>

      <h2 class="title">${lesson.id}과를<br/>시작합니다</h2>

      <p class="pace-check-lesson-title">${lesson.title}</p>
      ${coreMessageHtml}

      <div class="pace-check-divider"></div>

      <p class="pace-check-question">이번 주는 어떤 속도로 가실래요?</p>

      <button class="btn pace-check-default-btn" id="btn-default">
        <span class="pace-check-btn-main">이대로 가기</span>
        <span class="pace-check-btn-sub">${PACE_LABELS[defaultPace]} · ${PACE_DESCS[defaultPace]}</span>
      </button>

      <p class="pace-check-other-label">이번 주만 바꾸기</p>

      <div id="other-options">
        ${otherPaces.map(p => `
          <button class="option-card pace-check-other-card" data-pace="${p}">
            <p class="option-card-title">${PACE_LABELS[p]}</p>
            <p class="option-card-desc">${PACE_DESCS[p]}</p>
          </button>
        `).join('')}
      </div>

      <p class="subtle pace-check-hint">정해주시면 그대로 따라가요.<br/>천천히 골라보세요.</p>
    </div>
  `;

  // 기본 속도 그대로
  screen.querySelector('#btn-default').addEventListener('click', () => {
    Storage.setWeekPace(defaultPace);
    Storage.setLastPaceCheckLesson(lessonId);
    navigateTo('#home');
  });

  // 다른 속도 선택
  screen.querySelectorAll('.pace-check-other-card').forEach(card => {
    card.addEventListener('click', () => {
      const pace = card.dataset.pace;
      Storage.setWeekPace(pace);
      Storage.setLastPaceCheckLesson(lessonId);
      navigateTo('#home');
    });
  });

  return screen;
}
