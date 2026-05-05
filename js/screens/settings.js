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
import { requestNotificationPermission, startNotifyScheduler, stopNotifyScheduler } from '../notify.js';

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
  const notifyEnabled = Storage.getNotifyEnabled();

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

      <!-- 알림 시간 -->
      <div class="settings-section">
        <p class="settings-section-label">알림 시간</p>

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

        <label class="settings-toggle-row">
          <span class="settings-toggle-label">알림 켜기</span>
          <input type="checkbox" id="input-notify-enabled" ${notifyEnabled ? 'checked' : ''}/>
          <span class="settings-toggle-switch"></span>
        </label>
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
  screen.querySelector('#btn-save').addEventListener('click', () => {
    // 이름
    Storage.setUserName(screen.querySelector('#input-name').value.trim());
    // 속도
    Storage.setDefaultPace(selectedPace);
    // 알림 시간
    Storage.setNotifyTimes({
      morning: screen.querySelector('#input-morning').value,
      midday: screen.querySelector('#input-midday').value,
      evening: screen.querySelector('#input-evening').value,
    });
    // 알림 켜기
    const wasEnabled = Storage.getNotifyEnabled();
    const isEnabled = screen.querySelector('#input-notify-enabled').checked;
    Storage.setNotifyEnabled(isEnabled);

    // 알림 스케줄러 재시작 (정적 import된 함수 사용)
    try {
      // 알림 권한 새로 요청 (꺼져있다가 켜졌을 때)
      if (isEnabled && !wasEnabled) {
        requestNotificationPermission().catch(() => {});
      }
      if (isEnabled) {
        startNotifyScheduler();
      } else {
        stopNotifyScheduler();
      }
    } catch (e) {
      // 알림 모듈 사용 불가 시 무시
    }

    showToast(screen, '저장되었어요');
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

  return screen;
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
