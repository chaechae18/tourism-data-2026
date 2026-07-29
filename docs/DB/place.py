import os
import time
from pathlib import Path

import pymysql
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# =========================
# 환경 변수
# =========================

SERVICE_KEY = os.getenv("SERVICE_KEY")

DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

MOBILE_OS = os.getenv("MOBILE_OS", "ETC")
MOBILE_APP = os.getenv("MOBILE_APP", "MyDG")

BASE_URL = "https://apis.data.go.kr/B551011/KorService2"

# 수집 대상 지역 / 페이지 설정
AREA_CODE = 35        # 경상북도
SIGUNGU_CODE = 2      # 경주시
NUM_OF_ROWS = 100     # 한 페이지당 조회 건수
REQUEST_DELAY = 0.2   # API 호출 사이 대기(초) - 호출 제한 대비

# CATEGORY_IDX 매핑
CATEGORY_MAP = {
    "12": 1,  # 관광지
    "14": 2,  # 문화시설
    "15": 3,  # 축제
    "28": 4,  # 레포츠
    "32": 5,  # 숙박
    "38": 6,  # 쇼핑
    "39": 7,  # 음식점
    "25": 8,  # 여행코스
}


# api 요청 시 재시도 로직
def get_json(endpoint, params, retries=5):
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(
                f"{BASE_URL}/{endpoint}",
                params=params,
                timeout=20,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt == retries:
                raise
            wait = 2 * attempt
            print(f"  재시도 {attempt}/{retries} ({endpoint}) - {e} → {wait}초 대기")
            time.sleep(wait)


# items가 dict인지 list인지 확인하고 첫 번째 item을 반환하는 헬퍼 함수
def first_item(payload):
    items = (
        payload.get("response", {})
        .get("body", {})
        .get("items", {})
    )
    if not isinstance(items, dict):
        return {}
    item = items.get("item", {})
    if isinstance(item, list):
        return item[0] if item else {}
    if isinstance(item, dict):
        return item
    return {}


# 지역 기반 목록 API 호출 (공통 파라미터 자동 포함)
def fetch_area_list(page):
    params = {
        "serviceKey": SERVICE_KEY,
        "MobileOS": MOBILE_OS,
        "MobileApp": MOBILE_APP,
        "_type": "json",
        "pageNo": page,
        "numOfRows": NUM_OF_ROWS,
        "areaCode": AREA_CODE,
        "sigunguCode": SIGUNGU_CODE,
    }
    data = get_json("areaBasedList2", params)

    body_items = (
        data.get("response", {})
        .get("body", {})
        .get("items", {})
    )
    # 마지막 페이지 다음엔 items가 빈 문자열("")로 오기도 해서 방어
    items = body_items.get("item", []) if isinstance(body_items, dict) else []
    if isinstance(items, dict):  # 결과가 1건이면 리스트가 아니라 dict로 옴
        items = [items]
    return items


# 상세 공통정보(제목/주소/좌표/개요) 조회
def fetch_common(content_id):
    return first_item(get_json(
        "detailCommon2",
        {
            "serviceKey": SERVICE_KEY,
            "MobileOS": MOBILE_OS,
            "MobileApp": MOBILE_APP,
            "_type": "json",
            "contentId": content_id,
        },
    ))


# 상세 소개정보(운영시간/요금/주차) 조회
def fetch_intro(content_id, content_type):
    return first_item(get_json(
        "detailIntro2",
        {
            "serviceKey": SERVICE_KEY,
            "MobileOS": MOBILE_OS,
            "MobileApp": MOBILE_APP,
            "_type": "json",
            "contentId": content_id,
            "contentTypeId": content_type,
        },
    ))


# mysql 연결
conn = pymysql.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD or "",
    database=DB_NAME,
    charset="utf8mb4",
)
cursor = conn.cursor()

# 기존 PLACE 테이블의 (이름, 주소) 쌍을 가져와서 중복 방지용으로 저장
cursor.execute("SELECT NAME, ADDRESS FROM PLACE")
existing = set(cursor.fetchall())

# INSERT 쿼리
INSERT_SQL = """
INSERT INTO PLACE
(
    CATEGORY_IDX,
    NAME,
    TEXT,
    ADDRESS,
    LATITUDE,
    LONGITUDE,
    OPERATING_HOURS,
    ADMISSION_FEE,
    PARKING
)
VALUES
(
    %s,%s,%s,%s,%s,%s,%s,%s,%s
)
"""

try:
    page = 1

    while True:

        # 페이지 목록 조회
        items = fetch_area_list(page)
        if not items:
            break

        for item in items:

            try:
                content_id = item["contentid"]
                content_type = str(item["contenttypeid"])

                # 카테고리 필터 
                category_idx = CATEGORY_MAP.get(content_type)
                if category_idx is None:
                    print(f"SKIP(카테고리) : {content_type}")
                    continue

                # 상세 공통정보 조회
                common_item = fetch_common(content_id)
                time.sleep(REQUEST_DELAY)

                name = common_item.get("title")
                address = common_item.get("addr1")

                # 중복 방지 - 소개정보 호출 전에 확인해 불필요한 호출 방지
                if (name, address) in existing:
                    print(f"SKIP(중복) : {name}")
                    continue

                # 상세 소개정보 조회
                intro_item = fetch_intro(content_id, content_type)
                time.sleep(REQUEST_DELAY)

                # 운영시간 - 타입별 필드명이 달라 폴백으로 조회
                operating_hours = (
                    intro_item.get("opentime")
                    or intro_item.get("opentimefood")
                    or intro_item.get("opentimeculture")
                    or intro_item.get("opentimeleports")
                )

                # 입장/이용요금
                admission_fee = (
                    intro_item.get("usefee")
                    or intro_item.get("usefeeculture")
                    or intro_item.get("usefeeleports")
                    or intro_item.get("usefeefood")
                )

                # 주차정보
                parking = (
                    intro_item.get("parking")
                    or intro_item.get("parkingculture")
                    or intro_item.get("parkingleports")
                    or intro_item.get("parkingshopping")
                    or intro_item.get("parkingfood")
                )

                # DB 저장
                cursor.execute(
                    INSERT_SQL,
                    (
                        category_idx,
                        name,
                        common_item.get("overview"),
                        address,
                        common_item.get("mapy"),  # 위도
                        common_item.get("mapx"),  # 경도
                        operating_hours,
                        admission_fee,
                        parking,
                    ),
                )
                existing.add((name, address))
                print(f"INSERT : {name}")

            # 항목 단위 오류는 로깅만 하고 다음 항목으로 진행
            except Exception as e:
                print(f"ERROR : {item.get('contentid')} - {e}")
                continue

        # 페이지 단위로 커밋
        conn.commit()
        page += 1

finally:
    cursor.close()
    conn.close()

print("완료")
