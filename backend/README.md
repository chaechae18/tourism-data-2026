# Play Gyeongju — Backend

Django + DRF API 서버. 현재 구현 범위는 **메인(홈) 화면 조회 API 4개**와
**한국관광공사 TourAPI 수집기**입니다.

## 실행

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # 값 채우기
python manage.py runserver
```

`.env`의 `DB_NAME`이 비어 있으면 SQLite로 떨어집니다. MySQL 없이도 서버는 뜨지만,
테이블이 없으므로 조회는 비어 있습니다.

MySQL을 붙일 때는 `docs/db/schema.sql`을 먼저 적용합니다. `manage.py migrate`로는
테이블이 생기지 않습니다 — 스키마는 팀 DDL 소유이고 모델은 전부 `managed=False`입니다.

```bash
mysql -u <user> -p <database> < docs/db/schema.sql
```

## 직접 확인하기

MySQL 없이 로컬에서 홈 API 4개를 눈으로 확인할 수 있습니다.

```bash
cd backend
source .venv/bin/activate

python manage.py test          # 1) 테스트 98개
python manage.py seed_demo     # 2) 표본 데이터 (SQLite 테이블까지 만들어 줍니다)
python manage.py runserver 8123  # 3) 서버
```

`seed_demo`는 **일부러 걸러져야 하는 행**도 같이 넣습니다. 응답에
`[안 보여야 함]`으로 시작하는 항목이 하나라도 보이면 필터가 잘못된 것입니다.
여러 번 돌려도 안전합니다(매번 지우고 다시 넣습니다). `DEBUG=0`이면 실행을 거부합니다.

```bash
curl 'http://localhost:8123/api/main/banners'
curl 'http://localhost:8123/api/main/popup'
curl 'http://localhost:8123/api/main/popup?lang=en'
curl 'http://localhost:8123/api/main/festivals?lang=en'
curl 'http://localhost:8123/api/main/places/recommended'
```

한글이 `경` 처럼 보이면 이렇게 붙이면 읽기 편합니다.

```bash
curl -s 'http://localhost:8123/api/main/festivals' \
  | python -c "import sys,json;print(json.dumps(json.load(sys.stdin),ensure_ascii=False,indent=2))"
```

기대 결과는 [docs/verify-checklist.md](docs/verify-checklist.md)에 정리해 두었습니다.

## 테스트

```bash
python manage.py test
```

SQLite에서 돌아가므로 MySQL이 없어도 통과합니다. `managed=False` 모델은 Django가
테스트 테이블을 만들어주지 않기 때문에, `config/test_runner.py`가 테스트 동안에만
`managed`를 켭니다.

## 엔드포인트

전부 공개(인증 없음)이고, envelope 없는 JSON 배열을 반환합니다.

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/main/banners` | 노출 기간 내 메인 배너 |
| GET | `/api/main/popup` | 노출 기간 내 팝업/공지 |
| GET | `/api/main/festivals` | 아직 끝나지 않은 축제 |
| GET | `/api/main/places/recommended` | 메인 추천 관광지 (노출 중 + 조회수순) |

`PLACE`는 `IS_RECOMMENDED`와 `IS_DISPLAY`를 따로 봅니다. 공사 API에서 갓 수집된
장소가 검수 전까지 화면에 나오지 않게 하기 위해서입니다.

### 언어

네 엔드포인트 모두 `?lang=` 를 받습니다. 지원 코드는 `ko`, `en`, `ja`, `zh`이며
`?lang=` → `Accept-Language` 헤더 → `ko` 순으로 결정됩니다. 모르는 코드가 와도 400이
아니라 조용히 `ko`로 떨어집니다.

번역은 **요청 언어 → ko 번역 → 원본 테이블 컬럼**의 3단계로 폴백합니다.
`POPUP.TITLE`, `FESTIVAL.NAME` 같은 한국어 원문이 원본 테이블에 이미 있으므로,
`*_I18N`이 비어 있어도 빈 값이 나가지 않습니다.

`MAIN_BANNER`에는 번역 테이블이 없습니다. 배너 엔드포인트는 `?lang=`을 받되
무시합니다. 나머지 셋은 각각 `POPUP_I18N`, `FESTIVAL_I18N`, `PLACE_I18N`을 씁니다.

### 응답 예시

