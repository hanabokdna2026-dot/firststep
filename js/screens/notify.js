/**
 * 화면 5 - 알림 시간 정하기
 *
 * 알림
 * 언제 만나면 좋을까요
 *
 * 구현 방식 변경:
 * input[type=time]을 그대로 보여주되 디자인을 맞춤.
 * label도 hidden input도 안 쓰고, 그냥 input이 picker를 직접 트리거.
 * iOS·Android 모두 안정적으로 작동.
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
        <div class="time-row-v2">
          <p class="time-row-label">아침</p>
          <input type="time" class="time-input-v2" id="input-morning" value="${times.morning}"/>
        </div>

        <div class="time-row-v2">
          <p class="time-row-label">낮</p>
          <input type="time" class="time-input-v2" id="input-midday" value="${times.midday}"/>
        </div>

        <div class="time-row-v2" style="margin-bottom: 24px;">
          <p class="time-row-label">저녁</p>
          <input type="time" class="time-input-v2" id="input-evening" value="${times.evening}"/>
        </div>
      </div>

      <p class="subtle" style="margin-bottom: 28px;">시간을 누르면 바꿀 수 있어요.<br/>알림은 부드럽게 한 번씩 울려요.</p>

      <button class="btn" id="btn-start">시작할게요</button>
      <button class="btn-secondary" id="btn-no-notify" style="margin-top: 4px;">알림 없이 시작</button>
    </div>
  `;

  // 현재 시간 상태 (사용자가 변경한 값을 모음)
  const currentTimes = { ...times };

  // 시간 input이 바뀌면 currentTimes 업데이트
  ['morning', 'midday', 'evening'].forEach(key => {
    const input = screen.querySelector(`#input-${key}`);
    input.addEventListener('change', () => {
      currentTimes[key] = input.value;
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
