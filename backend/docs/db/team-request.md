# 팀에 보낼 스키마 변경 요청 (복붙용)

> **[지난 기록] 협의가 끝났습니다.** 확정 스키마는 [schema-v2.sql](schema-v2.sql)
> 입니다. 이 문서는 어떤 논의를 거쳐 그렇게 됐는지 남겨두는 용도이며, 여기 적힌
> 요청(특히 `CATEGORY` 기본 데이터)은 더 이상 유효하지 않습니다.

기술 배경은 [proposed-alter.sql](proposed-alter.sql), DDL 파일을 직접 고칠 경우의
최종 형태는 [proposed-create-table.sql](proposed-create-table.sql) 을 보세요.

아래 `---` 부터가 그대로 팀 채널에 붙여 넣는 본문입니다.

## 보내기 전 사전 검증 결과

로컬 MySQL 9.6 에 팀 DDL 전체(27개 테이블)를 올리고 실제로 확인한 내용입니다.

| 확인 항목 | 결과 |
| --- | --- |
| ALTER 문법 유효성 | 통과 (`AFTER TEXT` 포함) |
| 기존 데이터 보존 | ALTER 전 입력한 행이 값 그대로 보존됨 |
| NULL 여러 건 공존 | UNIQUE 걸린 상태에서 NULL 4건 정상 삽입 |
| 중복 차단 동작 | 같은 CONTENT_ID 두 번째 삽입이 `ERROR 1062` 로 차단됨 |
| 되돌리기 | `DROP COLUMN` 후에도 기존 데이터 보존 |
| ALTER 방식 == CREATE 교체 방식 | 두 방식의 최종 컬럼 구조 완전 일치 |

`PLACE` 에는 `CATEGORY` 를 향한 FK 제약이 없다는 것도 확인했습니다. 그래서 아래
본문에서는 "카테고리가 없으면 저장이 안 된다"가 아니라 "동기화 코드가 실존하는
카테고리를 찾아 연결한다"로 이유를 적었습니다.

---

안녕하세요!

메인(홈) 화면 API 작업하면서 한국관광공사 OpenAPI를 `PLACE`, `FESTIVAL`에 동기화하는
기능을 붙이고 있는데, 작업하다 보니 DDL에서 조금 수정하면 좋을 것 같은 부분이 있어서
공유드립니다.

### 1. `CONTENT_ID` 컬럼 추가

공사 API에서 관광지나 축제마다 `contentid`라는 고유번호를 내려주는데, 현재 테이블에는
이 값을 저장할 컬럼이 없습니다.

그래서 동기화를 다시 돌릴 때 기존 데이터인지 새 데이터인지 구분이 어려워서 같은
관광지가 계속 새로 저장될 수 있을 것 같습니다. 이름이나 주소로 비교하는 방법도
생각해봤는데, 공사에서 명칭이나 주소 표기를 수정하면 또 중복이 생길 가능성이 있어서
`contentid`를 저장하는 게 가장 안전할 것 같습니다.

### 2. `PLACE`에 이미지 컬럼 추가

공사 API에서 대표 이미지 URL(`firstimage`)도 같이 내려주는데 `PLACE`에는 저장할
컬럼이 없어서 관광지 이미지를 넣지 못하는 상태입니다.

`FESTIVAL`에는 이미 `IMG` 컬럼이 있어서 관광지만 하나 추가하면 될 것 같습니다.

그래서 아래처럼 DDL 수정해도 괜찮을까요?

```sql
ALTER TABLE PLACE
    ADD COLUMN CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '한국관광공사 콘텐츠 ID' AFTER IDX,
    ADD COLUMN IMG VARCHAR(600) DEFAULT NULL COMMENT '대표 이미지 URL' AFTER TEXT,
    ADD UNIQUE KEY UK_PLACE_CONTENT_ID (CONTENT_ID);

ALTER TABLE FESTIVAL
    ADD COLUMN CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '한국관광공사 콘텐츠 ID' AFTER IDX,
    ADD UNIQUE KEY UK_FESTIVAL_CONTENT_ID (CONTENT_ID);
```

기존 컬럼은 수정하지 않고 추가만 하는 내용이고, 모두 NULL 허용이라 기존 기능에는
영향이 없을 것 같습니다. 로컬에 DDL 올려서 미리 돌려봤는데 기존에 넣어둔 데이터도
그대로 유지되고, 수기로 등록해서 `CONTENT_ID`가 비어 있는 행도 여러 건 공존하는 걸
확인했습니다. 혹시 문제가 생기면 컬럼만 다시 삭제하면 되고 그때도 데이터는 남습니다.

제가 맡은 홈 조회 API 4개는 이 컬럼들을 읽지 않아서 적용 전이든 후든 동일하게
동작합니다. 공사 API 동기화 기능만 이 변경을 기다리고 있는 상태입니다.

그리고 같이 확인 부탁드리고 싶은 게 두 가지 있습니다.

1. `CATEGORY` 테이블에 기본 데이터(`TYPE='TOUR'`, `TYPE='FOOD'`) 정도만 미리
   넣어주실 수 있을까요? `PLACE.CATEGORY_IDX`가 NOT NULL이라 값은 반드시 들어가야
   하는데, 동기화 코드에서 실제 존재하는 카테고리를 찾아 연결하도록 해두었습니다.
   아무 숫자나 넣어도 DB는 받아주지만(`PLACE`에 FK 제약은 없더라구요) 어느 카테고리도
   가리키지 않는 데이터가 쌓일 것 같아서요.

2. `CATEGORY_CONTENT_I18N`이 `PLACE` 번역용 테이블이 맞을까요? 컬럼 설명은 그렇게
   보이는데 테이블명이 `CATEGORY_`로 시작해서 확신이 안 서서요. 맞다면 추천 관광지
   API에도 다국어를 붙여보려고 합니다.

확인 부탁드립니다. 감사합니다!
