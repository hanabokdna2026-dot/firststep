/**
 * 본문/통독/묵상 화면
 *
 * URL: #read/:type
 *   :type = morning | midday | evening
 *
 * 한 모듈로 세 세션 타입 다 처리. 세션 타입에 따라 다른 콘텐츠 보여줌.
 *
 * 아침: 본문 + 마음에 머물기 + 한 마디 기도 → "잠잠히 머물기"
 * 낮: 단락 본문 + 흘려 읽기 안내 → "읽었어요"
 * 저녁: 다시 그 말씀 + 하루 돌아보기 + 한 마디 기도 → "잠잠히 머물기"
 *
 * 잠잠히는 5단계에서. 일단 임시로 마침 화면으로.
 */

import Storage from '../storage.js';
import { getDay } from '../content.js';

const SESSION_LABELS = {
  morning: '아침',
  midday: '낮',
  evening: '저녁',
};

export default async function renderRead({ navigateTo, param, extra }) {
  const sessionType = param || 'morning';
  const sessionLabel = SESSION_LABELS[sessionType] || '';

  const screen = document.createElement('div');
  screen.className = 'screen';

  // 진도 정보 — extra에 있으면 그걸 쓰고, 없으면 진행 중인 일
  const overrideLesson = extra && extra[0] ? parseInt(extra[0], 10) : null;
  const overrideDay = extra && extra[1] ? parseInt(extra[1], 10) : null;
  const lessonId = overrideLesson || Storage.getCurrentLesson();
  const dayIndex = overrideDay || Storage.getCurrentDay();
  const isOverride = !!(overrideLesson && overrideDay);

  // 콘텐츠
  let day;
  try {
    day = await getDay(lessonId, dayIndex);
  } catch (e) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">콘텐츠를 불러올 수 없어요.</p>
    </div>`;
    return screen;
  }

  if (!day) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">오늘의 콘텐츠가 없어요.</p>
    </div>`;
    return screen;
  }

  // 세션 타입별로 다르게 렌더링
  if (sessionType === 'morning') {
    return renderMorning(screen, navigateTo, day, lessonId, dayIndex, isOverride);
  } else if (sessionType === 'midday') {
    return renderMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride);
  } else if (sessionType === 'evening') {
    return renderEvening(screen, navigateTo, day, lessonId, dayIndex, isOverride);
  }

  return screen;
}

// ==========================================
// 아침 본문 화면
// ==========================================
function renderMorning(screen, navigateTo, day, lessonId, dayIndex, isOverride) {
  // 번역 토글 — 세션 안에서만 유지 (기본 새번역)
  let currentTranslation = 'saebeon';
  const overridePath = isOverride ? `/${lessonId}/${dayIndex}` : '';

  const morning = day.morning;

  screen.innerHTML = `
    <div class="read-header">
      <button class="read-header-back" id="btn-close">‹ 닫기</button>
      <p class="read-header-title">아침 · ${day.dayLabel}</p>
      <button class="read-header-toggle" id="btn-toggle">새번역</button>
    </div>

    <div class="read-body">
      <p class="read-section-label">오늘의 말씀</p>

      <p class="read-verse" id="verse-text">${day.verses[currentTranslation]}</p>

      <p class="read-verse-ref">— ${day.verseRef}</p>

      <div class="read-divider"></div>

      <p class="read-section-label">마음에 머물기</p>
      <p class="read-guide-body">${morning.ponderQuestion}</p>

      <div class="read-divider"></div>

      <p class="read-section-label">하나님께 한 마디</p>
      ${morning.prayerLeadIn ? `<p class="read-guide-body">${morning.prayerLeadIn}</p>` : ''}

      <div class="read-prayer-example">
        <p class="read-prayer-example-text">"${morning.prayerExample}"</p>
      </div>

      <textarea
        class="read-prayer-input"
        id="prayer-input"
        placeholder="이 기도를 받아들이거나, 자기 말로 적어보세요"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      >${Storage.getPrayer(lessonId, dayIndex, 'morning')}</textarea>

      <button class="btn read-cta" id="btn-next">잠잠히 머물기</button>
    </div>
  `;

  // 번역 토글
  const toggleBtn = screen.querySelector('#btn-toggle');
  const verseEl = screen.querySelector('#verse-text');
  toggleBtn.addEventListener('click', () => {
    currentTranslation = currentTranslation === 'saebeon' ? 'gaeyeok' : 'saebeon';
    verseEl.textContent = day.verses[currentTranslation];
    toggleBtn.textContent = currentTranslation === 'saebeon' ? '새번역' : '개역개정';
  });

  // 닫기
  screen.querySelector('#btn-close').addEventListener('click', () => {
    saveAndExit(screen, lessonId, dayIndex, 'morning', navigateTo, '#home');
  });

  // 잠잠히 머물기 → silence 화면으로
  screen.querySelector('#btn-next').addEventListener('click', () => {
    saveAndExit(screen, lessonId, dayIndex, 'morning', navigateTo, '#silence/morning' + overridePath);
  });

  return screen;
}

