# Play Gyeongju Frontend
Next.js, React, Tailwind CSS로 만든 경주 여행 앱 MVP

## Docker Compose 실행

프로젝트 루트에서 MySQL과 백엔드를 포함해 한 번에 실행합니다.

```bash
docker compose up --build
```

프론트엔드는 `http://localhost:3000`, 백엔드는 `http://localhost:8001`에서
실행됩니다. 프론트엔드 소스는 컨테이너에 연결되어 자동 새로고침이 유지됩니다.

## 프론트엔드만 직접 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

Docker Compose의 백엔드만 사용하면서 프론트엔드를 직접 실행할 수도 있습니다.
다른 API 주소를 사용할 경우 `.env.local`의 값을 변경합니다.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

백엔드를 `uvicorn`으로 직접 8000 포트에서 실행한다면 이 값을
`http://localhost:8000`으로 변경합니다.

## TMAP 길찾기

`.env.local`에 SK open API에서 발급한 앱 키를 입력합니다.

```bash
NEXT_PUBLIC_TMAP_APP_KEY=your_app_key
```

지도는 WGS84 위경도를 일러스트 SVG 좌표로 투영합니다. 앱 키가 있으면 TMAP 보행자 경로안내 API 결과를 같은 좌표계에 그리며, 키가 없거나 호출에 실패하면 프론트 확인용 데모 경로를 표시합니다.

`NEXT_PUBLIC_` 환경변수는 브라우저에 노출됩니다. 운영 환경에서는 TMAP 호출을 백엔드 프록시로 옮기고 앱 키를 서버 환경변수로 관리해야 합니다.

## 검증

```bash
npm test -- --run
npm run build
```
