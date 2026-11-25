/**
 * 동기화 장부 (Firebase를 불러오지 않는 가벼운 부분)
 *
 * 로그인한 기기에서만 동작함. 로그인하지 않았으면 아무 일도 안 함.
 *
 * - 어떤 기록이 언제 바뀌었는지(times)와 아직 서버에 못 올린 것(dirty)을 적어둠
 * - 저장 모듈(storage.js)이 값을 바꿀 때마다 noteLocalChange를 부름
 * - 실제 서버와 주고받는 일은 cloud.js가 함
 *
 * 서버에 올리는 것:
 * - 진행 기록: 이름, 속도, 만날 시간, 현재 과·날, 마친 세션, 통독 책갈피 등
 * - 기도 기록: 한 마디 기도, 주기도 자기 말 (과마다 한 묶음)
 * 기기마다 따로 두는 것: 글씨 크기, 자연의 소리, 알림 켜짐·토큰
 */

const META_KEY = 'firststep-sync';
const PREFIX = 'firststep:';

const PROGRESS_KEYS = new Set([
  'userName', 'defaultPace', 'notifyTimes', 'onboardingDone',
  'currentLesson', 'currentDay', 'weekStartDate', 'weekPace',
  'lastAdvanceDate', 'lastPaceCheckLesson', 'readingSize',
]);
const PROGRESS_PREFIXES = ['session:', 'dayDone:', 'read:', 'reading:'];
const RECORD_PREFIXES = ['prayer:', 'lords:'];

let meta;          // undefined = 아직 안 읽음, null = 로그인 안 함
let dirtyListener = null;

function load() {
  if (meta !== undefined) return meta;
  meta = null;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const m = JSON.parse(raw);
      if (m && typeof m === 'object' && m.uid) {
        m.times = m.times || {};
        m.dirty = m.dirty || {};
        m.pulled = m.pulled || {};
        meta = m;
      }
    }
  } catch (e) { meta = null; }
  return meta;
}

export function getMeta() {
  return load();
}

export function saveMeta() {
  if (!meta) return;
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* 용량 부족 등 */ }
}

// 이 기기를 계정과 처음 잇거나 다른 계정으로 바꿀 때
export function startMeta(uid) {
  meta = { uid, times: {}, dirty: {}, pulled: {}, lastSync: 0 };
  saveMeta();
  return meta;
}

export function clearMeta() {
  meta = null;
  try { localStorage.removeItem(META_KEY); } catch (e) { /* 무시 */ }
}

export function isLinked() {
  const m = load();
  return !!(m && m.uid);
}

export function setDirtyListener(fn) {
  dirtyListener = fn;
}

export function shortKey(fullKey) {
  return typeof fullKey === 'string' && fullKey.startsWith(PREFIX) ? fullKey.slice(PREFIX.length) : null;
}

export function fullKey(short) {
  return PREFIX + short;
}

export function isSyncedKey(k) {
  if (typeof k !== 'string' || !k) return false;
  if (PROGRESS_KEYS.has(k)) return true;
  if (PROGRESS_PREFIXES.some(p => k.startsWith(p))) return true;
  return docIdForRecord(k) !== null;
}

function docIdForRecord(k) {
  for (const p of RECORD_PREFIXES) {
    if (k.startsWith(p)) {
      const lessonId = parseInt(k.slice(p.length).split(':')[0], 10);
      if (lessonId >= 1 && lessonId <= 99) return 'rec-' + lessonId;
      return null;
    }
  }
  return null;
}

// 서버에서 어느 묶음(문서)에 들어가는지
export function docIdFor(k) {
  return docIdForRecord(k) || 'progress';
}

// 저장 모듈이 값을 바꿀 때마다 부름
export function noteLocalChange(full) {
  const m = load();
  if (!m) return;
  const k = shortKey(full);
  if (!k || !isSyncedKey(k)) return;
  m.times[k] = Math.max(Date.now(), (m.times[k] || 0) + 1);
  m.dirty[k] = 1;
  saveMeta();
  if (dirtyListener) {
    try { dirtyListener(); } catch (e) { /* 무시 */ }
  }
}

// 이 기기에 지금 있는 동기화 대상 기록들 (처음 계정과 이을 때 사용)
export function listLocalSyncedKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = shortKey(localStorage.key(i));
    if (k && isSyncedKey(k)) keys.push(k);
  }
  return keys;
}
