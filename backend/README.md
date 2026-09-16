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

## TourAPI 동기화

`sync_tourapi.py` 가 공사 데이터를 `PLACE` / `FESTIVAL` 에 넣습니다. compose 의 `sync`
서비스가 `--loop` 로 이걸 주기 실행하므로, 평소에는 손댈 일이 없습니다. 시작할 때 DB를
확인해 장소나 영·일·중 번역이 비어 있으면 즉시 최초 적재하고, 이미 완성돼 있으면 건너뜁니다.
따라서 새로 받은 팀원도 `docker compose up -d --build` 외에 별도 적재 명령이 필요 없습니다.

```bash
docker compose logs -f sync                          # 진행 상황
docker compose exec backend python sync_tourapi.py   # 지금 당장 한 번 더
```

### 호출을 아끼는 방식

동기화 비용의 대부분은 장소 1건당 두 번씩 나가는 상세 조회(`detailCommon2` +
`detailIntro2`)입니다. 그래서 상세를 부르기 **전에** 목록 응답의 `modifiedtime` 을
`PLACE.MODIFIED_TIME` 과 대조하고, 그대로면 통째로 넘어갑니다. 분류체계 이름표
(`lclsSystmCode2`, 한 벌 만드는 데 수십 회)도 실제로 넣거나 고칠 행이 나왔을 때만 받습니다.

결과는 `created / updated / unchanged / skipped` 로 찍힙니다. `unchanged` 가 곧 아낀 건수이고,
장소 하나당 상세 2회를 아낀 셈입니다.

`MODIFIED_TIME` 은 **상세까지 받은 회차에만** 기록합니다. `--skip-detail` 로 넣은 행은 비워
두므로, 소개·운영시간이 빈 채로 "최신"으로 굳지 않고 다음 회차에서 채워집니다.

### 번역 적재

공사는 언어별로 서비스를 따로 냅니다 (`KorService2` / `EngService2` / `JpnService2` /
`ChsService2`). **같은 장소여도 언어별 `contentId` 와 `contentTypeId` 가 다를 수 있습니다.**
확정된 외국어 ID 는 `PLACE_TOURAPI_LINK` 에 저장합니다. 새 연결은 외국어 제목에 한국어
장소명이 포함되고 좌표도 가까운 유일한 후보일 때만 자동 확정합니다. 나머지는 로그의
`검토 필요` 항목으로 남기며 좌표만 가깝다고 연결하지 않습니다.

한국어 동기화가 끝나면 이어서 언어별로 `PLACE_I18N` 을 채웁니다. `PLACE` 는 그대로 한 줄이고,
번역만 `(PLACE_IDX, LANGUAGE_CODE)` 로 붙습니다. 한국어도 특별 취급 없이 `ko` 한 줄로 들어갑니다.

- 언어를 타지 않는 좌표·사진·분류코드는 `PLACE` 에만 둡니다.
- 쉬는날은 두 곳에 쓰임이 다르게 들어갑니다. 코스 추천이 요일을 맞춰 보는 `PLACE.REST_DATE`
  ("화") 와, 화면에 그대로 보여 주는 `PLACE_I18N.REST_DATE` ("매주 화요일 …") 입니다.
- 분류체계 이름은 같은 코드를 쓰는 장소가 공유하므로 `CATEGORY_NAME_I18N` 에 코드별로 한 줄만 둡니다.

번역이 없는 장소는 조회할 때 **요청 언어 → 한국어 → `PLACE` 원본** 순으로 내려가므로 화면이
비지 않습니다. 도슨트도 같은 순서로 원고를 고르고, **원고가 나온 언어에 맞는 목소리**로 읽습니다
(영어 원고가 없어 한국어로 내려갔으면 한국어 목소리로 읽습니다).

언어별로도 `MODIFIED_TIME` 을 따로 세므로, 2회차부터는 그 언어에서 바뀐 것만 받습니다.
공식 외국어 API에 없는 필드는 `translate_places.py`가 OpenAI API로 보완합니다. 결과는
`PLACE_I18N`에, 한국어 원문 해시·모델·생성 상태는 `PLACE_TRANSLATION_CACHE`에 저장합니다.
따라서 번역 파일을 배포하지 않으며, Docker 첫 실행에서 API로 만든 뒤 DB에서 재사용합니다.
주간 동기화 때 원문 해시가 달라진 필드만 다시 번역하고, 공식 TourAPI 값이 새로 들어온 필드는
기계 번역 이력을 지워 이후에도 공식 값을 우선합니다. 운영시간·휴무일은 숫자가 달라지면
자동 적재하지 않고 로그에 검토 대상으로 남깁니다.

### 자주 쓰는 옵션

| 옵션 | 쓸 때 |
|---|---|
| `--force` | 수정시각과 무관하게 전량 재적재. **컬럼을 새로 추가했을 때** 씁니다 |
| `--skip-detail` | 목록만 빠르게. 소개·운영시간·입장료가 빕니다 |
| `--target places\|festivals` | 한쪽만 |
| `--languages en ja` | 그 언어만 번역 적재. `--languages` 만 주면 번역을 건너뜁니다 |
| `--limit N` | 시험 실행 |
| `--interval-days N` | `--loop` 간격. `SYNC_INTERVAL_DAYS` 로도 지정 |

`--loop` 는 마지막 성공 시각을 `SYNC_STATE_PATH`(컨테이너에서는 `sync-state` 볼륨)에 남깁니다.
컨테이너를 다시 띄워도 주기를 새로 세지 않고 남은 시간만 기다립니다.

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
