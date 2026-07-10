export const APP_NAME = "Play Gyeongju";
export const APP_SUBTITLE = "천년 도시를 걷는 나만의 동행";
export const API_ENV_KEY = "NEXT_PUBLIC_API_BASE_URL";
export const SPOT_REVIEW_LIMIT = 350;
export const RANKING_RESET_LABEL = "오늘 00:00 기준";
export const DEFAULT_USER = {
  nickname: "lotus_traveler",
  email: "traveler@example.com",
  language: "ko",
};

export const AUTH_COPY = {
  introTitle: "천년의 경주,\n이야기를 따라.",
  introDescription: "동경과 함께 미션을 해결하고, 나만의 경주 여행을 완성해 보세요.",
  consent: "방문 데이터 수집 및 서비스 이용에 동의합니다.",
  oauth: ["Google로 계속하기", "Kakao로 계속하기"],
};

export const HOME_CONTENT = {
  hero: {
    eyebrow: "이번 주 경주",
    title: "동경이와 천년 도시를 걸어보세요",
    description: "가까운 문화유산과 지금 열리고 있는 이야기를 한눈에 확인하세요.",
  },
  festivals: [
    { id: "f1", title: "경주 문화유산 야행", period: "8. 23 - 8. 24", type: "야간 프로그램", color: "#c96d2d" },
    { id: "f2", title: "봉황대 뮤직스퀘어", period: "매주 금요일", type: "공연", color: "#287c70" },
    { id: "f3", title: "황리단길 주말 마켓", period: "매주 토 - 일", type: "로컬 마켓", color: "#405a9d" },
  ],
  popup: {
    title: "여름 스탬프 챌린지",
    description: "3개의 장소를 방문하고 동경이 여행 배지를 받아보세요.",
  },
  tourismUrl: "https://www.gyeongju.go.kr/tour/index.do",
};

export const QUESTS = [
  { id: "bunhwangsa", name: "분황사", description: "모전석탑의 인왕상을 찾아보세요.", distance: "1.7km", latitude: 35.8408, longitude: 129.2333, icon: "temple", docent: true },
  { id: "cheomseongdae", name: "첨성대", description: "별을 읽던 신라의 시간을 만나보세요.", distance: "280m", latitude: 35.8347, longitude: 129.2191, icon: "tower", docent: true },
  { id: "donggung", name: "동궁과 월지", description: "물 위에 비친 궁궐의 밤을 기록해 보세요.", distance: "1.1km", latitude: 35.8349, longitude: 129.2267, icon: "palace", docent: false },
  { id: "bulguksa", name: "불국사", description: "두 탑 사이에서 오래된 약속을 찾아보세요.", distance: "12.4km", latitude: 35.7900, longitude: 129.3321, icon: "temple", docent: true },
  { id: "seokguram", name: "석굴암", description: "동해를 향한 본존불의 시선을 따라가 보세요.", distance: "14.1km", latitude: 35.7948, longitude: 129.3492, icon: "grotto", docent: true },
];

export const MAP_LEGEND = {
  nearby: "1km 이내",
  distant: "1km 초과",
  current: "현재 위치",
};

export const DG_SLOTS = [
  { id: "hat", label: "머리" },
  { id: "accessory", label: "장식" },
  { id: "clothes", label: "의상" },
  { id: "hand", label: "손" },
];

export const DG_INVENTORY = [
  { id: "crown", slot: "hat", name: "금관", symbol: "♛", color: "#d4a538" },
  { id: "lotus", slot: "accessory", name: "연꽃 장식", symbol: "✿", color: "#d96b94" },
  { id: "hanbok", slot: "clothes", name: "청록 두루마기", symbol: "◈", color: "#287c70" },
  { id: "camera", slot: "hand", name: "여행 카메라", symbol: "◉", color: "#405a9d" },
  { id: "lantern", slot: "hand", name: "천년 등불", symbol: "✦", color: "#c96d2d" },
];

export const SPOT_RANKING = [
  { id: "spot-1", rank: 1, user: "wanderseoul", place: "월정교의 달빛", review: "다리 위보다 물에 비친 두 번째 월정교가 더 오래 기억에 남았어요.", likes: 342, comments: 41, photo: "🌉" },
  { id: "spot-2", rank: 2, user: "tabi_no_kiroku", place: "굴불사지 사면석불", review: "한 바위에 머문 네 개의 표정을 조용히 마주한 시간.", likes: 287, comments: 23, photo: "🪨" },
  { id: "spot-3", rank: 3, user: "emma.travels", place: "서출지 연못", review: "해 질 무렵 연꽃 잎 위로 번진 빛이 금색으로 보였어요.", likes: 201, comments: 18, photo: "🪷" },
  { id: "spot-4", rank: 4, user: "gyeongju_walk", place: "황리단길 골목", review: "낮보다 해 질 때 걷기 좋은 작은 골목을 발견했습니다.", likes: 166, comments: 14, photo: "🏠" },
  { id: "spot-5", rank: 5, user: "stoneandstar", place: "대릉원 산책길", review: "비가 그친 뒤의 고분은 유난히 초록빛이 짙었어요.", likes: 143, comments: 12, photo: "🌿" },
];

export const SPOT_COMMENTS = {
  "spot-1": ["저도 밤에 꼭 가보고 싶어요."],
  "spot-2": ["아침 시간대는 사람이 적어서 좋아요."],
};

export const BLOCKED_WORDS = ["바보", "욕설"];

export const PROFILE_MENU = [
  { id: "privacy", label: "개인정보 수정" },
  { id: "places", label: "내가 다녀간 장소" },
  { id: "contact", label: "Contact us." },
  { id: "withdraw", label: "회원 탈퇴" },
];

export const LANGUAGES = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
  { id: "ja", label: "日本語" },
];
