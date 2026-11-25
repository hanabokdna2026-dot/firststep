/**
 * 화면 1 - 환영
 *
 * 풍성한 삶으로 첫걸음
 * 풍성한 삶으로 한 걸음씩 함께
 *
 * [로그인하고 시작하기] → #account/start → (가입·로그인) → #name → #role → #pace …
 * [로그인 없이 시작하기] → #name → #pace …
 */

export default function renderWelcome({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="screen-inner-centered">
      <div class="welcome-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="#FAEEDA" stroke-width="1.5"/>
          <path d="M12 6V12L16 14" stroke="#FAEEDA" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>

      <h1 class="title-large">풍성한 삶으로 첫걸음</h1>

      <p class="body-large" style="margin-bottom: 64px;">풍성한 삶으로<br/>한 걸음씩 함께</p>

      <div class="welcome-actions">
        <button class="btn" id="btn-login-start">로그인하고 시작하기</button>
        <button class="btn-ghost" id="btn-start">로그인 없이 시작하기</button>
        <p class="welcome-hint">로그인하면 이끄미로 모임을 이끌거나 따르미로 함께할 수 있고, 여러 기기에서 기록을 이어 볼 수 있어요. 다른 기기에서 쓰던 계정도 여기서 로그인하면 돼요.</p>
      </div>

      <div class="hanabok-credit">
        <img src="icons/hanabok-mark.svg" alt="하나님나라복음 DNA Network" class="hanabok-mark"/>
        <div class="hanabok-text">
          <p class="hanabok-text-ko">하나님나라복음</p>
          <p class="hanabok-text-en">DNA NETWORK</p>
        </div>
      </div>
    </div>
  `;

  // 로그인하고 시작 — 가입(또는 다른 기기 계정으로 로그인) 뒤 이름 → 함께하기 → 속도 …
  screen.querySelector('#btn-login-start').addEventListener('click', () => {
    navigateTo('#account/start');
  });

  // 로그인 없이 — 기록은 이 휴대폰에만 (나중에 설정에서 로그인 가능)
  screen.querySelector('#btn-start').addEventListener('click', () => {
    navigateTo('#name');
  });

  return screen;
}
