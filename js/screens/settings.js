/**
 * 설정 화면
 *
 * URL: #settings
 *
 * 변경 가능:
 * - 이름
 * - 기본 속도
 * - 알림 시간 (아침/낮/저녁)
 * - 알림 켜기/끄기
 *
 * 그리고:
 * - 데이터 초기화 (위험)
 */

import Storage from '../storage.js';
import { getLesson, getActiveDayIndices } from '../content.js';

const PACE_LABELS = {
  one: '한 과씩 천천히',
  two: '두 과씩 빠르게',
  three: '세 과씩 더 빠르게',
};

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${period} ${displayH}:${String(m).padStart(2, '0')}`;
}

export default function renderSettings({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  const userName = Storage.getUserName();
  const defaultPace = Storage.getDefaultPace();
  const notifyTimes = Storage.getNotifyTimes();

  screen.innerHTML = `
    <div class="screen-inner-with-tabs">
      <div class="settings-header">
        <p class="eyebrow">설정</p>
      </div>

      <!-- 이름 -->
      <div class="settings-section">
        <p class="settings-section-label">이름</p>
        <input
          type="text"
          class="input-text"
          id="input-name"
          value="${escapeAttr(userName)}"
          placeholder="이름이나 부르고 싶은 호칭"
          autocomplete="off"
          maxlength="20"
        />
      </div>

      <!-- 기본 속도 -->
      <div class="settings-section">
        <p class="settings-section-label">기본 속도</p>
        <div id="pace-options">
          ${Object.entries(PACE_LABELS).map(([id, label]) => `
            <button
              class="settings-pace-option ${id === defaultPace ? 'selected' : ''}"
              data-pace="${id}"
            >
              ${label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 만날 시간 -->
      <div class="settings-section">
        <p class="settings-section-label">만날 시간</p>
        <p class="settings-section-hint">매일 그분과 만날 자리의 시간이에요.</p>

        <div class="time-row-v2">
          <p class="time-row-label">아침</p>
          <input type="time" class="time-input-v2" id="input-morning" value="${notifyTimes.morning}"/>
        </div>

        <div class="time-row-v2">
          <p class="time-row-label">낮</p>
          <input type="time" class="time-input-v2" id="input-midday" value="${notifyTimes.midday}"/>
        </div>

        <div class="time-row-v2">
          <p class="time-row-label">저녁</p>
          <input type="time" class="time-input-v2" id="input-evening" value="${notifyTimes.evening}"/>
        </div>
      </div>

      <!-- 푸시 알림 -->
      <div class="settings-section" id="push-section">
        <p class="settings-section-label">알림</p>
        <p class="settings-section-hint">약속한 시간에 부드럽게 알려드릴게요.</p>

        <div id="push-status">
          <p class="push-status-loading">자리 살펴보는 중...</p>
        </div>
      </div>

      <!-- 저장 -->
      <button class="btn settings-save-btn" id="btn-save">변경사항 저장</button>

      <!-- 데이터 초기화 (위험) -->
      <div class="settings-divider"></div>

      <div class="settings-section">
        <p class="settings-section-label">데이터</p>
        <button class="settings-danger-btn" id="btn-reset">처음부터 다시 시작</button>
        <p class="settings-danger-hint">저장된 모든 기록이 사라집니다.</p>
      </div>

      <!-- 하나복 footer -->
      <div class="hanabok-credit hanabok-credit-settings">
        <img src="icons/hanabok-mark.svg" alt="하나님나라복음 DNA Network" class="hanabok-mark"/>
        <div class="hanabok-text">
          <p class="hanabok-text-ko">하나님나라복음</p>
          <p class="hanabok-text-en">DNA NETWORK</p>
        </div>
      </div>
    </div>

    <nav class="home-tabbar">
      <button class="home-tab" data-tab="today">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
          <path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="home-tab-label">오늘</span>
      </button>
      <button class="home-tab" data-tab="record">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 5V21L12 17L4 21V5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span class="home-tab-label">기록</span>
      </button>
      <button class="home-tab home-tab-active" data-tab="settings">
        <svg class="home-tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="home-tab-label">설정</span>
      </button>
    </nav>
  `;

  // 기본 속도 선택
  let selectedPace = defaultPace;
  screen.querySelectorAll('.settings-pace-option').forEach(opt => {
    opt.addEventListener('click', () => {
      screen.querySelectorAll('.settings-pace-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedPace = opt.dataset.pace;
    });
  });

  // 저장 버튼
  screen.querySelector('#btn-save').addEventListener('click', async () => {
    // 이름
    Storage.setUserName(screen.querySelector('#input-name').value.trim());
    // 속도 — 기본 속도와 이번 주 속도 모두 갱신 (즉시 반영)
    Storage.setDefaultPace(selectedPace);
    Storage.setWeekPace(selectedPace);
    // 만날 시간
    Storage.setNotifyTimes({
      morning: screen.querySelector('#input-morning').value,
      midday: screen.querySelector('#input-midday').value,
      evening: screen.querySelector('#input-evening').value,
    });

    // 현재 자리가 새 속도에서 비활성이면 가장 가까운 활성 자리로 보정
    try {
      const currentLesson = Storage.getCurrentLesson();
      const currentDay = Storage.getCurrentDay();
      const lesson = await getLesson(currentLesson);
      if (lesson) {
        const activeDays = getActiveDayIndices(lesson, selectedPace);
        if (!activeDays.includes(currentDay)) {
          // 현재 자리가 비활성 — 가장 가까운 활성 자리로 (앞쪽 우선, 없으면 뒤)
          let target = activeDays.find(d => d >= currentDay);
          if (target === undefined) target = activeDays[activeDays.length - 1];
          if (target !== undefined) {
            Storage.setCurrentDay(target);
          }
        }
      }
    } catch (e) {
      // 보정 실패 시 무시 (저장은 이미 됨)
    }

    showToast(screen, '저장되었어요');

    // 푸시 켜져 있으면 약속 시간을 Firestore에도 갱신 (백그라운드로)
    if (Storage.isPushEnabled()) {
      try {
        const { updateMeetingTimes } = await import('../push-notifications.js');
        updateMeetingTimes();  // await 안 함 — 백그라운드로 진행
      } catch (e) { /* 무시 */ }
    }

    setTimeout(() => navigateTo('#home'), 800);
  });

  // 초기화
  screen.querySelector('#btn-reset').addEventListener('click', () => {
    if (confirm('정말 처음부터 다시 시작하시겠어요?\n\n저장된 모든 기록이 사라집니다.')) {
      Storage.clearAll();
      navigateTo('#welcome');
    }
  });

  // 탭
  screen.querySelectorAll('.home-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName === 'settings') return;
      if (tabName === 'today') navigateTo('#home');
      else if (tabName === 'record') navigateTo('#record');
    });
  });

  // 푸시 알림 자리 짜임 — 비동기로 진행
  setupPushSection(screen);

  return screen;
}

