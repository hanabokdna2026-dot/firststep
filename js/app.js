/**
 * 풍성한 첫걸음 - 앱 진입점
 *
 * URL 해시 기반 라우팅:
 * - #welcome  → 환영 화면
 * - #name     → 이름 묻기
 * - #pace     → 보통 속도
 * - #intro    → 안내
 * - #notify   → 알림 시간
 * - #home     → 홈
 *
 * 캐시 처리:
 * 모든 모듈을 dynamic import로 가져오면서 URL에 timestamp 붙임.
 * 이러면 매 페이지 로드마다 모든 JS가 새로 받아짐.
 * (개발 단계용 - 8단계에서 Service Worker로 정식 처리)
 */

// 페이지 로드 시점의 timestamp (모든 import에 붙음)
const v = '?v=' + Date.now();

// Storage는 다른 모듈들도 사용하니 먼저 import
const { default: Storage } = await import('./storage.js' + v);

// 라우트별 모듈 lazy 로드 (필요할 때 import)
const routeLoaders = {
  '#welcome': () => import('./screens/welcome.js' + v).then(m => m.default),
  '#name': () => import('./screens/name.js' + v).then(m => m.default),
  '#pace': () => import('./screens/pace.js' + v).then(m => m.default),
  '#intro': () => import('./screens/intro.js' + v).then(m => m.default),
  '#notify': () => import('./screens/notify.js' + v).then(m => m.default),
  '#home': () => import('./screens/home.js' + v).then(m => m.default),
};

// 화면 전환
function navigateTo(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    // 같은 해시면 hashchange 이벤트가 안 생기니 직접 렌더
    render();
  }
}

// 화면 그리기
async function render() {
  const hash = window.location.hash || '#welcome';
  const loader = routeLoaders[hash];
  const app = document.getElementById('app');

  if (loader) {
    try {
      const renderFn = await loader();
      app.innerHTML = '';
      // renderFn이 async일 수도 있고 sync일 수도 있음
      const screen = await renderFn({ navigateTo });
      app.appendChild(screen);

      // 스크롤 위치 초기화
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
    // 잘못된 해시면 환영 화면으로
    navigateTo('#welcome');
  }
}

// 첫 진입 처리
function init() {
  // 해시가 없거나 #이면 적절한 화면으로
  if (!window.location.hash || window.location.hash === '#') {
    if (Storage.isOnboardingDone()) {
      window.location.hash = '#home';
    } else {
      window.location.hash = '#welcome';
    }
  }

  // 해시 변경 시 다시 렌더
  window.addEventListener('hashchange', render);

  // 첫 렌더
  render();
}

// 시작
init();
