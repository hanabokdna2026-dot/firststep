// 여러 기기 시험 — 실제 앱 화면을 브라우저로 열어 에뮬레이터에 붙여서 확인
//  A: 원래 쓰던 휴대폰 (기록이 있음)  B: 새 휴대폰  C: 이끄미  D: 계정 삭제 시험용
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('../..');
const PORT = 5173;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.resolve('shots');
fs.mkdirSync(SHOTS, { recursive: true });

// ---- 정적 서버 ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, BASE).pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, r));

// ---- 결과 기록 ----
let pass = 0, fail = 0;
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail ? '\n      ' + detail : ''); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000, step = 300) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(step); }
  return null;
}

// ---- 에뮬레이터에서 직접 읽기 (규칙 무시하는 관리자 권한) ----
async function remote(docPath) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-firststep/databases/(default)/documents/${docPath}`,
    { headers: { Authorization: 'Bearer owner' } });
  if (r.status === 404) return null;
  return r.json();
}
function entry(docJson, key) {
  const f = docJson && docJson.fields && docJson.fields.e && docJson.fields.e.mapValue.fields;
  const ent = f && f[key] && f[key].mapValue.fields;
  if (!ent) return undefined;
  return ent.v.stringValue !== undefined ? ent.v.stringValue : null;
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const browser = await chromium.launch();

async function device(name, seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    serviceWorkers: 'block', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('firststep-dev:emulator', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
      sessionStorage.setItem('seeded', '1');
    }
  }, seed);
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => console.log(`  [${name} 오류]`, e.message));
  page.on('console', m => { if (m.type() === 'error') console.log(`  [${name} 콘솔]`, m.text()); });
  page.ctx = ctx;
  return page;
}
const shot = (page, file) => page.screenshot({ path: path.join(SHOTS, file), fullPage: true });
const ls = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const uidOf = (page) => page.evaluate(async () => (await import('/js/cloud.js')).getState().user?.uid);

const seedA = {
  'firststep:onboardingDone': 'true', 'firststep:userName': '은혜', 'firststep:currentLesson': '4', 'firststep:currentDay': '2',
  'firststep:weekPace': 'one', 'firststep:defaultPace': 'one', 'firststep:lastAdvanceDate': today, 'firststep:lastPaceCheckLesson': '10',
  [`firststep:session:${today}:morning`]: 'done', 'firststep:dayDone:4:2:morning': 'done',
  'firststep:prayer:4:1:morning': '주님, 오늘 제 한 걸음에 주의 말씀이 빛이 되어 주세요.',
  'firststep:prayer:4:1:evening': '오늘 하루 함께해 주셔서 감사합니다.',
  'firststep:lords:5:1': '하늘에 계신 우리 아버지',
  'firststep:textSize': '4',
};

try {
  // ------------------------------------------------------------
  console.log('1. 가입 — 동의 없이는 안 되고, 하면 기존 기록이 올라감');
  const A = await device('A', seedA);
  await A.goto(BASE + '/index.html#account');
  await A.click('.acct-seg-opt[data-mode="signup"]');
  await A.fill('#acct-email', 'grace@test.kr');
  await A.fill('#acct-pw', 'pray1234');
  await A.fill('#acct-pw2', 'pray1234');
  await shot(A, '01_signup_form.png');
  await A.click('#acct-submit');
  ok((await A.textContent('#acct-error')).includes('동의'), '동의 없이 가입 막힘');
  await A.check('#c-privacy');
  await A.check('#c-sensitive');
  await A.click('#acct-submit');
  ok(await A.waitForSelector('.acct-email', { timeout: 20000 }).then(() => true, () => false), '가입 후 계정 화면');
  const aUid = await uidOf(A);
  const rec4 = await until(async () => { const d = await remote(`users/${aUid}/data/rec-4`); return entry(d, 'prayer:4:1:morning') ? d : null; });
  ok(rec4 && entry(rec4, 'prayer:4:1:morning').startsWith('주님, 오늘'), '이 기기에 있던 기도가 계정으로 올라감');
  const rec5 = await remote(`users/${aUid}/data/rec-5`);
  ok(entry(rec5, 'lords:5:1') === '하늘에 계신 우리 아버지', '주기도 기록도 올라감');
  const prog = await remote(`users/${aUid}/data/progress`);
  ok(entry(prog, 'currentLesson') === '4' && entry(prog, 'userName') === '은혜', '진도와 이름이 올라감');
  ok(entry(prog, 'textSize') === undefined, '글씨 크기 같은 기기 설정은 올라가지 않음');
  const userDoc = await remote(`users/${aUid}`);
  ok(!!(userDoc && userDoc.fields.consent), '동의 시각이 계정에 기록됨');
  await until(async () => (await A.textContent('#acct-sync')).includes('저장되어'));
  await shot(A, '02_account_signed_in.png');

  // ------------------------------------------------------------
  console.log('2. 새 휴대폰에서 로그인하면 기록과 진도를 그대로 이어감');
  const B = await device('B');
  await B.goto(BASE + '/index.html');
  await B.waitForSelector('#btn-login-start');
  await shot(B, '00_welcome.png');
  await B.click('#btn-login-start');
  await B.waitForSelector('#acct-email');
  ok(await B.$('.acct-seg-opt.is-on[data-mode="signup"]') !== null, '첫 화면에서 들어오면 가입 탭이 먼저');
  await B.click('.acct-seg-opt[data-mode="login"]');
  await shot(B, '03_welcome_login.png');
  await B.fill('#acct-email', 'grace@test.kr');
  await B.fill('#acct-pw', 'wrongpass');
  await B.click('#acct-submit');
  await until(async () => (await B.textContent('#acct-error')).length > 0);
  ok((await B.textContent('#acct-error')).includes('맞지 않'), '틀린 비밀번호 안내', await B.textContent('#acct-error'));
  await B.fill('#acct-pw', 'pray1234');
  await B.click('#acct-submit');
  ok(await until(async () => (await B.evaluate(() => location.hash)) === '#home'), '로그인하자 바로 오늘 화면으로');
  await B.waitForSelector('.home-card-lesson-num', { timeout: 10000 });
  ok((await B.textContent('.home-card-lesson-num')).includes('4과'), '새 기기에 4과 진도가 이어짐', await B.textContent('.home-card-lesson-num'));
  ok((await ls(B, 'firststep:textSize')) === null, '새 기기의 글씨 크기는 따로 (옮겨오지 않음)');
  await shot(B, '04_new_device_home.png');
  await B.goto(BASE + '/index.html#record');
  await B.waitForTimeout(1200);
  ok((await B.content()).includes('주님, 오늘 제 한 걸음에'), '새 기기 기록 화면에 예전 기도가 보임');
  await shot(B, '05_new_device_record.png');

  // ------------------------------------------------------------
  console.log('3. 한 기기에서 적으면 다른 기기에도 보임');
  await B.evaluate(async () => { const S = (await import('/js/storage.js')).default; S.setPrayer(4, 2, 'morning', 'B에서 적은 기도'); });
  ok(!!await until(async () => entry(await remote(`users/${aUid}/data/rec-4`), 'prayer:4:2:morning') === 'B에서 적은 기도'), 'B에서 적은 기도가 서버로');
  await A.reload();
  ok(!!await until(async () => (await ls(A, 'firststep:prayer:4:2:morning')) === 'B에서 적은 기도'), 'A를 다시 여니 B의 기도가 내려옴');

  console.log('4. 같은 칸을 두 기기에서 고치면 나중 것이 남음');
  await A.evaluate(async () => { const S = (await import('/js/storage.js')).default; S.setPrayer(4, 3, 'evening', 'A가 먼저'); });
  await until(async () => entry(await remote(`users/${aUid}/data/rec-4`), 'prayer:4:3:evening') === 'A가 먼저');
  await sleep(50);
  await B.evaluate(async () => { const S = (await import('/js/storage.js')).default; S.setPrayer(4, 3, 'evening', 'B가 나중에'); });
  await until(async () => entry(await remote(`users/${aUid}/data/rec-4`), 'prayer:4:3:evening') === 'B가 나중에');
  await A.reload();
  ok(!!await until(async () => (await ls(A, 'firststep:prayer:4:3:evening')) === 'B가 나중에'), 'A에도 나중 것(B)이 남음');

  console.log('5. 인터넷 없이 적은 것은 연결되면 올라감');
  await A.ctx.setOffline(true);
  await A.evaluate(async () => { const S = (await import('/js/storage.js')).default; S.setPrayer(4, 3, 'midday', '오프라인에서 적음'); });
  await sleep(3500);
  ok(entry(await remote(`users/${aUid}/data/rec-4`), 'prayer:4:3:midday') === undefined, '오프라인 동안은 서버에 없음');
  await A.ctx.setOffline(false);
  await A.evaluate(() => window.dispatchEvent(new Event('online')));
  ok(!!await until(async () => entry(await remote(`users/${aUid}/data/rec-4`), 'prayer:4:3:midday') === '오프라인에서 적음'), '연결되자 올라감');

  // ------------------------------------------------------------
  console.log('6. 이끄미가 모임을 만들고, A가 초대 코드로 들어감');
  const C = await device('C', { 'firststep:onboardingDone': 'true', 'firststep:userName': '목자', 'firststep:lastAdvanceDate': today });
  await C.goto(BASE + '/index.html#account');
  await C.click('.acct-seg-opt[data-mode="signup"]');
  await C.fill('#acct-email', 'leader@test.kr');
  await C.fill('#acct-pw', 'lead1234');
  await C.fill('#acct-pw2', 'lead1234');
  await C.check('#c-privacy');
  await C.check('#c-sensitive');
  await C.click('#acct-submit');
  await C.waitForSelector('#acct-new', { timeout: 20000 });
  await C.click('#acct-new');
  await C.fill('#acct-new-name', '화요 소그룹');
  await C.click('#acct-new-ok');
  ok(!!await until(async () => (await C.evaluate(() => location.hash)).startsWith('#group/')), '모임 만들고 이끄미 화면으로');
  await C.waitForSelector('.grp-code');
  const code = (await C.textContent('.grp-code')).trim();
  ok(/^[A-Z0-9]{6}$/.test(code), '초대 코드 6자리 생성: ' + code);
  await shot(C, '06_leader_empty.png');

  await A.goto(BASE + '/index.html#account');
  await A.waitForSelector('#acct-code', { timeout: 15000 });
  await A.fill('#acct-code', 'zzzzzz');
  await A.click('#acct-join');
  await until(async () => (await A.textContent('#acct-join-err')).length > 0);
  ok((await A.textContent('#acct-join-err')).includes('없어요'), '없는 코드 안내');
  await A.fill('#acct-code', code.toLowerCase());
  await A.click('#acct-join');
  await A.waitForSelector('.acct-sheet');
  await shot(A, '07_join_consent.png');
  await A.click('#sheet-ok');
  ok((await A.textContent('.acct-sheet #sheet-err')).includes('동의'), '공유 동의 없이 못 들어감');
  await A.check('#c-share');
  await A.click('#sheet-ok');
  ok(!!await until(async () => (await A.textContent('#acct-mygroup')).includes('화요 소그룹')), 'A가 모임에 들어감');
  await shot(A, '08_member_account.png');

  await C.reload();
  await C.waitForSelector('.grp-item', { timeout: 15000 });
  const row = await C.textContent('.grp-item');
  ok(row.includes('은혜') && row.includes('4과'), '이끄미 화면에 A의 이름과 진도', row.replace(/\s+/g, ' '));
  ok(row.includes('오늘'), '마지막 활동 오늘');
  ok(await C.$('.grp-day.is-today .grp-dot.is-m.is-on') !== null, '오늘 아침을 한 것이 점으로 보임');
  await shot(C, '09_leader_view.png');
  const peek = await C.evaluate(async (uid) => {
    const { getDbKit } = await import('/js/firebase-core.js');
    const { db, F } = await getDbKit();
    try { await F.getDoc(F.doc(db, 'users', uid, 'data', 'rec-4')); return 'read'; } catch (e) { return e.code; }
  }, aUid);
  ok(peek === 'permission-denied', '이끄미가 A의 기도 기록을 직접 읽으려 하면 막힘', peek);

  // A가 오늘 저녁을 마치면 이끄미 화면에 반영
  await A.evaluate(async (t) => {
    const S = (await import('/js/storage.js')).default;
    S.markSessionDone(t, 'evening');
  }, today);
  await sleep(4000);
  await C.reload();
  await C.waitForSelector('.grp-item');
  ok(await C.$('.grp-day.is-today .grp-dot.is-e.is-on') !== null, 'A가 저녁을 마치자 이끄미 화면에 반영');

  // ------------------------------------------------------------
  console.log('7. 계정 삭제 — 서버 기록과 모임 정보가 모두 지워짐');
  const D = await device('D', { 'firststep:onboardingDone': 'true', 'firststep:userName': '디모데', 'firststep:prayer:1:1:morning': '지울 기도', 'firststep:lastAdvanceDate': today });
  await D.goto(BASE + '/index.html#account');
  await D.click('.acct-seg-opt[data-mode="signup"]');
  await D.fill('#acct-email', 'd@test.kr');
  await D.fill('#acct-pw', 'dddd1234');
  await D.fill('#acct-pw2', 'dddd1234');
  await D.check('#c-privacy');
  await D.check('#c-sensitive');
  await D.click('#acct-submit');
  await D.waitForSelector('#acct-code', { timeout: 20000 });
  const dUid = await uidOf(D);
  await D.fill('#acct-code', code);
  await D.click('#acct-join');
  await D.waitForSelector('#c-share');
  await D.check('#c-share');
  await D.click('#sheet-ok');
  await until(async () => (await D.textContent('#acct-mygroup')).includes('화요 소그룹'));
  ok(!!await until(async () => entry(await remote(`users/${dUid}/data/rec-1`), 'prayer:1:1:morning') === '지울 기도'), 'D 기록이 서버에 있음');
  await D.click('#acct-delete');
  await D.fill('#del-pw', 'dddd1234');
  await D.click('#sheet-ok');
  ok(!!await until(async () => !!(await D.$('.acct-seg'))), '삭제 후 로그인 화면으로');
  ok(await remote(`users/${dUid}`) === null && await remote(`users/${dUid}/data/rec-1`) === null, 'D의 계정 문서와 기록이 서버에서 지워짐');
  ok(await remote(`groups/` + (await C.evaluate(() => location.hash.split('/')[1])) + `/members/${dUid}`) === null, 'D가 모임 명단에서도 빠짐');
  ok((await ls(D, 'firststep:prayer:1:1:morning')) === '지울 기도', '휴대폰의 기록은 그대로 남음');

  // ------------------------------------------------------------
  console.log('8. 이끄미가 내보내면 A 쪽에서도 모임이 사라짐, 로그아웃해도 기록은 남음');
  await C.reload();
  await C.waitForSelector('.grp-remove');
  await C.click('.grp-remove');
  await sleep(1500);
  await A.reload();
  await sleep(1500);
  await A.goto(BASE + '/index.html#account');
  ok(!!await until(async () => !!(await A.$('#acct-code'))), 'A 화면에 다시 초대 코드 칸이 보임');

  await B.goto(BASE + '/index.html#account');
  await B.waitForSelector('#acct-logout', { timeout: 15000 });
  await B.click('#acct-logout');
  ok(!!await until(async () => !!(await B.$('.acct-seg'))), 'B 로그아웃');
  ok((await ls(B, 'firststep:prayer:4:1:morning')) !== null, '로그아웃해도 B 휴대폰의 기록은 남음');
  ok((await ls(B, 'firststep-sync')) === null, '로그아웃하면 동기화 장부는 지워짐');

  await A.goto(BASE + '/index.html#settings');
  await A.waitForSelector('#btn-account');
  await shot(A, '10_settings.png');

  // ------------------------------------------------------------
  console.log('9. 첫 화면에서 로그인하고 이끄미로 시작');
  const E = await device('E');
  await E.goto(BASE + '/index.html');
  await E.waitForSelector('#btn-login-start');
  await E.click('#btn-login-start');
  await E.waitForSelector('#acct-pw2');
  await E.fill('#acct-email', 'ikkumi@test.kr');
  await E.fill('#acct-pw', 'lead5678');
  await E.fill('#acct-pw2', 'lead5678');
  await E.check('#c-privacy');
  await E.check('#c-sensitive');
  await E.click('#acct-submit');
  ok(!!await until(async () => (await E.evaluate(() => location.hash)) === '#name'), '가입 뒤 이름 화면으로');
  await E.fill('#name-input', '바나바');
  await E.click('#btn-next');
  ok(!!await until(async () => (await E.evaluate(() => location.hash)) === '#role'), '로그인했으니 이름 다음에 함께하기 화면');
  ok(await E.$eval('#btn-next', b => b.disabled), '고르기 전에는 다음 버튼이 잠김');
  await shot(E, '11_role_choose.png');
  await E.click('.option-card[data-role="leader"]');
  await E.fill('#role-gname', '목요 따르미 모임');
  await E.click('#role-make');
  await E.waitForSelector('#role-panel .grp-code', { timeout: 15000 });
  const code2 = (await E.textContent('#role-panel .grp-code')).trim();
  ok(/^[A-Z0-9]{6}$/.test(code2), '이끄미로 모임 만들고 코드 받음: ' + code2);
  await shot(E, '12_role_leader_done.png');
  await E.click('#btn-next');
  ok(!!await until(async () => (await E.evaluate(() => location.hash)) === '#pace'), '다음은 속도 화면');
  await E.click('#btn-next');
  await until(async () => (await E.evaluate(() => location.hash)) === '#intro');
  await E.click('#btn-next');
  await until(async () => (await E.evaluate(() => location.hash)) === '#notify');
  await E.click('#btn-start');
  ok(!!await until(async () => (await E.evaluate(() => location.hash)) === '#home'), '오늘 화면까지 도착');
  await E.waitForSelector('.home-tab[data-tab="group"]', { timeout: 10000 });
  ok(true, '이끄미에게 아래 모임 탭이 보임');
  await shot(E, '13_leader_home_tab.png');

  console.log('10. 첫 화면에서 로그인하고 따르미로 시작');
  const F = await device('F');
  await F.goto(BASE + '/index.html');
  await F.waitForSelector('#btn-login-start');
  await F.click('#btn-login-start');
  await F.waitForSelector('#acct-pw2');
  await F.fill('#acct-email', 'ttareumi@test.kr');
  await F.fill('#acct-pw', 'follow12');
  await F.fill('#acct-pw2', 'follow12');
  await F.check('#c-privacy');
  await F.check('#c-sensitive');
  await F.click('#acct-submit');
  await until(async () => (await F.evaluate(() => location.hash)) === '#name');
  await F.fill('#name-input', '루디아');
  await F.click('#btn-next');
  await until(async () => (await F.evaluate(() => location.hash)) === '#role');
  await F.click('.option-card[data-role="member"]');
  await F.fill('#role-code', code2);
  await F.click('#role-join');
  await F.waitForSelector('#c-share');
  await shot(F, '14_role_member_consent.png');
  await F.check('#c-share');
  await F.click('#sheet-ok');
  ok(!!await until(async () => (await F.textContent('#role-panel')).includes('목요 따르미 모임')), '따르미로 모임에 들어감');
  ok(!(await F.$eval('#btn-next', b => b.disabled)), '들어간 뒤 다음 버튼이 열림');
  await F.click('#btn-next');
  await until(async () => (await F.evaluate(() => location.hash)) === '#pace');
  await F.click('#btn-next');
  await until(async () => (await F.evaluate(() => location.hash)) === '#intro');
  await F.click('#btn-next');
  await until(async () => (await F.evaluate(() => location.hash)) === '#notify');
  await F.click('#btn-start');
  ok(!!await until(async () => (await F.evaluate(() => location.hash)) === '#home'), '따르미도 오늘 화면까지 도착');
  ok(await F.$('.home-tab[data-tab="group"]') === null, '따르미에게는 모임 탭이 없음');

  await E.click('.home-tab[data-tab="group"]');
  await E.waitForSelector('.grp-item', { timeout: 15000 });
  const erow = await E.textContent('.grp-item');
  ok(erow.includes('루디아') && erow.includes('1과'), '이끄미 모임 탭에 따르미 루디아와 진도', erow.replace(/\s+/g, ' '));
  await shot(E, '15_leader_tab_view.png');

  console.log('11. 로그인 없이 시작하면 함께하기 단계 없이 그대로');
  const G = await device('G');
  await G.goto(BASE + '/index.html');
  await G.waitForSelector('#btn-start');
  await G.click('#btn-start');
  await until(async () => (await G.evaluate(() => location.hash)) === '#name');
  await G.fill('#name-input', '혼자');
  await G.click('#btn-next');
  ok(!!await until(async () => (await G.evaluate(() => location.hash)) === '#pace'), '이름 다음 바로 속도 화면 (함께하기 없음)');
} catch (e) {
  fail++;
  console.log('  ✗ 시험 중단:', e && e.stack || e);
}

await browser.close();
server.close();
console.log(`\n여러 기기 시험: 통과 ${pass}, 실패 ${fail}`);
process.exit(fail ? 1 : 0);
