/**
 * 풍성한 삶으로 첫걸음 - 로컬 저장소 래퍼
 *
 * 두 가지 저장소를 사용:
 * - localStorage: 작은 설정값 (이름, 기본 속도, 알림 시간)
 * - IndexedDB: 큰 데이터 (한 마디 기도들, 잠잠히 기록)
 *
 * MVP에서는 localStorage만 사용 (단순하게 시작).
 * IndexedDB는 다음 단계에 추가.
 */

const STORAGE_KEYS = {
  USER_NAME: 'firststep:userName',
  DEFAULT_PACE: 'firststep:defaultPace',  // 'one' | 'two' | 'three' (한 과/두 과/세 과)
  NOTIFY_TIMES: 'firststep:notifyTimes',  // { morning, midday, evening }
  NOTIFY_ENABLED: 'firststep:notifyEnabled',  // true | false

  // 진도
  CURRENT_LESSON: 'firststep:currentLesson',  // 1, 2, ...
  CURRENT_DAY: 'firststep:currentDay',  // 1~6
  WEEK_START_DATE: 'firststep:weekStartDate',  // ISO 날짜 문자열
  WEEK_PACE: 'firststep:weekPace',  // 이번 주 속도 ('one' | 'two' | 'three')
  LAST_ADVANCE_DATE: 'firststep:lastAdvanceDate',  // 마지막으로 진도 이동한 날 (ISO)

  // 글씨 크기 ('small' | 'medium' | 'large') — 기본 'medium'
  TEXT_SIZE: 'firststep:textSize',

  // 잠잠히 머무는 동안 자연의 소리 — 기본 켜짐 ('on' | 'off')
  NATURE_SOUND: 'firststep:natureSound',

  // 마지막으로 속도 확인한 과 (이 과가 현재 과보다 작으면 새 과 시작이라 속도 묻기)
  LAST_PACE_CHECK_LESSON: 'firststep:lastPaceCheckLesson',

  // 세션 완료 기록 (날짜별)
  // 예: firststep:session:2026-05-05:morning = 'done'
  SESSION_PREFIX: 'firststep:session:',

  // 한 마디 기도 기록
  // 예: firststep:prayer:1:1:morning = "주님께 적은 한 마디"
  PRAYER_PREFIX: 'firststep:prayer:',

  // 온보딩 완료 플래그
  ONBOARDING_DONE: 'firststep:onboardingDone',
};

