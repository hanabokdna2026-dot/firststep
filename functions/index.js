/**
 * 풍성한 첫걸음 — 매일 약속 시간에 푸시 알림 발송
 *
 * 매 시간마다 실행되어, 그 자리에 약속 시간이 닿은 사용자들에게 푸시를 보냄.
 * 시간대(timezone)별로 자기 시간에 맞춰 발송.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

// ========================================
// 푸시 메시지 — 시간대별 안내
// ========================================
const MESSAGES = {
  morning: [
    { title: '아침이에요', body: '오늘 첫 자리에서 그분과 만나요.' },
    { title: '좋은 아침이에요', body: '잠잠히 머물 시간이에요.' },
    { title: '아침의 자리', body: '한 걸음씩 시작해 봐요.' },
  ],
  midday: [
    { title: '낮의 자리', body: '말씀과 함께 잠시 쉬어가세요.' },
    { title: '점심 무렵', body: '하루 가운데서 그분께 머물러요.' },
    { title: '한낮의 만남', body: '오늘의 본문을 읽어볼 시간이에요.' },
  ],
  evening: [
    { title: '저녁이 되었어요', body: '하루를 마치며 그분 앞에 서요.' },
    { title: '하루를 돌아보며', body: '오늘 함께해 주셨음에 감사드려요.' },
    { title: '저녁의 자리', body: '잠잠히 마무리해 봐요.' },
  ],
};

function pickMessage(sessionType) {
  const list = MESSAGES[sessionType];
  return list[Math.floor(Math.random() * list.length)];
}

// ========================================
// 매 시간 실행되는 cron job
// 갱신: 2026-05-08 — Cloud Scheduler 자리 강제 재짜임
// ========================================
exports.sendDailyReminders = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
  },
  async (event) => {
    console.log('sendDailyReminders 실행 시작:', new Date().toISOString());
    const db = admin.firestore();
    const messaging = admin.messaging();

    // 지금 cron 자리 — Asia/Seoul 짜임 (HH:MM)
    // 짚어둘 자리: 사용자 시간대가 다 다를 수 있는데, 우리 짜임은 거의 다 한국 자리.
    // 그래서 일단 Seoul 자리 기준으로 가져오고, 다른 시간대 사용자도 짚도록 짜임 둠.
    const now = new Date();
    const seoulNow = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    let [seoulH, seoulM] = seoulNow.split(':').map(Number);
    if (seoulH === 24) seoulH = 0;
    // 30분 단위로 짜임 (cron이 :00 또는 :30에 도니까)
    const slotM = seoulM < 30 ? 0 : 30;
    const currentSlot = String(seoulH).padStart(2, '0') + ':' + String(slotM).padStart(2, '0');
    console.log(`현재 cron 자리: ${currentSlot} (Asia/Seoul)`);

    // scheduledSlots에 현재 자리가 들어 있는 사용자만 가져오기
    // 이러면 매 cron마다 모든 사용자 짚지 않아도 되어 효율 높음
    const snapshot = await db.collection('pushUsers')
      .where('enabled', '==', true)
      .where('scheduledSlots', 'array-contains', currentSlot)
      .get();

    if (snapshot.empty) {
      console.log(`이번 cron 자리에 닿는 사용자 없음 (${currentSlot})`);
      return;
    }
    console.log(`사용자 ${snapshot.size}명 짚어봄`);

    let sentCount = 0;
    let invalidCount = 0;

    // 각 사용자의 시간대 기준으로 — 그 사용자의 약속 시간이 지금인지 점검
    const promises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const token = data.token;
      const meetingTimes = data.meetingTimes || {};
      const userTimezone = data.timezone || 'Asia/Seoul';
      const lastSent = data.lastSent || {};  // { morning: ISO, midday: ISO, evening: ISO }

      // 사용자 시간대 기준으로 현재 시각 (HH:MM)
      const userNow = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      // userNow는 "HH:MM" 형식 (또는 "24:MM" → "00:MM")
      let [userHour, userMin] = userNow.split(':').map(Number);
      if (userHour === 24) userHour = 0;

      const userMinutesNow = userHour * 60 + userMin;
      console.log(`사용자 ${token.substring(0, 10)}... 시간 점검: 현재=${userNow}, 약속=${JSON.stringify(meetingTimes)}`);

      // 어떤 세션이 지금인지 점검
      // cron이 30분 단위로 돌아가니까 — 약속 시간 ±15분 안이면 발송
      // (가장 가까운 cron 실행 자리 한 번만 돌도록)
      let sessionToSend = null;
      let smallestDiff = 999;
      for (const [session, time] of Object.entries(meetingTimes)) {
        if (!time) continue;
        const [h, m] = time.split(':').map(Number);
        const sessionMinutes = h * 60 + m;
        // 하루 자리 고려 (자정 자리 짚음)
        let diff = Math.abs(userMinutesNow - sessionMinutes);
        if (diff > 720) diff = 1440 - diff;  // 자정 짜임
        // ±15분 안이면 그 세션
        if (diff <= 15 && diff < smallestDiff) {
          sessionToSend = session;
          smallestDiff = diff;
        }
      }

      if (!sessionToSend) {
        console.log(`  → 푸시 건너뜀 (가까운 약속 시간 없음)`);
        return;
      }

      // 같은 세션을 옛에 보낸 적 있으면 — 22시간 안이면 또 안 보냄
      // (하루에 한 번씩만 같은 세션 푸시 가도록)
      const lastSentForSession = lastSent[sessionToSend];
      if (lastSentForSession) {
        const lastTime = new Date(lastSentForSession).getTime();
        const hoursAgo = (now.getTime() - lastTime) / (1000 * 60 * 60);
        if (hoursAgo < 22) {
          console.log(`  → ${sessionToSend} 세션 푸시 건너뜀 (옛에 ${hoursAgo.toFixed(1)}시간 전에 보냄)`);
          return;
        }
      }

      console.log(`  → ${sessionToSend} 세션 푸시 보냄`);

      // 푸시 보내기
      const msg = pickMessage(sessionToSend);
      try {
        await messaging.send({
          token: token,
          notification: {
            title: msg.title,
            body: msg.body,
          },
          data: {
            sessionType: sessionToSend,
          },
          webpush: {
            fcmOptions: {
              link: 'https://hanabokdna2026-dot.github.io/firststep/',
            },
          },
        });
        sentCount++;

        // 마지막 보낸 시간 저장 (다음 cron 자리에 같은 자리 두 번 안 보내게)
        await docSnap.ref.update({
          [`lastSent.${sessionToSend}`]: now.toISOString(),
        });
      } catch (err) {
        // 토큰 무효 — 사용자가 알림 끄거나 앱 지움
        if (err.code === 'messaging/registration-token-not-registered'
          || err.code === 'messaging/invalid-registration-token') {
          await docSnap.ref.delete();
          invalidCount++;
        } else {
          console.error('푸시 보내기 실패:', err);
        }
      }
    });

    await Promise.all(promises);
    console.log(`푸시 ${sentCount}개 보냄, 무효 토큰 ${invalidCount}개 정리`);
  }
);