/**
 * 푸시 알림 자리 짜임 — 현재 상태 점검 + 켜고 끄기 버튼
 */
async function setupPushSection(screen) {
  const statusDiv = screen.querySelector('#push-status');
  if (!statusDiv) return;

  try {
    const { isPushSupported, getNotificationPermission, enablePushNotifications, disablePushNotifications } =
      await import('../push-notifications.js');

    if (!isPushSupported()) {
      statusDiv.innerHTML = '<p class="push-status-message">이 브라우저는 알림을 지원하지 않아요.</p>';
      return;
    }

    const renderState = () => {
      const enabled = Storage.isPushEnabled();
      const permission = getNotificationPermission();

      if (enabled && permission === 'granted') {
        statusDiv.innerHTML = `
          <div class="push-on-row">
            <span class="push-on-icon">🔔</span>
            <span class="push-on-text">알림이 켜져 있어요</span>
          </div>
          <button class="push-toggle-btn push-off-btn" id="btn-push-off">알림 끄기</button>
        `;
        statusDiv.querySelector('#btn-push-off').addEventListener('click', async () => {
          statusDiv.innerHTML = '<p class="push-status-loading">알림을 끄는 중...</p>';
          await disablePushNotifications();
          renderState();
        });
      } else if (permission === 'denied') {
        statusDiv.innerHTML = `
          <p class="push-status-message">알림이 차단되어 있어요.<br/>휴대폰 설정에서 알림 허용으로 바꿔주세요.</p>
        `;
      } else {
        statusDiv.innerHTML = `
          <button class="push-toggle-btn push-on-btn" id="btn-push-on">알림 켜기</button>
          <p class="push-status-hint">아침·낮·저녁 약속하신 시간에 부드럽게 알려드릴게요.</p>
        `;
        statusDiv.querySelector('#btn-push-on').addEventListener('click', async () => {
          statusDiv.innerHTML = '<p class="push-status-loading">알림을 켜는 중...</p>';
          // 만약 사용자가 시간을 입력한 채 아직 저장 안 했으면 — 먼저 저장
          Storage.setNotifyTimes({
            morning: screen.querySelector('#input-morning').value,
            midday: screen.querySelector('#input-midday').value,
            evening: screen.querySelector('#input-evening').value,
          });
          const result = await enablePushNotifications();
          if (result.success) {
            renderState();
            showToast(screen, result.message);
          } else {
            renderState();
            alert(result.message);
          }
        });
      }
    };

    renderState();
  } catch (err) {
    console.warn('푸시 자리 짜임 실패:', err);
    statusDiv.innerHTML = '<p class="push-status-message">알림 자리를 만들지 못했어요.</p>';
  }
}

// 짧은 토스트 메시지
function showToast(screen, message) {
  const toast = document.createElement('div');
  toast.className = 'settings-toast';
  toast.textContent = message;
  screen.appendChild(toast);
  setTimeout(() => toast.classList.add('settings-toast-visible'), 10);
}

function escapeAttr(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
