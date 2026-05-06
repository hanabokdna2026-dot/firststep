/**
 * 잠잠히 머물기
 *
 * URL: #silence/:type
 *   :type = morning | evening (낮은 잠잠히 없음)
 *
 * 한 화면 안에서 세 상태를 전환:
 *   1. setup    — 시간 설정 (기본 시간은 과별로 다름, ± 30초씩 조정 가능)
 *   2. counting — 카운트다운 진행 중 (호 + 숫자)
 *   3. done     — 마침 종 후 ("잘 마쳤어요")
 *
 * 시작 종이 울리고 카운트다운 시작.
 * 0:00 되면 마침 종 울리고 화면 부드럽게 변형.
 * 사용자가 "홈으로" 누르면 #done/:type 으로.
 *
 * 아침 머무름 기본 시간 (과별 차등):
 *   - 1~6과: 1분 (60초)
 *   - 7~8과: 2분 (120초)
 *   - 9~10과: 3분 (180초)
 *   저녁 머무름은 lessons.json의 silenceSeconds로 차등 적용 (10~30초)
 */

import Storage from '../storage.js';

const SILENCE_STEP = 30;              // ± 30초
const SILENCE_MIN = 30;               // 최소 30초
const SILENCE_MAX = 600;              // 최대 10분

// 아침 머무름 기본 시간 — 과별로 점점 깊어지는 흐름
function getMorningSilenceDefault(lessonId) {
  if (lessonId >= 9) return 180;  // 9·10과: 3분
  if (lessonId >= 7) return 120;  // 7·8과: 2분
  return 60;                      // 1~6과: 1분
}

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

// 종 울리기 — 같은 Audio 객체 재사용 (iOS Safari가 시간 지난 후
// 새 Audio 객체 자동 재생을 막을 수 있어서, 첫 user gesture로 풀린 객체를 계속 사용)
function playBell() {
  const audio = getBellAudio();
  try {
    audio.currentTime = 0;  // 처음부터 다시
    audio.play().catch(e => {
      // 자동 재생 정책 등으로 실패할 수 있음 — 조용히 무시
      console.warn('종소리 재생 실패:', e);
    });
  } catch (e) {
    console.warn('종소리 재생 실패:', e);
  }
}

// ==========================================
// 자연의 소리 — 머무는 동안 부드럽게 깔리는 ambient
// ==========================================
const NATURE_PATH = 'assets/sounds/nature.mp3';
const NATURE_VOLUME = 0.3;
let natureAudio = null;
let natureFadeTimerId = null;

function getNatureAudio() {
  if (!natureAudio) {
    natureAudio = new Audio(NATURE_PATH);
    natureAudio.loop = true;
    natureAudio.volume = NATURE_VOLUME;
    natureAudio.preload = 'auto';
  }
  return natureAudio;
}

function startNature() {
  if (!Storage.isNatureSoundOn()) return;
  const audio = getNatureAudio();
  try {
    audio.currentTime = 0;
    audio.volume = NATURE_VOLUME;
    audio.play().catch(e => {
      console.warn('자연의 소리 재생 실패:', e);
    });
  } catch (e) {
    console.warn('자연의 소리 재생 실패:', e);
  }
}

function stopNature() {
  if (!natureAudio) return;
  if (natureFadeTimerId) {
    clearInterval(natureFadeTimerId);
    natureFadeTimerId = null;
  }
  try {
    natureAudio.pause();
    natureAudio.currentTime = 0;
    natureAudio.volume = NATURE_VOLUME;
  } catch (e) { /* 무시 */ }
}

