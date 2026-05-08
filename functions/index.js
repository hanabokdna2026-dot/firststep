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
// ========================================
exports.sendDailyReminders = onSchedule(
  {
    schedule: 'every 30 minutes',  // 30분마다 — 30분 단위 정확도
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
  },
  async (event) => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    // 모든 푸시 사용자 가져오기
    const snapshot = await db.collection('pushUsers')
      .where('enabled', '==', true)
      .get();

    if (snapshot.empty) {
      console.log('푸시 받을 사용자 없음');
      return;
    }

    const now = new Date();
    let sentCount = 0;
    let invalidCount = 0;

    // 각 사용자의 시간대 기준으로 — 그 사용자의 약속 시간이 지금인지 점검
    const promises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const token = data.token;
      const meetingTimes = data.meetingTimes || {};
      const userTimezone = data.timezone || 'Asia/Seoul';

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

      // 어떤 세션이 지금인지 점검 (15분 안 자리면 발송)
      let sessionToSend = null;
      for (const [session, time] of Object.entries(meetingTimes)) {
        if (!time) continue;
        const [h, m] = time.split(':').map(Number);
        const sessionMinutes = h * 60 + m;
        const diff = userMinutesNow - sessionMinutes;
        // 0~30분 안이면 발송 (30분 cron이라 어긋날 수 있어서 여유 둠)
        if (diff >= 0 && diff < 30) {
          sessionToSend = session;
          break;
        }
      }

      if (!sessionToSend) return;

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
