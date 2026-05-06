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
import { getDay, getLesson, getActiveDayIndices, getDisplayDayLabel } from '../content.js';

const SESSION_LABELS = {
  morning: '아침',
  midday: '낮',
  evening: '저녁',
};

// ==========================================
// 번역 토글 (segmented control)
// ==========================================
// 양쪽 옵션이 다 보이는 결 — 사용자가 한눈에 "이건 두 번역으로 볼 수 있구나" 인지
function renderTranslationToggle(currentTranslation = 'saebeon') {
  return `
    <div class="read-header-segment" role="tablist">
      <button class="read-header-segment-option ${currentTranslation === 'saebeon' ? 'is-active' : ''}"
              data-translation="saebeon"
              role="tab"
              aria-selected="${currentTranslation === 'saebeon'}">새번역</button>
      <button class="read-header-segment-option ${currentTranslation === 'gaeyeok' ? 'is-active' : ''}"
              data-translation="gaeyeok"
              role="tab"
              aria-selected="${currentTranslation === 'gaeyeok'}">개역개정</button>
    </div>
  `;
}

// 토글 옵션을 누를 때 처리
// onChange: 새 번역 키 ('saebeon' | 'gaeyeok')를 받아 화면 갱신
function bindTranslationToggle(screen, onChange) {
  const segment = screen.querySelector('.read-header-segment');
  if (!segment) return;
  segment.querySelectorAll('.read-header-segment-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const newTranslation = btn.dataset.translation;
      // 활성 클래스 갱신
      segment.querySelectorAll('.read-header-segment-option').forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      onChange(newTranslation);
    });
  });
}

// ==========================================
// 헤더 오른쪽 영역 — 번역 토글 + 글씨 크기 버튼 (위아래로)
// ==========================================
function renderHeaderRight(currentTranslation) {
  return `
    <div class="read-header-right">
      ${renderTranslationToggle(currentTranslation)}
      ${renderTextSizeControl()}
    </div>
  `;
}

// ==========================================
// 글씨 크기 조절 (A- A+) — 토글 아래 한 줄
// ==========================================
function renderTextSizeControl() {
  const current = Storage.getTextSize();
  return `
    <div class="read-header-text-size">
      <button class="read-header-text-size-btn" data-size-action="dec" aria-label="글씨 작게" ${current <= 1 ? 'disabled' : ''}>
        <span class="a">A</span>−
      </button>
      <button class="read-header-text-size-btn" data-size-action="inc" aria-label="글씨 크게" ${current >= 5 ? 'disabled' : ''}>
        <span class="a">A</span>+
      </button>
    </div>
  `;
}

