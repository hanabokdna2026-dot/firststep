/**
 * 빠진 날 자동 진행
 *
 * 사용자가 며칠 빼먹어도 앱을 다시 열면 자동으로 그날 자리로 이동.
 * 부담 없이 — 빠진 자리는 그냥 흘려보내고, 오늘은 오늘의 자리에서 다시 시작.
 *
 * 짜임:
 * - 마지막으로 진도 이동한 날(LAST_ADVANCE_DATE) 기준으로 며칠 지났는지 계산
 * - 그날만큼 다음 활성 자리로 이동 (비활성 자리는 건너뜀)
 * - 이동 후 LAST_ADVANCE_DATE를 오늘로 갱신
 *
 * 호출 시점:
 * - 앱 시작 시 한 번 (init)
 * - 그 이후 같은 날엔 다시 호출되어도 아무 일 안 일어남
 *
 * 단, 사용자가 오늘 이미 자리에 들어갔거나 마쳤으면 진도가 그대로 — 그 자리를 끝까지.
 */

import Storage from './storage.js';
import { getTodayISO } from './time.js';
import { getNextActiveDay } from './content.js';

/**
 * 빠진 날 만큼 진도 자동 이동.
 *
 * @returns {Promise<{advanced: number}>} 며칠 진도 이동했는지
 */
export async function catchUpMissedDays() {
  const todayISO = getTodayISO();
  const lastAdvanceISO = Storage.getLastAdvanceDate();

  // 처음 시작이면 — 오늘로 초기화만 (이동 없음)
  if (!lastAdvanceISO) {
    Storage.setLastAdvanceDate(todayISO);
    return { advanced: 0 };
  }

  // 며칠 지났는지 (오늘 - 마지막 이동 날)
  const daysPassed = daysBetween(lastAdvanceISO, todayISO);

  // 같은 날 또는 미래 (시간대 변경 등) — 아무 일 없음
  if (daysPassed <= 0) {
    return { advanced: 0 };
  }

  // 빠진 날만큼 진도 이동 (오늘 빠진 게 아니라 어제까지 빠진 거라면 1일치)
  // 즉, 어제 마지막 이동했고 오늘이면 daysPassed=1, 그러나 오늘은 아직 자리에 머물러도 됨
  // 따라서 daysPassed - 1 만큼만 이동 (오늘 자리는 사용자 결단으로 마쳐야 함)
  //
  // 예: 어제 1일째에서 멈춤, 오늘 열음 → 그대로 1일째 (이동 없음)
  // 예: 그저께 1일째에서 멈춤, 오늘 열음 → 1일 빠짐 → 2일째 (또는 다음 활성 자리)로 이동
  const daysToAdvance = Math.max(0, daysPassed - 1);

  if (daysToAdvance === 0) {
    // 오늘이 어제 다음 날이라면 — 단순히 LAST_ADVANCE_DATE만 어제로 두고 오늘 자리에서 시작
    // (오늘 마치면 정상 이동)
    return { advanced: 0 };
  }

  // 빠진 날만큼 다음 활성 자리로 이동
  const weekPace = Storage.getWeekPace();
  let advanced = 0;

  for (let i = 0; i < daysToAdvance; i++) {
    const currentLesson = Storage.getCurrentLesson();
    const currentDay = Storage.getCurrentDay();
    const next = await getNextActiveDay(currentLesson, currentDay, weekPace);
    if (!next) break;  // 콘텐츠 끝
    Storage.setCurrentLesson(next.lessonId);
    Storage.setCurrentDay(next.dayIndex);
    advanced++;
  }

  // 마지막 이동 날짜를 어제(daysPassed - 1 = 0이 안 되도록)로 — 오늘은 아직 안 마침
  // 결국 오늘 마치면 그때 todayISO로 갱신됨
  // 일단 어제로 잡아두면 다음에 또 빼먹어도 정상 작동
  const yesterday = isoMinusDays(todayISO, 1);
  Storage.setLastAdvanceDate(yesterday);

  return { advanced };
}

/**
 * 두 ISO 날짜 사이의 일수 차이 (date2 - date1).
 */
function daysBetween(iso1, iso2) {
  const d1 = new Date(iso1 + 'T00:00:00');
  const d2 = new Date(iso2 + 'T00:00:00');
  const diffMs = d2 - d1;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * ISO 날짜에서 N일 빼기.
 */
function isoMinusDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
