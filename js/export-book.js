/**
 * 여정의 책 — 사용자가 적은 모든 기록을 한 권으로
 *
 * 새 창에 HTML로 띄움. 사용자가 브라우저의 인쇄 기능으로 PDF 저장 또는 종이 출력.
 */

import Storage from './storage.js';
import { getAllLessons } from './content.js';

const SESSION_LABELS = {
  morning: '아침',
  midday: '낮',
  evening: '저녁',
};

/**
 * 여정의 책을 새 창에 띄움.
 */
export async function openExportBook() {
  const userName = Storage.getUserName() || '';
  const lessons = await getAllLessons();
  const prayers = Storage.getAllPrayers();
  const lordsEntries = Storage.getAllLordsEntries();

  // 과별 → 일별로 정리
  const lessonMap = new Map();
  lessons.forEach(l => lessonMap.set(l.id, l));

  // 빈 기록은 빼고, lessonId·dayIndex·sessionType으로 정리
  const grouped = new Map();

  prayers.forEach(p => {
    if (!p.text || !p.text.trim()) return;
    const key = `${p.lessonId}-${p.dayIndex}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        lessonId: p.lessonId,
        dayIndex: p.dayIndex,
        prayers: {},
        lords: '',
      });
    }
    grouped.get(key).prayers[p.sessionType] = p.text.trim();
  });

  lordsEntries.forEach(e => {
    if (!e.text || !e.text.trim()) return;
    const key = `${e.lessonId}-${e.dayIndex}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        lessonId: e.lessonId,
        dayIndex: e.dayIndex,
        prayers: {},
        lords: '',
      });
    }
    grouped.get(key).lords = e.text.trim();
  });

  // 과·일 순으로 정렬
  const entries = Array.from(grouped.values()).sort((a, b) => {
    if (a.lessonId !== b.lessonId) return a.lessonId - b.lessonId;
    return a.dayIndex - b.dayIndex;
  });

  // 통계
  const totalEntries = entries.length;
  const totalPrayers = prayers.filter(p => p.text && p.text.trim()).length;

  // 오늘 날짜
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  // HTML 짜임
  const html = buildHtml({ userName, dateStr, entries, lessonMap, totalEntries, totalPrayers });

  // 새 창에 띄움
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');

  // 일부 모바일 브라우저가 팝업 막을 수 있어서 — 안 열리면 같은 창에서 띄움
  if (!newWindow) {
    window.location.href = url;
  }
}

function buildHtml(opts) {
  const { userName, dateStr, entries, lessonMap, totalEntries, totalPrayers } = opts;
  const title = userName ? `${userName} 님의 여정` : '풍성한 첫걸음 여정';

  const entryBlocks = entries.map(e => {
    const lesson = lessonMap.get(e.lessonId);
    const day = lesson ? lesson.days.find(d => d.dayIndex === e.dayIndex) : null;
    if (!lesson || !day) return '';

    const verseRef = day.verseRef || day.verseShortRef || '';
    const aspect = day.aspect || '';
    const keyword = day.keyword || '';

    const sessionBlocks = ['morning', 'midday', 'evening']
      .filter(s => e.prayers[s])
      .map(s => '<div class="session"><div class="session-label">' + SESSION_LABELS[s] + '</div><div class="session-text">' + escapeHtml(e.prayers[s]) + '</div></div>')
      .join('');

    const lordsBlock = e.lords
      ? '<div class="session"><div class="session-label session-label-lords">주기도 한 마디</div><div class="session-text">' + escapeHtml(e.lords) + '</div></div>'
      : '';

    return '<article class="entry"><header class="entry-header">' +
      '<div class="entry-meta">' + lesson.id + '과 · ' + (day.dayLabel || (day.dayIndex + '일')) + '</div>' +
      '<h2 class="entry-aspect">' + escapeHtml(aspect) + '</h2>' +
      (keyword ? '<p class="entry-keyword">"' + escapeHtml(keyword) + '"</p>' : '') +
      '<p class="entry-ref">' + escapeHtml(verseRef) + '</p>' +
      '</header><div class="entry-body">' + sessionBlocks + lordsBlock + '</div></article>';
  }).filter(Boolean).join('');

  const emptyState = entries.length === 0
    ? '<div class="empty-state"><p>아직 적은 기록이 없어요.</p><p>한 마디씩 적어가다 보면, 그 자리들이 한 권의 책이 될 거예요.</p></div>'
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;700&family=Noto+Sans+KR:wght@300;400;500&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Noto Sans KR', sans-serif;
  color: #2A1700;
  background: #FAEEDA;
  line-height: 1.7;
}
.page-cover, .page-stats, .container, .closing {
  max-width: 720px;
  margin: 0 auto;
  padding: 60px 40px;
}
.page-cover {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  page-break-after: always;
}
.cover-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 42px;
  font-weight: 500;
  color: #412402;
  margin-bottom: 24px;
  letter-spacing: -1px;
}
.cover-subtitle {
  font-family: 'Noto Serif KR', serif;
  font-size: 20px;
  color: #BA7517;
  margin-bottom: 60px;
  font-style: italic;
}
.cover-divider {
  width: 60px;
  height: 1px;
  background: #BA7517;
  margin: 40px 0;
}
.cover-quote {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px;
  color: #633806;
  line-height: 1.9;
  max-width: 480px;
  margin: 0 auto;
}
.cover-date {
  font-size: 13px;
  color: #854F0B;
  letter-spacing: 1px;
  margin-top: 80px;
}
.page-stats {
  text-align: center;
  padding: 80px 40px;
  page-break-after: always;
}
.stats-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 24px;
  color: #412402;
  margin-bottom: 32px;
}
.stats-grid {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin: 32px 0;
  flex-wrap: wrap;
}
.stat {
  text-align: center;
}
.stat-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 48px;
  font-weight: 500;
  color: #BA7517;
  line-height: 1;
}
.stat-label {
  font-size: 13px;
  color: #633806;
  margin-top: 8px;
}
.stats-message {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px;
  color: #633806;
  margin-top: 48px;
  line-height: 1.9;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}
