from dataclasses import dataclass


# 신라 사람 여섯. key 는 프론트 RoleSelect.jsx 의 role.key 와 맞춘다.
# guide 는 LLM 채점기에게 "이 인물이 어떤 곳을 좋아하는지" 알려 주는 설명이다.
# 장소 분류코드를 여기에 나열하지 않는다. 어떤 장소가 어울리는지는 채점 결과로 정해진다.
@dataclass(frozen=True)
class PersonaProfile:
    key: str
    name: str
    guide: str


# 장소를 나열하지 않고 인물의 성격으로 적는다. 목록으로 적으면 채점기가
# "목록에 있나 없나"로만 판단해서 점수가 0 과 5 로 갈린다.
PERSONA_PROFILES = (
    PersonaProfile(
        "king", "왕",
        "신라를 다스린 임금. 왕실의 자취와 선왕들의 능을 살피고, 나라의 큰 자리에 관심이 있다. "
        "격식 있는 상차림과 고기를 즐긴다.",
    ),
    PersonaProfile(
        "scholar", "학자",
        "글과 학문으로 사는 사람. 옛 기록과 비석, 학문을 가르치던 자리, 유물을 모아 둔 곳에 마음이 간다. "
        "거닐며 생각하기 좋은 옛터를 좋아하고, 소박한 전통 상차림을 든다.",
    ),
    PersonaProfile(
        "monk", "스님",
        "절에서 수행하는 승려. 불상과 탑, 산속 암자처럼 마음을 다스릴 수 있는 자리를 찾는다. "
        "고기를 피하고 두부와 산채 같은 담백한 음식을 든다.",
    ),
    PersonaProfile(
        "hwarang", "화랑",
        "몸과 마음을 닦는 젊은 무사. 산과 계곡, 성곽처럼 몸을 쓰는 곳과 장군·전장의 흔적에 끌린다. "
        "무예나 옛 복식을 직접 겪어 보는 체험을 반기고, 기운을 채우는 고기를 즐긴다.",
    ),
    PersonaProfile(
        "court_lady", "궁녀",
        "궁 안에서 일하며 궁궐 안팎을 오가던 여인. 거닐기 좋은 연못과 정원, "
        "궁중에 전해 오는 소소한 이야기가 남은 자리에 마음이 간다. 단것과 차를 즐긴다.",
    ),
    PersonaProfile(
        "merchant", "상인",
        "저잣거리에서 물건을 파는 사람. 사람이 붐비는 시장과 상가, 먹거리 골목을 누비며 "
        "물건과 값을 살핀다. 국밥이나 분식처럼 빠르게 드는 음식을 좋아한다.",
    ),
)

PERSONA_KEYS = tuple(profile.key for profile in PERSONA_PROFILES)


# 하루의 뼈대. 여섯 역할이 모두 같다.
# "어떤 장소가 어울리는지"는 여기 적지 않는다. PLACE_PERSONA_SCORE 의 점수가 정한다.
TOUR = "TOUR"
FOOD = "FOOD"

MORNING = "오전"
LUNCH = "점심"
AFTERNOON = "오후"
SNACK = "간식"
DINNER = "저녁"


@dataclass(frozen=True)
class Slot:
    time_slot: str  # 오전 / 점심 / 오후 / 간식 / 저녁
    place_type: str  # TOUR(관광지) / FOOD(음식점)
    # 하한을 넘는 덤. 채울 곳이 없으면 이 칸만 비운다. (점심·저녁은 절대 안 비운다)
    optional: bool = False


# 코스마다 관광지 3~4곳, 음식점 2~3곳으로 구성이 달라진다.
TOUR_RANGE = (3, 4)
FOOD_RANGE = (2, 3)


def day_plan(tour_count: int, food_count: int) -> tuple[Slot, ...]:
    """관광지·음식점 개수를 하루 순서로 늘어놓는다.

    관광지는 오전과 오후로 나누고(3곳이면 오전 1 · 오후 2), 점심과 저녁 사이에
    오후 관광을 끼운다. 음식이 셋이면 오후 관광 사이에 간식 한 끼가 들어간다.
    """
    morning = tour_count // 2
    afternoon = tour_count - morning
    # 하한을 넘는 관광지 한 곳은 오전 끝에 붙이고, 비어도 되는 칸으로 표시한다.
    extra_tour = tour_count > TOUR_RANGE[0]

    slots = [
        Slot(MORNING, TOUR, optional=extra_tour and index == morning - 1)
        for index in range(morning)
    ]
    slots.append(Slot(LUNCH, FOOD))
    slots.append(Slot(AFTERNOON, TOUR))
    # 간식은 오후 관광 사이에 둔다. 저녁 바로 앞에 붙이면 두 끼가 잇따른다.
    if food_count >= 3:
        slots.append(Slot(SNACK, FOOD, optional=True))
    slots.extend([Slot(AFTERNOON, TOUR)] * (afternoon - 1))
    slots.append(Slot(DINNER, FOOD))
    return tuple(slots)


DAY_PLAN = day_plan(TOUR_RANGE[1], FOOD_RANGE[0])


@dataclass(frozen=True)
class Persona:
    key: str
    name: str
    # 코스를 뽑을 때마다 이 범위 안에서 개수를 고른다. 하한은 반드시 채운다.
    tour_range: tuple[int, int] = TOUR_RANGE
    food_range: tuple[int, int] = FOOD_RANGE
    # 차, 대중교통 기준
    radius_km: float = 12.0
    max_total_km: float = 40.0
    # 가까운 후보 몇 곳을 놓고 뽑을지. 크게 잡을수록 코스가 매번 다양해진다.
    choice_pool: int = 8
    # 이 점수 미만이면 그 역할에게 안 어울리는 곳으로 보고 후보에서 뺀다.
    min_score: int = 3

    @property
    def slots(self) -> tuple[Slot, ...]:
        # 개수를 고르지 않고 쓸 때의 기본 구성 (관광지 최대, 음식 최소)
        return day_plan(self.tour_range[1], self.food_range[0])


# 역할은 프로필에서 자동으로 만들어진다. 역할을 추가하려면 PERSONA_PROFILES 에 한 줄 넣고
# 채점(sync_persona_scores.py)만 돌리면 된다. 코스 규칙을 새로 짤 필요가 없다.
PERSONAS = {
    profile.key: Persona(key=profile.key, name=profile.name)
    for profile in PERSONA_PROFILES
}
