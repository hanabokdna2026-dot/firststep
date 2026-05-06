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

// 현재 시간대 인사말
// 새벽 5~9시: 좋은 아침이에요
// 오전 10~11시: 오전이 깊어가요
// 낮 12~16시: 낮 시간이에요
// 오후 17~19시: 오후가 저물어요
// 저녁 20~21시: 저녁 시간이에요
// 밤 22~새벽 4시: 고요한 밤이에요
export function getTimeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return '좋은 아침이에요';
  if (h >= 10 && h < 12) return '오전이 깊어가요';
  if (h >= 12 && h < 17) return '낮 시간이에요';
  if (h >= 17 && h < 20) return '오후가 저물어요';
  if (h >= 20 && h < 22) return '저녁 시간이에요';
  return '고요한 밤이에요';
}

// 시간대 분류 (배경 색조 결정용)
// dawn (새벽~아침), day (낮), dusk (저녁), night (밤)
export function getTimeOfDayClass(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'dawn';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
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
// 고정 시간대로 어느 자리가 활성화될지 결정 (사용자의 만날 시간과 무관)
// - 04:30 ~ 11:59 → 'morning' (아침)
// - 12:00 ~ 17:59 → 'midday' (낮)
// - 18:00 ~ 04:29 → 'evening' (저녁)
//
// 사용자의 '만날 시간'은 자기 약속으로만 기록됨 — 활성 자리에는 영향 없음
export function getCurrentSessionType() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const morningStart = 4 * 60 + 30;   // 04:30
  const middayStart = 12 * 60;        // 12:00
  const eveningStart = 18 * 60;       // 18:00

  if (nowMin >= morningStart && nowMin < middayStart) {
    return 'morning';
  }
  if (nowMin >= middayStart && nowMin < eveningStart) {
    return 'midday';
  }
  // 18:00 ~ 다음 날 04:29 (자정 넘는 자리도 포함)
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