.container {
  padding: 60px 40px;
}
.container-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 24px;
  font-weight: 500;
  color: #412402;
  text-align: center;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}
.container-subtitle {
  text-align: center;
  font-size: 13px;
  color: #854F0B;
  margin-bottom: 48px;
  letter-spacing: 0.5px;
}
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #854F0B;
  line-height: 2;
}
.entry {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(186, 117, 23, 0.2);
}
.entry:last-child {
  border-bottom: none;
}
.entry-header {
  margin-bottom: 24px;
}
.entry-meta {
  font-size: 12px;
  color: #BA7517;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.entry-aspect {
  font-family: 'Noto Serif KR', serif;
  font-size: 20px;
  font-weight: 500;
  color: #412402;
  margin-bottom: 12px;
}
.entry-keyword {
  font-family: 'Noto Serif KR', serif;
  font-style: italic;
  color: #633806;
  font-size: 15px;
  margin-bottom: 6px;
}
.entry-ref {
  font-size: 12px;
  color: #854F0B;
  letter-spacing: 0.5px;
}
.entry-body {
  padding-left: 16px;
  border-left: 2px solid rgba(186, 117, 23, 0.2);
}
.session {
  margin-bottom: 16px;
}
.session:last-child {
  margin-bottom: 0;
}
.session-label {
  font-size: 11px;
  color: #BA7517;
  letter-spacing: 1.5px;
  margin-bottom: 4px;
}
.session-label-lords {
  color: #854F0B;
}
.session-text {
  font-size: 14px;
  color: #2A1700;
  line-height: 1.8;
  white-space: pre-wrap;
}
.closing {
  text-align: center;
  padding: 80px 40px;
  page-break-before: always;
}
.closing-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 22px;
  color: #412402;
  margin-bottom: 24px;
}
.closing-message {
  font-family: 'Noto Serif KR', serif;
  font-size: 15px;
  color: #633806;
  line-height: 2;
  max-width: 520px;
  margin: 0 auto;
}
.closing-mark {
  width: 40px;
  height: 1px;
  background: #BA7517;
  margin: 60px auto 0;
}
@media print {
  body { background: white; }
  .page-cover, .page-stats, .closing { min-height: auto; page-break-after: always; }
  .container { max-width: none; }
  .entry { page-break-inside: avoid; }
}
.print-bar {
  position: fixed;
  top: 16px;
  right: 16px;
  background: #BA7517;
  color: white;
  padding: 12px 20px;
  border-radius: 30px;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(65, 36, 2, 0.2);
  border: none;
  font-family: inherit;
  z-index: 100;
}
.print-bar:hover { background: #854F0B; }
@media print {
  .print-bar { display: none; }
}
</style>
</head>
<body>
<button class="print-bar" onclick="window.print()">📄 인쇄 / PDF로 저장</button>

<section class="page-cover">
<h1 class="cover-title">${escapeHtml(title)}</h1>
<p class="cover-subtitle">풍성한 첫걸음의 자리</p>
<div class="cover-divider"></div>
<p class="cover-quote">
그분과 매일 한 걸음씩<br>
걸어갔던 자리들을<br>
한 권의 책으로 모았습니다.
</p>
<p class="cover-date">${escapeHtml(dateStr)}</p>
</section>

<section class="page-stats">
<h2 class="stats-title">함께 걸어온 자리</h2>
<div class="stats-grid">
<div class="stat"><div class="stat-num">${totalEntries}</div><div class="stat-label">기록한 날</div></div>
<div class="stat"><div class="stat-num">${totalPrayers}</div><div class="stat-label">한 마디 기도</div></div>
</div>
<p class="stats-message">
거창한 자리가 아니어도 좋아요.<br>
매일 한 걸음씩 걸어온 자리들이<br>
여기 한 권으로 모였습니다.
</p>
</section>

<section class="container">
<h2 class="container-title">기록의 자리들</h2>
<p class="container-subtitle">— 한 마디씩 적은 자리 —</p>
${entryBlocks}
${emptyState}
</section>

<section class="closing">
<h2 class="closing-title">마치며</h2>
<p class="closing-message">
여정은 여기서 끝나는 게 아니에요.<br>
이제부터 일상 속에서<br>
그분과 함께 걸어가는 자리.<br>
<br>
여기 적은 한 마디 한 마디가<br>
앞으로의 자리에서<br>
길이 되어 줄 거예요.
</p>
<div class="closing-mark"></div>
</section>

</body>
</html>`;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
