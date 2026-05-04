/**
 * 화면 5 - 알림 시간 정하기
 *
 * 알림
 * 언제 만나면 좋을까요
 *
 * - 아침: 오전 7:00
 * - 낮:   오후 1:00
 * - 저녁: 오후 10:00
 *
 * 시작할게요 → #home (온보딩 완료)
 * 알림 없이 시작 → #home (알림 비활성화)
 *
 * 구현 방식:
 * 각 시간 행을 <label>로 감싸서 input을 포함시킴.
 * label 어디든 누르면 input의 시간 picker가 뜸.
 * input은 화면 외곽으로 보내서 안 보이지만 정상 작동함.
 */

import Storage from '../storage.js';

// 24시간 → 한국식 표현 (오전/오후 H:MM)
function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${period} ${displayH}:${String(m).padStart(2, '0')}`;
}

export default function renderNotify({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  const times = Storage.getNotifyTimes();

  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">알림</p>

      <h2 class="title">언제 만나면<br/>좋을까요</h2>

      <p class="body" style="margin-bottom: 28px;">제 일과에 맞게 시간을 정해주세요.<br/>나중에 언제든 바꿀 수 있어요.</p>

      <div id="times">
        <label class="time-row" for="input-morning">
          <div>
            <p class="time-row-label">아침</p>
            <p class="time-row-value" id="display-morning">${formatTime(times.morning)}</p>
          </div>
          <span class="time-row-change">변경</span>
          <input type="time" class="time-input-hidden" id="input-morning" value="${times.morning}"/>
        </label>

        <label class="time-row" for="input-midday">
          <div>
            <p class="time-row-label">낮</p>
            <p class="time-row-value" id="display-midday">${formatTime(times.midday)}</p>
          </div>
          <span class="time-row-change">변경</span>
          <input type="time" class="time-input-hidden" id="input-midday" value="${times.midday}"/>
        </label>

        <label class="time-row" for="input-evening" style="margin-bottom: 24px;">
          <div>
            <p class="time-row-label">저녁</p>
            <p class="time-row-value" id="display-evening">${formatTime(times.evening)}</p>
          </div>
          <span class="time-row-change">변경</span>
          <input type="time" class="time-input-hidden" id="input-evening" value="${times.evening}"/>
        </label>
      </div>

      <p class="subtle" style="margin-bottom: 28px;">알림은 부드럽게 한 번씩 울려요.<br/>방해되면 끄셔도 돼요.</p>

      <button class="btn" id="btn-start">시작할게요</button>
      <button class="btn-secondary" id="btn-no-notify" style="margin-top: 4px;">알림 없이 시작</button>
    </div>
  `;

  // 현재 시간 상태 (사용자가 변경한 값을 모음)
  const currentTimes = { ...times };

  // 시간 input이 바뀌면 표시 업데이트
  ['morning', 'midday', 'evening'].forEach(key => {
    const input = screen.querySelector(`#input-${key}`);
    const display = screen.querySelector(`#display-${key}`);
    input.addEventListener('change', () => {
      currentTimes[key] = input.value;
      display.textContent = formatTime(input.value);
    });
  });

  // 시작 버튼
  screen.querySelector('#btn-start').addEventListener('click', () => {
    Storage.setNotifyTimes(currentTimes);
    Storage.setNotifyEnabled(true);
    Storage.setOnboardingDone();
    navigateTo('#home');
  });

  // 알림 없이 시작
  screen.querySelector('#btn-no-notify').addEventListener('click', () => {
    Storage.setNotifyTimes(currentTimes);
    Storage.setNotifyEnabled(false);
    Storage.setOnboardingDone();
    navigateTo('#home');
  });

  return screen;
}
