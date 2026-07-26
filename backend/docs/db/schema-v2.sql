-- 수정 DDL v2 — 팀 확정본 (2026-07-26)
--
-- 협의 결과 (한솔/yeon_y_ 확인 완료):
--   · PLACE 는 공통 장소 테이블로 유지하고, SOURCE 로 출처를 구분한다
--     (TOUR_API, 이후 다른 출처가 생기면 값만 추가)
--   · 적재는 INSERT ... ON DUPLICATE KEY UPDATE (upsert). MySQL 에는 MERGE INTO 가
--     없고, 이 구문은 중복 판정에 UNIQUE 키가 필요하므로 (SOURCE, CONTENT_ID)
--     복합 UNIQUE 를 둔다
--
-- 이하 1차 협의 결과:
--   · CATEGORY 테이블 삭제, PLACE 에 TOUR/FOOD 구분 컬럼(TYPE) 추가
--   · PLACE 에 CONTENT, IS_DISPLAY, IMG 추가
--   · PLACE / FESTIVAL 에 공사 콘텐츠 ID 저장 컬럼 추가
--   · PLACE_I18N 신규 (FESTIVAL_I18N 은 기존 DDL 에 이미 있음)
--
-- 변경되는 테이블만 담았습니다. 나머지 23개 테이블은 기존 DDL 그대로입니다.
-- 로컬 MySQL 9.6 에서 실행 확인했습니다.
--
-- ⚠️  이 파일은 "DDL 원본 파일의 해당 CREATE TABLE 을 갈아끼우는" 용도입니다.
--     PLACE / FESTIVAL 을 DROP 후 재생성하므로 데이터가 있는 DB 에 그대로 돌리면
--     안 됩니다. 이미 데이터가 들어간 DB 는 proposed-alter-v2.sql 을 쓰세요.

-- ---------------------------------------------------------------------------
-- 1. CATEGORY 삭제
-- ---------------------------------------------------------------------------
-- 공사 API 가 contenttypeid 로 구분자를 주기 때문에(39=음식점, 그 외=관광지)
-- 별도 카테고리 마스터 없이 PLACE.TYPE 으로 구분합니다.
DROP TABLE IF EXISTS CATEGORY;

-- CATEGORY_CONTENT_I18N 은 PLACE_I18N 과 역할이 겹칩니다.
-- (컬럼 주석이 'CATEGORY_CONTENT_IDX = 관광지 순번' 이라 원래 PLACE 번역용으로
--  보입니다.) 확인 후 삭제 여부 결정 부탁드립니다.
-- DROP TABLE IF EXISTS CATEGORY_CONTENT_I18N;

-- ---------------------------------------------------------------------------
-- 2. PLACE — 관광지/맛집 리스트
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS PLACE;
CREATE TABLE PLACE (
    IDX INT NOT NULL AUTO_INCREMENT COMMENT '인덱스',
    SOURCE VARCHAR(20) DEFAULT NULL COMMENT '데이터 출처 (TOURAPI, MANUAL 등)',              -- 추가
    CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '출처 시스템의 콘텐츠 ID',                   -- 추가
    TYPE VARCHAR(20) NOT NULL DEFAULT 'TOUR' COMMENT '구분 (TOUR: 관광지, FOOD: 맛집)',      -- 추가 (기존 CATEGORY_IDX 대체)
    NAME VARCHAR(200) DEFAULT NULL COMMENT '관광지명',
    TEXT TEXT DEFAULT NULL COMMENT '소개',
    CONTENT VARCHAR(600) DEFAULT NULL COMMENT '설명',                                        -- 추가
    IMG VARCHAR(600) DEFAULT NULL COMMENT '대표 이미지 URL',                                 -- 추가
    ADDRESS VARCHAR(500) DEFAULT NULL COMMENT '주소',
    LATITUDE VARCHAR(50) DEFAULT NULL COMMENT '위도',
    LONGITUDE VARCHAR(50) DEFAULT NULL COMMENT '경도',
    OPERATING_HOURS VARCHAR(300) DEFAULT NULL COMMENT '운영시간',
    ADMISSION_FEE VARCHAR(300) DEFAULT NULL COMMENT '입장료',
    PARKING VARCHAR(300) DEFAULT NULL COMMENT '주차여부',
    IS_DISPLAY TINYINT NOT NULL DEFAULT 1 COMMENT '전시여부 (0: 비노출, 1: 노출)',           -- 추가
    IS_RECOMMENDED TINYINT NOT NULL DEFAULT 0 COMMENT '메인추천여부 (0: 미추천, 1: 추천)',
    VIEW_COUNT INT NOT NULL DEFAULT 0 COMMENT '조회수',
    REG_DATE TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록일',
    PRIMARY KEY (IDX),
    -- 같은 출처 안에서만 중복을 막습니다. 출처가 다르면 ID 가 같아도 각각 들어가고,
    -- 수기 등록(두 컬럼 모두 NULL)은 MySQL 이 NULL 을 중복으로 보지 않아 몇 건이든
    -- 공존합니다. 이 방식이 부담스러우시면 아래 한 줄만 지우면 됩니다.
    UNIQUE KEY UK_PLACE_SOURCE_CONTENT (SOURCE, CONTENT_ID),
    KEY IX_PLACE_RECOMMENDED (IS_RECOMMENDED, IS_DISPLAY, VIEW_COUNT)
) COMMENT='관광지/맛집 리스트';

-- ---------------------------------------------------------------------------
-- 3. FESTIVAL — 축제
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS FESTIVAL;
CREATE TABLE FESTIVAL (
    IDX INT NOT NULL AUTO_INCREMENT COMMENT '인덱스',
    SOURCE VARCHAR(20) DEFAULT NULL COMMENT '데이터 출처 (TOURAPI, MANUAL 등)',              -- 추가
    CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '출처 시스템의 콘텐츠 ID',                   -- 추가
    NAME VARCHAR(300) DEFAULT NULL COMMENT '페스티벌 제목',
    CONTENT VARCHAR(700) DEFAULT NULL COMMENT '내용',
    LOCATION VARCHAR(500) DEFAULT NULL COMMENT '장소',
    START_DATE DATETIME DEFAULT NULL COMMENT '시작날짜',
    IMG VARCHAR(600) DEFAULT NULL COMMENT '이미지',
    URL VARCHAR(600) DEFAULT NULL COMMENT 'URL',
    IS_TRASH TINYINT NOT NULL DEFAULT 0 COMMENT '삭제여부 (0: 사용, 1: 삭제)',
    END_DATE DATETIME DEFAULT NULL COMMENT '끝나는날짜',
    PRIMARY KEY (IDX),
    UNIQUE KEY UK_FESTIVAL_SOURCE_CONTENT (SOURCE, CONTENT_ID),
    KEY IX_FESTIVAL_PERIOD (IS_TRASH, END_DATE)
) COMMENT='축제';

-- ---------------------------------------------------------------------------
-- 4. PLACE_I18N — 관광지 번역 (신규)
-- ---------------------------------------------------------------------------
-- 기존 POPUP_I18N / FESTIVAL_I18N 과 같은 형태입니다.
-- ADDRESS 와 ADMISSION_FEE 도 번역 대상에 넣었습니다. 외국인 이용자에게
-- "성인 6,000원" 이나 한글 주소를 그대로 보여주기는 어려워서입니다.
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
