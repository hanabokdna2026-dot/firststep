/**
 * 세션 시작 인터스티셜
 *
 * URL: #session/:type
 *      #session/:type/:lesson/:day  (다른 날 보기에서 진입 시)
 *
 * 모든 세션 진입 전 한 박자 쉬는 자리.
 * "먼저 잠시 멈추세요" 메시지 + 시작 버튼.
 *
 * 시작 누르면 → #read/:type 또는 #read/:type/:lesson/:day
 */

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

  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="session-start">
      <p class="eyebrow" style="text-align: center;">${label}</p>

      <h2 class="title-centered">${intro.title}</h2>

      <p class="body-large session-start-body">${intro.body}</p>

      <div class="session-start-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8 2 5 5 5 9C5 13 8 14 8 18H16C16 14 19 13 19 9C19 5 16 2 12 2Z" stroke="#412402" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M9 21H15" stroke="#412402" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M10 18V21" stroke="#412402" stroke-width="1.5"/>
          <path d="M14 18V21" stroke="#412402" stroke-width="1.5"/>
        </svg>
      </div>

      <button class="btn btn-narrow" id="btn-begin">시작</button>

      <button class="btn-secondary" id="btn-back">홈으로</button>
    </div>
  `;

  screen.querySelector('#btn-begin').addEventListener('click', () => {
    navigateTo('#read/' + sessionType + overridePath);
  });

  screen.querySelector('#btn-back').addEventListener('click', () => {
    navigateTo('#home');
  });

  return screen;
}
