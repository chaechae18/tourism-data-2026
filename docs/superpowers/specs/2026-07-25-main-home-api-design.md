# 메인(홈) 화면 API 설계

작성일: 2026-07-25
담당 범위: 홈 화면 조회 API 4개 + 한국관광공사 TourAPI 수집 경로

## 1. 배경

이 저장소에는 지금까지 `frontend/`(Next.js 15 + React 19)만 있었고 백엔드가 없었다.
루트 README에 `backend/ API 서버 추가 예정`으로만 적혀 있는 상태였다.

DB 스키마는 팀에서 확정한 MySQL DDL이 별도로 존재한다. 이 DDL은 27개 테이블을 담고
있으며 여러 팀원이 나눠 맡는다. 이 문서는 그중 홈 화면이 쓰는 7개 테이블만 다룬다.

프로젝트 요건상 한국관광공사 OpenAPI(TourAPI) 활용이 필수다. 공사 API에서 받은
관광지·축제 데이터를 `PLACE`, `FESTIVAL` 테이블에 적재하고, 홈 API는 그 테이블을
읽는다.

## 2. 스택

- Django 5 + Django REST Framework
- MySQL (스키마 소유권은 팀 DDL에 있음)
- 프론트엔드는 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`으로 이미 설정되어 있어
  그대로 붙는다

## 3. 디렉터리 구조

```text
backend/
  manage.py  requirements.txt  .env.example  README.md
  config/          settings.py · urls.py · wsgi.py · test_runner.py
  core/            models.py   # 팀 DDL 미러링 (managed=False)
  main/            i18n.py · serializers.py · views.py · urls.py · tests/
  tourapi/         client.py · mappers.py · sync.py · management/commands/
  docs/db/         schema.sql · proposed-alter.sql