function bindTextSizeControl(screen) {
  const btnDec = screen.querySelector('[data-size-action="dec"]');
  const btnInc = screen.querySelector('[data-size-action="inc"]');
  if (!btnDec || !btnInc) return;

  function refresh() {
    const cur = Storage.getTextSize();
    btnDec.disabled = cur <= 1;
    btnInc.disabled = cur >= 5;
    document.body.setAttribute('data-text-size', String(cur));
  }

  btnDec.addEventListener('click', () => {
    const cur = Storage.getTextSize();
    if (cur > 1) {
      Storage.setTextSize(cur - 1);
      refresh();
    }
  });
  btnInc.addEventListener('click', () => {
    const cur = Storage.getTextSize();
    if (cur < 5) {
      Storage.setTextSize(cur + 1);
      refresh();
    }
  });
}

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

  // 사용자 속도에 따른 동적 dayLabel 계산
  // 데이터의 day.dayLabel(고정 "첫째 날"~"여섯째 날")은 그대로 두고,
  // 사용자에게 보일 라벨은 활성 자리 안에서 몇 번째인지 기준으로
  try {
    const lesson = await getLesson(lessonId);
    const weekPace = Storage.getWeekPace();
    const activeDayIndices = getActiveDayIndices(lesson, weekPace);
    if (activeDayIndices.includes(dayIndex)) {
      day.displayDayLabel = getDisplayDayLabel(dayIndex, activeDayIndices);
    } else {
      // 비활성 자리도 어떻게든 라벨이 있어야 함 (안전장치)
      day.displayDayLabel = day.dayLabel;
    }
  } catch (e) {
    day.displayDayLabel = day.dayLabel;
  }

  // 세션 타입별로 다르게 렌더링
  if (sessionType === 'morning') {
    return renderMorning(screen, navigateTo, day, lessonId, dayIndex, isOverride);
  } else if (sessionType === 'midday') {
    return await renderMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride);
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
      <p class="read-header-title">아침 · ${day.displayDayLabel}</p>
      ${renderHeaderRight(currentTranslation)}
    </div>

    <div class="read-body">
      <p class="read-section-label">오늘의 말씀</p>

      <p class="read-verse${day.passageMode === 'long' ? ' read-verse-long' : ''}" id="verse-text">${day.verses[currentTranslation]}</p>

      <p class="read-verse-ref">— ${day.verseRef}</p>

      <div class="read-divider"></div>

      ${morning.observeQuestion && morning.applyQuestion ? `
        <p class="read-section-label">잠시 들여다보기</p>
        <p class="read-guide-body">${morning.observeQuestion}</p>

        ${morning.kingdomQuestion ? `
          <p class="read-section-label" style="margin-top: 24px;">하나님 나라의 눈으로</p>
          ${morning.kingdomIntro ? `<p class="read-guide-body">${morning.kingdomIntro}</p>` : ''}
          <p class="read-guide-body" style="margin-top: 8px;">${morning.kingdomQuestion}</p>
        ` : ''}

        <p class="read-section-label" style="margin-top: 24px;">오늘 내 하루에서</p>
        <p class="read-guide-body">${morning.applyQuestion}</p>
      ` : `
        <p class="read-section-label">마음에 머물기</p>
        <p class="read-guide-body">${morning.ponderQuestion}</p>
      `}

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
  const verseEl = screen.querySelector('#verse-text');
  bindTextSizeControl(screen);
  bindTranslationToggle(screen, (newTranslation) => {
    currentTranslation = newTranslation;
    verseEl.textContent = day.verses[currentTranslation];
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
async function renderMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride) {
  const midday = day.midday;

  // 새 결: continuous 모드 (4과부터 사용자 페이스로 이어 읽기)
  if (midday.readingMode === 'continuous') {
    return await renderContinuousMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride);
  }

  // 기존 결: 고정 단락 (1·2·3과)
  return renderFixedMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride);
}

