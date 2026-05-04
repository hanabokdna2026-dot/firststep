/**
 * 화면 4 - 안내
 *
 * 처음에는
 * 하루 세 번, 하나님 앞에 머뭅니다
 *
 * - 아침 · 약 3분 — 오늘의 말씀을 처음 만납니다
 * - 낮 · 약 2분 — 짧은 단락을 흘려 읽습니다
 * - 저녁 · 약 3분 — 하루를 돌아보며 다시 만납니다
 *
 * 시간은 자라날 거예요. 처음에는 가볍게.
 * 정답이 없어요. 못한 날도 괜찮아요.
 *
 * 다음 → #notify
 */

export default function renderIntro({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">처음에는</p>

      <h2 class="title">하루 세 번,<br/>하나님 앞에 머뭅니다</h2>

      <div style="margin-top: 28px;">
        <div class="session-time-card">
          <p class="session-time-label">아침 · 약 3분</p>
          <p class="session-time-desc">오늘의 말씀을 처음 만납니다</p>
        </div>

        <div class="session-time-card">
          <p class="session-time-label">낮 · 약 2분</p>
          <p class="session-time-desc">짧은 단락을 흘려 읽습니다</p>
        </div>

        <div class="session-time-card" style="margin-bottom: 24px;">
          <p class="session-time-label">저녁 · 약 3분</p>
          <p class="session-time-desc">하루를 돌아보며 다시 만납니다</p>
        </div>
      </div>

      <p class="subtle" style="margin-bottom: 24px;">시간은 자라날 거예요. 처음에는 가볍게.<br/>정답이 없어요. 못한 날도 괜찮아요.</p>

      <button class="btn" id="btn-next">다음</button>
    </div>
  `;

  screen.querySelector('#btn-next').addEventListener('click', () => {
    navigateTo('#notify');
  });

  return screen;
}
