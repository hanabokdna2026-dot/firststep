/**
 * 시간 헬퍼
 *
 * - 현재 시간대 인식 (아침/낮/저녁)
 * - 날짜 포맷 (한국어, ISO)
 * - 다음 세션 시간 계산
 */

import Storage from './storage.js';

// "07:30" → 분 단위 숫자 (450)
function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 분 → "오전 7:30" 형식
export function formatKoreanTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${period} ${displayH}:${String(m).padStart(2, '0')}`;
}

// 분 → "7시 / 1시 / 10시" 같은 짧은 표현
export function formatKoreanShortTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  if (m === 0) {
    return `${period} ${displayH}시`;
  }
  return `${period} ${displayH}시 ${m}분`;
}

// 현재 시간 - 자연스럽게 (예: "오후 1시 32분")
export function formatCurrentTime(date = new Date()) {
  const h = date.getHours();
  const m = date.getMinutes();
  const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return formatKoreanShortTime(hhmm);
}

// 오늘 날짜 ISO (YYYY-MM-DD)
export function getTodayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 한국어 날짜 (요일 빼고)
// 예: "2026년 5월 5일"
export function formatKoreanDate(date = new Date()) {
  const yyyy = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${yyyy}년 ${m}월 ${d}일`;
}

// 현재 시간대 판별
// 알림 시간 기준으로:
// - 아침 알림 ~ 낮 알림 - 1분 → 'morning'
// - 낮 알림 ~ 저녁 알림 - 1분 → 'midday'
// - 저녁 알림 ~ 다음 날 아침 알림 - 1분 → 'evening'
export function getCurrentSessionType() {
  const times = Storage.getNotifyTimes();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const morning = timeToMinutes(times.morning);
  const midday = timeToMinutes(times.midday);
  const evening = timeToMinutes(times.evening);

  // 자정 ~ 아침: evening (전날 저녁 세션이 아직 유효)
  if (nowMin < morning) {
    return 'evening';
  }
  // 아침 ~ 낮 - 1분
  if (nowMin < midday) {
    return 'morning';
  }
  // 낮 ~ 저녁 - 1분
  if (nowMin < evening) {
    return 'midday';
  }
  // 저녁 ~ 자정
  return 'evening';
}

// 세션 타입 → 한글 라벨
export function getSessionLabel(type) {
  switch (type) {
    case 'morning': return '아침';
    case 'midday': return '낮';
    case 'evening': return '저녁';
    default: return '';
  }
}

// 세션 타입 → 인사말 (홈 화면 상단)
export function getSessionGreeting(type) {
  switch (type) {
    case 'morning': return '좋은 아침이에요';
    case 'midday': return '낮이에요';
    case 'evening': return '저녁이에요';
    default: return '';
  }
}

// 다음 세션의 시간 (현재 시간대 기준)
export function getNextSessionTime() {
  const times = Storage.getNotifyTimes();
  const current = getCurrentSessionType();

  switch (current) {
    case 'morning': return { type: 'midday', time: times.midday };
    case 'midday': return { type: 'evening', time: times.evening };
    case 'evening': return { type: 'morning', time: times.morning };  // 내일 아침
  }
}
