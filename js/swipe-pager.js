/**
 * 좌우 스와이프 페이저 (단순화된 결)
 *
 * 두 화면이 동시에 슬라이드되는 결을 만들되,
 * 옆 화면을 진짜로 그리지 않고 placeholder로 처리해서 안정적이고 가벼움.
 *
 * 동작:
 * 1. 손가락 가로 움직임이 임계값 넘으면 페이저 시작
 * 2. placeholder(단색 배경 + 옵션의 작은 메시지)를 옆에 깔아 두고
 *    본 화면과 함께 손가락 따라 움직임
 * 3. 떼면 35% 이상이면 끝까지 슬라이드 + navigateTo
 *    35% 미만이면 부드럽게 원위치
 *
 * 사용:
 *   setupSwipePager(screen, {
 *     leftBg: '#EFE4D2',          // 왼편 placeholder 배경 (옆에 보일 색)
 *     rightBg: '#F2EBDD',         // 오른편 placeholder 배경
 *     leftLabel: '여정',          // 왼편 placeholder 가운데에 보일 작은 라벨 (옵션)
 *     rightLabel: '다음 날',
 *     onCommitLeft: () => navigateTo('#journey'),    // 왼편으로 마무리
 *     onCommitRight: () => navigateTo('#home/...'),  // 오른편으로 마무리
 *   });
 *
 * onCommitLeft 또는 onCommitRight가 null이면 그 방향 스와이프 안 함.
 */

const COMMIT_THRESHOLD_RATIO = 0.30;   // 화면 너비 30% 이상 가야 마무리
const VERTICAL_TOLERANCE = 60;         // 세로 60px 넘으면 스크롤로 인식
const HORIZONTAL_INIT = 14;            // 가로 14px 이상 가야 스와이프 시작
const COMMIT_DURATION = 260;
const SNAPBACK_DURATION = 220;

export function setupSwipePager(screen, options) {
  const {
    leftBg = '#EFE4D2',
    rightBg = '#F2EBDD',
    leftLabel = null,
    rightLabel = null,
    onCommitLeft = null,
    onCommitRight = null,
  } = options;

  let touchStartX = 0;
  let touchStartY = 0;
  let isTracking = false;
  let isDragging = false;
  let direction = null;          // 'left' | 'right' (손가락 진행 방향)
  let placeholder = null;
  let isCommitting = false;      // 마무리 중 (다른 스와이프 차단)

  function onTouchStart(e) {
    if (isCommitting) return;
    if (e.touches.length !== 1) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isTracking = true;
    isDragging = false;
    direction = null;
  }

  function onTouchMove(e) {
    if (!isTracking || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // 세로 움직임이 크면 스크롤 — 스와이프 취소
    if (!isDragging && Math.abs(dy) > VERTICAL_TOLERANCE) {
      isTracking = false;
      return;
    }

    // 스와이프 시작 결
    if (!isDragging && Math.abs(dx) > HORIZONTAL_INIT && Math.abs(dx) > Math.abs(dy) * 1.2) {
      direction = dx < 0 ? 'left' : 'right';

      // 그 방향에 마무리 콜백 없으면 스와이프 안 함
      if (direction === 'left' && !onCommitRight) {
        isTracking = false;
        return;
      }
      if (direction === 'right' && !onCommitLeft) {
        isTracking = false;
        return;
      }

      isDragging = true;

      // placeholder 만들기
      placeholder = document.createElement('div');
      placeholder.className = 'swipe-placeholder';
      placeholder.style.background = direction === 'right' ? leftBg : rightBg;

      const label = direction === 'right' ? leftLabel : rightLabel;
      if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'swipe-placeholder-label';
        labelEl.textContent = label;
        placeholder.appendChild(labelEl);
      }

      // 시작 위치 — 화면 너비만큼 옆에 (왼쪽 또는 오른쪽 밖)
      placeholder.style.transform = direction === 'right'
        ? 'translateX(-100%)'
        : 'translateX(100%)';

      document.body.appendChild(placeholder);

      // 본 화면 transition 끄기
      screen.style.transition = 'none';
    }

    if (isDragging && placeholder) {
      // 두 화면 동시 이동
      screen.style.transform = `translateX(${dx}px)`;
      const baseOffset = direction === 'right' ? -window.innerWidth : window.innerWidth;
      placeholder.style.transform = `translateX(${baseOffset + dx}px)`;
    }
  }

  function onTouchEnd(e) {
    if (!isTracking) return;
    isTracking = false;

    if (!isDragging) return;
    isDragging = false;

    const touch = (e.changedTouches && e.changedTouches[0]) || null;
    if (!touch) {
      snapBack();
      return;
    }

    const dx = touch.clientX - touchStartX;
    const threshold = window.innerWidth * COMMIT_THRESHOLD_RATIO;
    const shouldCommit = Math.abs(dx) >= threshold;

    if (shouldCommit) {
      commit(dx);
    } else {
      snapBack();
    }
  }

  function onTouchCancel() {
    if (!isTracking) return;
    isTracking = false;
    if (isDragging) {
      isDragging = false;
      snapBack();
    }
  }

  function snapBack() {
    const easing = 'cubic-bezier(0.2, 0.9, 0.4, 1)';
    screen.style.transition = `transform ${SNAPBACK_DURATION}ms ${easing}`;
    screen.style.transform = 'translateX(0)';

    if (placeholder) {
      const offset = direction === 'right' ? -window.innerWidth : window.innerWidth;
      placeholder.style.transition = `transform ${SNAPBACK_DURATION}ms ${easing}`;
      placeholder.style.transform = `translateX(${offset}px)`;

      const ph = placeholder;
      placeholder = null;
      setTimeout(() => {
        if (ph.parentNode) ph.parentNode.removeChild(ph);
      }, SNAPBACK_DURATION + 30);
    }

    setTimeout(() => {
      screen.style.transition = '';
      screen.style.transform = '';
    }, SNAPBACK_DURATION + 30);
  }

  function commit(currentDx) {
    isCommitting = true;
    const distance = window.innerWidth;
    const targetX = currentDx < 0 ? -distance : distance;
    const easing = 'cubic-bezier(0.2, 0.7, 0.3, 1)';

    screen.style.transition = `transform ${COMMIT_DURATION}ms ${easing}`;
    screen.style.transform = `translateX(${targetX}px)`;

    if (placeholder) {
      placeholder.style.transition = `transform ${COMMIT_DURATION}ms ${easing}`;
      placeholder.style.transform = 'translateX(0)';
    }

    setTimeout(() => {
      // navigateTo는 라우터가 알아서 새 화면 그림
      // placeholder는 hashchange cleanup에서 정리
      if (currentDx < 0) {
        if (onCommitRight) onCommitRight();
      } else {
        if (onCommitLeft) onCommitLeft();
      }
      // isCommitting은 hashchange cleanup에서 자연 정리됨
    }, COMMIT_DURATION);
  }

  screen.addEventListener('touchstart', onTouchStart, { passive: true });
  screen.addEventListener('touchmove', onTouchMove, { passive: true });
  screen.addEventListener('touchend', onTouchEnd, { passive: true });
  screen.addEventListener('touchcancel', onTouchCancel, { passive: true });

  // hashchange 시 placeholder 정리
  const cleanup = () => {
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;
    isCommitting = false;
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);
}
