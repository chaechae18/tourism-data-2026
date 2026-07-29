# Play Gyeongju Backend

FastAPI와 SQLite를 사용하는 로컬 API 서버입니다.

## 실행

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

`.env`에 외부 API 키와 로컬 설정을 입력합니다.

```env
KAKAO_REST_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
ADMIN_API_KEY=
DATABASE_PATH=./data/play_gyeongju.db
UPLOAD_DIR=./uploads
MAX_UPLOAD_BYTES=10485760
SEARCH_CACHE_TTL_SECONDS=300
SEARCH_RATE_LIMIT=30
SEARCH_RATE_WINDOW_SECONDS=60
CORS_ORIGINS=http://localhost:3000
```

Kakao 검색이 실패하거나 결과가 없으면 Naver 지역 검색을 사용합니다.
이미지는 로컬 `uploads/` 디렉터리에 저장하며 JPEG, PNG, WebP 형식과
10MB 이하 파일만 허용합니다.

```bash
uvicorn app.main:app --reload --port 8000
```

첫 실행 시 `data/play_gyeongju.db`가 생성되고 SQLite 스키마와 로컬
개발용 사용자(`X-User-No: 1`)가 준비됩니다.

- API 문서: `http://localhost:8000/docs`
- 상태 확인: `http://localhost:8000/health`
- 상세 명세: [`../docs/spot-api.md`](../docs/spot-api.md)

## 테스트

```bash
pytest
```

## Docker

백엔드 디렉터리를 빌드 컨텍스트로 사용합니다.

```bash
cd backend
docker build -t play-gyeongju-backend .
```

API 키는 이미지에 포함하지 않고 실행 시 `.env`로 전달합니다. 현재 로컬
SQLite 데이터와 업로드 파일은 Docker 볼륨에 보존합니다.

```bash
docker run --rm \
  --name play-gyeongju-backend \
  --env-file .env \
  -p 8000:8000 \
  -v play-gyeongju-data:/app/data \
  -v play-gyeongju-uploads:/app/uploads \
  play-gyeongju-backend
```

실행 후 `http://localhost:8000/health`에서 상태를 확인할 수 있습니다.
운영 MySQL 연결은 데이터베이스 계층 전환 시 별도로 적용합니다.
