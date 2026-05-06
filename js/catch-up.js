/**
 * 빠진 날 자동 진행
 *
 * 사용자가 며칠 빼먹어도 (또는 하루만 지나도) 앱을 다시 열면 자동으로 그날 자리로 이동.
 * 부담 없이 — 빠진 자리는 그냥 흘려보내고, 오늘은 오늘의 자리에서 새로 시작.
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
 * 예:
 * - 어제 1일째에서 멈춤 → 오늘 열음 → 2일째(또는 다음 활성 자리)로 자동 이동
 * - 그저께 1일째에서 멈춤 → 오늘 열음 → 2일치 이동 → 3일째(또는 그 다음 활성 자리)로
 * - 일주일 빼먹음 → 6일치 자동 이동
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

  // 지난 날 수만큼 다음 활성 자리로 이동
  // 예: 어제 1일째 → 오늘 → 1일치 이동 → 2일째
  // 예: 그저께 1일째 → 오늘 → 2일치 이동 → 3일째
  const weekPace = Storage.getWeekPace();
  let advanced = 0;

  for (let i = 0; i < daysPassed; i++) {
    const currentLesson = Storage.getCurrentLesson();
    const currentDay = Storage.getCurrentDay();
    const next = await getNextActiveDay(currentLesson, currentDay, weekPace);
    if (!next) break;  // 콘텐츠 끝
    Storage.setCurrentLesson(next.lessonId);
    Storage.setCurrentDay(next.dayIndex);
    advanced++;
  }

  // 마지막 이동 날짜를 오늘로 갱신 — 오늘은 더 이상 자동 이동 안 일어남
  Storage.setLastAdvanceDate(todayISO);

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