// 기존 결 — 고정 단락 (1·2·3과 그대로)
function renderFixedMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride) {
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
      <p class="read-header-title">낮 · ${day.displayDayLabel}</p>
      ${renderHeaderRight(currentTranslation)}
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
  const passageEl = screen.querySelector('#passage-text');
  bindTextSizeControl(screen);
  bindTranslationToggle(screen, (newTranslation) => {
    currentTranslation = newTranslation;
    passageEl.innerHTML = renderPassage(midday.passageText[currentTranslation]);
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

// 새 결 — continuous 모드 (4과부터 사용자 페이스로 이어 읽기)
async function renderContinuousMidday(screen, navigateTo, day, lessonId, dayIndex, isOverride) {
  const midday = day.midday;
  const overridePath = isOverride ? `/${lessonId}/${dayIndex}` : '';
  const { book, chapter, totalVerses } = midday.source;

  // 분량 정의 (절수)
  const SIZES = {
    '3': 8,    // 3분 ≈ 8절
    '5': 16,   // 5분 ≈ 16절
    '7': 24,   // 7분 ≈ 24절
    '10': 36,  // 10분 ≈ 36절
  };

  // 절 단위 데이터 로드 (요한복음 1장 = john1.json)
  let chapterData;
  try {
    const fileName = `${bookSlug(book)}${chapter}.json`;
    const res = await fetch(`data/${fileName}`);
    chapterData = await res.json();
  } catch (e) {
    screen.innerHTML = `<div class="screen-inner"><p class="body">통독 본문을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p></div>`;
    return screen;
  }

  // 사용자 진도
  let lastVerse = Storage.getReadingProgress(book, chapter);  // 0이면 처음
  let startVerse = lastVerse + 1;  // 다음 절부터 시작

  // 1장 다 읽었으면
  const finishedChapter = startVerse > totalVerses;

  // 분량 선택 (저장된 값 또는 기본 3)
  let currentSize = Storage.getReadingSize();  // '3'|'5'|'7'|'10'
  let currentTranslation = 'saebeon';

  // 현재 펼침 범위 계산 함수
  function calcRange(size) {
    const wantVerses = SIZES[size];
    let endVerse = Math.min(startVerse + wantVerses - 1, totalVerses);
    return { start: startVerse, end: endVerse };
  }

  // 본문 렌더 함수 (절 번호 + 본문)
  function renderVerses(start, end, translation) {
    const lines = [];
    for (let v = start; v <= end; v++) {
      const verseData = chapterData.verses.find(x => x.v === v);
      if (verseData) {
        lines.push(`<p class="continuous-verse"><span class="continuous-verse-num">${v}</span> ${verseData[translation]}</p>`);
      }
    }
    return lines.join('');
  }

  // ── 1장을 다 읽은 경우 — 마무리 화면 ──
  if (finishedChapter) {
    screen.innerHTML = `
      <div class="read-header">
        <button class="read-header-back" id="btn-close">‹ 닫기</button>
        <p class="read-header-title">낮 · ${day.displayDayLabel}</p>
        <span style="width: 60px;"></span>
      </div>

      <div class="read-body">
        <p class="eyebrow">통독 마침</p>
        <h2 class="title-small">요한복음 1장을<br/>다 읽으셨어요</h2>

        <p class="body" style="margin-top: 16px;">
          한 장을 끝까지 읽으셨다는 것 — 그 자체로 큰 한 걸음이에요.
        </p>

        <div class="read-guide-card" style="margin-top: 24px;">
          <p class="read-guide-card-text">
            다음 한 주 새 과에서 요한복음 2장으로 이어집니다.
            오늘은 잠시 멈추셔도 좋고,
            성경책이나 다른 성경 앱으로 더 읽어가셔도 좋아요.
          </p>
        </div>

        ${midday.prayerExample ? `
          <p class="read-section-label" style="margin-top: 28px;">한 마디 기도</p>
          <div class="read-prayer-example">
            <p class="read-prayer-example-text">"${midday.prayerExample}"</p>
          </div>
        ` : ''}

        <button class="btn read-cta" id="btn-next">마침</button>
      </div>
    `;

    screen.querySelector('#btn-close').addEventListener('click', () => navigateTo('#home'));
    screen.querySelector('#btn-next').addEventListener('click', () => {
      navigateTo('#done/midday' + overridePath);
    });
    return screen;
  }

  // ── 일반 통독 화면 ──
  function paint() {
    const range = calcRange(currentSize);
    const versesHtml = renderVerses(range.start, range.end, currentTranslation);
    const refLabel = `${book} ${chapter}:${range.start}${range.end > range.start ? '-' + range.end : ''}`;

    screen.innerHTML = `
      <div class="read-header">
        <button class="read-header-back" id="btn-close">‹ 닫기</button>
        <p class="read-header-title">낮 · ${day.displayDayLabel}</p>
        ${renderHeaderRight(currentTranslation)}
      </div>

      <div class="read-body">
        <p class="read-section-label">오늘의 통독</p>
        <p class="read-verse-ref" style="margin-bottom: 12px;">${refLabel}</p>

        <div class="continuous-size-toggle">
          ${['3', '5', '7', '10'].map(s => `
            <button class="continuous-size-btn ${s === currentSize ? 'active' : ''}" data-size="${s}">${s}분</button>
          `).join('')}
        </div>

        <div class="continuous-verses" id="verses-area">
          ${versesHtml}
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

        <button class="btn read-cta" id="btn-next">여기까지 읽었어요</button>
      </div>
    `;

    // 분량 버튼
    screen.querySelectorAll('.continuous-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSize = btn.dataset.size;
        Storage.setReadingSize(currentSize);
        paint();  // 다시 그림
      });
    });

    // 번역 토글
    bindTextSizeControl(screen);
    bindTranslationToggle(screen, (newTranslation) => {
      currentTranslation = newTranslation;
      paint();
    });

    // 닫기
    screen.querySelector('#btn-close').addEventListener('click', () => {
      navigateTo('#home');
    });

    // 여기까지 읽었어요 → 진도 저장 후 마침 화면
    screen.querySelector('#btn-next').addEventListener('click', () => {
      const r = calcRange(currentSize);
      Storage.setReadingProgress(book, chapter, r.end);
      navigateTo('#done/midday' + overridePath);
    });
  }

  paint();
  return screen;
}