const Storage = {
  // 이름
  getUserName() {
    return localStorage.getItem(STORAGE_KEYS.USER_NAME) || '';
  },
  setUserName(name) {
    localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
  },

  // 기본 속도
  getDefaultPace() {
    return localStorage.getItem(STORAGE_KEYS.DEFAULT_PACE) || 'one';
  },
  setDefaultPace(pace) {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_PACE, pace);
  },

  // 알림 시간
  getNotifyTimes() {
    const stored = localStorage.getItem(STORAGE_KEYS.NOTIFY_TIMES);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    // 기본값
    return {
      morning: '04:30',
      midday: '12:00',
      evening: '18:00',
    };
  },
  setNotifyTimes(times) {
    localStorage.setItem(STORAGE_KEYS.NOTIFY_TIMES, JSON.stringify(times));
  },

  getNotifyEnabled() {
    const stored = localStorage.getItem(STORAGE_KEYS.NOTIFY_ENABLED);
    if (stored === null) return true;  // 기본값: 켬
    return stored === 'true';
  },
  setNotifyEnabled(enabled) {
    localStorage.setItem(STORAGE_KEYS.NOTIFY_ENABLED, enabled ? 'true' : 'false');
  },

  // 온보딩 완료 여부
  isOnboardingDone() {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_DONE) === 'true';
  },
  setOnboardingDone() {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_DONE, 'true');
  },

  // 진도
  getCurrentLesson() {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_LESSON);
    return stored ? parseInt(stored, 10) : 1;
  },
  setCurrentLesson(lessonId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_LESSON, String(lessonId));
  },

  getCurrentDay() {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_DAY);
    return stored ? parseInt(stored, 10) : 1;
  },
  setCurrentDay(dayIndex) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_DAY, String(dayIndex));
  },

  getWeekPace() {
    return localStorage.getItem(STORAGE_KEYS.WEEK_PACE) || this.getDefaultPace();
  },
  setWeekPace(pace) {
    localStorage.setItem(STORAGE_KEYS.WEEK_PACE, pace);
  },

  // 마지막으로 진도 이동한 날 (ISO 형식 'YYYY-MM-DD')
  // 빈 값이면 아직 한 번도 이동 안 한 것 (새 사용자)
  getLastAdvanceDate() {
    return localStorage.getItem(STORAGE_KEYS.LAST_ADVANCE_DATE) || '';
  },
  setLastAdvanceDate(isoDate) {
    localStorage.setItem(STORAGE_KEYS.LAST_ADVANCE_DATE, isoDate);
  },

  // 글씨 크기 (1~5, 기본 3)
  getTextSize() {
    const stored = localStorage.getItem(STORAGE_KEYS.TEXT_SIZE);
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 1 && n <= 5) return n;
    return 3;  // 기본값 — 보통
  },
  setTextSize(size) {
    const n = parseInt(size, 10);
    if (isNaN(n) || n < 1 || n > 5) return;
    localStorage.setItem(STORAGE_KEYS.TEXT_SIZE, String(n));
  },

  // 자연의 소리 토글 (잠잠히 머무는 동안) — 기본 켜짐
  isNatureSoundOn() {
    const stored = localStorage.getItem(STORAGE_KEYS.NATURE_SOUND);
    if (stored === null) return true;  // 기본 켜짐
    return stored === 'on';
  },
  setNatureSoundOn(on) {
    localStorage.setItem(STORAGE_KEYS.NATURE_SOUND, on ? 'on' : 'off');
  },

  // 마지막 속도 확인한 과
  getLastPaceCheckLesson() {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_PACE_CHECK_LESSON);
    return stored ? parseInt(stored, 10) : 0;
  },
  setLastPaceCheckLesson(lessonId) {
    localStorage.setItem(STORAGE_KEYS.LAST_PACE_CHECK_LESSON, String(lessonId));
  },

  // 디버그 - 모든 데이터 초기화
  clearAll() {
    // 풍성한 삶으로 첫걸음 키만 지우기 (다른 앱 데이터 안 건드림)
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firststep:')) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  },

  // 세션 완료 기록 (날짜별 - 오늘 무엇을 했는지)
  // sessionType: 'morning' | 'midday' | 'evening'
  // dateStr: 'YYYY-MM-DD'
  isSessionDone(dateStr, sessionType) {
    return localStorage.getItem(STORAGE_KEYS.SESSION_PREFIX + dateStr + ':' + sessionType) === 'done';
  },
  markSessionDone(dateStr, sessionType) {
    localStorage.setItem(STORAGE_KEYS.SESSION_PREFIX + dateStr + ':' + sessionType, 'done');
  },

  // 일별 완료 기록 (이 과의 어떤 일을 했는지 - 일 목록 화면용)
  // 키 형태: firststep:dayDone:1:3:morning  (1과 셋째 날 아침)
  isDaySessionDone(lessonId, dayIndex, sessionType) {
    return localStorage.getItem(`firststep:dayDone:${lessonId}:${dayIndex}:${sessionType}`) === 'done';
  },
  markDaySessionDone(lessonId, dayIndex, sessionType) {
    localStorage.setItem(`firststep:dayDone:${lessonId}:${dayIndex}:${sessionType}`, 'done');
  },
  // 마침 해제 (사용자가 직접 풀거나, 다시 하고 싶을 때)
  unmarkDaySessionDone(lessonId, dayIndex, sessionType) {
    localStorage.removeItem(`firststep:dayDone:${lessonId}:${dayIndex}:${sessionType}`);
  },
  // 오늘 날짜 기준 마침도 함께 해제 (오늘 마쳤던 세션만 의미 있음)
  unmarkTodaySession(dateStr, sessionType) {
    localStorage.removeItem(STORAGE_KEYS.SESSION_PREFIX + dateStr + ':' + sessionType);
  },

  // 어떤 일이 "어느 정도라도" 마쳐졌는지 (세 세션 중 하나라도)
  isDayStarted(lessonId, dayIndex) {
    return ['morning', 'midday', 'evening'].some(t =>
      this.isDaySessionDone(lessonId, dayIndex, t)
    );
  },
  // 어떤 일이 "완전히" 마쳐졌는지 (세 세션 다)
  isDayFullyDone(lessonId, dayIndex) {
    return ['morning', 'midday', 'evening'].every(t =>
      this.isDaySessionDone(lessonId, dayIndex, t)
    );
  },

  // 한 마디 기도 저장
  // lessonId: 1, dayIndex: 1, sessionType: 'morning'
  getPrayer(lessonId, dayIndex, sessionType) {
    return localStorage.getItem(
      STORAGE_KEYS.PRAYER_PREFIX + lessonId + ':' + dayIndex + ':' + sessionType
    ) || '';
  },
  setPrayer(lessonId, dayIndex, sessionType, text) {
    if (text && text.trim()) {
      localStorage.setItem(
        STORAGE_KEYS.PRAYER_PREFIX + lessonId + ':' + dayIndex + ':' + sessionType,
        text.trim()
      );
    }
  },

  // 모든 기도 가져오기 (기록 화면용)
  getAllPrayers() {
    const prayers = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.PRAYER_PREFIX)) {
        const parts = key.replace(STORAGE_KEYS.PRAYER_PREFIX, '').split(':');
        if (parts.length === 3) {
          prayers.push({
            lessonId: parseInt(parts[0], 10),
            dayIndex: parseInt(parts[1], 10),
            sessionType: parts[2],
            text: localStorage.getItem(key),
          });
        }
      }
    }
    return prayers;
  },

  // 통독 진도 트래커 (4과부터 사용)
  // 어디까지 읽었는지 절 번호로 저장
  // 키: firststep:read:lesson4:lastVerse → 18 (요한복음 1장 18절까지 읽음)
  // 책-장이 바뀌면 별도 키 (5과부터 확장 시)
  getReadingProgress(book, chapter) {
    const key = `firststep:read:${book}:${chapter}:lastVerse`;
    const v = localStorage.getItem(key);
    return v ? parseInt(v, 10) : 0;  // 0 = 아직 시작 안 함
  },
  setReadingProgress(book, chapter, lastVerse) {
    const key = `firststep:read:${book}:${chapter}:lastVerse`;
    localStorage.setItem(key, String(lastVerse));
  },
  // 통독 분량 선택 기억 (사용자가 다음에 들어올 때 같은 분량으로)
  getReadingSize() {
    return localStorage.getItem('firststep:readingSize') || '3';  // '3'|'5'|'7'|'10'
  },
  setReadingSize(size) {
    localStorage.setItem('firststep:readingSize', String(size));
  },

  // 주기도 자기 말 저장 (5·6과 아침 세션에서 사용)
  // 키: firststep:lords:{lessonId}:{dayIndex}
  getLordsEntry(lessonId, dayIndex) {
    return localStorage.getItem(`firststep:lords:${lessonId}:${dayIndex}`) || '';
  },
  setLordsEntry(lessonId, dayIndex, text) {
    const key = `firststep:lords:${lessonId}:${dayIndex}`;
    if (text && text.length > 0) {
      localStorage.setItem(key, text);
    } else {
      localStorage.removeItem(key);
    }
  },

  // 모든 주기도 자기 입력 가져오기
  getAllLordsEntries() {
    const entries = [];
    const prefix = 'firststep:lords:';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const parts = key.replace(prefix, '').split(':');
        if (parts.length === 2) {
          entries.push({
            lessonId: parseInt(parts[0], 10),
            dayIndex: parseInt(parts[1], 10),
            text: localStorage.getItem(key) || '',
          });
        }
      }
    }
    return entries;
  },
};

export default Storage;
