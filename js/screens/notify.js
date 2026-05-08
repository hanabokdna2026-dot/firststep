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

      <!-- 알림 켜기 자리 -->
      <div class="notify-push-card" id="push-card">
        <p class="notify-push-title">🔔 알림 받기</p>
        <p class="notify-push-body">약속하신 시간에 부드럽게 알려드릴게요.</p>
        <button class="btn btn-narrow" id="btn-enable-push">알림 켜기</button>
        <p class="notify-push-hint">나중에 설정에서 끄거나 갈무리할 수 있어요.</p>
      </div>

      <p class="subtle" style="margin-bottom: 28px;">시간을 누르면 바꿀 수 있어요.<br/>휴대폰의 알람이나 캘린더에 따로<br/>약속을 적어두셔도 좋아요.</p>

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

  // 알림 켜기 버튼 자리 짜임
  setupPushButton(screen, currentTimes);

  // 시작 버튼
  screen.querySelector('#btn-start').addEventListener('click', () => {
    Storage.setNotifyTimes(currentTimes);
    Storage.setOnboardingDone();
    Storage.setLastAdvanceDate(getTodayISO());  // 첫 진도 시작점을 오늘로
    navigateTo('#home');
  });

  return screen;
}

/**
 * 알림 켜기 버튼 자리 — 사용자가 알림 켰는지 살펴보고 보여주기
 */
async function setupPushButton(screen, currentTimes) {
  const card = screen.querySelector('#push-card');
  if (!card) return;

  try {
    const { isPushSupported, getNotificationPermission, enablePushNotifications } =
      await import('../push-notifications.js');

    if (!isPushSupported()) {
      // 푸시 자체를 못 받는 자리 — 카드 숨기기
      card.style.display = 'none';
      return;
    }

    const renderState = () => {
      const enabled = Storage.isPushEnabled();
      const permission = getNotificationPermission();

      if (enabled && permission === 'granted') {
        card.innerHTML = `
          <p class="notify-push-title">🔔 알림이 켜져 있어요</p>
          <p class="notify-push-body">약속하신 시간에 부드럽게 알려드릴게요.</p>
        `;
      } else if (permission === 'denied') {
        card.innerHTML = `
          <p class="notify-push-title">🔔 알림 받기</p>
          <p class="notify-push-body">알림이 차단되어 있어요.<br/>휴대폰 설정에서 알림을 허용해 주세요.</p>
        `;
      } else {
        // 기본 자리 — 켜기 버튼
        card.innerHTML = `
          <p class="notify-push-title">🔔 알림 받기</p>
          <p class="notify-push-body">약속하신 시간에 부드럽게 알려드릴게요.</p>
          <button class="btn btn-narrow" id="btn-enable-push">알림 켜기</button>
          <p class="notify-push-hint">나중에 설정에서 끄거나 갈무리할 수 있어요.</p>
        `;
        const btn = card.querySelector('#btn-enable-push');
        btn.addEventListener('click', async () => {
          // 사용자가 입력한 시간을 미리 저장 (alarm 짜임에 같이 보내기 위해)
          Storage.setNotifyTimes(currentTimes);

          btn.disabled = true;
          btn.textContent = '알림 켜는 중...';
          const result = await enablePushNotifications();

          if (result.success) {
            renderState();  // 켜진 자리로 갈무리
          } else {
            btn.disabled = false;
            btn.textContent = '알림 켜기';
            alert(result.message);
          }
        });
      }
    };

    renderState();
  } catch (err) {
    console.warn('알림 자리 짜임 실패:', err);
    card.style.display = 'none';
  }
}