```

`tourapi`(쓰기)와 `main`(읽기)을 별도 앱으로 나눈다. 두 앱은 `core.models`를 통해서만
만난다. 홈 API는 `PLACE` 행이 공사 API에서 왔는지 수기 입력인지 알 필요가 없고,
수집기는 홈 응답 포맷을 알 필요가 없다.

## 4. 모델

`core/models.py`에 7개 모델을 둔다. 전부 `managed = False`이며 `db_table`로 대문자
테이블명을, `db_column`으로 대문자 컬럼명을 지정한다. Django는 이 테이블에 대해
migration을 만들지 않는다 — 스키마 변경은 팀 DDL을 통해서만 일어난다.

| 테이블 | 모델 | 홈 API에서의 역할 |
| --- | --- | --- |
| `MAIN_BANNER` | `MainBanner` | 배너 |
| `POPUP` | `Popup` | 팝업 원본 |
| `POPUP_I18N` | `PopupI18n` | 팝업 번역 |
| `FESTIVAL` | `Festival` | 축제 원본 |
| `FESTIVAL_I18N` | `FestivalI18n` | 축제 번역 |
| `PLACE` | `Place` | 관광지 원본 (`TYPE`으로 관광/맛집 구분) |
| `PLACE_I18N` | `PlaceI18n` | 관광지 번역 (`NAME`, `TEXT`, `CONTENT`, `ADDRESS`, `ADMISSION_FEE`) |


`TINYINT` 플래그 중 값이 0/1인 것(`IS_DISPLAY`, `IS_TRASH`, `IS_RECOMMENDED`)은
`BooleanField`로 매핑한다. 쿼리가 `is_display=True`로 읽히고, MySQL의 tinyint와
왕복이 정확하다. 값이 0/1이 아닌 `TINYINT`(예: `USERS.STATUS`)는 이 범위에 없다.

## 5. 엔드포인트

응답은 전부 envelope 없는 순수 JSON 배열이다. 인증은 없다(홈 화면은 비로그인 노출).

### GET /api/main/banners

| 항목 | 값 |
| --- | --- |
| 필터 | `IS_TRASH=0`, `IS_DISPLAY=1`, 현재시각이 기간 내 |
| 정렬 | `SORT` asc, `IDX` asc |
| 필드 | `img`, `title`, `sub_title`, `link` |

`MAIN_BANNER_I18N`이 DDL에 없으므로 `?lang=`을 받되 무시하고 원본 컬럼을 낸다.

### GET /api/main/popup

| 항목 | 값 |
| --- | --- |
| 필터 | `IS_DISPLAY=1`, 현재시각이 기간 내 |
| 정렬 | `IDX` desc |
| 필드 | `title`, `content`(번역), `img`, `link`(원본) |

`POPUP`에는 `IS_TRASH` 컬럼이 없다. 경로는 단수형이지만 기간이 겹치는 팝업이 여러 개일
수 있으므로 배열을 반환한다.

### GET /api/main/festivals

| 항목 | 값 |
| --- | --- |
| 필터 | `IS_TRASH=0`, `END_DATE`가 아직 안 지남 |
| 정렬 | `START_DATE` asc, `IDX` asc |
| 필드 | `name`, `content`, `location`(번역), `start_date`, `end_date`, `img`, `url`(원본) |

### GET /api/main/places/recommended

| 항목 | 값 |
| --- | --- |
| 필터 | `IS_RECOMMENDED=1` |
| 정렬 | `VIEW_COUNT` desc, `IDX` asc |
| 필드 | `name`, `text`, `address`, `latitude`, `longitude`, `admission_fee` |

`PLACE_I18N`을 조인하여 `?lang=` 파라미터에 따라 다국어 번역(`name`, `text`, `content`, `address`, `admission_fee`)을 제공한다. `LATITUDE`/`LONGITUDE`는 DB에서
`VARCHAR(50)`이지만 프론트 지도가 숫자를 기대하므로 응답에서 float으로 변환하고,
파싱 실패 시 `null`을 낸다.

`CATEGORY_CONTENT_I18N` 테이블은 `PLACE_I18N`과 역할이 중복되어 미결 상태(확인 대기 중)이다.


## 6. 기간 판정

DDL상 `START_DATE`/`END_DATE`가 전부 nullable이다. NULL은 "제한 없음"으로 본다.

```sql
(START_DATE IS NULL OR START_DATE <= now) AND (END_DATE IS NULL OR END_DATE >= now)
```

`now`는 `TIME_ZONE = 'Asia/Seoul'`, `USE_TZ = True` 기준의 `timezone.now()`다.

## 7. 다국어 처리

언어 코드는 `?lang=` → `Accept-Language` 헤더 → `ko` 순으로 해석한다.
지원 코드는 `ko`, `en`, `ja`, `zh`이며, 모르는 값이 오면 400을 내지 않고 조용히 `ko`로
떨어진다. 홈 화면이 언어 코드 오타 하나로 비면 안 되기 때문이다.

번역 조회는 **요청 언어 → ko 번역 → 원본 테이블 컬럼**의 3단계 폴백이다. 3단계가
필요한 이유는 `POPUP.TITLE`, `FESTIVAL.NAME` 같은 한국어 원문이 원본 테이블에 이미
있어서, `*_I18N`에 ko 행이 없어도 빈 값을 낼 이유가 없기 때문이다.

폴백은 목록당 최대 2회 쿼리로 끝낸다. 먼저 요청 언어로 한 번 조회하고, 번역이 빠진
IDX만 모아 ko로 한 번 더 조회해 파이썬에서 병합한다. 행마다 쿼리하지 않으므로 N+1이
생기지 않는다.

## 8. TourAPI 수집

`tourapi` 앱은 공사 API를 호출해 `PLACE`, `FESTIVAL`에 upsert한다.

- `client.py` — 인증키 주입, 페이징, 재시도, 공사 측 에러코드 해석
- `mappers.py` — 공사 응답 필드 → DB 컬럼 매핑 (순수 함수, HTTP 없음)
- `sync.py` — upsert 트랜잭션
- `management/commands/sync_places.py`, `sync_festivals.py` — 실행 진입점

`mappers.py`를 HTTP에서 떼어놓는 이유는 필드 매핑이 가장 자주 틀리고 가장 자주 바뀌는
부분이기 때문이다. 네트워크 없이 고정 샘플 응답으로 테스트한다.

주의할 매핑: 공사 API의 `mapx`가 경도, `mapy`가 위도다. 순서가 뒤집혀 있다.

### 확정된 스키마 변경 사항 (schema-v2.sql)

팀 협의를 거쳐 `docs/db/schema-v2.sql` (기존 DB 변경용 `schema-v2-alter.sql`)로 스키마가 확정되었다. 상세 변경 델타는 `docs/db/schema-changes.md`를 참조한다.

1. **`PLACE` / `FESTIVAL`에 `(SOURCE, CONTENT_ID)` 복합 UNIQUE 제약 및 컬럼 추가**: 출처별 고유 ID를 관리하여 재동기화 시 중복 방지 및 다중 수집원 공존 지원.
2. **`PLACE`에 `IMG`, `TYPE`, `IS_DISPLAY` 컬럼 추가**: TourAPI `firstimage` 매핑, 음식/관광 구분, 노출 검수 플래그.
3. **`PLACE_I18N` 신규 생성 및 `CATEGORY` 삭제**.


## 9. 테스트

`managed = False` 모델은 Django가 테스트 DB에 테이블을 만들어주지 않는다.
`config/test_runner.py`에서 테스트 시작 시에만 `managed`를 켜는 커스텀 러너를 쓴다.
테스트는 SQLite로 돌아가므로 로컬에 MySQL이 없어도 `manage.py test`가 통과한다.

커버할 것:

- 엔드포인트별 필터 조건 (삭제/미노출/기간 밖 행이 빠지는지)
- 정렬 순서
- 언어 폴백 3단계 전부
- `lang` 미지정, 미지원 코드
- 좌표 문자열 → float 변환과 파싱 실패
- TourAPI 매퍼의 필드 매핑 (`mapx`/`mapy` 뒤집힘 포함)

## 10. 이번 범위에서 제외

- 홈 외 화면의 API (팀원 담당)
- 인증/인가 — 홈 4개는 공개 엔드포인트다
- 관리자 화면 — `django.contrib.admin`을 쓰지 않는다. `INSTALLED_APPS`를 최소로 유지해
  `migrate`가 팀 MySQL에 `auth_*`, `django_content_type` 테이블을 만들지 않게 한다
- 캐싱 — 트래픽 특성을 모르는 상태에서 넣지 않는다
