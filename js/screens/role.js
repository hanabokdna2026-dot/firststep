/**
 * 처음 시작 — 함께하기
 *
 * URL: #role  (로그인하고 시작한 사람만: 이름 다음, 속도 앞)
 *
 * - 따르미로: 이끄미에게 받은 초대 코드로 들어감 (공유 동의)
 * - 이끄미로: 모임을 만들고 초대 코드를 나눔 (이끄미도 매일의 자리를 함께 걸음)
 * - 혼자: 모임 없이 시작 (나중에 설정에서 언제든)
 */

import Storage from '../storage.js';
import { isLinked } from '../sync-meta.js';
import { escapeHtml, openJoinSheet, findGroupByCode, shareInvite, shareLabel } from '../group-ui.js';

const ROLES = [
  { id: 'member', title: '따르미로', desc: '이끄미에게 받은 초대 코드로 모임에 들어가요.' },
  { id: 'leader', title: '이끄미로', desc: '모임을 만들고 초대 코드를 나눠요. 따르미들의 진행 상황을 볼 수 있고, 매일의 자리는 함께 걸어요.' },
  { id: 'solo', title: '혼자 걸어요', desc: '모임 없이 시작해요. 나중에 설정에서 언제든 들어갈 수 있어요.' },
];

export default function renderRole({ navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'screen';

  // 로그인하지 않았으면 이 단계는 건너뜀
  if (!isLinked()) {
    setTimeout(() => navigateTo('#pace'), 0);
    return screen;
  }

  screen.innerHTML = `
    <div class="screen-inner">
      <p class="eyebrow">함께하기</p>
      <h2 class="title">어떻게<br/>함께할까요</h2>
      <p class="body" style="margin-bottom: 24px;">나중에 설정에서 언제든 바꿀 수 있어요.</p>

      <div id="role-options">
        ${ROLES.map(r => `
          <button class="option-card" data-role="${r.id}" type="button">
            <div class="option-card-header"><span class="option-card-title">${r.title}</span></div>
            <p class="option-card-desc">${r.desc}</p>
          </button>`).join('')}
      </div>

      <div id="role-panel" class="role-panel"></div>

      <button class="btn" id="btn-next" disabled>다음</button>
    </div>
  `;

  const panel = screen.querySelector('#role-panel');
  const next = screen.querySelector('#btn-next');
  let cloud = null;
  const loadCloud = async () => (cloud = cloud || await import('../cloud.js'));
  let ready = false;     // 고른 방식대로 준비가 끝났는지
  const setReady = (v) => { ready = v; next.disabled = !v; };

  screen.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      screen.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      showPanel(card.dataset.role);
    });
  });

  function showPanel(role) {
    setReady(false);
    if (role === 'solo') {
      panel.innerHTML = '';
      setReady(true);
      return;
    }
    if (role === 'member') {
      panel.innerHTML = `
        <div class="acct-code-row">
          <input class="input-text acct-code-input" id="role-code" maxlength="7" placeholder="초대 코드 6자리" autocapitalize="characters" autocomplete="off" spellcheck="false" />
          <button class="btn acct-code-btn" id="role-join">들어가기</button>
        </div>
        <p class="acct-error" id="role-err" role="alert"></p>`;
      const err = panel.querySelector('#role-err');
      panel.querySelector('#role-join').addEventListener('click', async () => {
        err.textContent = '';
        let c;
        try { c = await loadCloud(); } catch (e) { err.textContent = '인터넷 연결을 확인해 주세요.'; return; }
        const found = await findGroupByCode(c, panel.querySelector('#role-code').value);
        if (found.error) { err.textContent = found.error; return; }
        if (await openJoinSheet(screen, c, found.info)) {
          panel.innerHTML = `
            <div class="acct-card role-done">
              <p class="acct-group-name">${escapeHtml(found.info.name)}</p>
              <p class="acct-muted">이끄미 ${escapeHtml(found.info.leaderName || '')}님의 모임에 들어갔어요.</p>
            </div>`;
          setReady(true);
        }
      });
      return;
    }
    if (role === 'leader') {
      const needName = !Storage.getUserName();
      panel.innerHTML = `
        ${needName ? `
          <label class="acct-label" for="role-myname">따르미들에게 보일 내 이름</label>
          <input class="input-text role-gap" id="role-myname" maxlength="20" placeholder="이름이나 호칭" />` : ''}
        <label class="acct-label" for="role-gname">모임 이름</label>
        <div class="acct-code-row">
          <input class="input-text" id="role-gname" maxlength="30" placeholder="예: 화요 소그룹" />
          <button class="btn acct-code-btn" id="role-make">만들기</button>
        </div>
        <p class="acct-error" id="role-err" role="alert"></p>`;
      const err = panel.querySelector('#role-err');
      panel.querySelector('#role-make').addEventListener('click', async () => {
        err.textContent = '';
        if (needName) {
          const myName = panel.querySelector('#role-myname').value.trim();
          if (!myName) { err.textContent = '따르미들에게 보일 이름을 적어 주세요.'; return; }
          Storage.setUserName(myName);
        }
        const name = panel.querySelector('#role-gname').value.trim();
        if (!name) { err.textContent = '모임 이름을 적어 주세요.'; return; }
        const btn = panel.querySelector('#role-make');
        btn.disabled = true;
        try {
          const c = await loadCloud();
          const g = await c.createGroup(name);
          panel.innerHTML = `
            <div class="grp-code-card role-done">
              <div>
                <p class="acct-card-label">${escapeHtml(g.name)} 초대 코드</p>
                <p class="grp-code">${escapeHtml(g.code)}</p>
              </div>
              <button class="btn-outline" id="role-share">${shareLabel()}</button>
            </div>
            <p class="acct-note">이 코드를 따르미들에게 보내 주세요. 따르미들의 진행 상황은 아래 '모임' 탭에서 볼 수 있어요.</p>`;
          panel.querySelector('#role-share').addEventListener('click', () =>
            shareInvite(g, () => toast('초대 글을 복사했어요')));
          setReady(true);
        } catch (e) {
          err.textContent = cloud ? cloud.authMessage(e) : '인터넷 연결을 확인해 주세요.';
          btn.disabled = false;
        }
      });
    }
  }

  next.addEventListener('click', () => {
    if (ready) navigateTo('#pace');
  });

  function toast(message) {
    const t = document.createElement('div');
    t.className = 'settings-toast';
    t.textContent = message;
    screen.appendChild(t);
    setTimeout(() => t.classList.add('settings-toast-visible'), 10);
    setTimeout(() => t.remove(), 2200);
  }

  return screen;
}
