# Play Gyeongju

경주 여행 앱의 모노레포 작업공간입니다.

```text
frontend/  Next.js + React + Tailwind CSS
backend/   FastAPI + MySQL API 서버
```

프론트엔드 실행과 환경변수 설정은 [frontend/README.md](./frontend/README.md)를 참고하세요.
스팟 API 실행 방법은 [backend/README.md](./backend/README.md), 프론트 연동
명세는 [docs/spot-api.md](./docs/spot-api.md)를 참고하세요.

## 전체 실행

프로젝트 루트에서 한 번에 MySQL, 백엔드, 프론트엔드를 실행합니다.

```bash
docker compose up --build
```

- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:8001`
- API 문서: `http://localhost:8001/docs`
- MySQL: `localhost:3306`

프론트엔드 소스는 컨테이너에 연결되어 코드 변경 시 자동으로 반영됩니다.
장소 검색 등 외부 API 기능이 필요하면 `backend/.env.example`을 참고해
`backend/.env`에 API 키를 설정합니다. MySQL 로컬 개발 계정은 Compose의
기본값으로 준비되므로 별도 설정 없이 실행할 수 있습니다.

중지하려면 다음 명령을 사용합니다.

```bash
docker compose down
```

기존 MySQL 볼륨이 다른 계정 정보로 초기화되어 연결에 실패할 경우에만,
보존할 데이터가 없는지 확인한 뒤 `docker compose down -v`로 개발 볼륨을
초기화합니다.
