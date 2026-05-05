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
  { id: 3, title: '하나님과의 인격적 교제' },
  { id: 4, title: '하나님의 말씀, 어떻게 누릴까' },
  { id: 5, title: '기도, 어떻게 누릴까 (1)' },
  { id: 6, title: '기도, 어떻게 누릴까 (2)' },
  { id: 7, title: '풍성한 삶을 어떻게 누릴까' },
  { id: 8, title: '증인의 삶' },
  { id: 9, title: '세례, 그 사랑 깊은 언약' },
];
