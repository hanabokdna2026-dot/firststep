/**
 * 모임 관련 화면 조각 — 계정 화면, 처음 시작(함께하기) 화면, 이끄미 화면이 함께 씀
 */

export function escapeHtml(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 아래에서 올라오는 확인 창
export function openSheet(container, html) {
  const sheet = document.createElement('div');
  sheet.className = 'acct-sheet';
  sheet.innerHTML = `<div class="acct-sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
  container.appendChild(sheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
  return sheet;
}

/**
 * 모임에 들어가기 전 — 이끄미에게 무엇이 보이는지 알리고 동의를 받음
 * @returns {Promise<boolean>} 들어갔으면 true, 취소하면 false
 */
export function openJoinSheet(container, cloud, info) {
  return new Promise((resolve) => {
    const sheet = openSheet(container, `
      <p class="acct-sheet-title">'${escapeHtml(info.name)}' 모임에 들어갈까요?</p>
      <p class="acct-sheet-text">이끄미 ${escapeHtml(info.leaderName || '')}님에게는 이것만 보여요.</p>
      <ul class="acct-sheet-list">
        <li>내 이름</li>
        <li>지금 몇 과 몇째 날인지</li>
        <li>최근 7일 동안 아침·낮·저녁을 했는지</li>
        <li>마지막으로 앱을 연 날</li>
      </ul>
      <p class="acct-sheet-text">기도와 묵상 내용은 보이지 않아요. 모임에서 나가면 바로 보이지 않게 돼요.</p>
      <label class="acct-check"><input type="checkbox" id="c-share" /> <span>위 내용을 이끄미와 나누는 데 동의해요</span></label>
      <p class="acct-error" id="sheet-err" role="alert"></p>
      <button class="btn" id="sheet-ok">동의하고 들어가기</button>
      <button class="btn-secondary" id="sheet-cancel">취소</button>
    `);
    const done = (v) => { sheet.remove(); resolve(v); };
    sheet.addEventListener('click', (e) => { if (e.target === sheet) resolve(false); });
    sheet.querySelector('#sheet-cancel').addEventListener('click', () => done(false));
    sheet.querySelector('#sheet-ok').addEventListener('click', async () => {
      const err = sheet.querySelector('#sheet-err');
      if (!sheet.querySelector('#c-share').checked) { err.textContent = '동의해 주셔야 들어갈 수 있어요.'; return; }
      const btn = sheet.querySelector('#sheet-ok');
      btn.disabled = true;
      try {
        await cloud.joinGroup(info.code, true);
        done(true);
      } catch (e) {
        err.textContent = cloud.authMessage(e);
        btn.disabled = false;
      }
    });
  });
}

/** 초대 코드로 모임 찾기 — 안내 문구까지 */
export async function findGroupByCode(cloud, raw) {
  const code = cloud.normalizeCode(raw);
  if (code.length !== 6) return { error: '초대 코드 6자리를 확인해 주세요.' };
  try {
    return { info: await cloud.lookupGroup(code) };
  } catch (e) {
    const missing = e && (e.code === 'app/no-group' || e.code === 'app/bad-code');
    return { error: missing ? '이 코드로 된 모임이 없어요. 다시 확인해 주세요.' : cloud.authMessage(e) };
  }
}

/** 초대 코드 나누기 — 휴대폰이면 공유 창(카톡 등), 아니면 복사 */
export async function shareInvite(group, onCopied) {
  const text = `풍성한 첫걸음 '${group.name}' 모임 초대 코드: ${group.code}\n`
    + `앱을 열고 '로그인하고 시작하기'로 가입한 뒤 '따르미로'를 골라 코드를 넣어 주세요.\n`
    + `이미 쓰고 있다면 설정 → 계정과 모임에서 넣으면 돼요.\n`
    + `https://hanabokdna2026-dot.github.io/firststep/`;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch (e) { /* 취소 */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (onCopied) onCopied();
  } catch (e) {
    prompt('초대 코드', group.code);
  }
}

export function shareLabel() {
  return navigator.share ? '코드 보내기' : '코드 복사';
}
