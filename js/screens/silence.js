/**
 * 잠잠히 머물기
 *
 * URL: #silence/:type
 *   :type = morning | evening (낮은 잠잠히 없음)
 *
 * 한 화면 안에서 세 상태를 전환:
 *   1. setup    — 시간 설정 (기본 1분, ± 30초씩)
 *   2. counting — 카운트다운 진행 중 (호 + 숫자)
 *   3. done     — 마침 종 후 ("잘 마쳤어요")
 *
 * 시작 종이 울리고 카운트다운 시작.
 * 0:00 되면 마침 종 울리고 화면 부드럽게 변형.
 * 사용자가 "홈으로" 누르면 #done/:type 으로.
 */

const SILENCE_DEFAULT_SECONDS = 60;  // 기본 1분
const SILENCE_STEP = 30;              // ± 30초
const SILENCE_MIN = 30;               // 최소 30초
const SILENCE_MAX = 600;              // 최대 10분

// 종소리 파일 — 잔향 살린 버전 (5초)
const BELL_PATH = 'assets/sounds/bell-medium.mp3';

// 종소리 (preload)
let bellAudio = null;
function getBellAudio() {
  if (!bellAudio) {
    bellAudio = new Audio(BELL_PATH);
    bellAudio.preload = 'auto';
  }
  return bellAudio;
}

// 종 울리기 — 새 Audio 객체로 매번 (이전 재생이 안 끝나도 새로 시작)
function playBell() {
  const audio = new Audio(BELL_PATH);
  audio.play().catch(e => {
    // 자동 재생 정책 등으로 실패할 수 있음 — 조용히 무시
    console.warn('종소리 재생 실패:', e);
  });
}

