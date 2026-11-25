/**
 * 계정과 모임
 *
 * URL: #account        (설정에서 들어옴)
 *      #account/start  (처음 화면의 '로그인하고 시작하기'에서 들어옴 — 가입 탭이 먼저)
 *                      가입·로그인 뒤: 이미 진행하던 계정이면 오늘 화면으로,
 *                      처음이면 이름 → 함께하기(이끄미/따르미/혼자) → 속도 … 순서로
 *
 * 로그인하지 않은 상태: 로그인 / 처음 가입 (가입은 동의 두 가지를 받은 뒤에만)
 * 로그인한 상태: 동기화 상태, 내 모임(초대 코드로 들어가기), 이끄는 모임, 로그아웃, 계정 삭제
 */

import Storage from '../storage.js';
import { isLinked } from '../sync-meta.js';
import { escapeHtml, openSheet, openJoinSheet, findGroupByCode } from '../group-ui.js';

const PRIVACY_TEXT = `
  <p><b>개인정보 수집·이용 (필수)</b></p>
  <p>수집 항목: 이메일, 앱에서 쓰는 이름, 진행 기록(지금 몇 과 몇째 날인지, 마친 세션, 만날 시간)</p>
  <p>이용 목적: 계정 확인, 여러 기기에서 기록 이어 보기</p>
  <p>보관 기간: 탈퇴할 때까지. 계정을 삭제하면 바로 지워져요.</p>
  <p>동의하지 않으셔도 괜찮아요. 그러면 로그인 없이 이 기기에서만 쓸 수 있어요.</p>
  <p>기록은 Google Firebase 서버에 저장돼요.</p>`;

const SENSITIVE_TEXT = `
  <p><b>민감정보 처리 (필수, 따로 받는 동의)</b></p>
  <p>수집 항목: 한 마디 기도, 주기도로 적은 기도 같은 신앙에 관한 기록</p>
  <p>이용 목적: 본인이 여러 기기에서 이어 보기</p>
  <p>보이는 범위: 다른 성도나 모임 이끄미에게는 보이지 않아요.</p>
  <p>보관 기간: 탈퇴할 때까지. 계정을 삭제하면 바로 지워져요.</p>
  <p>동의하지 않으셔도 괜찮아요. 그러면 로그인 없이 이 기기에서만 쓸 수 있어요.</p>`;

