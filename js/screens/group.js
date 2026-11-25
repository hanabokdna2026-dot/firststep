/**
 * 모임 진행 상황 (이끄미 화면)
 *
 * URL: #group            (아래 '모임' 탭 — 이끄는 모임이 하나면 바로, 여럿이면 고르기)
 *      #group/{모임 ID}
 *
 * 보이는 것: 이름, 지금 몇 과 몇째 날, 최근 7일 아침·낮·저녁, 마지막으로 앱을 연 날
 * 보이지 않는 것: 기도와 묵상 내용 (서버 규칙으로도 막혀 있음)
 */

import { getTodayISO } from '../time.js';
import { getLedCache } from '../sync-meta.js';
import { tabbarHtml, bindTabbar } from '../tabbar.js';
import { escapeHtml, shareInvite, shareLabel } from '../group-ui.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(iso) {
  return WEEKDAYS[new Date(iso + 'T00:00:00Z').getUTCDay()];
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

export default function renderGroup({ navigateTo, param }) {
  let gid = param || null;
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="screen-inner-with-tabs">
      <div id="grp-switch"></div>
      <div id="grp-body"><p class="acct-muted">불러오는 중…</p></div>
    </div>
    ${tabbarHtml('group')}
  `;
  bindTabbar(screen, navigateTo, 'group');
  const body = screen.querySelector('#grp-body');

  // 이끄는 모임이 여럿이면 위에서 고름 (이 기기에 기억해 둔 목록)
  function paintSwitch() {
    const led = getLedCache();
    if (!gid && led.length) gid = led[0].gid;
    const box = screen.querySelector('#grp-switch');
    box.innerHTML = led.length > 1 ? `
      <div class="grp-switch">
        ${led.map(g => `<button class="grp-switch-opt ${g.gid === gid ? 'is-on' : ''}" data-gid="${escapeHtml(g.gid)}">${escapeHtml(g.name)}</button>`).join('')}
      </div>` : '';
    box.querySelectorAll('.grp-switch-opt').forEach(b => b.addEventListener('click', () => navigateTo('#group/' + b.dataset.gid)));
  }
  paintSwitch();

  (async () => {
    let c;
    try {
      c = await import('../cloud.js');
      const user = await c.getUser();
      if (!user) { navigateTo('#account'); return; }
    } catch (e) {
      body.innerHTML = '<p class="acct-muted">인터넷에 연결되면 모임 정보를 보여 드릴게요.</p>';
      return;
    }
    if (!gid) {
      // 기억해 둔 목록이 없으면 서버에서 확인
      try { await c.getLedGroups(); } catch (e) { /* 아래 안내 */ }
      paintSwitch();
    }
    if (!gid) {
      body.innerHTML = `
        <h2 class="title-small grp-title">모임</h2>
        <p class="acct-muted">이끄는 모임이 없어요. 설정 → 계정과 모임에서 모임을 만들 수 있어요.</p>`;
      return;
    }
    await paint(c);
  })();

  async function paint(c) {
    let g;
    try { g = await c.getGroupProgress(gid); } catch (e) {
      body.innerHTML = `<p class="acct-muted">모임 정보를 불러오지 못했어요. ${escapeHtml(c.authMessage(e))}</p>`;
      return;
    }
    if (!g) { body.innerHTML = '<p class="acct-muted">없어진 모임이에요.</p>'; return; }

    const today = getTodayISO();
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
    const members = g.members.slice().sort((a, b) =>
      String(b.lastActive || '').localeCompare(String(a.lastActive || '')) || String(a.name).localeCompare(String(b.name)));

    body.innerHTML = `
      <h2 class="title-small grp-title">${escapeHtml(g.name)}</h2>
      <div class="grp-code-card">
        <div>
          <p class="acct-card-label">초대 코드</p>
          <p class="grp-code">${escapeHtml(g.code)}</p>
        </div>
        <button class="btn-outline" id="grp-share">${shareLabel()}</button>
      </div>
      <p class="acct-note grp-note">따르미들의 진행 상황만 보여요. 기도와 묵상 내용은 보이지 않아요.</p>

      <div class="grp-legend">
        <span><i class="grp-dot is-m"></i>아침</span>
        <span><i class="grp-dot is-d"></i>낮</span>
        <span><i class="grp-dot is-e"></i>저녁</span>
        <span class="grp-legend-range">최근 7일</span>
      </div>

      ${members.length ? `
        <ul class="grp-list">
          ${members.map(m => memberRow(m, days, today)).join('')}
        </ul>` : `
        <p class="acct-muted grp-empty">아직 들어온 따르미가 없어요. 초대 코드를 나눠 주세요.<br/>따르미는 처음 시작할 때 '따르미로'를 고르거나, 설정 → 계정과 모임에서 코드를 넣으면 돼요.</p>`}

      <div class="settings-divider"></div>
      <button class="btn-tertiary" id="grp-delete">이 모임 없애기</button>
    `;

    body.querySelector('#grp-share').addEventListener('click', () =>
      shareInvite(g, () => toast('초대 글을 복사했어요')));

    body.querySelectorAll('.grp-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        if (!confirm(`${name}님을 모임에서 내보낼까요?\n\n그분의 진행 상황이 더 이상 보이지 않아요. 그분의 기록은 지워지지 않아요.`)) return;
        try { await c.removeMember(gid, btn.dataset.uid); } catch (e) { alert(c.authMessage(e)); }
        paint(c);
      });
    });

    body.querySelector('#grp-delete').addEventListener('click', async () => {
      if (!confirm(`'${g.name}' 모임을 없앨까요?\n\n초대 코드도 함께 없어지고, 따르미들의 기록은 지워지지 않아요.`)) return;
      try {
        await c.deleteGroup(gid);
        navigateTo(getLedCache().length ? '#group' : '#account');
      } catch (e) { alert(c.authMessage(e)); }
    });
  }

  function memberRow(m, days, today) {
    const ago = m.lastActive ? daysBetween(m.lastActive, today) : null;
    const agoText = ago === null ? '' : ago <= 0 ? '오늘' : ago === 1 ? '어제' : `${ago}일 전`;
    const week = m.week || {};
    return `
      <li class="grp-item">
        <div class="grp-item-top">
          <span class="grp-name">${escapeHtml(m.name || '이름 없음')}</span>
          <span class="grp-ago ${ago !== null && ago >= 3 ? 'is-quiet' : ''}">${agoText}</span>
        </div>
        <p class="grp-place">${escapeHtml(m.place || '')}</p>
        <div class="grp-week" aria-label="최근 7일">
          ${days.map(d => {
            const s = week[d] || '';
            return `<span class="grp-day ${d === today ? 'is-today' : ''}">
              <span class="grp-dots">
                <i class="grp-dot is-m ${s.includes('m') ? 'is-on' : ''}"></i>
                <i class="grp-dot is-d ${s.includes('d') ? 'is-on' : ''}"></i>
                <i class="grp-dot is-e ${s.includes('e') ? 'is-on' : ''}"></i>
              </span>
              <span class="grp-wd">${weekdayOf(d)}</span>
            </span>`;
          }).join('')}
        </div>
        <button class="grp-remove" data-uid="${escapeHtml(m.uid)}" data-name="${escapeHtml(m.name || '')}">내보내기</button>
      </li>`;
  }

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
