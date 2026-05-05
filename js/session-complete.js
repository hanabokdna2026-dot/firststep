/**
 * 세션 완료 처리
 *
 * silence와 done 화면에서 공통으로 사용.
 *
 * 두 가지 기록:
 * 1. 날짜별 (오늘 뭐 했는지) - 홈 화면 오늘 카드 표시용
 * 2. 일별 (이 과의 어떤 일을 마쳤는지) - 일 목록 화면 표시용
 *
 * 진도 진행:
 * - 진행 중인 일(currentLesson, currentDay)의 저녁 세션을 마쳐야만 진행
 * - 다른 날을 마쳐도 진도는 안 움직임 (사용자 페이스 존중)
 *
 * 같은 세션을 두 번 호출해도 중복 처리되지 않도록 안전하게.
 */

import Storage from './storage.js';
import { getTodayISO } from './time.js';
import { getNextActiveDay } from './content.js';

/**
 * 세션 완료 처리.
 *
 * @param {string} sessionType - 'morning' | 'midday' | 'evening'
 * @param {object} options - { lessonId, dayIndex } 마칠 과/일 정보. 없으면 진행 중인 일.
 * @returns {Promise<{progressed, isJourneyEnd, alreadyDone}>}
 */
export async function completeSession(sessionType, options = {}) {
  const todayISO = getTodayISO();
  const currentLesson = Storage.getCurrentLesson();
  const currentDay = Storage.getCurrentDay();
  const weekPace = Storage.getWeekPace();

  // 마치는 과/일 (지정 안 하면 진행 중인 것)
  const lessonId = options.lessonId ?? currentLesson;
  const dayIndex = options.dayIndex ?? currentDay;

  // 일별 완료 기록 (이 과의 어떤 일이 마쳐졌는지 — 일 목록 화면용)
  const alreadyDone = Storage.isDaySessionDone(lessonId, dayIndex, sessionType);

  if (alreadyDone) {
    return { progressed: false, isJourneyEnd: false, alreadyDone: true };
  }

  Storage.markDaySessionDone(lessonId, dayIndex, sessionType);

  // 날짜별 완료 기록 (오늘 어떤 세션을 했는지 — 홈 카드 표시용)
  // 진행 중인 일이면 오늘 한 것으로 기록
  const isCurrentDay = (lessonId === currentLesson && dayIndex === currentDay);
  if (isCurrentDay) {
    Storage.markSessionDone(todayISO, sessionType);
  }

  // 진도 진행 — 진행 중인 일의 저녁 세션을 마쳤을 때만
  // 속도(weekPace) 고려해서 다음 활성 자리로 이동 (비활성 자리 자동 건너뜀)
  let progressed = false;
  let isJourneyEnd = false;
  if (sessionType === 'evening' && isCurrentDay) {
    const next = await getNextActiveDay(currentLesson, currentDay, weekPace);
    if (next) {
      Storage.setCurrentLesson(next.lessonId);
      Storage.setCurrentDay(next.dayIndex);
      progressed = true;
    } else {
      isJourneyEnd = true;
    }
  }

  return { progressed, isJourneyEnd, alreadyDone: false };
}
