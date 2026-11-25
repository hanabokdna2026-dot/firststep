/**
 * 계정 · 여러 기기 동기화 · 모임
 *
 * 이 파일은 로그인 기능을 쓸 때만 불러옴 (로그인 안 하면 Firebase를 아예 안 불러옴).
 *
 * 서버 구조 (Firestore)
 *   users/{uid}                  — 동의 시각, 묶음별 마지막 저장 시각(docs), 소속 모임(groupId)
 *   users/{uid}/data/progress    — 진행 기록 { e: { 키: { v: 값|null, t: 시각 } }, u: 시각 }
 *   users/{uid}/data/rec-{과}    — 그 과의 기도 기록 (같은 모양)
 *   groups/{gid}                 — 모임 { name, leaderUid, leaderName, code, createdAt }
 *   groups/{gid}/members/{uid}   — 이끄미에게 보이는 진행 요약 (기도 내용은 절대 없음)
 *   groupCodes/{code}            — 초대 코드 → 모임
 *
 * 같은 기록을 두 기기에서 고치면 나중에 고친 쪽이 남음 (키마다 시각 비교).
 */

import Storage from './storage.js';
import { getAuthKit, getDbKit } from './firebase-core.js';
import {
  getMeta, saveMeta, startMeta, clearMeta, setDirtyListener,
  isSyncedKey, docIdFor, fullKey, listLocalSyncedKeys, getLedCache, setLedCache,
} from './sync-meta.js';
import { getTodayISO } from './time.js';

// ==========================================
// 상태
// ==========================================
let currentUser = null;
let authReady = null;            // 첫 로그인 상태 확인이 끝나면 풀리는 약속
const listeners = new Set();     // 화면에 상태 알리기
let status = { phase: 'idle', lastSync: 0, error: '' };  // idle | syncing | offline | error
let pushTimer = null;
let syncing = null;
let lastPullAt = 0;

function emit() {
  const snapshot = getState();
  listeners.forEach(fn => { try { fn(snapshot); } catch (e) { /* 무시 */ } });
}

export function getState() {
  const m = getMeta();
  return {
    user: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
    phase: status.phase,
    error: status.error,
    lastSync: (m && m.lastSync) || 0,
    pending: m ? Object.keys(m.dirty).length : 0,
    groupId: (m && m.groupId) || null,
  };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setPhase(phase, error = '') {
  status.phase = phase;
  status.error = error;
  emit();
}

// ==========================================
// 시작 — 앱이 켜질 때 (로그인한 적 있는 기기에서만 부름)
// ==========================================
export function start() {
  if (authReady) return authReady;
  authReady = (async () => {
    const { auth, A } = await getAuthKit();
    await new Promise((resolve) => {
      let first = true;
      A.onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (!user && getMeta()) {
          // 다른 곳에서 로그아웃되었거나 계정이 지워짐 — 이 기기 장부도 정리
          clearMeta();
        }
        emit();
        if (first) { first = false; resolve(); }
      });
    });
    return currentUser;
  })();
  authReady.catch(() => { authReady = null; });
  return authReady;
}

export async function getUser() {
  await start();
  return currentUser;
}

// 이 파일을 불러오는 순간부터 — Firebase를 아직 못 불러왔어도(오프라인으로 시작 등)
// 인터넷이 돌아오거나 앱이 다시 보이면 맞추기를 다시 시도함
setDirtyListener(schedulePush);
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncNow({ reason: 'online' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPush();
    else syncNow({ reason: 'visible', throttle: 30000 });
  });
}

// ==========================================
// 계정
// ==========================================
const AUTH_MESSAGES = {
  'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
  'auth/invalid-email': '이메일 주소를 다시 확인해 주세요.',
  'auth/missing-email': '이메일 주소를 적어 주세요.',
  'auth/weak-password': '비밀번호는 6자 이상으로 정해 주세요.',
  'auth/missing-password': '비밀번호를 적어 주세요.',
  'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.',
  'auth/wrong-password': '비밀번호가 맞지 않아요.',
  'auth/user-not-found': '가입된 이메일이 아니에요.',
  'auth/too-many-requests': '시도가 많았어요. 잠시 후 다시 해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/operation-not-allowed': '아직 로그인 기능이 준비되지 않았어요. 관리자에게 알려 주세요.',
  'auth/requires-recent-login': '보안을 위해 비밀번호를 한 번 더 확인해야 해요.',
  'auth/user-disabled': '사용할 수 없는 계정이에요.',
};

