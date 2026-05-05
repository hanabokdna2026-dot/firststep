/**
 * 좌우 스와이프 페이저
 *
 * 두 화면이 동시에 슬라이드되는 결을 만듦.
 * iOS 사진 앨범처럼 손가락 따라 옆 화면이 같이 보이고,
 * 떼면 거리에 따라 마무리하거나 원위치.
 *
 * 사용:
 *   setupSwipePager(screen, {
 *     onLeft: async () => { ... renderLeft() ... },     // 오른쪽 스와이프 시 들어올 화면 (왼편)
 *     onRight: async () => { ... renderRight() ... },   // 왼쪽 스와이프 시 들어올 화면 (오른편)
 *     onCommitLeft: () => navigateTo('#journey'),      // 왼편 화면으로 이동 확정
 *     onCommitRight: () => navigateTo('#home/...'),    // 오른편 화면으로 이동 확정
 *   });
 *
 * onLeft, onRight는 그 화면 DOM 요소를 반환하는 async 함수.
 * 미리 호출되어 fetch가 끝나면 캐시되어 빠르게 슬라이드됨.
 */

const COMMIT_THRESHOLD_RATIO = 0.35;  // 화면 너비 35% 이상 가야 마무리
const VERTICAL_TOLERANCE = 60;        // 세로 60px 이상 움직이면 스크롤로 인식
const HORIZONTAL_INIT = 12;           // 가로 12px 이상 움직여야 스와이프 모드 진입
const COMMIT_DURATION = 280;          // 마무리 슬라이드 시간 (ms)
const SNAPBACK_DURATION = 240;        // 원위치 시간 (ms)

