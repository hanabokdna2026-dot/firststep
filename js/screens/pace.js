/**
 * 화면 3 - 기본 속도 정하기
 *
 * 속도
 * 어떤 속도로 가실래요
 * 매주 자유롭게 바꿀 수 있어요. 기본 속도만 정해두는 거예요.
 *
 * - 한 과씩 천천히 (권장)
 * - 두 과씩 빠르게
 * - 세 과씩 더 빠르게
 *
 * 다음 → #intro
 */

import Storage from '../storage.js';

const PACE_OPTIONS = [
  {
    id: 'one',
    title: '한 과씩 천천히',
    desc: '한 주에 한 과. 깊이 머물면서.',
    recommended: true,
  },
  {
    id: 'two',
    title: '두 과씩 빠르게',
    desc: '한 주에 두 과. 흐름을 빨리 따라가며.',
  },
  {
    id: 'three',
    title: '세 과씩 더 빠르게',
    desc: '한 주에 세 과. 큰 그림을 잡으며.',
  },
];

export default function renderPace({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  // 옵션 카드 HTML 생성
  const currentPace = Storage.getDefaultPace();
  const optionsHtml = PACE_OPTIONS.map(opt => `
    <button
      class="option-card ${opt.recommended ? 'recommended' : ''} ${opt.id === currentPace ? 'selected' : ''}"
      data-pace="${opt.id}"
      type="button"
    >
      <div class="option-card-header">
        <span class="option-card-title">${opt.title}</span>
        ${opt.recommended ? '<span class="option-card-badge">권장</span>' : ''}
      </div>
      <p class="option-card-desc">${opt.desc}</p>
    </button>
  `).join('');

  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">속도</p>

      <h2 class="title">어떤 속도로<br/>가실래요</h2>

      <p class="body" style="margin-bottom: 24px;">매주 자유롭게 바꿀 수 있어요.<br/>기본 속도만 정해두는 거예요.</p>

      <div id="options">
        ${optionsHtml}
      </div>

      <p class="subtle" style="margin: 16px 0 24px;">이끄미와 함께라면 평소 속도로 골라주세요. 매주 정해주시는 대로 바꾸면 돼요.</p>

      <button class="btn" id="btn-next">다음</button>
    </div>
  `;

  // 선택 가능한 변수
  let selectedPace = currentPace;

  // 옵션 클릭
  const optionCards = screen.querySelectorAll('.option-card');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      // 모든 카드에서 selected 빼기
      optionCards.forEach(c => c.classList.remove('selected'));
      // 누른 카드에 selected 추가
      card.classList.add('selected');
      // 선택값 저장
      selectedPace = card.dataset.pace;
    });
  });

  // 다음 버튼
  screen.querySelector('#btn-next').addEventListener('click', () => {
    Storage.setDefaultPace(selectedPace);
    Storage.setWeekPace(selectedPace);  // 첫 주는 기본 속도와 같음
    navigateTo('#intro');
  });

  return screen;
}