```bash
curl 'http://localhost:8000/api/main/banners'
curl 'http://localhost:8000/api/main/popup?lang=en'
curl 'http://localhost:8000/api/main/festivals?lang=ja'
curl 'http://localhost:8000/api/main/places/recommended'
```

```json
[
  {
    "name": "첨성대",
    "text": "동양에서 가장 오래된 천문대",
    "address": "경북 경주시 인왕동 839-1",
    "latitude": 35.834755,
    "longitude": 129.219004,
    "admission_fee": "무료"
  }
]
```

`PLACE.LATITUDE/LONGITUDE`는 DB에서 `VARCHAR(50)`이지만 응답에서는 숫자로 변환합니다.
파싱할 수 없는 값은 `null`이 됩니다.

## 한국관광공사 TourAPI 수집

```bash
python manage.py sync_places                     # 지역기반 관광정보 → PLACE
python manage.py sync_places --limit 20 --skip-detail
python manage.py sync_festivals --from 20260101  # 행사정보 → FESTIVAL
```

`.env`에 `TOURAPI_SERVICE_KEY`(공공데이터포털 발급 인증키, **Decoding** 값)가 필요합니다.

### 스키마 v2

수집기는 팀과 협의해 확정한 v2 스키마를 전제로 합니다
([docs/db/schema-v2.sql](docs/db/schema-v2.sql), 이미 만들어진 DB는
[schema-v2-alter.sql](docs/db/schema-v2-alter.sql)).

- `PLACE` / `FESTIVAL`에 `SOURCE` + `CONTENT_ID`, 둘을 묶은 UNIQUE 키
- `CATEGORY` 테이블 삭제, `PLACE.TYPE`(`TOUR`/`FOOD`)로 대체
- `PLACE`에 `CONTENT`, `IMG`, `IS_DISPLAY` 추가
- `PLACE_I18N` 신규 (`FESTIVAL_I18N`은 원래 있었음)

`(SOURCE, CONTENT_ID)` UNIQUE 키가 upsert의 핵심입니다. MySQL에는 `MERGE INTO`가
없어 `INSERT ... ON DUPLICATE KEY UPDATE`를 쓰는데, 이 구문은 UNIQUE 키로 중복을
판정하기 때문입니다. 키가 없으면 재동기화가 매번 새 행을 만듭니다.

`SOURCE`가 키에 포함되어 있어, 수기로 등록한 장소가 우연히 같은 `CONTENT_ID`를
갖더라도 동기화가 덮어쓰지 않습니다.

### 설계 메모

- `client.py`(HTTP) / `mappers.py`(필드 매핑) / `sync.py`(upsert)를 분리했습니다.
  필드 매핑이 가장 자주 깨지는 부분이라, 네트워크 없이 고정 샘플로 테스트합니다.
- **공사 API의 `mapx`는 경도, `mapy`는 위도입니다.** 이름과 순서가 반대입니다.
- 동기화는 `IS_RECOMMENDED`, `VIEW_COUNT`, `IS_DISPLAY`, `IS_TRASH`를 건드리지
  않습니다. 운영자가 손으로 정한 값이므로 다음 동기화 때 덮이면 안 됩니다.
- `PLACE.TYPE`은 공사의 `contenttypeid`로 정합니다. 39(음식점)면 `FOOD`, 나머지는
  `TOUR`입니다. 공사 응답에서 구분할 수 있는 건 이 정도까지입니다.

## 구조

```text
config/    settings · urls · 테스트 러너
core/      팀 DDL을 미러링한 모델 (managed=False, 읽기 전용 취급)
main/      홈 화면 조회 API
tourapi/   공사 API 수집 (쓰기)
docs/db/   schema.sql (수신본) · proposed-alter.sql (제안)
```

`main`(읽기)과 `tourapi`(쓰기)는 `core.models`를 통해서만 만납니다. 홈 API는 `PLACE`
행이 공사 API에서 왔는지 수기 입력인지 알 필요가 없고, 수집기는 홈 응답 포맷을 알
필요가 없습니다.

`INSTALLED_APPS`에 admin·auth·sessions·contenttypes가 없습니다. `migrate`가 팀 공용
MySQL에 Django 자체 테이블을 만들면 안 되기 때문입니다.

설계 배경은 [docs/superpowers/specs/2026-07-25-main-home-api-design.md](../docs/superpowers/specs/2026-07-25-main-home-api-design.md)에 있습니다.
