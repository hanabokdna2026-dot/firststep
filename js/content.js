/**
 * 콘텐츠 로더
 *
 * lessons.json을 한 번 fetch하고 캐시.
 * 모든 화면이 import해서 사용.
 */

let cachedData = null;

export async function loadContent() {
  if (cachedData) return cachedData;

  const res = await fetch('data/lessons.json');
  if (!res.ok) {
    throw new Error('콘텐츠 로딩 실패');
  }
  cachedData = await res.json();
  return cachedData;
}

// 특정 과 가져오기
export async function getLesson(lessonId) {
  const data = await loadContent();
  return data.lessons.find(l => l.id === lessonId);
}

// 특정 과의 특정 일 가져오기
export async function getDay(lessonId, dayIndex) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return null;
  return lesson.days.find(d => d.dayIndex === dayIndex);
}

// 다음 과·일이 있는지 확인 (콘텐츠 끝 도달했는지)
export async function hasNext(lessonId, dayIndex) {
  const data = await loadContent();
  const lesson = data.lessons.find(l => l.id === lessonId);
  if (!lesson) return false;

  // 같은 과 내에 다음 일이 있는지
  if (dayIndex < 6) return true;

  // 다음 과가 있는지
  return data.lessons.some(l => l.id === lessonId + 1);
}

// 다음 일로 진행 (현재 일이 6이면 다음 과 1일로)
export function getNextDay(lessonId, dayIndex) {
  if (dayIndex < 6) {
    return { lessonId, dayIndex: dayIndex + 1 };
  }
  return { lessonId: lessonId + 1, dayIndex: 1 };
}

// 전체 과 목록 가져오기 (커리큘럼 화면용)
// 풍삶첫 전체는 10과 + 부록까지지만, 일단 lessons.json에 있는 과만 반환
// 추후 커리큘럼 메타데이터(과 번호, 제목, 핵심 메시지)만 따로 두면 미리보기 가능
export async function getAllLessons() {
  const data = await loadContent();
  return data.lessons;
}

// 풍삶첫 전체 커리큘럼 골격 (실제 콘텐츠가 없어도 미리보기 가능)
// 추후 lessons.json에 더 많은 과를 추가하면 자연스럽게 확장
export const CURRICULUM_OUTLINE = [
  { id: 1, title: '거듭남의 신비와 축복' },
  { id: 2, title: '인격적인 하나님' },
  { id: 3, title: '하나님과 인격적 관계 맺기' },
  { id: 4, title: '하나님의 말씀 누리는 축복' },
  { id: 5, title: '하나님께 나아가는 축복' },
  { id: 6, title: '하나님께 나아가 누리는 축복' },
  { id: 7, title: '함께 주님을 따르는 공동체' },
  { id: 8, title: '주님을 따라 사는 삶터와 일터' },
  { id: 9, title: '축복을 누리며 증언하는 삶' },
  { id: 10, title: '사랑 깊은 언약과 기념의 영성' },
];

// ==========================================================================
// 속도(pace) 처리 함수들
// ==========================================================================

// 사용자에게 보여줄 한국어 dayLabel 6개
const DAY_LABELS_KO = ['첫째 날', '둘째 날', '셋째 날', '넷째 날', '다섯째 날', '여섯째 날'];

/**
 * 속도에 따라 한 과 안의 활성 자리(dayIndex 배열) 반환.
 *
 * - 'one'  (한 과/주): 1·2·3·4·5·6 모두 활성
 * - 'two'  (두 과/주): priority='core'인 모든 자리 (보통 3개)
 * - 'three'(세 과/주): priority='core' 중 앞 두 개
 *
 * 데이터에 priority가 없으면 모두 활성으로 fallback.
 */
export function getActiveDayIndices(lesson, weekPace) {
  if (!lesson || !lesson.days) return [];

  if (weekPace === 'one') {
    return lesson.days.map(d => d.dayIndex).sort((a, b) => a - b);
  }

  // core 자리들만
  const coreDays = lesson.days
    .filter(d => d.priority === 'core')
    .map(d => d.dayIndex)
    .sort((a, b) => a - b);

  // priority 메타데이터가 없는 경우 fallback (데이터 안전성)
  if (coreDays.length === 0) {
    return lesson.days.map(d => d.dayIndex).sort((a, b) => a - b);
  }

  if (weekPace === 'two') {
    return coreDays;
  }

  if (weekPace === 'three') {
    return coreDays.slice(0, 2);
  }

  // 알 수 없는 속도면 모든 자리
  return lesson.days.map(d => d.dayIndex).sort((a, b) => a - b);
}

