/**
 * 알림 처리
 *
 * 웹 알림은 환경 제약이 많음:
 * - iOS Safari: PWA 설치 후에만, iOS 16.4+ 필요
 * - Android Chrome: 설치 안 해도 가능
 * - 데스크톱 브라우저: 가능
 *
 * 정확한 시간에 알림 보내는 건 Service Worker + 시계 트리거가 필요한데
 * 모바일에서 백그라운드 실행 제약 때문에 어려움.
 *
 * MVP에서는 단순한 방식:
 * - 권한 요청 (사용자가 시작할게요 누를 때)
 * - 앱이 켜져있을 때 setTimeout으로 다음 알림 시간에 알림 보냄
 * - 정확한 푸시 알림은 v2 (서버 필요)
 */

import Storage from './storage.js';
import { getCurrentSessionType, getSessionLabel } from './time.js';

// 알림 권한 요청
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  // 처음이면 요청
  const result = await Notification.requestPermission();
  return result;
}

// 알림 표시
export function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    const notification = new Notification(title, {
      body,
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-192.png',
      tag: 'firststep',
      silent: false,
    });
    // 클릭하면 앱으로
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (e) {
    console.warn('알림 실패:', e);
  }
}

// 앱이 켜져있을 때 다음 알림 시간 트리거
let notifyTimerId = null;

export function startNotifyScheduler() {
  if (notifyTimerId) {
    clearTimeout(notifyTimerId);
  }

  if (!Storage.getNotifyEnabled()) {
    return;
  }

  scheduleNext();
}

function scheduleNext() {
  const times = Storage.getNotifyTimes();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowSec = nowMin * 60 + now.getSeconds();

  // 오늘 남은 알림 시간들
  const candidates = [
    { type: 'morning', time: times.morning },
    { type: 'midday', time: times.midday },
    { type: 'evening', time: times.evening },
  ].map(t => {
    const [h, m] = t.time.split(':').map(Number);
    const targetSec = h * 3600 + m * 60;
    return { ...t, targetSec };
  });

  // 다음 트리거할 알림 찾기 (오늘 안에서)
  let next = null;
  let waitSec = Infinity;

  for (const c of candidates) {
    let delta = c.targetSec - nowSec;
    if (delta < 0) {
      // 오늘 지난 시간 → 내일로
      delta += 86400;
    }
    if (delta < waitSec) {
      waitSec = delta;
      next = c;
    }
  }

  if (next) {
    notifyTimerId = setTimeout(() => {
      const label = getSessionLabel(next.type);
      const userName = Storage.getUserName();
      const title = '풍성한 삶으로 첫걸음';
      const body = userName
        ? `${userName}님, ${label} 만남이 기다리고 있어요`
        : `${label} 만남이 기다리고 있어요`;
      showNotification(title, body);
      // 다음 알림 다시 스케줄
      scheduleNext();
    }, waitSec * 1000);
  }
}

export function stopNotifyScheduler() {
  if (notifyTimerId) {
    clearTimeout(notifyTimerId);
    notifyTimerId = null;
  }
}
