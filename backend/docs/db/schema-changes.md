# DDL 변경 델타 및 스키마 변경 사항 (팀 공유용)

본 문서는 원본 `schema.sql` 대비 `schema-v2.sql` (및 `schema-v2-alter.sql`)에서 확정 변경된 DDL 델타 항목을 한눈에 볼 수 있도록 정리한 문서입니다.

---

## 1. 테이블별 변경 델타

### PLACE (관광지/맛집)
- **변경 사항**: 추가 6개 컬럼 / 삭제 1개 컬럼 / 추가 1개 제약 조건 / 추가 1개 인덱스

| 항목/컬럼명 | 변경 유형 | 내용 및 사유 |
| --- | --- | --- |
| `SOURCE` | `VARCHAR(20)` 추가 | 데이터 출처 구분 (`TOUR_API`, `GYEONGJU_CITY`, `MANUAL`) |
| `CONTENT_ID` | `VARCHAR(50)` 추가 | 출처 시스템의 고유 콘텐츠 ID (재동기화 시 중복 방지) |
| `TYPE` | `VARCHAR(20) NOT NULL DEFAULT 'TOUR'` 추가 | 삭제된 `CATEGORY` 테이블을 대체 (`TOUR` / `FOOD`) |
| `CONTENT` | `VARCHAR(600)` 추가 | 상세 내용/개요 |
| `IMG` | `VARCHAR(600)` 추가 | 대표 이미지 URL (TourAPI `firstimage` 매핑) |
| `IS_DISPLAY` | `TINYINT NOT NULL DEFAULT 1` 추가 | 수집된 행의 노출 여부 검수 플래그 |
| `CATEGORY_IDX` | **컬럼 삭제** | `CATEGORY` 테이블 폐기에 따라 제거 |
| `UNIQUE (SOURCE, CONTENT_ID)` | **제약조건 추가** | 출처별 고유 ID 복합 유니크 제약 |
| `KEY (IS_RECOMMENDED, IS_DISPLAY, VIEW_COUNT)` | **인덱스 추가** | 추천 관광지 및 인기순 조회 성능 최적화 인덱스 |

---

### FESTIVAL (축제/행사)
- **변경 사항**: 추가 2개 컬럼 / 추가 1개 제약 조건 / 추가 1개 인덱스

| 항목/컬럼명 | 변경 유형 | 내용 및 사유 |
| --- | --- | --- |
| `SOURCE` | `VARCHAR(20)` 추가 | 데이터 출처 구분 (`TOUR_API`, `GYEONGJU_CITY` 등) |
| `CONTENT_ID` | `VARCHAR(50)` 추가 | 출처 시스템의 고유 축제 ID |
| `UNIQUE (SOURCE, CONTENT_ID)` | **제약조건 추가** | 출처별 고유 ID 복합 유니크 제약 |
| `KEY (IS_TRASH, END_DATE)` | **인덱스 추가** | 현재 진행 중 및 예정 행사 조회 인덱스 |

---

### 테이블 단위 변경

| 테이블명 | 변경 구분 | 비고 |
| --- | --- | --- |
| `PLACE_I18N` | **신규 생성** | 관광지 다국어 번역 테이블 (`NAME`, `TEXT`, `CONTENT`, `ADDRESS`, `ADMISSION_FEE` 등) |
| `CATEGORY` | **테이블 삭제** | TourAPI `contenttypeid`(39=음식점, 나머지=관광지)로 대체 |
| `CATEGORY_CONTENT_I18N` | **미결 (확인 대기)** | `PLACE_I18N`과 역할이 중복되므로 팀 확인 대기 중 |

> [!NOTE]
> 전체 테이블 수는 **27개**로 유지됩니다 (`CATEGORY` 삭제 -1, `PLACE_I18N` 생성 +1).
> `schema-v2.sql`은 변경되는 3개 테이블(`PLACE`, `FESTIVAL`, `PLACE_I18N`)만 포함하고 있습니다.
> 운영 중인 DB에 반영할 때는 `schema-v2-alter.sql`을 사용해야 데이터 손실 없이 인덱스 및 컬럼이 변경됩니다.