/**
 * dayIndex가 그 속도에서 활성 자리인지 확인.
 */
export async function isDayActive(lessonId, dayIndex, weekPace) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return false;
  const active = getActiveDayIndices(lesson, weekPace);
  return active.includes(dayIndex);
}

/**
 * 사용자에게 보여줄 dayLabel 계산.
 *
 * 활성 자리 배열 안에서 그 dayIndex가 몇 번째인지 보고
 * '첫째 날', '둘째 날' 식으로 반환.
 *
 * 예: 두 과 속도, 1과의 활성 자리 [1, 3, 5]일 때
 *   - dayIndex=1 → '첫째 날'
 *   - dayIndex=3 → '둘째 날'
 *   - dayIndex=5 → '셋째 날'
 */
export function getDisplayDayLabel(dayIndex, activeDayIndices) {
  const idx = activeDayIndices.indexOf(dayIndex);
  if (idx < 0) return '날';
  return DAY_LABELS_KO[idx] || `${idx + 1}일째`;
}

/**
 * 한 과 안에서 사용자에게 보이는 그 과의 총 일수.
 * 두 과 속도면 보통 3, 세 과 속도면 2.
 */
export function getActiveDayCount(lesson, weekPace) {
  return getActiveDayIndices(lesson, weekPace).length;
}

/**
 * 다음 활성 자리 계산.
 *
 * 현재 자리(currentLesson, currentDay)에서 그 속도(weekPace)로
 * 다음 활성 자리는 어디인지 반환.
 *
 * 같은 과의 다음 활성 자리가 있으면 그걸로,
 * 없으면 다음 과의 첫 활성 자리로 (속도 무관, 새 과는 사용자가 그 주에 새로 속도 정함).
 *
 * @returns { lessonId, dayIndex, isNewLesson }
 */
export async function getNextActiveDay(currentLesson, currentDay, weekPace) {
  const data = await loadContent();
  const lesson = data.lessons.find(l => l.id === currentLesson);

  if (lesson) {
    const active = getActiveDayIndices(lesson, weekPace);
    const currentIdx = active.indexOf(currentDay);
    if (currentIdx >= 0 && currentIdx < active.length - 1) {
      return {
        lessonId: currentLesson,
        dayIndex: active[currentIdx + 1],
        isNewLesson: false,
      };
    }
  }

  // 같은 과 끝 — 다음 과로
  const nextLesson = data.lessons.find(l => l.id === currentLesson + 1);
  if (nextLesson) {
    // 새 과의 첫 자리는 항상 dayIndex=1 (활성 자리 중 첫 번째)
    // 새 과의 속도는 사용자가 그 주에 다시 정하니, 일단 'one' 기준으로 dayIndex=1을 반환
    // 실제 다음 활성 자리는 그 주에 결정됨
    return {
      lessonId: currentLesson + 1,
      dayIndex: 1,
      isNewLesson: true,
    };
  }

  // 모든 과 마침
  return null;
}

/**
 * 이전 활성 자리 (홈 화면 오른쪽 스와이프의 반대 방향용).
 *
 * 보통 안 쓰지만, 미리보기 모드에서 화살표 좌우 navigation 등을 만들 때 유용.
 */
export async function getPreviousActiveDay(currentLesson, currentDay, weekPace) {
  const data = await loadContent();
  const lesson = data.lessons.find(l => l.id === currentLesson);

  if (lesson) {
    const active = getActiveDayIndices(lesson, weekPace);
    const currentIdx = active.indexOf(currentDay);
    if (currentIdx > 0) {
      return {
        lessonId: currentLesson,
        dayIndex: active[currentIdx - 1],
        isNewLesson: false,
      };
    }
  }

  // 같은 과의 첫 활성 자리 — 이전 과로
  if (currentLesson > 1) {
    const prevLesson = data.lessons.find(l => l.id === currentLesson - 1);
    if (prevLesson) {
      const prevActive = getActiveDayIndices(prevLesson, weekPace);
      // 이전 과의 마지막 활성 자리
      return {
        lessonId: currentLesson - 1,
        dayIndex: prevActive[prevActive.length - 1] || 1,
        isNewLesson: false,
      };
    }
  }

  return null;
}
