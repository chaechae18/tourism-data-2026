# 팀 회신 2차 (복붙용)

> **[지난 기록] 협의가 끝났습니다.** 확정 스키마는 [schema-v2.sql](schema-v2.sql)
> 입니다. 최종 결론은 여기 제안한 `(SOURCE, CONTENT_ID)` 복합 UNIQUE 로 정해졌고,
> `CATEGORY` 삭제·`IS_DISPLAY`·`PLACE_I18N` 도 모두 반영됐습니다.

1차 요청([team-request.md](team-request.md))에 대한 팀 답변에 회신하는 내용입니다.

## 판단 요약 — 실제로 다퉈야 할 건 1개뿐

| 팀 의견 | 그냥 받으면? | 대응 |
| --- | --- | --- |
| UNIQUE 키 빼기 | **중복 적재가 돌아옴** | 소프트하게 대안 제시 |
| CATEGORY 삭제 | 오히려 이득 (코드가 줄어듦) | 수용 |
| PLACE 에 IS_DISPLAY | 이득 (검수 후 노출 가능) | 수용 |
| PLACE 에 CONTENT | 설명 칸이 2개가 됨 (경미) | 수용하되 한 줄 확인 |
| PLACE_I18N 추가 | 이득 | 수용 |
| FESTIVAL_I18N 추가 | **이미 있음 — 헛작업 방지 필요** | 사실만 알림 |

---

## 보낼 내용 (짧은 버전)

확인 감사합니다! 말씀하신 방향대로 진행하면 될 것 같고, 두 가지만 공유드릴게요.

**1. `FESTIVAL_I18N` 은 이미 DDL 에 있습니다.**
주신 DDL 에 이미 들어있어서 (`FESTIVAL_IDX`, `LANGUAGE_CODE`, `NAME`, `CONTENT`,
`LOCATION`) 지금 축제 다국어가 이걸로 동작하고 있습니다. 새로 만드실 필요는 없고
`PLACE_I18N` 만 추가하시면 됩니다. 기존 I18N 테이블들과 같은 형태면 될 것 같아요.

```sql
CREATE TABLE PLACE_I18N (
    IDX INT NOT NULL AUTO_INCREMENT COMMENT '번역 순번',
    PLACE_IDX INT NOT NULL COMMENT '관광지 순번',
    LANGUAGE_CODE VARCHAR(10) NOT NULL COMMENT '언어 코드(ko, en, ja, zh)',
    NAME VARCHAR(200) NOT NULL COMMENT '관광지명',
    TEXT TEXT DEFAULT NULL COMMENT '소개',
    ADDRESS VARCHAR(500) DEFAULT NULL COMMENT '주소',
    OPERATING_HOURS VARCHAR(300) DEFAULT NULL COMMENT '운영시간',
    ADMISSION_FEE VARCHAR(300) DEFAULT NULL COMMENT '입장료',
    CREATED_AT TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    UPDATED_AT TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    PRIMARY KEY (IDX),
    UNIQUE KEY UK_PLACE_I18N (PLACE_IDX, LANGUAGE_CODE)
) COMMENT='관광지 번역';
```

주소랑 입장료도 번역 대상에 넣어봤습니다. 외국인 이용자한테 "성인 6,000원"이나
한글 주소를 그대로 보여주긴 좀 그럴 것 같아서요. 불필요하면 빼셔도 됩니다.

그리고 `PLACE_I18N` 을 만들면 `CATEGORY_CONTENT_I18N` 과 역할이 겹칠 것 같은데
(컬럼 주석이 '관광지 순번'이라 원래 이 용도로 만드신 것 같아서요) 이건 편하신 대로
정리해주시면 따라가겠습니다.

**2. UNIQUE 키는 출처 컬럼이랑 묶는 건 어떨까요?**

다른 출처도 들어올 수 있다는 말씀 생각 못 했는데 짚어주셔서 감사합니다. 다만 UNIQUE
를 아예 빼면 동기화 돌릴 때마다 같은 관광지가 새로 쌓이는 문제가 다시 생겨서요.
출처 컬럼을 같이 두고 조합으로 거는 방법도 있을 것 같습니다.

```sql
SOURCE VARCHAR(20) DEFAULT NULL COMMENT '데이터 출처 (TOURAPI, MANUAL 등)',
CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '출처 시스템의 콘텐츠 ID',
UNIQUE KEY UK_PLACE_SOURCE_CONTENT (SOURCE, CONTENT_ID)
```

이러면 출처가 다르면 ID 가 같아도 각각 들어가고, 같은 출처 안에서만 중복이
막힙니다. 수기 등록은 둘 다 비워두면 되고요 (MySQL 은 UNIQUE 에서 NULL 을 중복으로
안 봐서 몇 건이든 들어갑니다).

번거로우시면 그냥 빼는 것도 괜찮습니다. 그 경우엔 제가 코드에서 중복 체크를
처리하겠습니다.

나머지(카테고리 테이블 정리, `IS_DISPLAY`, `CONTENT` 추가)는 말씀하신 대로
진행해주시면 됩니다. `CONTENT` 는 기존 `TEXT` 컬럼('소개')과 어떻게 나눠 쓰면 될지만
편하실 때 알려주세요. 공사 API 의 장소 소개문을 넣을 자리가 필요해서요.

감사합니다!

---

## 참고: 각 항목 상세 (보내는 내용 아님)

### CATEGORY 삭제를 수용하는 이유

공사 API 에 구분자가 있습니다. `contenttypeid` 로 내려옵니다.

| contenttypeid | 의미 |
| --- | --- |
| 12 | 관광지 |
| 14 | 문화시설 |
| 28 | 레포츠 |
| 38 | 쇼핑 |
| 39 | 음식점 |

39 를 FOOD, 나머지를 TOUR 로 매핑하면 됩니다. CATEGORY 가 사라지면 `CategoryResolver`
클래스와 "카테고리가 없으면 동기화 중단" 로직이 통째로 필요 없어집니다. 코드가
줄어드는 방향이라 반대할 이유가 없습니다.

`CATEGORY_DIV` 의 세부 분류(문화재/자연/한식/카페)가 사라지는 건 지금 프론트에서
카테고리를 쓰는 화면이 하나도 없어서 당장 손해가 없습니다. 나중에 필요해지면 그때
PLACE 에 컬럼을 하나 더 두면 됩니다.

### CONTENT 를 그냥 받아도 되는 이유

PLACE 에 이미 `TEXT TEXT '소개'` 가 있어서 설명 칸이 두 개가 됩니다. 다만 안 쓰는
컬럼이 하나 생기는 정도라 기능이 깨지지는 않습니다. 공사 API 의 `overview` 는 기존
`TEXT` 에 넣고, `CONTENT` 는 팀에서 용도를 정할 때까지 비워두면 됩니다.

### UNIQUE 를 빼도 코드로 버틸 수 있는 이유 (차선책)

동기화는 `update_or_create(content_id=...)` 로 도는데, 이건 SELECT 후 INSERT/UPDATE
라 DB 제약이 없어도 순차 실행에서는 동작합니다. 다만 두 가지가 취약해집니다.

- 동기화가 겹쳐 돌면 둘 다 SELECT 를 놓쳐서 중복 INSERT 가 납니다
- 이미 중복이 생긴 뒤에는 `MultipleObjectsReturned` 로 동기화가 멈춥니다

그래서 UNIQUE 가 없으면 코드에서 `filter().first()` 방식으로 바꾸고, 중복 감지 시
로그를 남기도록 방어해야 합니다. 가능한 일이지만 DB 가 막아주는 것보다 약합니다.
