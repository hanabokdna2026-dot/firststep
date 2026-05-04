/**
 * 마침 화면
 *
 * URL: #done/:type
 *   :type = morning | midday | evening
 *
 * "잘 마쳤어요" + 다음 세션 안내 + 홈으로
 *
 * 이 화면에 들어오면 그 세션을 완료로 기록.
 * 마지막 세션(저녁)이면 다음 일로 진도 진행.
 */

import Storage from '../storage.js';
import {
  getSessionLabel,
  getNextSessionTime,
  formatKoreanShortTime,
  getTodayISO,
} from '../time.js';
import { getNextDay, hasNext } from '../content.js';

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

export default async function renderDone({ navigateTo, param }) {
  const sessionType = param || 'morning';
  const sessionLabel = getSessionLabel(sessionType);
  const message = SESSION_DONE_MESSAGES[sessionType] || '';

  const screen = document.createElement('div');
  screen.className = 'screen';

  // 진도 정보
  const lessonId = Storage.getCurrentLesson();
  const dayIndex = Storage.getCurrentDay();
  const todayISO = getTodayISO();

  // 세션 완료 기록
  Storage.markSessionDone(todayISO, sessionType);

  // 저녁이면 다음 일로 진도 진행
  let dayProgressed = false;
  let isJourneyEnd = false;
  if (sessionType === 'evening') {
    const hasMore = await hasNext(lessonId, dayIndex);
    if (hasMore) {
      const next = getNextDay(lessonId, dayIndex);
      Storage.setCurrentLesson(next.lessonId);
      Storage.setCurrentDay(next.dayIndex);
      dayProgressed = true;
    } else {
      isJourneyEnd = true;
    }
  }

  // 다음 세션 안내 (저녁이면 내일 아침)
  const next = getNextSessionTime();
  const nextLabel = getSessionLabel(next.type);
  const nextTime = formatKoreanShortTime(next.time);
  const nextHint = NEXT_HINT[sessionType] || '';

  // 다음 세션 카드 (여정 끝이면 다른 메시지)
  let nextCardHtml = '';
  if (isJourneyEnd) {
    nextCardHtml = `
      <div class="done-next-card done-journey-end">
        <p class="done-next-label">여정의 끝</p>
        <p class="done-next-value">풍성한 첫걸음을 모두 함께 걸으셨습니다</p>
      </div>
    `;
  } else if (sessionType === 'evening') {
    // 다음 날 진도가 새 과의 첫째 날이면 안내 추가
    const nextLesson = Storage.getCurrentLesson();
    const nextDay = Storage.getCurrentDay();
    const isNewLesson = dayProgressed && nextDay === 1 && nextLesson > 1;
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
