// 보안 규칙 시험 — 허용되어야 할 것과 막혀야 할 것을 하나씩 확인
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-firststep',
  firestore: { rules: readFileSync('../../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

const db = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const alice = db('alice'), bob = db('bob'), leader = db('leader'), anon = db(null);

let pass = 0, fail = 0;
async function check(name, p) {
  try { await p; pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n     ', e && e.message); }
}
const allow = (name, op) => check('허용: ' + name, assertSucceeds(op));
const deny = (name, op) => check('막힘: ' + name, assertFails(op));

const summary = (extra = {}) => ({
  name: '은혜', lesson: 4, day: 2, place: '4과 · 둘째 날', lastActive: '2026-11-25',
  week: { '2026-11-25': 'm' }, u: 1, ...extra,
});

console.log('계정과 기록');
await allow('본인 계정 문서 만들기', setDoc(doc(alice, 'users/alice'), { createdAt: 'x', consent: { privacy: 'x', sensitive: 'x' }, docs: {}, groupId: null }));
await deny('계정 문서에 정해지지 않은 칸', setDoc(doc(alice, 'users/alice'), { admin: true }, { merge: true }));
await allow('본인 기도 기록 저장', setDoc(doc(alice, 'users/alice/data/rec-4'), { e: { 'prayer:4:1:morning': { v: '주님', t: 5 } }, u: 5 }));
await allow('본인 진행 기록 저장', setDoc(doc(alice, 'users/alice/data/progress'), { e: { currentLesson: { v: '4', t: 5 } }, u: 5 }));
await deny('정해지지 않은 묶음 이름', setDoc(doc(alice, 'users/alice/data/secret'), { e: {}, u: 1 }));
await deny('기록 묶음에 다른 칸', setDoc(doc(alice, 'users/alice/data/rec-4'), { e: {}, u: 1, note: 'x' }));
await allow('본인 기도 기록 읽기', getDoc(doc(alice, 'users/alice/data/rec-4')));
await deny('다른 사람이 기도 기록 읽기', getDoc(doc(bob, 'users/alice/data/rec-4')));
await deny('인도자가 기도 기록 읽기', getDoc(doc(leader, 'users/alice/data/rec-4')));
await deny('로그인 안 한 사람이 읽기', getDoc(doc(anon, 'users/alice/data/rec-4')));
await deny('다른 사람이 기록 쓰기', setDoc(doc(bob, 'users/alice/data/rec-4'), { e: {}, u: 1 }));
await deny('다른 사람 계정 문서 읽기', getDoc(doc(bob, 'users/alice')));

console.log('모임 만들기');
const b = writeBatch(leader);
b.set(doc(leader, 'groups/g1'), { name: '화요 소그룹', leaderUid: 'leader', leaderName: '목자', code: 'ABC234', createdAt: 'x' });
b.set(doc(leader, 'groupCodes/ABC234'), { gid: 'g1', leaderUid: 'leader' });
await allow('인도자가 모임과 코드 함께 만들기', b.commit());
await deny('남의 모임을 가리키는 코드 만들기', setDoc(doc(bob, 'groupCodes/ZZZ999'), { gid: 'g1', leaderUid: 'bob' }));
await deny('이미 있는 코드 덮어쓰기', setDoc(doc(bob, 'groupCodes/ABC234'), { gid: 'g1', leaderUid: 'bob' }));
await deny('다른 사람을 인도자로 모임 만들기', setDoc(doc(bob, 'groups/g2'), { name: 'x', leaderUid: 'leader', leaderName: '', code: 'QQQ222', createdAt: 'x' }));
await deny('인도자 아닌 사람이 모임 고치기', setDoc(doc(bob, 'groups/g1'), { name: '바꿈' }, { merge: true }));
await allow('로그인한 사람이 코드로 모임 찾기', getDoc(doc(bob, 'groupCodes/ABC234')));
await deny('코드 목록 보기', getDocs(collection(bob, 'groupCodes')));
await deny('로그인 안 한 사람이 코드 찾기', getDoc(doc(anon, 'groupCodes/ABC234')));
await allow('인도자가 자기 모임 목록 보기', getDocs(query(collection(leader, 'groups'), where('leaderUid', '==', 'leader'))));
await deny('모든 모임 목록 보기', getDocs(collection(bob, 'groups')));

console.log('모임 들어가기와 진행 요약');
await deny('틀린 코드로 들어가기', setDoc(doc(alice, 'groups/g1/members/alice'), summary({ code: 'WRONG1', joinedAt: 'x', consentAt: 'x' })));
await deny('요약에 기도 내용 칸 넣기', setDoc(doc(alice, 'groups/g1/members/alice'), summary({ code: 'ABC234', joinedAt: 'x', consentAt: 'x', prayer: '주님' })));
await deny('남의 이름으로 들어가기', setDoc(doc(bob, 'groups/g1/members/alice'), summary({ code: 'ABC234', joinedAt: 'x', consentAt: 'x' })));
await allow('맞는 코드로 들어가기', setDoc(doc(alice, 'groups/g1/members/alice'), summary({ code: 'ABC234', joinedAt: 'x', consentAt: 'x' })));
await allow('본인 요약 갱신', updateDoc(doc(alice, 'groups/g1/members/alice'), { day: 3, u: 2 }));
await deny('요약의 코드 바꾸기', updateDoc(doc(alice, 'groups/g1/members/alice'), { code: 'XYZ789' }));
await allow('인도자가 모임 사람들 진행 보기', getDocs(collection(leader, 'groups/g1/members')));
await deny('모임 사람이 다른 사람들 진행 보기', getDocs(collection(alice, 'groups/g1/members')));
await deny('모임 밖 사람이 진행 보기', getDoc(doc(bob, 'groups/g1/members/alice')));
await allow('본인 요약 읽기', getDoc(doc(alice, 'groups/g1/members/alice')));
await allow('인도자가 내보내기', deleteDoc(doc(leader, 'groups/g1/members/alice')));
await deny('내보낸 뒤 요약 갱신으로 다시 들어오기', updateDoc(doc(alice, 'groups/g1/members/alice'), { day: 4, u: 3 }));

console.log('알림 토큰 (기존 규칙)');
const tok = 'tok_' + 'x'.repeat(40);
await deny('토큰 없이 새로 만들기 (예전 갱신 방식)', setDoc(doc(anon, 'pushUsers/' + tok), { meetingTimes: {}, scheduledSlots: [] }, { merge: true }));
await allow('토큰·켜짐을 함께 보내는 새 갱신 방식', setDoc(doc(anon, 'pushUsers/' + tok), { token: tok, enabled: true, meetingTimes: { morning: '05:30' }, scheduledSlots: ['05:30'], timezone: 'Asia/Seoul', lastUpdated: 'x' }, { merge: true }));
await deny('알림 토큰 목록 보기', getDocs(collection(anon, 'pushUsers')));

await env.cleanup();
console.log(`\n규칙 시험: 통과 ${pass}, 실패 ${fail}`);
if (fail) process.exit(1);
