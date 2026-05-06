/**
 * 화면 5 - 만날 시간 정하기 (온보딩)
 *
 * 매일 그분과 만날 자리의 시간을 정하는 자리.
 * 알림은 보내지 않음 — 사용자가 자기 약속으로 정하는 짜임.
 *
 * 사용자가 정한 시간은 홈 화면 카드에 표시되어 그 시간 자리를 짚을 수 있게.
 */

import Storage from '../storage.js';
import { getTodayISO } from '../time.js';

export default function renderNotify({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  const times = Storage.getNotifyTimes();

  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">만날 시간</p>

      <h2 class="title">언제 만나면<br/>좋을까요</h2>

      <p class="body" style="margin-bottom: 28px;">매일 그분과 만날 자리의 시간을 정해두세요.<br/>약속이 있으면 자리에 머물기 쉬워집니다.</p>

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

      <p class="subtle" style="margin-bottom: 28px;">시간을 누르면 바꿀 수 있어요.<br/>직접 휴대폰의 알람이나 캘린더에<br/>약속을 적어두시면 좋아요.</p>

      <button class="btn" id="btn-start">시작할게요</button>
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
    Storage.setOnboardingDone();
    Storage.setLastAdvanceDate(getTodayISO());  // 첫 진도 시작점을 오늘로
    navigateTo('#home');
  });

  return screen;
}
