/**
 * 화면 1 - 환영
 *
 * 풍성한 첫걸음
 * 풍성한 삶으로 한 걸음씩 함께
 *
 * [시작하기] → #name
 * [이미 시작한 적이 있어요] → (v2 기능, MVP에서는 노출만)
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

      <h1 class="title-large">풍성한 첫걸음</h1>

      <p class="body-large" style="margin-bottom: 64px;">풍성한 삶으로<br/>한 걸음씩 함께</p>

      <div style="width: 100%; max-width: 280px;">
        <button class="btn" id="btn-start">시작하기</button>
        <button class="btn-secondary" id="btn-existing">이미 시작한 적이 있어요</button>
      </div>
    </div>
  `;

  screen.querySelector('#btn-start').addEventListener('click', () => {
    navigateTo('#name');
  });

  screen.querySelector('#btn-existing').addEventListener('click', () => {
    // v2 기능 - MVP에서는 알림만
    alert('데이터 복원 기능은 다음 버전에 준비됩니다.');
  });

  return screen;
}
