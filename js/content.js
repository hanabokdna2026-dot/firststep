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