// ==========================================
// 낮 통독 화면
// ==========================================
function renderMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride) {
  let currentTranslation = 'saebeon';
  const midday = day.midday;
  const overridePath = isOverride ? `/${lessonId}/${dayIndex}` : '';

  // 단락 본문을 줄바꿈 단위로 split해서 <p>로 감싸기
  function renderPassage(text) {
    return text.split('\n\n').map(p => `<p class="read-passage-paragraph">${p}</p>`).join('');
  }

  screen.innerHTML = `
    <div class="read-header">
      <button class="read-header-back" id="btn-close">‹ 닫기</button>
      <p class="read-header-title">낮 · ${day.dayLabel}</p>
      <button class="read-header-toggle" id="btn-toggle">새번역</button>
    </div>

    <div class="read-body">
      <p class="read-section-label">오늘의 짧은 단락</p>
      <p class="read-verse-ref" style="margin-bottom: 28px;">${midday.passageRef}</p>

      <div id="passage-text">
        ${renderPassage(midday.passageText[currentTranslation])}
      </div>

      <div class="read-guide-card">
        <p class="read-guide-card-text">${midday.guide}</p>
      </div>

      ${midday.prayerExample ? `
        <p class="read-section-label" style="margin-top: 28px;">한 마디 기도</p>
        <div class="read-prayer-example">
          <p class="read-prayer-example-text">"${midday.prayerExample}"</p>
        </div>
      ` : ''}

      <button class="btn read-cta" id="btn-next">읽었어요</button>
    </div>
  `;

  // 번역 토글
  const toggleBtn = screen.querySelector('#btn-toggle');
  const passageEl = screen.querySelector('#passage-text');
  toggleBtn.addEventListener('click', () => {
    currentTranslation = currentTranslation === 'saebeon' ? 'gaeyeok' : 'saebeon';
    passageEl.innerHTML = renderPassage(midday.passageText[currentTranslation]);
    toggleBtn.textContent = currentTranslation === 'saebeon' ? '새번역' : '개역개정';
  });

  // 닫기
  screen.querySelector('#btn-close').addEventListener('click', () => {
    navigateTo('#home');
  });

  // 읽었어요 → 마침 화면
  screen.querySelector('#btn-next').addEventListener('click', () => {
    navigateTo('#done/midday' + overridePath);
  });

  return screen;
}

// ==========================================
// 저녁 묵상 화면
// ==========================================
function renderEvening(screen, navigateTo, day, lessonId, dayIndex, isOverride) {
  let currentTranslation = 'saebeon';
  const evening = day.evening;
  const isWeekClosing = evening.isWeekClosing;
  const overridePath = isOverride ? `/${lessonId}/${dayIndex}` : '';

  // weekSummary가 있으면 (마지막 날) 그것도 렌더
  let weekSummaryHtml = '';
  if (isWeekClosing && evening.weekSummary) {
    const summary = evening.weekSummary;
    const versesHtml = summary.verses.map(item => `
      <div class="read-week-verse-row">
        <span class="read-week-verse-day">${item.dayLabel}</span>
        <span class="read-week-verse-fragment">"${item.fragment}"</span>
        <span class="read-week-verse-ref">${item.ref}</span>
      </div>
    `).join('');

    weekSummaryHtml = `
      <p class="read-section-label">${summary.intro}</p>
      <div class="read-week-summary">
        ${versesHtml}
      </div>
      <div class="read-divider"></div>
    `;
  }

  screen.innerHTML = `
    <div class="read-header">
      <button class="read-header-back" id="btn-close">‹ 닫기</button>
      <p class="read-header-title">저녁 · ${day.dayLabel}</p>
      <button class="read-header-toggle" id="btn-toggle">새번역</button>
    </div>

    <div class="read-body">
      <p class="read-section-label">다시 그 말씀</p>

      <p class="read-verse read-verse-evening" id="verse-text">${day.verses[currentTranslation]}</p>

      <p class="read-verse-ref">— ${day.verseRef}</p>

      <div class="read-divider"></div>

      ${weekSummaryHtml}

      <p class="read-section-label">하루를 돌아보며</p>
      <p class="read-guide-body">${evening.reflectQuestion}</p>

      <div class="read-divider"></div>

      <p class="read-section-label">하나님께</p>

      <div class="read-prayer-example">
        <p class="read-prayer-example-text">"${evening.prayerExample}"</p>
      </div>

      <textarea
        class="read-prayer-input"
        id="prayer-input"
        placeholder="이 기도를 받아들이거나, 자기 말로 적어보세요"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      >${Storage.getPrayer(lessonId, dayIndex, 'evening')}</textarea>

      <button class="btn read-cta" id="btn-next">잠잠히 머물기</button>
    </div>
  `;

  // 번역 토글
  const toggleBtn = screen.querySelector('#btn-toggle');
  const verseEl = screen.querySelector('#verse-text');
  toggleBtn.addEventListener('click', () => {
    currentTranslation = currentTranslation === 'saebeon' ? 'gaeyeok' : 'saebeon';
    verseEl.textContent = day.verses[currentTranslation];
    toggleBtn.textContent = currentTranslation === 'saebeon' ? '새번역' : '개역개정';
  });

  // 닫기
  screen.querySelector('#btn-close').addEventListener('click', () => {
    saveAndExit(screen, lessonId, dayIndex, 'evening', navigateTo, '#home');
  });

  // 잠잠히 머물기 → silence 화면으로
  screen.querySelector('#btn-next').addEventListener('click', () => {
    saveAndExit(screen, lessonId, dayIndex, 'evening', navigateTo, '#silence/evening' + overridePath);
  });

  return screen;
}

// ==========================================
// 공통 헬퍼 — 기도 저장 후 다음 화면으로
// ==========================================
function saveAndExit(screen, lessonId, dayIndex, sessionType, navigateTo, target) {
  const input = screen.querySelector('#prayer-input');
  if (input) {
    const text = input.value.trim();
    Storage.setPrayer(lessonId, dayIndex, sessionType, text);
  }
  navigateTo(target);
}