// 책 이름 → 파일 슬러그 (요한복음 → john)
function bookSlug(book) {
  const map = {
    '요한복음': 'john',
    '사도행전': 'acts',
    // 추후 5과부터 다른 책 추가 시 여기에
  };
  return map[book] || book;
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
      <p class="read-header-title">저녁 · ${day.displayDayLabel}</p>
      ${renderHeaderRight(currentTranslation)}
    </div>

    <div class="read-body">
      <p class="read-section-label">다시 그 말씀</p>

      <p class="read-verse read-verse-evening${day.passageMode === 'long' ? ' read-verse-long' : ''}" id="verse-text">${day.verses[currentTranslation]}</p>

      <p class="read-verse-ref">— ${day.verseRef}</p>

      <div class="read-divider"></div>

      ${weekSummaryHtml}

      ${evening.confessLine ? `
        <p class="read-section-label">입술로 드리는 고백</p>
        ${evening.confessIntro ? `<p class="read-guide-body">${evening.confessIntro}</p>` : ''}

        <div class="read-confess-card">
          <p class="read-confess-line">"${evening.confessLine}"</p>
          ${evening.confessRef ? `<p class="read-confess-ref">— ${evening.confessRef}</p>` : ''}
        </div>

        <div class="read-divider"></div>
      ` : ''}

      <p class="read-section-label">하루를 돌아보며</p>
      <p class="read-guide-body">${evening.reflectQuestion}</p>

      ${evening.lordsPart && evening.lordsKeywords ? `
        <!-- 5·6과: 주기도 자세히 배우기 결 -->
        <div class="read-divider"></div>

        <p class="read-section-label">주기도로 마치기</p>
        ${evening.lordsIntro ? `<p class="read-guide-body">${evening.lordsIntro}</p>` : ''}

        <div class="read-lords-card">
          <p class="read-lords-part">"${evening.lordsPart}"</p>

          <div class="read-lords-keywords">
            ${evening.lordsKeywords.map(kw => `
              <div class="read-lords-keyword-row">
                <span class="read-lords-keyword-key">${kw.key}</span>
                <span class="read-lords-keyword-meaning">${kw.meaning}</span>
              </div>
            `).join('')}
          </div>

          ${evening.lordsExample ? `
            <p class="read-lords-example-label">예시 기도</p>
            <p class="read-lords-example">"${evening.lordsExample}"</p>
          ` : ''}
        </div>

        <textarea
          class="read-prayer-input read-lords-input"
          id="lords-input"
          placeholder="${evening.lordsPlaceholder || '자기 말로 한 마디 적어보세요'}"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        >${Storage.getLordsEntry(lessonId, dayIndex)}</textarea>
      ` : evening.lordsFocus ? `
        <!-- 7~10과: 주기도의 한 부분에 머물기 결 -->
        <div class="read-divider"></div>

        <p class="read-section-label">주기도의 흐름으로</p>
        ${evening.lordsIntro ? `<p class="read-guide-body">${evening.lordsIntro}</p>` : ''}

        <div class="read-lords-focus-card">
          ${evening.lordsLine ? `<p class="read-lords-focus-line">"${evening.lordsLine}"</p>` : ''}
          ${evening.lordsPrayerExample ? `<p class="read-lords-focus-prayer">${evening.lordsPrayerExample.replace(/\n/g, '<br/>')}</p>` : ''}
        </div>
      ` : ''}

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
  const verseEl = screen.querySelector('#verse-text');
  bindTextSizeControl(screen);
  bindTranslationToggle(screen, (newTranslation) => {
    currentTranslation = newTranslation;
    verseEl.textContent = day.verses[currentTranslation];
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
  // 주기도 자기 말 입력 (5·6과 아침 세션에서만 사용됨)
  const lordsInput = screen.querySelector('#lords-input');
  if (lordsInput) {
    const lordsText = lordsInput.value.trim();
    Storage.setLordsEntry(lessonId, dayIndex, lordsText);
  }
  navigateTo(target);
}
