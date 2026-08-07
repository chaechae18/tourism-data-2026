from dataclasses import dataclass


# 분류체계(lclsSystm) 소분류 코드. sync_tourapi 가 PLACE.CATEGORY_CODE 에 넣는 값
PALACE = "HS010100"  # 고궁 
TOMB = "HS010800"  # 고분, 능
SHRINE = "HS010900"  # 사당
HISTORIC_SITE = "HS010700"  # 사적지
BUDDHA_STATUE = "HS020300"  # 불상
KOREAN_RESTAURANT = "FD010100"  # 한식 > 관광식당

# 한식 62곳 중 고기 -> 하드코딩의 경우 변경 가능성이 있으므로, 메뉴 키워드로 검색하는 방식으로 변경
MEAT_KEYWORDS = (
    "갈비", "한우", "등심", "안창", "살치", "부채살", "삼겹", "차돌", "채끝",
    "구이", "육회", "불고기", "수육", "곰탕", "국밥", "한정식",
)


@dataclass(frozen=True)
class Slot:

    time_slot: str  # 오전 / 점심 / 오후 / 저녁
    category_codes: tuple[str, ...]
    menu_keywords: tuple[str, ...] = ()


@dataclass(frozen=True)
class Persona:
    key: str
    name: str
    slots: tuple[Slot, ...]
    # 차, 대중교통 기준
    radius_km: float = 12.0
    max_total_km: float = 40.0
    choice_pool: int = 5


KING = Persona(
    key="king",
    name="왕",
    slots=(
        Slot("오전", (PALACE,)),
        Slot("오전", (TOMB,)),
        Slot("점심", (KOREAN_RESTAURANT,), MEAT_KEYWORDS),
        Slot("오후", (TOMB, SHRINE)),
        Slot("오후", (HISTORIC_SITE, BUDDHA_STATUE)),
        Slot("저녁", (KOREAN_RESTAURANT,), MEAT_KEYWORDS),
    ),
)

PERSONAS = {persona.key: persona for persona in (KING,)}
