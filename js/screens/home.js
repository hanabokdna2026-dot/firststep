/**
 * 홈 화면
 *
 * 매일 사용자가 켤 때 보는 메인 화면.
 *
 * 구성:
 * - 상단: 오늘 날짜, 인사말, 이름
 * - 메인 카드: 현재 세션 (아침/낮/저녁) - 본문 + 시작 버튼
 * - 다음 세션 안내 (작게)
 * - 하단 탭: 오늘 / 기록 / 설정
 */

import Storage from '../storage.js';
import { getDay } from '../content.js';
import {
  getCurrentSessionType,
  getSessionLabel,
  getSessionGreeting,
  getNextSessionTime,
  formatKoreanDate,
  formatKoreanShortTime,
  getTodayISO,
} from '../time.js';

export default async function renderHome({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  // 진도 정보
  const lessonId = Storage.getCurrentLesson();
  const dayIndex = Storage.getCurrentDay();

  // 콘텐츠 가져오기
  let day;
  try {
    day = await getDay(lessonId, dayIndex);
  } catch (e) {
    screen.innerHTML = `<div class="screen-inner-centered">
      <p class="body-large">콘텐츠를 불러오는 중 문제가 있어요.</p>
    </div>`;
    return screen;
  }

  if (!day) {
    // 진도가 콘텐츠 범위를 벗어남 (10과 다 끝났을 때 등)
    screen.innerHTML = `<div class="screen-inner-centered">
      <h2 class="title" style="text-align: center;">여정의 끝까지 오셨어요</h2>
      <p class="body-large" style="margin-top: 16px;">풍성한 첫걸음 10과를<br/>모두 함께 걸으셨습니다.</p>
    </div>`;
    return screen;
  }

  // 세션 정보
  const sessionType = getCurrentSessionType();
  const sessionLabel = getSessionLabel(sessionType);
  const greeting = getSessionGreeting(sessionType);
  const userName = Storage.getUserName();
  const today = formatKoreanDate();
  const todayISO = getTodayISO();
  const isDone = Storage.isSessionDone(todayISO, sessionType);

  // 다음 세션
  const next = getNextSessionTime();
  const nextLabel = getSessionLabel(next.type);
  const nextTime = formatKoreanShortTime(next.time);

  // 미리보기에 보여줄 본문 (세션 타입에 따라 다름)
  let previewVerse = '';
  let previewRef = '';
  if (sessionType === 'morning' || sessionType === 'evening') {
    // 아침과 저녁은 같은 본문
    previewVerse = day.verses.saebeon;
    previewRef = day.verseRef;
  } else if (sessionType === 'midday') {
    // 낮은 통독이라 미리보기 안 함 — 안내만
    previewVerse = '';
    previewRef = day.midday.passageRef;
  }

  // 인사말 두 번째 줄
  const greetingSub = userName
    ? `${userName}님, 오늘도 함께 걸어요`
    : '오늘도 함께 걸어요';

  // 메인 카드 내용 (세션 타입별)
  let mainCardContent;
  if (sessionType === 'midday') {
    mainCardContent = `
      <p class="card-section-label">오늘의 낮 세션</p>
      <p class="card-passage-ref">${previewRef}</p>
      <p class="card-passage-hint">짧은 단락을 흘려 읽습니다.</p>
    `;
  } else {
    mainCardContent = `
      <p class="card-section-label">오늘의 ${sessionLabel} 세션</p>
      <p class="card-verse-text">${previewVerse}</p>
      <p class="card-verse-ref">— ${previewRef}</p>
    `;
  }

  // 시작 버튼 라벨 (이미 했으면 다시 하기)
  const buttonLabel = isDone
    ? `${sessionLabel} 세션 다시 보기`
    : `시작하기`;

  screen.innerHTML = `
    <div class="home-greeting">
      <p class="home-date">${today}</p>
      <h1 class="home-greeting-title">${greeting}</h1>
      <p class="home-greeting-sub">${greetingSub}</p>
    </div>

    <div class="home-main">
      <div class="home-card">
        <div class="home-card-header">
          <span class="home-card-lesson">${lessonId}과 · ${day.dayLabel}</span>
          <span class="home-card-progress">${dayIndex} / 6</span>
        </div>
        <p class="home-card-title">${day.aspect ? day.aspect.split(' — ')[0] : ''}</p>

        <div class="home-card-divider"></div>

        ${mainCardContent}

        <button class="btn home-card-btn" id="btn-start">${buttonLabel}</button>

        ${isDone ? '<p class="home-card-done">이미 마쳤어요. 다시 만나도 좋아요.</p>' : ''}
      </div>
    </div>

    <div class="home-next-row">
      <div class="home-next-card">
        <p class="home-next-label">다음</p>
        <p class="home-next-value">${nextLabel} · ${nextTime}</p>
      </div>
    </div>

    <nav class="home-tabbar">
      <button class="home-tab home-tab-active" data-tab="today">
        <span class="home-tab-dot"></span>
        <span class="home-tab-label">오늘</span>
      </button>
      <button class="home-tab" data-tab="record">
        <span class="home-tab-dot"></span>
        <span class="home-tab-label">기록</span>
      </button>
      <button class="home-tab" data-tab="settings">
        <span class="home-tab-dot"></span>
        <span class="home-tab-label">설정</span>
      </button>
    </nav>
  `;

  // 시작 버튼
  screen.querySelector('#btn-start').addEventListener('click', () => {
    // 다음 단계에서 실제 세션 화면으로 진입
    // 지금은 alert
    alert(`${sessionLabel} 세션 화면은 4단계에서 만들어요.`);
  });

  // 탭
  screen.querySelectorAll('.home-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName === 'today') return;  // 이미 홈
      if (tabName === 'record') {
        alert('기록 화면은 다음 단계에 만들어요.');
      } else if (tabName === 'settings') {
        // 임시: 데이터 초기화 옵션 제공
        if (confirm('설정 화면은 다음 단계에 만들어요.\n\n지금은 데이터 초기화만 가능해요. 초기화할까요?')) {
          Storage.clearAll();
          navigateTo('#welcome');
        }
      }
    });
  });

  return screen;
}
