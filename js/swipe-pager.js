/**
 * 좌우 스와이프 페이저
 *
 * 화면 어디서든 자연스럽게 좌우 스와이프되는 짜임.
 * placeholder를 옆에 깔아 두 화면이 함께 움직이는 듯한 짜임.
 *
 * 핵심:
 * - 화면 어느 부분에서든 손을 대고 가로로 밀면 동작
 * - 세로 스크롤과 충돌하지 않게 가로 움직임 인식
 * - 일단 스와이프 시작되면 세로 움직임은 무시 (손이 호를 그려도 자연스럽게)
 * - textarea/input 안에서는 동작 안 함 (텍스트 선택 보존)
 * - 스와이프 인식되면 click 이벤트 막아 카드 동작 방해 안 함
 *
 * 사용:
 *   setupSwipePager(screen, {
 *     leftBg, rightBg,           // placeholder 색
 *     leftLabel, rightLabel,     // placeholder 가운데 라벨
 *     onCommitLeft, onCommitRight,  // 마무리 콜백 (null이면 그 방향 스와이프 안 함)
 *   });
 */

const COMMIT_THRESHOLD_RATIO = 0.28;
const HORIZONTAL_INIT = 8;             // 가로 8px만 넘으면 스와이프 후보 (이전 14px → 8px로 너그럽게)
const VERTICAL_CANCEL = 16;            // 가로 후보 들어가기 전 세로가 너무 크면 스크롤로 인식
const COMMIT_DURATION = 260;
const SNAPBACK_DURATION = 220;
const EDGE_GUARD = 24;                 // 화면 가장자리 24px에서 시작한 터치는 시스템에 양보 (iOS 뒤로가기 충돌 방지)

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
  let isDragging = false;        // 가로 스와이프 모드에 들어갔는지
  let direction = null;
  let placeholder = null;
  let isCommitting = false;
  let suppressClick = false;     // 스와이프 후 click 한 번 막기
  let scrollDecided = false;     // 세로 스크롤로 결정됐는지 (이번 터치 동안 가로 스와이프 안 함)

  function isInteractiveTarget(el) {
    if (!el) return false;
    // textarea, input, select 안에서 시작한 터치는 스와이프에서 제외
    return el.matches('textarea, input, select') || el.closest('textarea, input, select');
  }

  function onTouchStart(e) {
    if (isCommitting) return;
    if (e.touches.length !== 1) return;

    // textarea/input 안이면 스와이프 추적 안 함
    if (isInteractiveTarget(e.target)) {
      isTracking = false;
      return;
    }

    const startX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;

    // 화면 가장자리에서 시작한 터치는 시스템 뒤로가기 동작과 충돌하므로 양보
    // iOS PWA·Safari에서 가장자리 가로 스와이프는 시스템이 잡고 있음
    if (startX < EDGE_GUARD || startX > screenWidth - EDGE_GUARD) {
      isTracking = false;
      return;
    }

    touchStartX = startX;
    touchStartY = e.touches[0].clientY;
    isTracking = true;
    isDragging = false;
    direction = null;
    scrollDecided = false;
  }

  function onTouchMove(e) {
    if (!isTracking || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // 아직 dragging 모드 아닐 때만 세로 움직임 체크
    // 한 번 dragging 모드에 들어가면 세로 움직임은 무시 (손이 호를 그려도 자연스럽게)
    if (!isDragging && !scrollDecided) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // 세로가 명확히 더 클 때 — 스크롤로 결정
      if (absDy > VERTICAL_CANCEL && absDy > absDx) {
        scrollDecided = true;
        return;
      }

      // 가로가 임계값 넘고 세로보다 클 때 — 스와이프 시작
      if (absDx > HORIZONTAL_INIT && absDx > absDy) {
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

        startDragging();
      }
    }

    if (isDragging && placeholder) {
      // 두 화면 함께 이동 (가로만)
      screen.style.transform = `translateX(${dx}px)`;
      const baseOffset = direction === 'right' ? -window.innerWidth : window.innerWidth;
      placeholder.style.transform = `translateX(${baseOffset + dx}px)`;
    }
  }

  function startDragging() {
    isDragging = true;

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

    placeholder.style.transform = direction === 'right'
      ? 'translateX(-100%)'
      : 'translateX(100%)';

    document.body.appendChild(placeholder);

    screen.style.transition = 'none';
    screen.style.willChange = 'transform';
  }

  function onTouchEnd(e) {
    if (!isTracking) return;
    isTracking = false;

    if (!isDragging) return;
    isDragging = false;

    // 스와이프 후 click 한 번 막기 (카드 click이 함께 발동되는 것 방지)
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 350);

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

  // 스와이프 직후 발생할 click을 한 번 막음
  function onClickCapture(e) {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick = false;
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
      screen.style.willChange = '';
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
      if (currentDx < 0) {
        if (onCommitRight) onCommitRight();
      } else {
        if (onCommitLeft) onCommitLeft();
      }
    }, COMMIT_DURATION);
  }

  screen.addEventListener('touchstart', onTouchStart, { passive: true });
  screen.addEventListener('touchmove', onTouchMove, { passive: true });
  screen.addEventListener('touchend', onTouchEnd, { passive: true });
  screen.addEventListener('touchcancel', onTouchCancel, { passive: true });

  // capture 단계에서 click을 한 번 막아 카드 click이 함께 발동되는 것 방지
  // body 레벨에서 capture — 어떤 요소의 click이든 가로챌 수 있음
  document.addEventListener('click', onClickCapture, true);

  // hashchange 시 정리
  const cleanup = () => {
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;
    isCommitting = false;
    document.removeEventListener('click', onClickCapture, true);
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);
}