export function authMessage(err) {
  const code = err && err.code;
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (err && /network|offline|Failed to fetch|import/i.test(String(err.message || err))) {
    return '인터넷 연결을 확인해 주세요.';
  }
  return '문제가 생겼어요. 잠시 후 다시 해 주세요.' + (code ? ` (${code})` : '');
}

/**
 * 가입 — 개인정보 동의와 민감정보(기도·묵상 기록) 별도 동의를 받은 뒤에만 부름
 */
export async function signUp(email, password, consent) {
  if (!consent || !consent.privacy || !consent.sensitive) {
    throw { code: 'app/consent-required' };
  }
  await start();
  const { auth, A } = await getAuthKit();
  const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), password);
  currentUser = cred.user;
  const now = new Date().toISOString();
  const { db, F } = await getDbKit();
  await F.setDoc(F.doc(db, 'users', cred.user.uid), {
    createdAt: now,
    consent: { privacy: now, sensitive: now },
    docs: {},
    groupId: null,
  }, { merge: true });
  await linkThisDevice(cred.user.uid);
  return cred.user;
}

export async function signIn(email, password) {
  await start();
  const { auth, A } = await getAuthKit();
  const cred = await A.signInWithEmailAndPassword(auth, email.trim(), password);
  currentUser = cred.user;
  await linkThisDevice(cred.user.uid);
  return cred.user;
}

export async function resetPassword(email) {
  await start();
  const { auth, A } = await getAuthKit();
  await A.sendPasswordResetEmail(auth, email.trim());
}

/**
 * 로그아웃 — 이 기기의 기록은 그대로 둠 (계정에도 남아 있음)
 */
export async function signOut() {
  await flushPush();
  await start();
  const { auth, A } = await getAuthKit();
  clearMeta();
  await A.signOut(auth);
  currentUser = null;
  emit();
}

/**
 * 계정 삭제 — 서버의 모든 기록과 모임 정보를 지우고 계정을 없앰.
 * 이 기기에 남은 기록은 그대로 둠.
 */
export async function deleteAccount(password) {
  await start();
  const { auth, A } = await getAuthKit();
  const user = auth.currentUser;
  if (!user) throw { code: 'auth/no-current-user' };
  // 비밀번호 다시 확인 (오래 전에 로그인했으면 Firebase가 요구함)
  const cred = A.EmailAuthProvider.credential(user.email, password);
  await A.reauthenticateWithCredential(user, cred);

  const { db, F } = await getDbKit();
  const uid = user.uid;
  const userRef = F.doc(db, 'users', uid);
  const userSnap = await F.getDoc(userRef);
  const groupId = userSnap.exists() ? userSnap.data().groupId : null;

  // 1) 내가 들어가 있는 모임에서 빠지기
  if (groupId) {
    try { await F.deleteDoc(F.doc(db, 'groups', groupId, 'members', uid)); } catch (e) { /* 이미 없음 */ }
  }
  // 2) 내가 이끄는 모임 모두 없애기
  const led = await F.getDocs(F.query(F.collection(db, 'groups'), F.where('leaderUid', '==', uid)));
  for (const g of led.docs) {
    await deleteGroupDocs(g.id, g.data().code);
  }
  // 3) 내 기록 묶음과 계정 문서
  const data = await F.getDocs(F.collection(db, 'users', uid, 'data'));
  for (const d of data.docs) await F.deleteDoc(d.ref);
  await F.deleteDoc(userRef);
  // 4) 계정
  await A.deleteUser(user);
  clearMeta();
  currentUser = null;
  emit();
}

// ==========================================
// 동기화
// ==========================================

// 이 기기를 계정과 이음 — 이 기기에 있던 기록도 계정으로 올라감
// (서버에 같은 기록이 더 새것으로 있으면 서버 것이 남음)
async function linkThisDevice(uid) {
  const m = getMeta();
  if (!m || m.uid !== uid) {
    const fresh = startMeta(uid);
    listLocalSyncedKeys().forEach(k => {
      fresh.times[k] = 1;   // 아주 오래된 것으로 표시 — 서버에 있으면 서버 것이 이김
      fresh.dirty[k] = 1;
    });
    saveMeta();
  }
  emit();
  await syncNow({ reason: 'link', force: true });
}

function schedulePush() {
  emit();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; syncNow({ reason: 'change', pushOnly: true }); }, 2500);
}

export async function flushPush() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  const m = getMeta();
  if (m && Object.keys(m.dirty).length && currentUser) {
    try { await syncNow({ reason: 'flush', pushOnly: true }); } catch (e) { /* 무시 */ }
  }
}

