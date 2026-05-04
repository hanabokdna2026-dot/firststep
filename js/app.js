/**
 * 풍성한 첫걸음 - 앱 진입점
 *
 * URL 해시 기반 라우팅:
 * - #welcome  → 환영 화면
 * - #name     → 이름 묻기
 * - #pace     → 보통 속도
 * - #intro    → 안내
 * - #notify   → 알림 시간
 * - #home     → 홈 (다음 단계)
 *
 * 온보딩이 끝났으면 #home으로, 안 끝났으면 #welcome으로.
 */

import Storage from './storage.js';
import renderWelcome from './screens/welcome.js';
import renderName from './screens/name.js';
import renderPace from './screens/pace.js';
import renderIntro from './screens/intro.js';
import renderNotify from './screens/notify.js';
import renderHome from './screens/home.js';

// 라우팅 표
const routes = {
  '#welcome': renderWelcome,
  '#name': renderName,
  '#pace': renderPace,
  '#intro': renderIntro,
  '#notify': renderNotify,
  '#home': renderHome,
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
  const renderFn = routes[hash];
  const app = document.getElementById('app');

  if (renderFn) {
    app.innerHTML = '';
    // renderFn이 async일 수도 있고 sync일 수도 있음
    const screen = await renderFn({ navigateTo });
    app.appendChild(screen);

    // 스크롤 위치 초기화
    window.scrollTo(0, 0);
  } else {
    // 잘못된 해시면 환영 화면으로
    navigateTo('#welcome');
  }
}

// 임시 홈 스텁은 더 이상 사용 안 함 (renderHome으로 교체됨)

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
