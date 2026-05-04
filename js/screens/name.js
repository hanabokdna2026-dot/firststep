/**
 * 화면 2 - 이름 묻기
 *
 * 처음 만남
 * 이 시간을 함께할 이름을 알려주세요
 * 하나님이 이미 알고 계시지만, 저희도 부르고 싶어요.
 *
 * 입력 → #pace
 * 건너뛸게요 → #pace (이름 없이)
 */

import Storage from '../storage.js';

export default function renderName({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">처음 만남</p>

      <h2 class="title">이 시간을 함께할<br/>이름을 알려주세요</h2>

      <p class="body" style="margin-bottom: 32px;">하나님이 이미 알고 계시지만,<br/>저희도 부르고 싶어요.</p>

      <input
        type="text"
        class="input-text"
        id="name-input"
        placeholder="이름이나 부르고 싶은 호칭"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        maxlength="20"
      />

      <div class="form-actions">
        <button class="btn" id="btn-next">다음</button>
        <button class="btn-secondary" id="btn-skip">건너뛸게요</button>
      </div>
    </div>
  `;

  const input = screen.querySelector('#name-input');
  const btnNext = screen.querySelector('#btn-next');
  const btnSkip = screen.querySelector('#btn-skip');

  // 기존 값이 있으면 채워넣기 (뒤로 갔다 다시 왔을 때)
  const existingName = Storage.getUserName();
  if (existingName) {
    input.value = existingName;
  }

  // 자동 포커스 (모바일에서는 키보드 자동 안 뜨는 경우도 있음)
  // 즉시 포커스 안 하고 살짝 지연 — 화면 전환 애니메이션 후
  setTimeout(() => input.focus(), 300);

  // 다음 버튼 — 입력값 저장 후 진행
  btnNext.addEventListener('click', () => {
    const name = input.value.trim();
    if (name) {
      Storage.setUserName(name);
    }
    navigateTo('#pace');
  });

  // 건너뛰기 — 이름 비워둠
  btnSkip.addEventListener('click', () => {
    Storage.setUserName('');
    navigateTo('#pace');
  });

  // 엔터 키로 다음
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnNext.click();
    }
  });

  return screen;
}