/**
 * 서버와 맞추기. 동시에 여러 번 불려도 한 번씩 차례로.
 * @returns {Promise<{changed: boolean}>} 이 기기 기록이 서버 것으로 바뀌었는지
 */
export function syncNow(opts = {}) {
  const run = async () => {
    const m = getMeta();
    if (!m || !m.uid) return { changed: false };
    if (opts.throttle && Date.now() - lastPullAt < opts.throttle && !Object.keys(m.dirty).length) {
      return { changed: false };
    }
    await start();
    if (!currentUser || currentUser.uid !== m.uid) return { changed: false };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPhase('offline');
      return { changed: false };
    }
    setPhase('syncing');
    try {
      let changed = false;
      if (!opts.pushOnly) {
        changed = await pull(m);
        lastPullAt = Date.now();
      }
      const conflicts = await push(m);
      if (conflicts) changed = (await pull(m)) || changed;
      await updateMemberSummary(m);
      m.lastSync = Date.now();
      saveMeta();
      setPhase('idle');
      if (changed && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('firststep:synced', { detail: { changed: true } }));
      }
      return { changed };
    } catch (err) {
      console.warn('동기화 실패:', err);
      const offline = err && (err.code === 'unavailable' || /offline|network/i.test(String(err.message)));
      setPhase(offline ? 'offline' : 'error', offline ? '' : (err.code || String(err.message || err)));
      return { changed: false, error: err };
    }
  };
  syncing = (syncing || Promise.resolve()).then(run, run);
  return syncing;
}

// 서버 → 이 기기
async function pull(m) {
  const { db, F } = await getDbKit();
  const userRef = F.doc(db, 'users', m.uid);
  const us = await F.getDoc(userRef);
  if (!us.exists()) return false;
  const ud = us.data();
  m.groupId = ud.groupId || null;
  if (!m.ledAt || Date.now() - m.ledAt > 6 * 3600 * 1000) {
    try { await getLedGroups(); } catch (e) { /* 다음에 */ }
  }
  const docs = ud.docs || {};
  let changed = false;
  for (const [docId, u] of Object.entries(docs)) {
    if ((m.pulled[docId] || 0) >= u) continue;
    const ds = await F.getDoc(F.doc(db, 'users', m.uid, 'data', docId));
    const entries = ds.exists() ? (ds.data().e || {}) : {};
    for (const [k, ent] of Object.entries(entries)) {
      if (!isSyncedKey(k) || docIdFor(k) !== docId || !ent || typeof ent.t !== 'number') continue;
      if (ent.t > (m.times[k] || 0)) {
        if (ent.v === null || ent.v === undefined) localStorage.removeItem(fullKey(k));
        else localStorage.setItem(fullKey(k), String(ent.v));
        m.times[k] = ent.t;
        delete m.dirty[k];
        changed = true;
      }
    }
    m.pulled[docId] = u;
  }
  saveMeta();
  return changed;
}

// 이 기기 → 서버. 서버에 더 새것이 있으면 건너뛰고 true를 돌려줌 (다시 받아오도록)
async function push(m) {
  const dirtyKeys = Object.keys(m.dirty);
  if (!dirtyKeys.length) return false;
  const { db, F } = await getDbKit();
  const byDoc = {};
  dirtyKeys.forEach(k => {
    if (!isSyncedKey(k)) { delete m.dirty[k]; return; }
    (byDoc[docIdFor(k)] = byDoc[docIdFor(k)] || []).push(k);
  });
  const userRef = F.doc(db, 'users', m.uid);
  let conflicts = false;
  for (const [docId, keys] of Object.entries(byDoc)) {
    const ref = F.doc(db, 'users', m.uid, 'data', docId);
    const sent = {};
    const result = await F.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const remote = snap.exists() ? (snap.data().e || {}) : {};
      const prevU = snap.exists() ? (snap.data().u || 0) : 0;
      const updates = {};
      let skipped = false;
      for (const k of keys) {
        const t = m.times[k] || 1;
        const r = remote[k];
        if (r && typeof r.t === 'number' && r.t >= t) { skipped = true; continue; }
        const v = localStorage.getItem(fullKey(k));
        updates[k] = { v: v === null ? null : v, t };
        sent[k] = t;
      }
      if (!Object.keys(updates).length) return { wrote: 0, skipped, prevU };
      const u = Date.now();
      tx.set(ref, { e: updates, u }, { merge: true });
      tx.set(userRef, { docs: { [docId]: u } }, { merge: true });
      return { wrote: Object.keys(updates).length, skipped, u, prevU };
    });
    // 올리는 동안 다시 바뀐 것은 남겨 둠
    keys.forEach(k => {
      if (sent[k] !== undefined && m.times[k] === sent[k]) delete m.dirty[k];
    });
    if (result.skipped) {
      // 서버에 더 새것이 있던 키 — 이 기기 것은 버리고 서버 것을 다시 받아옴
      conflicts = true;
      keys.forEach(k => { if (sent[k] === undefined) delete m.dirty[k]; });
      m.pulled[docId] = 0;
    } else if (result.u && (m.pulled[docId] || 0) >= result.prevU) {
      // 쓰기 직전까지 서버 것을 다 받아 둔 상태였다면, 방금 쓴 것까지 이 기기와 같음
      m.pulled[docId] = result.u;
    }
    saveMeta();
  }
  return conflicts;
}

