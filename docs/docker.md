# Docker에서 운영 DB 사용하기

배포 사이트는 Vercel에서 운영하고, 각 팀원은 Docker 또는 로컬 프론트엔드로 화면을 수정합니다.
기본 Docker 구성은 `backend/.env`의 운영 DB에 직접 연결합니다. 로그인·방문 완료·게시물 작성 등
앱에서 저장하는 내용은 배포 사이트와 같은 DB에 반영됩니다. Git은 코드를 공유하며, DB 접속 정보는 공유하지 않습니다.

## 접속 설정

팀에서 받은 값을 `backend/.env`에 넣습니다. 이 파일은 Git과 Docker 이미지에 포함되지 않습니다.

```dotenv
DB_HOST=팀에서_받은_호스트
DB_PORT=팀에서_받은_포트
DB_USER=팀에서_받은_사용자
DB_PASSWORD=팀에서_받은_비밀번호
DB_NAME=팀에서_받은_DB명
DB_SSL=true
DB_SSL_CA=
DB_AUTO_MIGRATE=false
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Docker는 접속 정보를 로컬 MySQL 주소로 덮어쓰지 않습니다. TLS는 시스템 신뢰 저장소로 인증서와
호스트명을 검증합니다. Aiven에서 별도 CA를 제공하는 서비스라면 인증서를
`backend/certs/aiven-ca.pem`에 저장하고 `DB_SSL_CA=/app/certs/aiven-ca.pem`을 설정합니다.
Compose가 `backend/certs`를 `/app/certs`에 읽기 전용으로 마운트합니다.
인증서는 Git과 Docker 이미지에 포함되지 않습니다. Python을 직접 실행할 때는 로컬 파일 경로를 지정합니다.
인증서 검증에 실패하면 연결을 중단하며, 암호화 없는 연결로 재시도하지 않습니다.
[Aiven 인증서 안내](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)

기존 `SESSION_SECRET_KEY`와 외부 API 키도 유지합니다. 소셜 로그인은 제공자에 등록된 콜백 URL에
따라 배포 사이트로 돌아갈 수 있으므로, 로컬 화면 확인에는 아이디·비밀번호 로그인을 사용합니다.

## 실행

프론트엔드를 이미 `npm run dev`로 실행 중이면 백엔드만 실행합니다.

```bash
docker compose up -d --build backend
```

화면도 Docker로 실행하려면 기존 로컬 프론트엔드를 종료한 뒤 실행합니다.

```bash
docker compose up -d --build
```

프론트엔드는 `http://localhost:3000`, API는 `http://localhost:8001`입니다.
`frontend/.env.local`의 `NEXT_PUBLIC_API_BASE_URL`도 `http://localhost:8001`로 맞춥니다.
로그인 쿠키를 위해 프론트·API의 호스트명을 모두 `localhost`로 통일합니다.
Docker 프론트엔드는 화면 수정용 개발 서버이며, 이 설정 자체를 공개 운영 서버에 배포하는 용도는 아닙니다.

```bash
docker compose ps
curl http://localhost:8001/health
```

`.env` 변경은 단순 재시작이 아니라 `docker compose up -d --force-recreate backend`로 적용합니다.
이 명령은 **기존 이미지**를 사용하므로 코드도 변경했다면 `--build`를 함께 사용합니다.
Vercel 환경변수나 배포는 이 명령으로 변경되지 않습니다.

## 운영 DB를 변경하는 별도 작업

기본 실행은 로컬 `db` 컨테이너와 `sync` 작업을 시작하지 않습니다. 백엔드는 시작 시 `SELECT 1`로
접속만 확인하며, Compose에서 자동 마이그레이션을 비활성화합니다. 앱의 일반 저장 기능은 그대로 동작합니다.

스키마 변경은 적용할 마이그레이션을 검토하고 팀과 적용 시점을 정한 뒤 한 번 실행합니다.

```bash
docker compose run --rm --no-deps backend alembic current
docker compose run --rm --no-deps backend alembic upgrade head
```

관광 데이터 적재·번역·채점은 운영 DB를 수정하고 외부 API 사용료가 발생할 수 있습니다.
필요한 스키마를 적용한 뒤 담당자 한 명만 실행합니다.

```bash
docker compose --profile sync up -d --build sync
docker compose logs -f sync
docker compose stop sync
```

이미 실행 중인 동기화 컨테이너는 프로필 변경만으로 멈추지 않으므로 중단하려면 `stop sync`를 실행합니다.

## DB 통합 테스트는 로컬 DB에서만 실행

백엔드 DB 통합 테스트는 테스트 DB를 생성·초기화·삭제합니다. 운영 DB 주소에서는 실행을 차단합니다.
필요할 때만 `docker compose --profile local-db up -d db`로 로컬 MySQL을 켭니다.
로컬 DB 서비스의 초기 계정은 Compose의 기본값 또는 **루트 `.env`/셸의 `MYSQL_*`**를 사용하며,
`backend/.env`의 운영 DB 접속 정보와는 별개입니다. 기존 MySQL 데이터 볼륨은 그대로 보존됩니다.
테스트 프로세스에는 로컬 `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=false`를 명시해야 합니다.
