/**
 * 세션 시작 인터스티셜
 *
 * URL: #session/:type
 *      #session/:type/:lesson/:day  (여정 전체 보기에서 진입 시)
 *
 * 모든 세션 진입 전 한 박자 쉬는 자리.
 * "먼저 잠시 멈추세요" 메시지 + 시작 버튼.
 *
 * 이미 마친 세션이면 "이미 마쳤어요" 안내 + 마침 해제 옵션.
 *
 * 시작 누르면 → #read/:type 또는 #read/:type/:lesson/:day
 */

import Storage from '../storage.js';

const SESSION_LABELS = {
  morning: '아침 세션',
  midday: '낮 세션',
  evening: '저녁 세션',
};

const SESSION_INTROS = {
  morning: {
    title: '먼저 잠시 멈추세요',
    body: '서두르지 않습니다.<br/>깊게 한 번 숨을 쉬어봅니다.',
  },
  midday: {
    title: '잠시 짬을 내어',
    body: '오늘의 짧은 단락을<br/>흘려 읽어보겠습니다.',
  },
  evening: {
    title: '하루를 마치며',
    body: '오늘 만난 그 말씀에<br/>다시 머물러봅니다.',
  },
};

export default function renderSessionStart({ navigateTo, param, extra }) {
  const sessionType = param || 'morning';
  const label = SESSION_LABELS[sessionType] || '세션';
  const intro = SESSION_INTROS[sessionType] || SESSION_INTROS.morning;

  // 다른 날에서 진입한 경우 extra에 [lessonId, dayIndex] 들어있음
  const lessonOverride = extra && extra[0] ? extra[0] : null;
  const dayOverride = extra && extra[1] ? extra[1] : null;
  const overridePath = (lessonOverride && dayOverride) ? `/${lessonOverride}/${dayOverride}` : '';

  // 실제 lessonId/dayIndex 결정 (override가 있으면 그것, 없으면 현재 진도)
  const lessonId = lessonOverride || Storage.getCurrentLesson();
  const dayIndex = dayOverride || Storage.getCurrentDay();

  // 이미 마친 세션인지 확인
  const isDone = Storage.isDaySessionDone(lessonId, dayIndex, sessionType);

  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="session-start">
      <p class="eyebrow" style="text-align: center;">${label}</p>

      <h2 class="title-centered">${isDone ? '이미 만났어요' : intro.title}</h2>

      <p class="body-large session-start-body">${
        isDone
          ? '오늘 이 세션은 이미 마치셨어요.<br/>다시 만나도 좋고, 마침 표시를 풀어도 됩니다.'
          : intro.body
      }</p>

      <div class="session-start-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8 2 5 5 5 9C5 13 8 14 8 18H16C16 14 19 13 19 9C19 5 16 2 12 2Z" stroke="#412402" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M9 21H15" stroke="#412402" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M10 18V21" stroke="#412402" stroke-width="1.5"/>
          <path d="M14 18V21" stroke="#412402" stroke-width="1.5"/>
        </svg>
      </div>

      <button class="btn btn-narrow" id="btn-begin">${isDone ? '다시 만나기' : '시작'}</button>

      ${isDone ? `
        <button class="btn-tertiary" id="btn-unmark">마침 표시 풀기</button>
      ` : ''}

      <button class="btn-secondary" id="btn-back">홈으로</button>
    </div>
  `;

  screen.querySelector('#btn-begin').addEventListener('click', () => {
    navigateTo('#read/' + sessionType + overridePath);
  });

  screen.querySelector('#btn-back').addEventListener('click', () => {
    navigateTo('#home');
  });

  // 마침 해제
  if (isDone) {
    screen.querySelector('#btn-unmark').addEventListener('click', () => {
      if (confirm('이 세션의 마침 표시를 풀까요?\n\n다시 마칠 때까지 마치지 않은 세션으로 보입니다.')) {
        // 일별 마침 해제
        Storage.unmarkDaySessionDone(lessonId, dayIndex, sessionType);
        // 오늘 날짜 기준 마침도 풀기 (현재 진도와 같은 자리일 때만 의미 있음)
        if (lessonId === Storage.getCurrentLesson() && dayIndex === Storage.getCurrentDay()) {
          // 오늘 마쳤다고 기록된 거라면 풀어주기
          // dateStr 알아내기 (오늘만 풀어줌 - 다른 날짜의 흔적은 남겨둠)
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const todayStr = `${yyyy}-${mm}-${dd}`;
          Storage.unmarkTodaySession(todayStr, sessionType);
        }
        // 홈으로 (홈에서 세션 카드가 미마침 상태로 다시 보임)
        navigateTo('#home');
      }
    });
  }

  return screen;
}