export default function renderAccount({ navigateTo, param }) {
  const fromWelcome = param === 'start' || param === 'welcome';
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="acct">
      <button class="journey-back" id="acct-back">← ${fromWelcome ? '처음으로' : '설정'}</button>
      <h2 class="title-small acct-title">${fromWelcome ? '로그인하고 시작하기' : '계정과 모임'}</h2>
      <div id="acct-body"></div>
    </div>
  `;
  const body = screen.querySelector('#acct-body');
  screen.querySelector('#acct-back').addEventListener('click', () => {
    navigateTo(fromWelcome ? '#welcome' : '#settings');
  });

  let cloud = null;
  let unsubscribe = null;
  const loadCloud = async () => {
    if (!cloud) cloud = await import('../cloud.js');
    return cloud;
  };

  if (window.registerScreenCleanup) {
    window.registerScreenCleanup(() => { if (unsubscribe) unsubscribe(); });
  }

  // ------------------------------------------------------------
  // 로그인하지 않은 상태
  // ------------------------------------------------------------
  function renderSignedOut(mode = fromWelcome ? 'signup' : 'login') {
    const signup = mode === 'signup';
    body.innerHTML = `
      <p class="acct-intro">${fromWelcome
        ? '가입하면 이끄미로 모임을 이끌거나 따르미로 함께할 수 있고, 여러 기기에서 기록을 이어 볼 수 있어요. 다른 기기에서 쓰던 계정이 있으면 로그인을 눌러 주세요.'
        : '로그인하면 여러 기기에서 기록을 이어 보고, 모임 이끄미와 진행 상황을 나눌 수 있어요. 로그인하지 않아도 지금처럼 이 휴대폰에서 쓸 수 있어요.'}</p>

      <div class="acct-seg" role="tablist">
        <button class="acct-seg-opt ${signup ? '' : 'is-on'}" data-mode="login" role="tab">로그인</button>
        <button class="acct-seg-opt ${signup ? 'is-on' : ''}" data-mode="signup" role="tab">처음 가입</button>
      </div>

      <form class="acct-form" id="acct-form" novalidate>
        <label class="acct-label" for="acct-email">이메일</label>
        <input class="input-text" id="acct-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" />

        <label class="acct-label" for="acct-pw">비밀번호</label>
        <input class="input-text" id="acct-pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" />

        ${signup ? `
          <label class="acct-label" for="acct-pw2">비밀번호 확인</label>
          <input class="input-text" id="acct-pw2" type="password" autocomplete="new-password" />
          <p class="acct-hint">비밀번호는 6자 이상으로 정해 주세요.</p>

          <div class="acct-consent">
            <label class="acct-check"><input type="checkbox" id="c-privacy" /> <span>개인정보 수집·이용에 동의해요 (필수)</span></label>
            <details class="acct-details"><summary>내용 보기</summary>${PRIVACY_TEXT}</details>
            <label class="acct-check"><input type="checkbox" id="c-sensitive" /> <span>기도·묵상 기록 저장에 따로 동의해요 (필수)</span></label>
            <details class="acct-details"><summary>내용 보기</summary>${SENSITIVE_TEXT}</details>
          </div>
        ` : ''}

        <p class="acct-error" id="acct-error" role="alert"></p>
        <button class="btn acct-submit" type="submit" id="acct-submit">${signup ? '가입하고 기록 올리기' : '로그인'}</button>
        ${signup ? '' : '<button class="btn-secondary" type="button" id="acct-forgot">비밀번호를 잊었어요</button>'}
      </form>
    `;

    body.querySelectorAll('.acct-seg-opt').forEach(b => {
      b.addEventListener('click', () => renderSignedOut(b.dataset.mode));
    });

    const form = body.querySelector('#acct-form');
    const errEl = body.querySelector('#acct-error');
    const submit = body.querySelector('#acct-submit');
    const showError = (msg) => { errEl.textContent = msg; errEl.classList.toggle('is-ok', false); };
    const showOk = (msg) => { errEl.textContent = msg; errEl.classList.toggle('is-ok', true); };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = body.querySelector('#acct-email').value.trim();
      const pw = body.querySelector('#acct-pw').value;
      if (!email) return showError('이메일 주소를 적어 주세요.');
      if (!pw) return showError('비밀번호를 적어 주세요.');
      let consent = null;
      if (signup) {
        if (pw.length < 6) return showError('비밀번호는 6자 이상으로 정해 주세요.');
        if (pw !== body.querySelector('#acct-pw2').value) return showError('비밀번호 확인이 맞지 않아요.');
        consent = {
          privacy: body.querySelector('#c-privacy').checked,
          sensitive: body.querySelector('#c-sensitive').checked,
        };
        if (!consent.privacy || !consent.sensitive) return showError('두 가지 동의가 있어야 가입할 수 있어요.');
      }
      submit.disabled = true;
      submit.textContent = signup ? '가입하는 중…' : '로그인하는 중…';
      showError('');
      try {
        const c = await loadCloud();
        if (signup) await c.signUp(email, pw, consent);
        else await c.signIn(email, pw);
        afterSignIn();
      } catch (err) {
        const c = cloud;
        showError(c ? c.authMessage(err) : '인터넷 연결을 확인해 주세요.');
        submit.disabled = false;
        submit.textContent = signup ? '가입하고 기록 올리기' : '로그인';
      }
    });

    const forgot = body.querySelector('#acct-forgot');
    if (forgot) {
      forgot.addEventListener('click', async () => {
        const email = body.querySelector('#acct-email').value.trim();
        if (!email) return showError('위에 이메일을 먼저 적어 주세요.');
        forgot.disabled = true;
        try {
          const c = await loadCloud();
          await c.resetPassword(email);
          showOk('가입된 이메일이라면 비밀번호를 다시 정하는 메일을 보냈어요. 메일함을 확인해 주세요.');
        } catch (err) {
          showError(cloud ? cloud.authMessage(err) : '인터넷 연결을 확인해 주세요.');
        }
        forgot.disabled = false;
      });
    }
  }

  function afterSignIn() {
    if (fromWelcome || !Storage.isOnboardingDone()) {
      // 다른 기기의 진도가 내려왔으면 바로 오늘 화면으로,
      // 처음이면 이름 → 함께하기(이끄미/따르미/혼자) → 속도 … 순서로
      navigateTo(Storage.isOnboardingDone() ? '#home' : '#name');
      return;
    }
    renderSignedIn();
  }

  // ------------------------------------------------------------
  // 로그인한 상태
  // ------------------------------------------------------------
  async function renderSignedIn() {
    const c = await loadCloud();
    const state = c.getState();
    if (!state.user) { renderSignedOut('login'); return; }

    body.innerHTML = `
      <div class="acct-card">
        <p class="acct-card-label">로그인한 계정</p>
        <p class="acct-email">${escapeHtml(state.user.email || '')}</p>
        <div class="acct-sync-row">
          <p class="acct-sync" id="acct-sync"></p>
          <button class="btn-outline acct-sync-btn" id="acct-sync-now">지금 맞추기</button>
        </div>
      </div>

      <p class="settings-section-label">내 모임</p>
      <div id="acct-mygroup" class="acct-block"><p class="acct-muted">불러오는 중…</p></div>

      <p class="settings-section-label">이끄는 모임</p>
      <div id="acct-led" class="acct-block"><p class="acct-muted">불러오는 중…</p></div>

      <div class="settings-divider"></div>
      <button class="settings-danger-btn" id="acct-logout">로그아웃</button>
      <button class="btn-tertiary acct-delete" id="acct-delete">계정 삭제</button>
    `;

    const syncEl = body.querySelector('#acct-sync');
    const paintSync = (s) => {
      if (s.phase === 'syncing') syncEl.textContent = '맞추는 중…';
      else if (s.phase === 'offline') syncEl.textContent = '인터넷이 연결되면 저장할게요';
      else if (s.phase === 'error') syncEl.textContent = '저장하지 못했어요. 잠시 후 다시 해 볼게요.';
      else if (s.pending) syncEl.textContent = '곧 저장할게요';
      else if (s.lastSync) syncEl.textContent = '모든 기록이 저장되어 있어요 · ' + timeAgo(s.lastSync);
      else syncEl.textContent = '';
    };
    paintSync(state);
    if (unsubscribe) unsubscribe();
    let lastGroup = state.groupId;
    unsubscribe = c.subscribe((s) => {
      paintSync(s);
      if (!s.user) { renderSignedOut('login'); return; }
      if (s.groupId !== lastGroup) { lastGroup = s.groupId; paintMyGroup(); }
    });

    body.querySelector('#acct-sync-now').addEventListener('click', () => c.syncNow({ reason: 'manual' }));

    body.querySelector('#acct-logout').addEventListener('click', async () => {
      if (!confirm('로그아웃할까요?\n\n이 휴대폰의 기록은 그대로 남고, 계정에도 저장되어 있어요.')) return;
      try { await c.signOut(); } catch (e) { /* 무시 */ }
      renderSignedOut('login');
    });

    body.querySelector('#acct-delete').addEventListener('click', () => openDeleteSheet(c));

    paintMyGroup();
    paintLed();
    c.syncNow({ reason: 'account', throttle: 15000 });
  }

  async function paintMyGroup() {
    const box = body.querySelector('#acct-mygroup');
    if (!box) return;
    const c = await loadCloud();
    let g = null;
    try { g = await c.getMyGroup(); } catch (e) { g = null; }
    if (!body.contains(box)) return;
    if (g) {
      box.innerHTML = `
        <div class="acct-card acct-card-tight">
          <p class="acct-group-name">${escapeHtml(g.name)}</p>
          <p class="acct-muted">이끄미 ${escapeHtml(g.leaderName || '')}</p>
          <p class="acct-note">이끄미에게는 지금 몇 과 몇째 날인지와 최근 7일 동안 아침·낮·저녁을 했는지만 보여요. 기도와 묵상 내용은 보이지 않아요.</p>
          <button class="btn-tertiary acct-left" id="acct-leave">모임에서 나가기</button>
        </div>`;
      box.querySelector('#acct-leave').addEventListener('click', async () => {
        if (!confirm(`'${g.name}' 모임에서 나갈까요?\n\n이끄미에게 내 진행 상황이 더 이상 보이지 않아요.`)) return;
        try { await c.leaveGroup(); } catch (e) { alert(c.authMessage(e)); }
        paintMyGroup();
      });
    } else {
      box.innerHTML = `
        <p class="acct-muted acct-muted-gap">이끄미에게 받은 초대 코드가 있으면 넣어 주세요.</p>
        <div class="acct-code-row">
          <input class="input-text acct-code-input" id="acct-code" maxlength="7" placeholder="초대 코드 6자리" autocapitalize="characters" autocomplete="off" spellcheck="false" />
          <button class="btn acct-code-btn" id="acct-join">들어가기</button>
        </div>
        <p class="acct-error" id="acct-join-err" role="alert"></p>`;
      const err = box.querySelector('#acct-join-err');
      box.querySelector('#acct-join').addEventListener('click', async () => {
        err.textContent = '';
        const found = await findGroupByCode(c, box.querySelector('#acct-code').value);
        if (found.error) { err.textContent = found.error; return; }
        if (await openJoinSheet(screen, c, found.info)) paintMyGroup();
      });
    }
  }

  async function paintLed() {
    const box = body.querySelector('#acct-led');
    if (!box) return;
    const c = await loadCloud();
    let groups = [];
    try { groups = await c.getLedGroups(); } catch (e) { groups = []; }
    if (!body.contains(box)) return;
    box.innerHTML = `
      ${groups.map(g => `
        <button class="acct-led-card" data-gid="${escapeAttr(g.gid)}">
          <span class="acct-led-main">
            <span class="acct-group-name">${escapeHtml(g.name)}</span>
            <span class="acct-muted">초대 코드 ${escapeHtml(g.code)}</span>
          </span>
          <span class="acct-led-go" aria-hidden="true">›</span>
        </button>`).join('')}
      <div id="acct-new-wrap">
        <button class="btn-outline acct-new-btn" id="acct-new">새 모임 만들기</button>
      </div>
      ${groups.length ? '' : '<p class="acct-muted acct-muted-gap">이끄미로 섬기신다면 모임을 만들어 초대 코드를 나눠 주세요. 따르미들의 진행 상황을 볼 수 있어요.</p>'}
    `;
    box.querySelectorAll('.acct-led-card').forEach(b => {
      b.addEventListener('click', () => navigateTo('#group/' + b.dataset.gid));
    });
    box.querySelector('#acct-new').addEventListener('click', () => {
      const wrap = box.querySelector('#acct-new-wrap');
      wrap.innerHTML = `
        <div class="acct-code-row">
          <input class="input-text" id="acct-new-name" maxlength="30" placeholder="모임 이름 (예: 화요 소그룹)" />
          <button class="btn acct-code-btn" id="acct-new-ok">만들기</button>
        </div>
        <p class="acct-error" id="acct-new-err" role="alert"></p>`;
      const input = wrap.querySelector('#acct-new-name');
      input.focus();
      wrap.querySelector('#acct-new-ok').addEventListener('click', async () => {
        const name = input.value.trim();
        const err = wrap.querySelector('#acct-new-err');
        if (!name) { err.textContent = '모임 이름을 적어 주세요.'; return; }
        if (!Storage.getUserName()) { err.textContent = '설정에서 이름을 먼저 정해 주세요. 따르미들에게 이끄미 이름으로 보여요.'; return; }
        try {
          const g = await c.createGroup(name);
          navigateTo('#group/' + g.gid);
        } catch (e) {
          err.textContent = c.authMessage(e);
        }
      });
    });
  }

  function openDeleteSheet(c) {
    const sheet = openSheet(screen, `
      <p class="acct-sheet-title">계정을 삭제할까요?</p>
      <p class="acct-sheet-text">서버에 저장된 기록과 모임 정보가 모두 지워지고 되돌릴 수 없어요. 내가 이끄는 모임도 함께 없어져요. 이 휴대폰에 있는 기록은 그대로 남아요.</p>
      <label class="acct-label" for="del-pw">확인을 위해 비밀번호를 적어 주세요</label>
      <input class="input-text" id="del-pw" type="password" autocomplete="current-password" />
      <p class="acct-error" id="sheet-err" role="alert"></p>
      <button class="btn acct-danger-solid" id="sheet-ok">계정 삭제</button>
      <button class="btn-secondary" id="sheet-cancel">취소</button>
    `);
    sheet.querySelector('#sheet-cancel').addEventListener('click', () => sheet.remove());
    sheet.querySelector('#sheet-ok').addEventListener('click', async () => {
      const err = sheet.querySelector('#sheet-err');
      const pw = sheet.querySelector('#del-pw').value;
      if (!pw) { err.textContent = '비밀번호를 적어 주세요.'; return; }
      const btn = sheet.querySelector('#sheet-ok');
      btn.disabled = true; btn.textContent = '삭제하는 중…';
      try {
        await c.deleteAccount(pw);
        sheet.remove();
        renderSignedOut('login');
        alert('계정을 삭제했어요. 이 휴대폰의 기록은 그대로 남아 있어요.');
      } catch (e) {
        err.textContent = c.authMessage(e);
        btn.disabled = false; btn.textContent = '계정 삭제';
      }
    });
  }

  // ------------------------------------------------------------
  // 처음 그리기
  // ------------------------------------------------------------
  if (isLinked()) {
    body.innerHTML = '<p class="acct-muted">계정을 확인하는 중…</p>';
    loadCloud()
      .then(c => c.start())
      .then(() => renderSignedIn())
      .catch(() => {
        body.innerHTML = '<p class="acct-muted">인터넷에 연결되면 계정 정보를 보여 드릴게요. 기록은 이 휴대폰에 안전하게 있어요.</p>';
      });
  } else {
    renderSignedOut();   // 첫 화면에서 왔으면 가입 탭, 설정에서 왔으면 로그인 탭
  }

  return screen;
}

function timeAgo(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const escapeAttr = escapeHtml;
