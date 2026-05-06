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
  const textSize = Storage.getTextSize();

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
        <p class="settings-section-hint">매일 그분과 만날 자리의 시간이에요.<br/>직접 휴대폰의 알람이나 캘린더에 약속을 적어두시면 좋아요.</p>

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

      <!-- 글씨 크기 -->
      <div class="settings-section">
        <p class="settings-section-label">글씨 크기</p>
        <p class="settings-section-hint">본문과 묵상의 글씨 크기예요.</p>

        <div class="text-size-segment" id="text-size-segment">
          <button class="text-size-option ${textSize === 'small' ? 'is-active' : ''}" data-size="small">
            <span class="text-size-sample text-size-sample-small">가</span>
            <span class="text-size-label">작게</span>
          </button>
          <button class="text-size-option ${textSize === 'medium' ? 'is-active' : ''}" data-size="medium">
            <span class="text-size-sample text-size-sample-medium">가</span>
            <span class="text-size-label">보통</span>
          </button>
          <button class="text-size-option ${textSize === 'large' ? 'is-active' : ''}" data-size="large">
            <span class="text-size-sample text-size-sample-large">가</span>
            <span class="text-size-label">크게</span>
          </button>
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

  // 글씨 크기 선택 — 누르자마자 즉시 미리보기 (body에 적용)
  let selectedTextSize = textSize;
  screen.querySelectorAll('.text-size-option').forEach(opt => {
    opt.addEventListener('click', () => {
      screen.querySelectorAll('.text-size-option').forEach(o => o.classList.remove('is-active'));
      opt.classList.add('is-active');
      selectedTextSize = opt.dataset.size;
      // 즉시 적용 (저장하기 전이라도 미리보기로 결을 짚을 수 있게)
      document.body.setAttribute('data-text-size', selectedTextSize);
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
    // 글씨 크기
    Storage.setTextSize(selectedTextSize);

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
