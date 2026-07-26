-- 수정 DDL v2 — 이미 만들어진 DB 용 (데이터 보존)
--
-- proposed-schema-v2.sql 과 결과는 같지만, 이쪽은 기존 데이터를 지우지 않습니다.
-- 아직 DB 를 안 만드셨으면 proposed-schema-v2.sql 로 새로 구축하는 게 간단합니다.
--
-- 로컬 MySQL 9.6 에서 데이터를 넣은 상태로 실행 확인했습니다.

-- ---------------------------------------------------------------------------
-- PLACE
-- ---------------------------------------------------------------------------
ALTER TABLE PLACE
    ADD COLUMN SOURCE VARCHAR(20) DEFAULT NULL COMMENT '데이터 출처 (TOURAPI, MANUAL 등)' AFTER IDX,
    ADD COLUMN CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '출처 시스템의 콘텐츠 ID' AFTER SOURCE,
    ADD COLUMN TYPE VARCHAR(20) NOT NULL DEFAULT 'TOUR' COMMENT '구분 (TOUR: 관광지, FOOD: 맛집)' AFTER CONTENT_ID,
    ADD COLUMN CONTENT VARCHAR(600) DEFAULT NULL COMMENT '설명' AFTER TEXT,
    ADD COLUMN IMG VARCHAR(600) DEFAULT NULL COMMENT '대표 이미지 URL' AFTER CONTENT,
    ADD COLUMN IS_DISPLAY TINYINT NOT NULL DEFAULT 1 COMMENT '전시여부 (0: 비노출, 1: 노출)' AFTER PARKING,
    ADD UNIQUE KEY UK_PLACE_SOURCE_CONTENT (SOURCE, CONTENT_ID),
    ADD KEY IX_PLACE_RECOMMENDED (IS_RECOMMENDED, IS_DISPLAY, VIEW_COUNT);

-- 기존 CATEGORY_IDX 로 분류해 둔 데이터가 있다면 먼저 TYPE 으로 옮긴 뒤 컬럼을
-- 지우세요. 데이터가 없다면 아래 UPDATE 는 건너뛰어도 됩니다.
-- UPDATE PLACE p JOIN CATEGORY c ON c.IDX = p.CATEGORY_IDX SET p.TYPE = c.TYPE;

ALTER TABLE PLACE DROP COLUMN CATEGORY_IDX;

-- ---------------------------------------------------------------------------
-- FESTIVAL
-- ---------------------------------------------------------------------------
ALTER TABLE FESTIVAL
    ADD COLUMN SOURCE VARCHAR(20) DEFAULT NULL COMMENT '데이터 출처 (TOURAPI, MANUAL 등)' AFTER IDX,
    ADD COLUMN CONTENT_ID VARCHAR(50) DEFAULT NULL COMMENT '출처 시스템의 콘텐츠 ID' AFTER SOURCE,
    ADD UNIQUE KEY UK_FESTIVAL_SOURCE_CONTENT (SOURCE, CONTENT_ID),
    ADD KEY IX_FESTIVAL_PERIOD (IS_TRASH, END_DATE);

-- ---------------------------------------------------------------------------
-- PLACE_I18N (신규)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- CATEGORY 정리
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS CATEGORY;

-- CATEGORY_CONTENT_I18N 은 PLACE_I18N 과 역할이 겹칩니다. 확인 후 결정 부탁드립니다.
-- DROP TABLE IF EXISTS CATEGORY_CONTENT_I18N;