// ==========================================
// 모임 — 이끄미에게 보이는 진행 요약
// ==========================================
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function buildSummary() {
  const today = getTodayISO();
  const week = {};
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    let s = '';
    if (Storage.isSessionDone(day, 'morning')) s += 'm';
    if (Storage.isSessionDone(day, 'midday')) s += 'd';
    if (Storage.isSessionDone(day, 'evening')) s += 'e';
    week[day] = s;
  }
  const lesson = Storage.getCurrentLesson();
  const day = Storage.getCurrentDay();
  let place = `${lesson}과`;
  try {
    const { getLesson, getActiveDayIndices, getDisplayDayLabel } = await import('./content.js');
    const l = await getLesson(lesson);
    if (l) place = `${lesson}과 · ${getDisplayDayLabel(day, getActiveDayIndices(l, Storage.getWeekPace()))}`;
  } catch (e) { /* 내용 불러오기 실패 — 과만 */ }
  return {
    name: (Storage.getUserName() || '').slice(0, 20),
    lesson, day, place: place.slice(0, 40),
    lastActive: today,
    week,
  };
}

async function updateMemberSummary(m) {
  if (!m.groupId) return;
  const summary = await buildSummary();
  const sig = JSON.stringify(summary);
  if (m.summarySig === sig && m.summaryGroup === m.groupId) return;
  const { db, F } = await getDbKit();
  try {
    await F.updateDoc(F.doc(db, 'groups', m.groupId, 'members', m.uid), { ...summary, u: Date.now() });
    m.summarySig = sig;
    m.summaryGroup = m.groupId;
  } catch (err) {
    if (err && (err.code === 'not-found' || err.code === 'permission-denied')) {
      // 이끄미가 모임에서 내보냈거나 모임이 없어짐
      await F.setDoc(F.doc(db, 'users', m.uid), { groupId: null }, { merge: true });
      m.groupId = null;
      m.summarySig = null;
      emit();
    } else {
      throw err;
    }
  }
  saveMeta();
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // 헷갈리는 0·O·1·I 뺌
function makeCode() {
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** 초대 코드로 모임 정보 살펴보기 (들어가기 전 확인용) */
export async function lookupGroup(codeInput) {
  const code = normalizeCode(codeInput);
  if (code.length !== 6) throw { code: 'app/bad-code' };
  const { db, F } = await getDbKit();
  const c = await F.getDoc(F.doc(db, 'groupCodes', code));
  if (!c.exists()) throw { code: 'app/no-group' };
  const gid = c.data().gid;
  const g = await F.getDoc(F.doc(db, 'groups', gid));
  if (!g.exists()) throw { code: 'app/no-group' };
  return { gid, code, name: g.data().name, leaderName: g.data().leaderName || '' };
}

/** 모임에 들어가기 — 진행 상황 공유 동의를 받은 뒤에만 부름 */
export async function joinGroup(codeInput, consented) {
  if (!consented) throw { code: 'app/consent-required' };
  const user = await getUser();
  const m = getMeta();
  if (!user || !m) throw { code: 'auth/no-current-user' };
  const info = await lookupGroup(codeInput);
  const { db, F } = await getDbKit();
  if (m.groupId && m.groupId !== info.gid) {
    try { await F.deleteDoc(F.doc(db, 'groups', m.groupId, 'members', user.uid)); } catch (e) { /* 무시 */ }
  }
  const summary = await buildSummary();
  const now = new Date().toISOString();
  await F.setDoc(F.doc(db, 'groups', info.gid, 'members', user.uid), {
    ...summary, code: info.code, joinedAt: now, consentAt: now, u: Date.now(),
  });
  await F.setDoc(F.doc(db, 'users', user.uid), { groupId: info.gid }, { merge: true });
  m.groupId = info.gid;
  m.summarySig = JSON.stringify(summary);
  m.summaryGroup = info.gid;
  saveMeta();
  emit();
  return info;
}

export async function leaveGroup() {
  const user = await getUser();
  const m = getMeta();
  if (!user || !m || !m.groupId) return;
  const { db, F } = await getDbKit();
  try { await F.deleteDoc(F.doc(db, 'groups', m.groupId, 'members', user.uid)); } catch (e) { /* 이미 없음 */ }
  await F.setDoc(F.doc(db, 'users', user.uid), { groupId: null }, { merge: true });
  m.groupId = null;
  m.summarySig = null;
  saveMeta();
  emit();
}

/** 내가 들어가 있는 모임 (이름·이끄미) */
export async function getMyGroup() {
  const m = getMeta();
  if (!m || !m.groupId) return null;
  const { db, F } = await getDbKit();
  const g = await F.getDoc(F.doc(db, 'groups', m.groupId));
  // 내 요약이 아직 명단에 있는지도 확인 — 이끄미가 내보냈거나 모임이 없어졌으면 정리
  let stillMember = false;
  if (g.exists()) {
    try {
      stillMember = (await F.getDoc(F.doc(db, 'groups', m.groupId, 'members', m.uid))).exists();
    } catch (e) {
      stillMember = false;
    }
  }
  if (!stillMember) {
    try { await F.setDoc(F.doc(db, 'users', m.uid), { groupId: null }, { merge: true }); } catch (e) { /* 다음에 */ }
    m.groupId = null;
    m.summarySig = null;
    saveMeta();
    emit();
    return null;
  }
  return { gid: g.id, name: g.data().name, leaderName: g.data().leaderName || '' };
}

/** 내가 이끄는 모임들 */
export async function getLedGroups() {
  const user = await getUser();
  if (!user) return [];
  const { db, F } = await getDbKit();
  const q = await F.getDocs(F.query(F.collection(db, 'groups'), F.where('leaderUid', '==', user.uid)));
  const list = q.docs.map(d => ({ gid: d.id, ...d.data() }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  setLedCache(list);
  return list;
}

export async function createGroup(name) {
  const user = await getUser();
  if (!user) throw { code: 'auth/no-current-user' };
  const clean = String(name || '').trim().slice(0, 30);
  if (!clean) throw { code: 'app/no-name' };
  const { db, F } = await getDbKit();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const gref = F.doc(F.collection(db, 'groups'));
    const batch = F.writeBatch(db);
    batch.set(gref, {
      name: clean,
      leaderUid: user.uid,
      leaderName: (Storage.getUserName() || '').slice(0, 20),
      code,
      createdAt: new Date().toISOString(),
    });
    batch.set(F.doc(db, 'groupCodes', code), { gid: gref.id, leaderUid: user.uid });
    try {
      await batch.commit();
      setLedCache([...getLedCache(), { gid: gref.id, name: clean }]);
      emit();
      return { gid: gref.id, name: clean, code };
    } catch (err) {
      // 같은 코드가 이미 있으면 (아주 드묾) 새 코드로 다시
      if (err && err.code === 'permission-denied' && attempt < 4) continue;
      throw err;
    }
  }
  throw { code: 'app/code-failed' };
}

/** 이끄미 화면: 모임 정보와 사람들의 진행 요약 */
export async function getGroupProgress(gid) {
  const { db, F } = await getDbKit();
  const g = await F.getDoc(F.doc(db, 'groups', gid));
  if (!g.exists()) return null;
  const ms = await F.getDocs(F.collection(db, 'groups', gid, 'members'));
  const members = ms.docs.map(d => ({ uid: d.id, ...d.data() }));
  return { gid, ...g.data(), members };
}

export async function removeMember(gid, memberUid) {
  const { db, F } = await getDbKit();
  await F.deleteDoc(F.doc(db, 'groups', gid, 'members', memberUid));
}

async function deleteGroupDocs(gid, code) {
  const { db, F } = await getDbKit();
  const ms = await F.getDocs(F.collection(db, 'groups', gid, 'members'));
  for (const d of ms.docs) await F.deleteDoc(d.ref);
  if (code) { try { await F.deleteDoc(F.doc(db, 'groupCodes', code)); } catch (e) { /* 무시 */ } }
  await F.deleteDoc(F.doc(db, 'groups', gid));
}

export async function deleteGroup(gid) {
  const { db, F } = await getDbKit();
  const g = await F.getDoc(F.doc(db, 'groups', gid));
  if (g.exists()) await deleteGroupDocs(gid, g.data().code);
  setLedCache(getLedCache().filter(x => x.gid !== gid));
  emit();
}
