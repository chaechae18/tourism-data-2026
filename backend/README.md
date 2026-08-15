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
MYSQL_DATABASE=play_gyeongju
MYSQL_USER=play_gyeongju
MYSQL_PASSWORD=
MYSQL_ROOT_PASSWORD=
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

## DB 마이그레이션

DB 구조는 Alembic 으로 관리합니다. **백엔드가 뜰 때 자동으로 최신 상태까지 적용**되므로,
코드를 받은 뒤에는 백엔드만 다시 띄우면 됩니다. 손으로 `ALTER TABLE` 을 칠 일이 없습니다.

```bash
docker compose up -d --build backend   # 이것만으로 DB 구조가 최신이 됩니다
```

### 스키마를 바꿔야 할 때

`db/schema.mysql.sql` 은 **기준선 스냅샷이라 고쳐도 반영되지 않습니다.**
아래처럼 마이그레이션을 새로 만드세요.

```bash
cd backend
alembic revision -m "add password hash to user auth"   # alembic/versions/ 에 파일 생성
```

만들어진 파일의 `upgrade()` 에 바꿀 내용을, `downgrade()` 에 되돌리는 내용을 적습니다.
ORM 을 쓰지 않으므로 SQL 을 직접 씁니다.

```python
def upgrade() -> None:
    op.execute("ALTER TABLE USER_AUTH ADD COLUMN PASSWORD_HASH VARCHAR(255) NOT NULL")

def downgrade() -> None:
    op.execute("ALTER TABLE USER_AUTH DROP COLUMN PASSWORD_HASH")
```

커밋해서 올리면 팀원은 백엔드를 다시 띄우는 것만으로 같은 구조가 됩니다.

### 규칙

- **이미 올린 마이그레이션 파일은 고치지 않습니다.** 다른 사람 DB 에는 이미 적용돼 있어서
  고쳐도 다시 실행되지 않습니다. 바꿀 게 있으면 새 파일을 추가하세요.
- 기존 DB 에도 안전하게 돌아가야 합니다. 컬럼 추가라면 이미 있는지 확인하거나
  기본값을 주세요. (`0002_spots_place_snapshot.py` 가 예시입니다)

### 자주 쓰는 명령

```bash
alembic current            # 지금 DB 가 몇 번까지 적용됐는지
alembic history            # 마이그레이션 목록
alembic upgrade head       # 최신까지 적용 (백엔드 시작 시 자동 실행되는 것과 동일)
alembic downgrade -1       # 한 단계 되돌리기
```

## 테스트

```bash
pytest
```

테스트 DB 도 같은 마이그레이션으로 만들어집니다. 마이그레이션이 깨지면 테스트가 먼저 실패합니다.

## Docker Compose

프로젝트 루트에서 `docker compose up --build`를 실행합니다. 외부 API 키와
MySQL 계정 정보는 모두 `backend/.env`에 설정합니다. MySQL 데이터와 업로드
파일은 Docker 볼륨에 보존됩니다.
