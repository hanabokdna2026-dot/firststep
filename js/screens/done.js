/**
 * 낮 통독 마침 화면
 *
 * URL: #done/:type  (실제로는 :type='midday'만 사용)
 *
 * 아침/저녁은 잠잠히 마침 화면에서 직접 홈으로 가므로
 * 이 화면은 낮 통독 후에만 거침.
 *
 * "잘 마쳤어요" + 다음 세션 안내 + 홈으로
 */

import Storage from '../storage.js';
import {
  getSessionLabel,
  getNextSessionTime,
  formatKoreanShortTime,
} from '../time.js';

const SESSION_DONE_MESSAGES = {
  morning: '오늘 아침 세션을 마쳤습니다.<br/>이 말씀을 마음에 두고 하루를 살아가요.',
  midday: '낮 세션을 마쳤습니다.<br/>본문이 마음에 잠겨들기를.',
  evening: '오늘 하루를 마칩니다.<br/>주님 안에서 평안히 쉬시기를.',
};

const NEXT_HINT = {
  morning: '짧은 단락을 함께 읽어요',
  midday: '하루를 돌아보며 다시 만나요',
  evening: '내일 아침에 새 말씀이 기다려요',
};

export default async function renderDone({ navigateTo, param, extra }) {
  const sessionType = param || 'midday';
  const sessionLabel = getSessionLabel(sessionType);
  const message = SESSION_DONE_MESSAGES[sessionType] || '';

  // 다른 일에서 진입한 경우
  const overrideLesson = extra && extra[0] ? parseInt(extra[0], 10) : null;
  const overrideDay = extra && extra[1] ? parseInt(extra[1], 10) : null;
  const isOverride = !!(overrideLesson && overrideDay);

  const screen = document.createElement('div');
  screen.className = 'screen';

  // 세션 완료 처리 (완료 기록 + 진도 진행)
  const { completeSession } = await import('../session-complete.js?v=' + Date.now());
  const result = isOverride
    ? await completeSession(sessionType, { lessonId: overrideLesson, dayIndex: overrideDay })
    : await completeSession(sessionType);

  // 다음 세션 안내
  const next = getNextSessionTime();
  const nextLabel = getSessionLabel(next.type);
  const nextTime = formatKoreanShortTime(next.time);
  const nextHint = NEXT_HINT[sessionType] || '';

  // 다음 세션 카드
  let nextCardHtml = '';
  if (result.isJourneyEnd) {
    nextCardHtml = `
      <div class="done-next-card done-journey-end">
        <p class="done-next-label">여정의 끝</p>
        <p class="done-next-value">풍성한 삶으로 첫걸음을 모두 함께 걸으셨습니다</p>
      </div>
    `;
  } else if (sessionType === 'evening') {
    const nextLesson = Storage.getCurrentLesson();
    const nextDay = Storage.getCurrentDay();
    const isNewLesson = result.progressed && nextDay === 1 && nextLesson > 1;
    nextCardHtml = `
      <div class="done-next-card">
        <p class="done-next-label">다음 만남</p>
        <p class="done-next-value">${nextLabel} · ${nextTime}</p>
        ${isNewLesson ? `<p class="done-next-hint">${nextLesson}과를 새롭게 시작합니다</p>` : `<p class="done-next-hint">${nextHint}</p>`}
      </div>
    `;
  } else {
    nextCardHtml = `
      <div class="done-next-card">
        <p class="done-next-label">다음 만남</p>
        <p class="done-next-value">${nextLabel} · ${nextTime}</p>
        <p class="done-next-hint">${nextHint}</p>
      </div>
    `;
  }

  screen.innerHTML = `
    <div class="done-screen">
      <div class="done-icon">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M10 18L16 24L26 12" stroke="#854F0B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <h2 class="title-centered">잘 마쳤어요</h2>

      <p class="body-large done-message">${message}</p>

      ${nextCardHtml}

      <button class="btn-narrow done-cta" id="btn-home">홈으로</button>
    </div>
  `;

  screen.querySelector('#btn-home').addEventListener('click', () => {
    navigateTo('#home');
  });

  return screen;
}
