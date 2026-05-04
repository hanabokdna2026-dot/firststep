# 풍성한 첫걸음 - MVP

PWA 앱 진행 상황 (1-3단계).

## 폴더 구조

```
firststep_app/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js          # 라우팅
│   ├── storage.js      # localStorage 래퍼
│   ├── content.js      # lessons.json 로더
│   ├── time.js         # 시간대/날짜 헬퍼
│   └── screens/
│       ├── welcome.js
│       ├── name.js
│       ├── pace.js
│       ├── intro.js
│       ├── notify.js
│       └── home.js
├── data/lessons.json
└── assets/sounds/
    ├── bell-short.mp3      # 종소리 (3초, 짧은 버전 - 기본)
    ├── bell-medium.mp3     # 종소리 (5초, 잔향 살린 버전)
    └── bowl4-original.mp3  # 원본 (12초)
```

## 로컬에서 실행

```bash
cd firststep_app
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000

## 작동 흐름

**처음 켜면**: 환영 → 이름 → 보통 속도 → 안내 → 알림 시간 → 홈

**홈 화면에서**:
- 현재 시간대(아침/낮/저녁) 자동 인식
- 오늘의 본문 미리보기
- 진도 표시 (1과 · 첫째 날 / 1 / 6)
- 다음 세션 안내
- 하단 탭 (오늘/기록/설정)

**시작하기 버튼**: 다음 단계(4단계)에서 실제 세션 화면 연결됩니다.

## 진행 상황

- ✅ 1단계: 프로젝트 골격
- ✅ 2단계: 첫 진입 흐름 (5개 화면)
- ✅ 3단계: 홈 화면 + 시간대 인식 + 진도 계산
- ⏳ 4단계: 세션 화면 (아침/낮/저녁)
- ⏳ 5단계: 잠잠히 머물기 + 종소리
- ⏳ 6단계: 새 과 시작 시 속도 확인
- ⏳ 7단계: 기록/설정 화면
- ⏳ 8단계: PWA 마무리 (manifest, SW, 알림)

## 종소리 결정

기존 렉시오 디비나의 `bowl4.mp3`(12초)를 받아서 **앞 3초만 잘라 페이드아웃 처리**한 `bell-short.mp3`를 기본으로 잡았어요. 이유는:
- 종은 시간 신호이지 음악이 아님
- 짧을수록 시작·마침이 명확
- 잠잠히 1분 중 첫 12초가 종소리에 묻히지 않도록

원본과 5초 버전(`bell-medium.mp3`)도 두었으니 5단계에서 사용해보고 결이 안 맞으면 바꿀 수 있어요.

## 데이터 초기화

처음부터 다시 보고 싶을 때:
- 홈 화면 하단 탭의 "설정" 누르면 임시 초기화 옵션 나옴
- 또는 브라우저 개발자도구 콘솔에서 `localStorage.clear()`