// 초 → "M:SS" 형식
function formatSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function renderSilence({ navigateTo, param, extra }) {
  const sessionType = param || 'morning';

  // 다른 일에서 진입한 경우
  const overrideLesson = extra && extra[0] ? parseInt(extra[0], 10) : null;
  const overrideDay = extra && extra[1] ? parseInt(extra[1], 10) : null;
  const isOverride = !!(overrideLesson && overrideDay);

  const screen = document.createElement('div');
  screen.className = 'screen';

  // 상태
  let state = 'setup';        // setup | counting | done
  let totalSeconds = SILENCE_DEFAULT_SECONDS;
  let remainingSeconds = totalSeconds;
  let intervalId = null;
  let startTime = null;        // 정확한 카운트다운을 위해 setInterval 대신 시계 사용

  // 종소리 미리 로드 (사용자 인터랙션 후에야 실제로 가능)
  getBellAudio();

  function render() {
    if (state === 'setup') {
      renderSetup();
    } else if (state === 'counting') {
      renderCounting();
    } else if (state === 'done') {
      renderDone();
    }
  }

  // ============================================
  // 1. 시간 설정 화면
  // ============================================
  function renderSetup() {
    screen.innerHTML = `
      <div class="silence-screen">
        <div class="silence-header">
          <button class="silence-header-back" id="btn-back">‹ 뒤로</button>
          <p class="silence-header-title">잠잠히</p>
          <div class="silence-header-spacer"></div>
        </div>

        <div class="silence-setup">
          <h2 class="title-centered silence-setup-title">잠시<br/>하나님 앞에 머뭅니다</h2>

          <p class="body-large silence-setup-sub">이번엔 말 없이.<br/>아무것도 하지 않고 그저 함께.</p>

          <p class="silence-setup-label">머물 시간</p>

          <div class="silence-time-control">
            <button class="silence-time-btn" id="btn-minus" ${totalSeconds <= SILENCE_MIN ? 'disabled' : ''}>−</button>
            <p class="silence-time-display">
              <span class="silence-time-num">${formatSeconds(totalSeconds)}</span>
            </p>
            <button class="silence-time-btn" id="btn-plus" ${totalSeconds >= SILENCE_MAX ? 'disabled' : ''}>+</button>
          </div>

          <div class="silence-setup-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8 2 5 5 5 9C5 13 8 14 8 18H16C16 14 19 13 19 9C19 5 16 2 12 2Z" stroke="#412402" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M9 21H15" stroke="#412402" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M10 18V21" stroke="#412402" stroke-width="1.5"/>
              <path d="M14 18V21" stroke="#412402" stroke-width="1.5"/>
            </svg>
          </div>

          <p class="silence-setup-hint">시작 종이 울리고 시간이 흐릅니다.<br/>마침 종이 울리면 천천히 마치셔도 됩니다.</p>

          <button class="btn btn-narrow silence-start-btn" id="btn-start-bell">시작 종 울리기</button>
        </div>
      </div>
    `;

    screen.querySelector('#btn-back').addEventListener('click', () => {
      // 뒤로 — 본문 화면으로
      navigateTo('#read/' + sessionType);
    });

    screen.querySelector('#btn-minus').addEventListener('click', () => {
      if (totalSeconds > SILENCE_MIN) {
        totalSeconds -= SILENCE_STEP;
        renderSetup();
      }
    });

    screen.querySelector('#btn-plus').addEventListener('click', () => {
      if (totalSeconds < SILENCE_MAX) {
        totalSeconds += SILENCE_STEP;
        renderSetup();
      }
    });

    screen.querySelector('#btn-start-bell').addEventListener('click', () => {
      startCounting();
    });
  }

  // ============================================
  // 2. 카운트다운 시작
  // ============================================
  function startCounting() {
    state = 'counting';
    remainingSeconds = totalSeconds;
    startTime = Date.now();

    // 시작 종 울림
    playBell();

    // 집중 모드 (앱 이름 라벨 더 옅어짐)
    document.body.classList.add('silence-deep');

    renderCounting();

    // 1초마다 업데이트 (실제 시간 기반)
    intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      remainingSeconds = Math.max(0, totalSeconds - elapsed);

      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        intervalId = null;
        // 마침 종 울리고 done 상태로
        playBell();
        // 집중 모드 해제
        document.body.classList.remove('silence-deep');
        state = 'done';
        renderDone();
      } else {
        updateCountingDisplay();
      }
    }, 1000);
  }

  // ============================================
  // 카운트다운 화면 렌더
  // ============================================
  function renderCounting() {
    const radius = 92;
    const circumference = 2 * Math.PI * radius;
    const progress = remainingSeconds / totalSeconds;
    const dashOffset = circumference * (1 - progress);

    screen.innerHTML = `
      <div class="silence-screen">
        <div class="silence-header silence-header-minimal">
          <div class="silence-header-spacer"></div>
          <div class="silence-header-spacer"></div>
          <button class="silence-skip" id="btn-skip">건너뛰기</button>
        </div>

        <div class="silence-counting">
          <p class="silence-counting-label">잠잠히</p>

          <div class="silence-circle">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="${radius}" stroke="rgba(186, 117, 23, 0.2)" stroke-width="0.5" fill="none"/>
              <circle
                cx="100" cy="100" r="${radius}"
                stroke="#BA7517" stroke-width="2" fill="none"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${dashOffset}"
                stroke-linecap="round"
                transform="rotate(-90 100 100)"
                style="transition: stroke-dashoffset 1s linear;"
                id="progress-circle"
              />
            </svg>
            <div class="silence-circle-inner">
              <p class="silence-circle-time" id="time-display">${formatSeconds(remainingSeconds)}</p>
              <p class="silence-circle-hint">남은 시간</p>
            </div>
          </div>

          <p class="silence-counting-quote">아무 말 없이.<br/>그저 함께 있는 시간입니다.</p>
        </div>
      </div>
    `;

    screen.querySelector('#btn-skip').addEventListener('click', () => {
      // 건너뛰기 — 카운트다운 멈추고 마침 종 울리고 done으로
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      // 집중 모드 해제
      document.body.classList.remove('silence-deep');
      playBell();
      state = 'done';
      renderDone();
    });
  }

  // 카운트다운 진행 중 매 초 업데이트 (전체 다시 그리지 않고 부분만)
  function updateCountingDisplay() {
    const timeEl = screen.querySelector('#time-display');
    const circleEl = screen.querySelector('#progress-circle');
    if (timeEl) {
      timeEl.textContent = formatSeconds(remainingSeconds);
    }
    if (circleEl) {
      const radius = 92;
      const circumference = 2 * Math.PI * radius;
      const progress = remainingSeconds / totalSeconds;
      const dashOffset = circumference * (1 - progress);
      circleEl.setAttribute('stroke-dashoffset', dashOffset);
    }
  }

  // ============================================
  // 3. 마침 화면
  // ============================================
  async function renderDone() {
    // 세션 완료 처리 (완료 기록 + 진도 진행)
    const { completeSession } = await import('../session-complete.js?v=' + Date.now());
    if (isOverride) {
      await completeSession(sessionType, { lessonId: overrideLesson, dayIndex: overrideDay });
    } else {
      await completeSession(sessionType);
    }

    screen.innerHTML = `
      <div class="silence-screen">
        <div class="silence-done">
          <div class="silence-done-circle">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="92" stroke="rgba(186, 117, 23, 0.3)" stroke-width="0.5" fill="none"/>
            </svg>
            <div class="silence-circle-inner">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8 2 5 5 5 9C5 13 8 14 8 18H16C16 14 19 13 19 9C19 5 16 2 12 2Z" stroke="#854F0B" stroke-width="1" stroke-linejoin="round"/>
                <path d="M9 21H15" stroke="#854F0B" stroke-width="1" stroke-linecap="round"/>
                <path d="M10 18V21" stroke="#854F0B" stroke-width="1"/>
                <path d="M14 18V21" stroke="#854F0B" stroke-width="1"/>
              </svg>
              <p class="silence-done-bell-label">마침 종이 울렸어요</p>
            </div>
          </div>

          <h2 class="title-centered silence-done-title">잘 마쳤어요</h2>

          <p class="body-large silence-done-message">더 머물고 싶으시면 머물러도 좋아요.<br/>준비되시면 천천히 닫으시면 됩니다.</p>

          <button class="btn btn-narrow" id="btn-finish">홈으로</button>
        </div>
      </div>
    `;

    screen.querySelector('#btn-finish').addEventListener('click', () => {
      // 바로 홈으로 (별도 마침 화면 거치지 않음)
      navigateTo('#home');
    });
  }

  // 첫 렌더
  render();

  // 화면이 사라질 때 정리 (라우팅으로 다른 화면 가면 이 함수의 클로저는 살아있지만
  // intervalId는 cleanup 필요. 대안: hashchange 이벤트로 청소)
  // 단순하게는 anchor 변경되면 자동으로 화면이 다시 그려지면서 정리됨.
  // 다만 interval이 살아있으면 메모리 leak이라 그것만 처리.
  const cleanupOnHashChange = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // 집중 모드 해제 (혹시 카운트다운 중에 떠난 경우)
    document.body.classList.remove('silence-deep');
    window.removeEventListener('hashchange', cleanupOnHashChange);
  };
  window.addEventListener('hashchange', cleanupOnHashChange);

  return screen;
}