// 부드럽게 페이드아웃 후 멈춤 (마침 종 직전에)
function fadeOutNature(durationMs) {
  if (!natureAudio || natureAudio.paused) return;
  if (natureFadeTimerId) {
    clearInterval(natureFadeTimerId);
  }
  const steps = 20;
  const stepTime = durationMs / steps;
  const startVolume = natureAudio.volume;
  const volStep = startVolume / steps;
  let count = 0;
  natureFadeTimerId = setInterval(() => {
    count++;
    if (natureAudio) {
      natureAudio.volume = Math.max(0, natureAudio.volume - volStep);
    }
    if (count >= steps) {
      clearInterval(natureFadeTimerId);
      natureFadeTimerId = null;
      if (natureAudio) {
        try {
          natureAudio.pause();
          natureAudio.currentTime = 0;
          natureAudio.volume = NATURE_VOLUME;
        } catch (e) { /* 무시 */ }
      }
    }
  }, stepTime);
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

  // 현재 lessonId 가져오기 (override 우선, 없으면 storage)
  const lessonId = overrideLesson || Storage.getCurrentLesson() || 1;

  // 상태
  let state = 'setup';        // setup | preparing | counting | done
  // 아침 머무름 — 과별로 다른 기본 시간 / 저녁 머무름 — 1분 (저녁은 lessons.json silenceSeconds로 별도 처리됨)
  let totalSeconds = sessionType === 'morning'
    ? getMorningSilenceDefault(lessonId)
    : 60;
  let remainingSeconds = totalSeconds;
  let overflowSeconds = 0;     // 마침 종 후 +로 흐르는 시간
  let bellRang = false;        // 마침 종 한 번 울렸는지 (중복 방지)
  let intervalId = null;
  let startTime = null;        // 정확한 카운트다운을 위해 setInterval 대신 시계 사용
  let wakeLock = null;         // 화면이 꺼지지 않게 (iOS 16.4+ / Android 지원)
  let visibilityHandler = null; // background에서 돌아올 때 점검용
  let natureStartTimer = null;  // 시작 종 후 5초 후 자연의 소리 시작 타이머

  // 종소리 + 자연 소리 미리 로드 (사용자 인터랙션 후에야 실제로 가능)
  getBellAudio();
  if (Storage.isNatureSoundOn()) {
    getNatureAudio();  // 토글이 켜져 있으면 미리 다운로드 시작
  }

  // ============================================
  // 0초에 닿았는지 점검 — 마침 종 처리
  // (background에서 돌아왔을 때나 setInterval 안에서 부름)
  // ============================================
  // ============================================
  // 시간 점검 — 매 초 부르기 (setInterval) + background 복귀 시
  // 0초에 닿으면 마침 종 한 번 울리고, 그 후엔 +로 시간 흐름
  // 사용자가 '마쳤어요' 누를 때 done으로
  // ============================================
  function checkAndComplete() {
    if (state !== 'counting' || !startTime) return false;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    if (elapsed < totalSeconds) {
      // 아직 카운트다운 중
      remainingSeconds = totalSeconds - elapsed;
      overflowSeconds = 0;

      // 끝 2초 남았을 때 자연의 소리 페이드아웃 시작 (1.8초 동안)
      // setInterval이 매 초 호출되니 정확히 2초에 한 번만 발동되도록
      if (remainingSeconds === 2 && natureAudio && !natureAudio.paused) {
        fadeOutNature(1800);
      }
    } else {
      // 0초 도달 (또는 지남)
      remainingSeconds = 0;
      overflowSeconds = elapsed - totalSeconds;

      if (!bellRang) {
        // 마침 종 한 번만 울림
        bellRang = true;
        // 시작 5초 자연 소리 타이머가 아직 안 발동했으면 취소
        if (natureStartTimer) {
          clearTimeout(natureStartTimer);
          natureStartTimer = null;
        }
        // 자연 소리 안전하게 멈춤 (페이드아웃이 안 끝났을 수도 있음)
        stopNature();
        playBell();
        // 화면 갈무리 — '마쳤어요' 버튼 보이게 + 안내 갱신
        renderCounting();
      }
    }
    return false;  // done으로 자동 안 감 (사용자가 '마쳤어요' 눌러야)
  }

  // ============================================
  // Wake Lock — 머무는 동안 화면이 안 꺼지게
  // ============================================
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (e) {
        // Wake Lock 못 받아도 진행 (visibilitychange로 보완됨)
        console.warn('wake lock 실패:', e);
      }
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) { /* 무시 */ }
      wakeLock = null;
    }
  }

  function render() {
    if (state === 'setup') {
      renderSetup();
    } else if (state === 'preparing') {
      renderPreparing();
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

          <label class="silence-nature-toggle">
            <span class="silence-nature-icon">🍃</span>
            <span class="silence-nature-label">머무는 동안 자연의 소리</span>
            <span class="silence-nature-switch">
              <input type="checkbox" id="natureToggle" ${Storage.isNatureSoundOn() ? 'checked' : ''}>
              <span class="silence-nature-slider"></span>
            </span>
          </label>

          <button class="btn btn-narrow silence-start-btn" id="btn-start-bell">시작 종 울리기</button>
        </div>
      </div>
    `;

    screen.querySelector('#natureToggle').addEventListener('change', (e) => {
      Storage.setNatureSoundOn(e.target.checked);
    });

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
      startPreparing();
    });
  }

  // ============================================
  // 1.5. 시작 전 3초 유예 — 마음 가다듬는 자리
  // ============================================
  let prepareTimerId = null;
  function startPreparing() {
    state = 'preparing';
    let prepareSeconds = 3;

    renderPreparing(prepareSeconds);

    prepareTimerId = setInterval(() => {
      prepareSeconds -= 1;
      if (prepareSeconds <= 0) {
        clearInterval(prepareTimerId);
        prepareTimerId = null;
        // 시작 종이 울리고 카운트다운 시작
        startCounting();
      } else {
        renderPreparing(prepareSeconds);
      }
    }, 1000);
  }

  function renderPreparing(seconds) {
    screen.innerHTML = `
      <div class="silence-screen">
        <div class="silence-header silence-header-minimal">
          <div class="silence-header-spacer"></div>
          <div class="silence-header-spacer"></div>
          <div class="silence-header-spacer"></div>
        </div>

        <div class="silence-counting">
          <p class="silence-counting-label">곧 시작합니다</p>

          <div class="silence-circle">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="92" stroke="rgba(186, 117, 23, 0.15)" stroke-width="0.5" fill="none"/>
            </svg>
            <div class="silence-circle-inner">
              <p class="silence-circle-time silence-prepare-num">${seconds}</p>
              <p class="silence-circle-hint">호흡을 가다듬으세요</p>
            </div>
          </div>

          <p class="silence-counting-quote">잠시 후 시작 종이 울립니다.</p>
        </div>
      </div>
    `;
  }

  // ============================================
  // 2. 카운트다운 시작
  // ============================================
  function startCounting() {
    state = 'counting';
    remainingSeconds = totalSeconds;
    overflowSeconds = 0;
    bellRang = false;
    startTime = Date.now();

    // 시작 종 울림
    playBell();

    // 5초 후 자연의 소리 시작 (시작 종 잔향이 끝난 다음 부드럽게)
    natureStartTimer = setTimeout(() => {
      startNature();
      natureStartTimer = null;
    }, 5000);

    // Wake Lock — 화면이 안 꺼지게 (지원하는 OS에서)
    requestWakeLock();

    // visibilitychange — background에서 돌아오면 즉시 시간 점검
    // (모바일에서 화면 잠그면 setInterval이 멈추니까 마침 종을 놓칠 수 있음)
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        // 돌아왔을 때 wake lock도 다시 요청 (한 번 풀렸을 수 있음)
        if (state === 'counting' && !wakeLock) {
          requestWakeLock();
        }
        // 시간 점검 — 이미 0초 지났으면 즉시 마침 처리
        checkAndComplete();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // 집중 모드 (앱 이름 라벨 더 옅어짐)
    document.body.classList.add('silence-deep');

    renderCounting();

    // 1초마다 업데이트 (실제 시간 기반)
    intervalId = setInterval(() => {
      checkAndComplete();
      updateCountingDisplay();
    }, 1000);
  }

  // ============================================
  // 카운트다운 화면 렌더
  // ============================================
  function renderCounting() {
    const radius = 92;
    const circumference = 2 * Math.PI * radius;
    const progress = bellRang ? 1 : (remainingSeconds / totalSeconds);
    const dashOffset = circumference * (1 - progress);

    // 마침 종 울리기 전: 카운트다운 중 / 울린 후: +로 흐름
    const timeText = bellRang
      ? '+' + formatSeconds(overflowSeconds)
      : formatSeconds(remainingSeconds);
    const hintText = bellRang ? '마침 종이 울렸어요' : '남은 시간';
    const quoteText = bellRang
      ? '천천히 마치셔도 됩니다.<br/>준비되시면 마침을 누르세요.'
      : '아무 말 없이.<br/>그저 함께 있는 시간입니다.';

    // 오른쪽 위 버튼: 카운트다운 중엔 '건너뛰기', 마침 종 울린 후엔 '마쳤어요'
    const rightBtnLabel = bellRang ? '마쳤어요' : '건너뛰기';
    const rightBtnId = bellRang ? 'btn-finish' : 'btn-skip';

    screen.innerHTML = `
      <div class="silence-screen">
        <div class="silence-header silence-header-minimal">
          <div class="silence-header-spacer"></div>
          <div class="silence-header-spacer"></div>
          <button class="silence-skip" id="${rightBtnId}">${rightBtnLabel}</button>
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
              <p class="silence-circle-time" id="time-display">${timeText}</p>
              <p class="silence-circle-hint" id="time-hint">${hintText}</p>
            </div>
          </div>

          <p class="silence-counting-quote">${quoteText}</p>
        </div>
      </div>
    `;

    // 마치기 (건너뛰기 또는 마쳤어요) 핸들러
    const finishHandler = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      // 시작 5초 타이머 + 자연 소리 정리
      if (natureStartTimer) {
        clearTimeout(natureStartTimer);
        natureStartTimer = null;
      }
      stopNature();
      document.body.classList.remove('silence-deep');
      releaseWakeLock();
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
      // 마침 종 — 아직 안 울렸으면 울림 (건너뛰기)
      if (!bellRang) {
        playBell();
      }
      state = 'done';
      renderDone();
    };

    screen.querySelector(`#${rightBtnId}`).addEventListener('click', finishHandler);
  }

  // 카운트다운 진행 중 매 초 업데이트 (전체 다시 그리지 않고 부분만)
  function updateCountingDisplay() {
    const timeEl = screen.querySelector('#time-display');
    const circleEl = screen.querySelector('#progress-circle');
    if (timeEl) {
      // 마침 종 울리기 전: 카운트다운 / 후: +로 흐름
      timeEl.textContent = bellRang
        ? '+' + formatSeconds(overflowSeconds)
        : formatSeconds(remainingSeconds);
    }
    if (circleEl) {
      const radius = 92;
      const circumference = 2 * Math.PI * radius;
      // 마침 종 후엔 원이 가득 찬 채로 (progress = 1)
      const progress = bellRang ? 1 : (remainingSeconds / totalSeconds);
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
