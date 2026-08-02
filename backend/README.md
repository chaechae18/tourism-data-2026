# Play Gyeongju Backend

FastAPI와 MySQL을 사용하는 API 서버입니다.

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
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=play_gyeongju
DB_USER=play_gyeongju
DB_PASSWORD=
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

첫 실행 시 MySQL 스키마와 로컬 개발용 사용자(`X-User-No: 1`)가 준비됩니다.

- API 문서: `http://localhost:8000/docs`
- 상태 확인: `http://localhost:8000/health`
- 상세 명세: [`../docs/spot-api.md`](../docs/spot-api.md)

## 테스트

```bash
pytest
```

## Docker Compose

프로젝트 루트에서 `docker compose up --build`를 실행합니다. `backend/.env`에는
외부 API 키를, 루트 `.env`에는 MySQL 계정 정보를 설정할 수 있습니다. MySQL 데이터와
업로드 파일은 Docker 볼륨에 보존됩니다.