export function setupSwipePager(screen, options) {
  const {
    onLeft,         // 왼편 화면 (오른쪽 스와이프 시 들어옴)
    onRight,        // 오른편 화면 (왼쪽 스와이프 시 들어옴)
    onCommitLeft,   // 왼편 화면으로 이동 확정
    onCommitRight,  // 오른편 화면으로 이동 확정
  } = options;

  let touchStartX = 0;
  let touchStartY = 0;
  let isTracking = false;
  let isDragging = false;
  let direction = null;        // 'left' (←) | 'right' (→) - 손가락 진행 방향
  let neighborScreen = null;   // 옆 화면 (DOM)
  let isAnimating = false;     // 마무리 애니메이션 중

  // 인접 화면 캐시
  let leftScreenCache = null;
  let rightScreenCache = null;

  // 이미 fetch 중이면 중복 호출 방지
  let leftPromise = null;
  let rightPromise = null;

  async function getLeftScreen() {
    if (leftScreenCache) return leftScreenCache;
    if (!leftPromise && onLeft) {
      leftPromise = (async () => {
        try {
          const el = await onLeft();
          leftScreenCache = el;
          return el;
        } catch (e) {
          console.error('Left screen load failed:', e);
          return null;
        }
      })();
    }
    return leftPromise;
  }

  async function getRightScreen() {
    if (rightScreenCache) return rightScreenCache;
    if (!rightPromise && onRight) {
      rightPromise = (async () => {
        try {
          const el = await onRight();
          rightScreenCache = el;
          return el;
        } catch (e) {
          console.error('Right screen load failed:', e);
          return null;
        }
      })();
    }
    return rightPromise;
  }

  // 인접 화면을 미리 fetch (사용자가 슬라이드 시도 전에 준비)
  // requestIdleCallback이 있으면 그때, 없으면 짧은 setTimeout
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  idle(() => {
    if (onLeft) getLeftScreen();
    if (onRight) getRightScreen();
  });

  function onTouchStart(e) {
    if (isAnimating) return;
    if (e.touches.length !== 1) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isTracking = true;
    isDragging = false;
    direction = null;
  }

  async function onTouchMove(e) {
    if (!isTracking || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // 세로 움직임이 크면 스와이프 취소 (스크롤로 처리)
    if (!isDragging && Math.abs(dy) > VERTICAL_TOLERANCE) {
      isTracking = false;
      return;
    }

    // 가로 움직임이 임계값 넘고 가로가 세로보다 크면 스와이프 시작
    if (!isDragging && Math.abs(dx) > HORIZONTAL_INIT && Math.abs(dx) > Math.abs(dy) * 1.2) {
      isDragging = true;
      direction = dx < 0 ? 'left' : 'right';

      // 인접 화면 준비
      const adjacentScreen = direction === 'right'
        ? await getLeftScreen()
        : await getRightScreen();

      if (!adjacentScreen) {
        // 인접 화면이 없으면 스와이프 안 함
        isTracking = false;
        return;
      }

      // 옆 화면을 DOM에 추가 (자기 자신의 위치는 transform으로)
      neighborScreen = adjacentScreen;
      neighborScreen.classList.add('swipe-neighbor');
      // 시작 위치 — 오른쪽 스와이프(왼편 화면 들어옴)면 화면 왼쪽 밖
      // 왼쪽 스와이프(오른편 화면 들어옴)면 화면 오른쪽 밖
      neighborScreen.style.transform = direction === 'right'
        ? `translateX(-100%)`
        : `translateX(100%)`;
      neighborScreen.style.transition = 'none';
      screen.parentNode.appendChild(neighborScreen);

      // 본 화면도 transition 끄기
      screen.style.transition = 'none';
    }

    if (isDragging && neighborScreen) {
      // 두 화면 동시 이동
      // 본 화면은 손가락 따라 dx만큼
      // 옆 화면은 dx만큼 함께
      screen.style.transform = `translateX(${dx}px)`;

      const baseOffset = direction === 'right' ? -window.innerWidth : window.innerWidth;
      neighborScreen.style.transform = `translateX(${baseOffset + dx}px)`;
    }
  }

  function onTouchEnd(e) {
    if (!isTracking) return;
    isTracking = false;

    if (!isDragging) {
      return;
    }

    isDragging = false;

    const touch = (e.changedTouches && e.changedTouches[0]) || null;
    if (!touch) {
      snapBack();
      return;
    }

    const dx = touch.clientX - touchStartX;
    const screenWidth = window.innerWidth;
    const threshold = screenWidth * COMMIT_THRESHOLD_RATIO;

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

  // 부드럽게 원위치
  function snapBack() {
    isAnimating = true;
    screen.style.transition = `transform ${SNAPBACK_DURATION}ms cubic-bezier(0.2, 0.9, 0.4, 1)`;
    screen.style.transform = 'translateX(0)';

    if (neighborScreen) {
      const offset = direction === 'right' ? -window.innerWidth : window.innerWidth;
      neighborScreen.style.transition = `transform ${SNAPBACK_DURATION}ms cubic-bezier(0.2, 0.9, 0.4, 1)`;
      neighborScreen.style.transform = `translateX(${offset}px)`;
    }

    setTimeout(() => {
      // 옆 화면 제거
      if (neighborScreen && neighborScreen.parentNode) {
        neighborScreen.parentNode.removeChild(neighborScreen);
        neighborScreen.classList.remove('swipe-neighbor');
        neighborScreen.style.transform = '';
        neighborScreen.style.transition = '';
      }
      neighborScreen = null;
      screen.style.transition = '';
      screen.style.transform = '';
      isAnimating = false;
    }, SNAPBACK_DURATION + 20);
  }

  // 끝까지 슬라이드 후 navigateTo
  function commit(currentDx) {
    isAnimating = true;
    const distance = window.innerWidth;
    const targetX = currentDx < 0 ? -distance : distance;

    screen.style.transition = `transform ${COMMIT_DURATION}ms cubic-bezier(0.2, 0.7, 0.3, 1)`;
    screen.style.transform = `translateX(${targetX}px)`;

    if (neighborScreen) {
      neighborScreen.style.transition = `transform ${COMMIT_DURATION}ms cubic-bezier(0.2, 0.7, 0.3, 1)`;
      neighborScreen.style.transform = 'translateX(0)';
    }

    setTimeout(() => {
      // navigateTo 호출 — 라우터가 새 화면 그리면 옆 화면은 자동으로 사라짐
      if (currentDx < 0) {
        // 왼쪽 스와이프 — 오른편 화면(다음 날)으로
        if (onCommitRight) onCommitRight();
      } else {
        // 오른쪽 스와이프 — 왼편 화면(여정)으로
        if (onCommitLeft) onCommitLeft();
      }
    }, COMMIT_DURATION);
  }

  screen.addEventListener('touchstart', onTouchStart, { passive: true });
  screen.addEventListener('touchmove', onTouchMove, { passive: true });
  screen.addEventListener('touchend', onTouchEnd, { passive: true });
  screen.addEventListener('touchcancel', onTouchCancel, { passive: true });

  // cleanup — hashchange가 발생하면 정리
  const cleanup = () => {
    if (neighborScreen && neighborScreen.parentNode) {
      neighborScreen.parentNode.removeChild(neighborScreen);
    }
    neighborScreen = null;
    leftScreenCache = null;
    rightScreenCache = null;
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);
}
