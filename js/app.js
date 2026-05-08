/**
 * 풍성한 삶으로 첫걸음 - 앱 진입점
 *
 * URL 해시 기반 라우팅:
 *
 * 정적 라우트:
 * - #welcome  → 환영
 * - #name     → 이름
 * - #pace     → 보통 속도
 * - #intro    → 안내
 * - #notify   → 만날 시간
 * - #home     → 홈
 *
 * 동적 라우트 (세션):
 * - #session/:type → 세션 시작 인터스티셜 (먼저 잠시 멈추세요)
 * - #read/:type    → 본문/통독/묵상 화면
 * - #done/:type    → 마침 화면
 *   :type은 morning | midday | evening
 *
 * 캐시 처리:
 * 모든 모듈을 dynamic import로 가져오면서 URL에 timestamp 붙임.
 */

// 페이지 로드 시점의 timestamp (모든 import에 붙음)
const v = '?v=' + Date.now();

// Storage는 다른 모듈들도 사용하니 먼저 import
const { default: Storage } = await import('./storage.js' + v);

// 라우트 매핑 — 정적 라우트와 동적 라우트(prefix 매칭)
// 정적 라우트는 정확히 일치, 동적은 'prefix/:param' 형태
const routes = [
  { pattern: '#welcome', loader: () => import('./screens/welcome.js' + v) },
  { pattern: '#name', loader: () => import('./screens/name.js' + v) },
  { pattern: '#pace', loader: () => import('./screens/pace.js' + v) },
  { pattern: '#intro', loader: () => import('./screens/intro.js' + v) },
  { pattern: '#notify', loader: () => import('./screens/notify.js' + v) },
  { pattern: '#home', loader: () => import('./screens/home.js' + v) },
  { pattern: '#home/', loader: () => import('./screens/home.js' + v) },
  { pattern: '#record', loader: () => import('./screens/record.js' + v) },
  { pattern: '#settings', loader: () => import('./screens/settings.js' + v) },
  { pattern: '#pace-check', loader: () => import('./screens/pace-check.js' + v) },
  { pattern: '#journey', loader: () => import('./screens/journey.js' + v) },
  { pattern: '#session/', loader: () => import('./screens/session-start.js' + v) },
  { pattern: '#read/', loader: () => import('./screens/read.js' + v) },
  { pattern: '#silence/', loader: () => import('./screens/silence.js' + v) },
  { pattern: '#done/', loader: () => import('./screens/done.js' + v) },
];

// 해시에서 라우트와 파라미터 추출
function matchRoute(hash) {
  // 정확히 일치하는 정적 라우트 먼저 찾기
  for (const route of routes) {
    if (route.pattern === hash) {
      return { route, param: null };
    }
  }
  // prefix로 시작하는 동적 라우트 찾기
  for (const route of routes) {
    if (route.pattern.endsWith('/') && hash.startsWith(route.pattern)) {
      const rest = hash.slice(route.pattern.length);
      // 슬래시로 split — param이 단순 문자열일 수도 있고 'morning/1/3' 같은 복합일 수도 있음
      const parts = rest.split('/');
      const param = parts[0];
      const extra = parts.slice(1);
      return { route, param, extra };
    }
  }
  return null;
}

// 화면 전환
function navigateTo(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    render();
  }
}

// 동시 render 방지 — 진행 중인 render가 있으면 새 요청은 그것이 끝난 후에
let renderInFlight = null;

// 화면 그리기
async function render() {
  // 이미 진행 중이면 그것이 끝나기를 기다림 (중복 진행 방지)
  if (renderInFlight) {
    await renderInFlight;
  }

  renderInFlight = (async () => {
    const hash = window.location.hash || '#welcome';
    const matched = matchRoute(hash);
    const app = document.getElementById('app');

    if (matched) {
      try {
        const module = await matched.route.loader();
        const renderFn = module.default;
        // 화면을 그리기 직전에 한 번 더 비우기 (완전히 클린)
        app.innerHTML = '';
        const screen = await renderFn({ navigateTo, param: matched.param, extra: matched.extra });
        // await 후에도 또 한 번 비워서, 그 사이에 들어온 요청 결과가 있어도 깨끗하게
        app.innerHTML = '';
        app.appendChild(screen);
        window.scrollTo(0, 0);
      } catch (e) {
        console.error('화면 로딩 실패:', e);
        app.innerHTML = `
          <div style="padding: 48px 32px; text-align: center;">
            <p style="color: #412402;">화면을 불러오는 중 문제가 있어요.</p>
            <p style="color: #854F0B; font-size: 13px; margin-top: 12px;">새로고침 해보세요.</p>
          </div>
        `;
      }
    } else {
      navigateTo('#welcome');
    }
  })();

  await renderInFlight;
  renderInFlight = null;
}

// 첫 진입 처리
async function init() {
  // hashchange 리스너부터 등록
  window.addEventListener('hashchange', render);

  // 글씨 크기 적용 (body에 data-text-size 속성)
  document.body.setAttribute('data-text-size', Storage.getTextSize());

  // 빠진 날 자동 진행 (사용자가 며칠 빼먹어도 자연스럽게 흘러감)
  // 온보딩 마친 사용자만 — 새 사용자는 진도 아직 시작 안 함
  if (Storage.isOnboardingDone()) {
    try {
      const { catchUpMissedDays } = await import('./catch-up.js' + v);
      await catchUpMissedDays();
    } catch (e) {
      // catch-up 실패해도 앱 시작은 정상 진행
      console.error('Catch-up error:', e);
    }
  }

  // 옛 사용자 자리 갈무리 — scheduledSlots이 없으면 자동 더해주기
  // (옛 결로 알림 켜둔 사용자가 새 효율 짜임으로 짜이게)
  if (Storage.isPushEnabled() && Storage.getPushToken()) {
    try {
      const { updateMeetingTimes } = await import('./push-notifications.js' + v);
      // 백그라운드로 실행 (await 안 함 — 앱 시작 막지 않게)
      updateMeetingTimes();
    } catch (e) {
      console.warn('푸시 자리 갱신 실패:', e);
    }
  }

  // 빈 해시면 적절한 자리로 — 이때 hash를 바꾸면 hashchange가 발생해 render가 호출됨
  // 그래서 직접 render() 호출은 안 함 (이중 호출 방지)
  if (!window.location.hash || window.location.hash === '#') {
    if (Storage.isOnboardingDone()) {
      window.location.hash = '#home';
    } else {
      window.location.hash = '#welcome';
    }
    // hashchange가 알아서 render 부름
  } else {
    // 해시가 이미 있는 경우 (예: PWA가 이전 상태로 복원되거나, 사용자가 URL 직접 입력)
    render();
  }
}

init();
