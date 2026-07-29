# Play Gyeongju

경주 여행 앱의 모노레포 작업공간입니다.

```text
frontend/  Next.js + React + Tailwind CSS
backend/   API 서버 (FastAPI + SQLite / Django + DRF, 통합 진행 중)
docs/      설계 문서
```

프론트엔드 실행과 환경변수 설정은 [frontend/README.md](./frontend/README.md)를,
백엔드는 [backend/README.md](./backend/README.md)를 참고하세요.
스팟 API 프론트 연동 명세는 [docs/spot-api.md](./docs/spot-api.md)에 있습니다.

## 백엔드가 두 벌인 이유

스팟 기능(FastAPI)과 홈 화면 API(Django)를 각자 만들어 올린 상태라 현재
`backend/` 아래에 두 스택이 공존합니다. FastAPI 쪽으로 합치는 중이며, 그동안은
아래 두 문단이 각각 유효합니다. 자세한 실행법은 [backend/README.md](./backend/README.md)를 보세요.
