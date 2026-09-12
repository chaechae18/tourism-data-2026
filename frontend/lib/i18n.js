export const SUPPORTED_LANGUAGES = ["ko", "en", "ja", "zh"];

export const LANGUAGE_LOCALES = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
};

export const MESSAGES = {
  ko: {
    common: {
      close: "닫기", save: "저장", change: "바꾸기", ready: "준비 중",
      networkError: "서버에 연결하지 못했습니다.", requestError: "요청을 처리하지 못했습니다.",
    },
    intro: {
      title: "천년의 경주,\n이야기를 따라.",
      description: "동경이와 함께 미션을 해결하고, 나만의 경주 여행을 완성해 보세요.",
      login: "로그인", artworkLabel: "움직이는 종이 물결 안의 첨성대 일러스트",
    },
    auth: {
      login: "로그인", signup: "회원가입", signupSubmit: "동의하고 시작하기",
      id: "아이디", idPlaceholder: "로그인 아이디", nickname: "닉네임", nicknamePlaceholder: "여행자 이름",
      email: "이메일", password: "비밀번호", passwordConfirm: "비밀번호 확인",
      passwordConfirmPlaceholder: "비밀번호를 다시 입력하세요", country: "국가",
      countryPlaceholder: "국가를 선택하세요", birthDate: "생년월일",
      consent: "방문 데이터 수집 및 서비스 이용에 동의합니다.", or: "또는",
      google: "Google로 계속하기", kakao: "Kakao로 계속하기",
      consentRequired: "약관에 동의해주세요.", requiredFields: "필수 정보를 모두 입력해주세요.",
      passwordMismatch: "비밀번호가 일치하지 않습니다.", loginRequired: "아이디와 비밀번호를 입력해주세요.",
      signupFailed: "회원가입에 실패했습니다.", loginFailed: "로그인에 실패했습니다.",
    },
    nav: { label: "주요 메뉴", home: "홈", donggyeong: "동경이", map: "지도", spots: "스팟", my: "내 정보" },
    guide: {
      skip: "건너뛰기", next: "다음", start: "캐릭터 고르러 가기",
      notification: "화면 위쪽 종 모양을 누르면 새 소식을 볼 수 있어요.",
      home: { title: "홈", description: "경주 소식, 이번 달 행사, 추천 관광지를 한눈에" },
      donggyeong: { title: "동경이", description: "여행하며 모은 아이템으로 내 동경이를 꾸며요" },
      map: { title: "지도", description: "선택한 캐릭터의 코스를 확인할 수 있어요" },
      spots: { title: "스팟", description: "다른 여행자의 추천 명소를 확인하고, 내 스팟도 추천하기" },
      my: { title: "My page", description: "기본 정보를 수정하고, 다녀간 장소를 확인할 수 있어요" },
    },
    home: {
      title: "동경이와 천년 도시를 걸어보세요", description: "문화유산과 진행중인 행사를 한눈에 확인하세요.",
      nearby: "가까운 장소 보기", notice: "지금 알려드려요", noticeCount: "{count}건", noNotice: "새로운 공지가 없어요.", detail: "자세히 보기", hideToday: "오늘 하루 보지 않기",
      news: "경주 소식", noBanner: "지금 노출 중인 배너가 없어요.", festivals: "다가오는 행사",
      noFestival: "예정된 행사가 없어요.", starts: "{date} 시작", ends: "{date} 종료", festivalInfo: "행사 정보",
      recommended: "추천 관광지", recommendedPage: "추천 관광지 {page}페이지", noRecommended: "추천 중인 관광지가 없어요.", tourismInfo: "경주 관광 정보",
    },
    play: {
      logout: "로그아웃", courseFallback: "코스를 불러오지 못해 샘플 장소를 보여주고 있어요 — {message}",
      courseLoadError: "코스를 불러오지 못했습니다.", courseReady: "{name} 코스를 지도에 그렸어요.",
      coursePending: "{name} 코스는 준비 중이에요. 지금은 왕 코스가 보여요.", coursePendingShort: "{name} 코스는 준비 중이에요.",
      courseRerolled: "새 코스를 뽑았어요.", courseRerollError: "코스를 다시 뽑지 못했어요.",
      visitCompleted: "방문 완료로 표시했어요.", docentPending: "{name} 도슨트를 준비하고 있어요.", outfitSaved: "현재 착장을 저장했어요.",
    },
    map: {
      title: "경주 2D 지도", illustrationLabel: "실제 위치 비율을 반영한 경주 일러스트 지도", rangeLabel: "지도 범위",
      city: "도심권", all: "전체 경주", currentLocation: "현재 위치", findLocation: "현재 위치 찾기",
      unsupportedLocation: "현재 브라우저에서는 위치 기능을 사용할 수 없어요.", locating: "현재 위치를 확인하고 있어요.",
      outside: "경주 관광권 밖이에요. 데모 위치를 유지합니다.", located: "현재 위치를 지도에 표시했어요.",
      permission: "위치 권한을 허용하면 가까운 장소를 확인할 수 있어요.", routeKey: "TMAP 키 연결이 필요해요.",
      routeLoaded: "TMAP 도보 경로를 불러왔어요.", routeFailed: "TMAP 연결에 실패했어요. 잠시 후 다시 시도해 주세요.",
      currentRole: "지금 역할", near: "가까워요", walkDistance: "도보 거리", duration: "예상 시간",
      routeLoading: "경로 불러오는 중", routeAgain: "TMAP 경로 다시 보기", route: "TMAP 길찾기",
      visited: "방문 완료", complete: "퀘스트 완료", docent: "도슨트 듣기", pending: "준비 중",
      minutes: "{minutes}분", hoursMinutes: "{hours}시간 {minutes}분", start: "출발", closedNotice: " ※ 휴무일 확인 필요",
      reroll: "코스 다시 뽑기", within1km: "1km 이내", beyond1km: "1km 초과", selectPlace: "{name} 선택",
      zoomIn: "지도 확대", zoomOut: "지도 축소", zoomReset: "지도 원래대로", operatingHours: "운영시간", parking: "주차", restDate: "휴무일", menu: "메뉴",
    },
    roles: {
      title: "역할 선택", guide: "신라 사람 중 하나를 고르면, 그 인물이 다녔을 법한 하루 코스를 지도에 그려 드려요.",
      courseReady: "코스 준비됨", pending: "준비 중",
      king: { name: "왕", tagline: "궁궐과 왕릉을 따라", description: "월성에서 시작해 왕릉을 잇는 하루. 상차림은 고기 위주로." },
      scholar: { name: "학자", tagline: "서원과 비석 사이에서", description: "옛 글이 남은 서원과 비석을 따라 걷는 하루." },
      monk: { name: "스님", tagline: "절과 불상을 찾아", description: "산사와 마애불을 돌며 마음을 다스리는 하루." },
      hwarang: { name: "화랑", tagline: "남산과 계곡을 누비며", description: "산길과 물길에서 몸과 마음을 닦는 하루." },
      court_lady: { name: "궁녀", tagline: "궁 안의 이야기를 따라", description: "궁궐 뒤편에 남은 자취와 소소한 이야기를 찾아서." },
      merchant: { name: "상인", tagline: "저잣거리를 누비며", description: "시장과 상가를 돌며 경주의 물건을 살피는 하루." },
    },
    donggyeong: { title: "동경이 꾸미기", save: "착장 저장", mine: "내 동경이", inventory: "인벤토리", quests: "방문 퀘스트", viewerLabel: "3D 동경이 캐릭터 뷰어" },
    slots: { hat: "머리", accessory: "장식", clothes: "의상", hand: "손" },
    items: { crown: "금관", lotus: "연꽃 장식", hanbok: "청록 두루마기", camera: "여행 카메라", lantern: "천년 등불" },
    quests: {
      bunhwangsa: { name: "분황사", description: "모전석탑의 인왕상을 찾아보세요." },
      cheomseongdae: { name: "첨성대", description: "별을 읽던 신라의 시간을 만나보세요." },
      donggung: { name: "동궁과 월지", description: "물 위에 비친 궁궐의 밤을 기록해 보세요." },
      bulguksa: { name: "불국사", description: "두 탑 사이에서 오래된 약속을 찾아보세요." },
      seokguram: { name: "석굴암", description: "동해를 향한 본존불의 시선을 따라가 보세요." },
    },
    myPage: {
      title: "내 여행 설정", nickname: "닉네임", nicknameSaved: "닉네임을 저장했어요.", language: "언어 설정",
      visited: "내가 다녀간 장소", visitedDescription: "방문한 경주 명소를 확인해보세요.", noVisited: "아직 방문 완료한 장소가 없어요.", saveFailed: "언어 설정을 저장하지 못했습니다.",
      visitedPlaces: {ticketTitle: "경주 여행 티켓", ticketDescription: "내가 방문한 장소를 티켓으로 모아봤어요."},
      saved: "언어 설정을 저장했어요.", unavailable: "{name} 화면은 백엔드 연결 후 제공됩니다.",
      guide: "앱 사용법 다시 보기", privacy: "개인정보 수정", places: "내가 다녀간 장소", contact: "Contact us.", withdraw: "회원 탈퇴",
      personalInfo: { back: "뒤로가기", title: "개인정보 수정", description: "나의 프로필 정보를 관리해보세요", basicInfo: "기본 정보", nickname: "닉네임", nicknamePlaceholder: "닉네임을 입력해주세요", email: "이메일", emailPlaceholder: "이메일을 입력해주세요", country: "국가", countryPlaceholder: "국가를 입력해주세요", birthDate: "생년월일", noticeTitle: "프로필 안내", noticeDescription: "입력한 정보는 프로필과 여행 기록을 표시하는 데 사용됩니다.", save: "저장하기", updated: "개인정보가 수정되었습니다.", updateFailed: "개인정보 수정에 실패했습니다." },
    },
    notifications: {
      label: "알림", empty: "새 알림이 없어요.",
      SPOT_LIKE: { title: "새로운 좋아요", message: "내 스팟에 새로운 좋아요가 추가됐어요." },
      QUEST_COMPLETED: { title: "퀘스트 달성", message: "퀘스트를 완료했어요." },
    },
    spots: {
      title: "나만의 경주 스팟", navLabel: "스팟 상단 메뉴", ranking: "랭킹", spots: "스팟", create: "나의 스팟 등록",
      rankingTitle: "오늘의 스팟 랭킹", publicTitle: "공개 스팟", mineTitle: "내가 쓴 게시글", postTitle: "스팟 게시물",
      pending: "검수 대기", approved: "승인", rejected: "반려", like: "좋아요", unlike: "좋아요 취소", comment: "댓글",
      bookmark: "북마크", unbookmark: "북마크 취소", deleteMine: "내 스팟 삭제", firstComment: "첫 댓글을 남겨보세요.",
      commentPlaceholder: "댓글을 남겨보세요", noMine: "아직 작성한 스팟이 없어요.", sortLabel: "스팟 목록 정렬",
      submitComment: "등록", sort: "정렬", sortLikes: "좋아요순", sortNewest: "신규순", searchLabel: "장소 검색",
      locationPlaceholder: "어디에서 발견했나요?", locating: "주변 장소 찾는 중...", resetLabel: "오늘 00:00 기준",
      nearby: "내 주변 장소", radius: "현재 위치 기준 2km", nearest: "가까운 순", photo: "사진", choosePhoto: "사진 선택",
      review: "한줄평", reviewPlaceholder: "경주에서 발견한 순간을 350자 이내로 남겨 보세요.", submitting: "등록 중...", share: "스팟 공유",
      geolocationUnsupported: "이 브라우저에서는 현재 위치를 사용할 수 없어요.", nearbyLoaded: "현재 위치에서 가까운 장소를 불러왔어요.",
      nearbyEmpty: "현재 위치 주변에서 등록할 장소를 찾지 못했어요.", permissionDenied: "위치 권한이 필요해요. 권한을 허용하거나 장소를 직접 검색해 주세요.",
      positionUnavailable: "현재 위치를 확인할 수 없어요. 장소를 직접 검색해 주세요.", timeout: "현재 위치 확인 시간이 초과됐어요. 다시 시도해 주세요.",
      locationFailed: "현재 위치를 확인하지 못했어요.", selectPlace: "검색 결과에서 장소를 선택하고 한줄평을 입력해 주세요.",
      blockedReview: "한줄평에 사용할 수 없는 표현이 있어요.", created: "스팟을 등록했어요. 10초 후 임시 승인되어 공개됩니다.",
      deleteConfirm: "이 스팟을 삭제할까요?", deleted: "스팟을 삭제했어요.", blockedComment: "댓글에 사용할 수 없는 표현이 있어요.",
      commentCreated: "댓글을 등록했어요. 승인 후 다른 사용자에게 표시됩니다.",
      photoAlt: "{name} 사진", openPost: "{name} 게시물 열기", previewAlt: "{name} 미리보기", postPhotoAlt: "{name} 게시물 사진",
      spotPlaceholder: "스팟 카드 자리 {index}", rankingPlaceholder: "랭킹 카드 자리 {rank}",
    },
  },
  en: {
    common: { close: "Close", save: "Save", change: "Change", ready: "Coming soon", networkError: "Could not connect to the server.", requestError: "Could not complete the request." },
    intro: { title: "A thousand years of Gyeongju,\none story at a time.", description: "Complete missions with Donggyeong and create your own Gyeongju journey.", login: "Log in", artworkLabel: "Cheomseongdae illustration amid animated paper waves" },
    auth: { login: "Log in", signup: "Sign up", signupSubmit: "Agree and get started", id: "Username", idPlaceholder: "Login username", nickname: "Nickname", nicknamePlaceholder: "Traveler name", email: "Email", password: "Password", passwordConfirm: "Confirm password", passwordConfirmPlaceholder: "Enter your password again", country: "Country", countryPlaceholder: "Select a country", birthDate: "Date of birth", consent: "I agree to the collection of visit data and the terms of service.", or: "or", google: "Continue with Google", kakao: "Continue with Kakao", consentRequired: "Please agree to the terms.", requiredFields: "Please fill in all required fields.", passwordMismatch: "Passwords do not match.", loginRequired: "Enter your username and password.", signupFailed: "Sign-up failed.", loginFailed: "Login failed." },
    nav: { label: "Main navigation", home: "Home", donggyeong: "Donggyeong", map: "Map", spots: "Spots", my: "My" },
    guide: { skip: "Skip", next: "Next", start: "Choose a character", notification: "Tap the bell at the top of the screen to see what's new.", home: { title: "Home", description: "Gyeongju news, this month's festivals, and recommended places" }, donggyeong: { title: "Donggyeong", description: "Dress up your Donggyeong with items you collect on the road" }, map: { title: "Map", description: "See the course for the character you picked" }, spots: { title: "Spots", description: "Browse spots other travellers recommend, and recommend your own" }, my: { title: "My page", description: "Edit your basic details and look back on where you have been" } },
    home: { title: "Walk through the thousand-year city with Donggyeong", description: "Find heritage sites and events happening now at a glance.", nearby: "Explore nearby places", notice: "Latest notices", noticeCount: "{count} notices", noNotice: "There are no new notices.", detail: "View details", hideToday: "Don't show again today", news: "Gyeongju news", noBanner: "There are no active banners.", festivals: "Upcoming events", noFestival: "There are no upcoming events.", starts: "Starts {date}", ends: "Ends {date}", festivalInfo: "Event details", recommended: "Recommended places", recommendedPage: "Recommended places page {page}", noRecommended: "There are no recommendations yet.", tourismInfo: "Gyeongju tourism information" },
    play: { logout: "Log out", courseFallback: "Showing sample places because the course could not be loaded — {message}", courseLoadError: "Could not load the course.", courseReady: "The {name} course is now on the map.", coursePending: "The {name} course is coming soon. The King course is shown for now.", coursePendingShort: "The {name} course is coming soon.", courseRerolled: "A new course is ready.", courseRerollError: "Could not create a new course.", visitCompleted: "Marked as visited.", docentPending: "The guide for {name} is coming soon.", outfitSaved: "Your current outfit has been saved." },
    map: { title: "Gyeongju 2D Map", illustrationLabel: "Illustrated Gyeongju map reflecting real-world locations", rangeLabel: "Map range", city: "City center", all: "All Gyeongju", currentLocation: "Current location", findLocation: "Find my location", unsupportedLocation: "Location is not available in this browser.", locating: "Finding your location.", outside: "You are outside the Gyeongju travel area. Keeping the demo location.", located: "Your location is now on the map.", permission: "Allow location access to find nearby places.", routeKey: "A TMAP key is required.", routeLoaded: "The TMAP walking route is ready.", routeFailed: "Could not connect to TMAP. Please try again later.", currentRole: "Current role", near: "Nearby", walkDistance: "Walking distance", duration: "Estimated time", routeLoading: "Loading route", routeAgain: "View TMAP route again", route: "TMAP directions", visited: "Visited", complete: "Complete quest", docent: "Listen to guide", pending: "Coming soon", minutes: "{minutes} min", hoursMinutes: "{hours} hr {minutes} min", start: "Start", closedNotice: " ※ Check closing days", reroll: "Create another course", within1km: "Within 1 km", beyond1km: "Over 1 km", selectPlace: "Select {name}", zoomIn: "Zoom in", zoomOut: "Zoom out", zoomReset: "Reset zoom", operatingHours: "Hours", parking: "Parking", restDate: "Closed", menu: "Menu" },
    roles: { title: "Choose a role", guide: "Choose a person from Silla and we will map out a day they might have lived.", courseReady: "Course ready", pending: "Coming soon", king: { name: "King", tagline: "Palaces and royal tombs", description: "A day from Wolseong through the royal tombs, with a meat-focused table." }, scholar: { name: "Scholar", tagline: "Between academies and steles", description: "A day following old writings through academies and monuments." }, monk: { name: "Scholar monk", tagline: "Temples and Buddhist statues", description: "A reflective day among mountain temples and rock-carved Buddhas." }, hwarang: { name: "Hwarang", tagline: "Across Namsan and its valleys", description: "Train body and mind along mountain paths and streams." }, court_lady: { name: "Court lady", tagline: "Stories inside the palace", description: "Find the traces and quiet stories left behind the palace." }, merchant: { name: "Merchant", tagline: "Through the marketplace", description: "A day exploring Gyeongju's markets, shops, and goods." } },
    donggyeong: { title: "Dress up Donggyeong", save: "Save outfit", mine: "My Donggyeong", inventory: "Inventory", quests: "Visit quests", viewerLabel: "3D Donggyeong character viewer" },
    slots: { hat: "Head", accessory: "Accessory", clothes: "Outfit", hand: "Hand" },
    items: { crown: "Golden crown", lotus: "Lotus ornament", hanbok: "Teal durumagi", camera: "Travel camera", lantern: "Millennium lantern" },
    quests: { bunhwangsa: { name: "Bunhwangsa Temple", description: "Find the guardian figures on the stone-brick pagoda." }, cheomseongdae: { name: "Cheomseongdae", description: "Meet the Silla era that read the stars." }, donggung: { name: "Donggung Palace and Wolji Pond", description: "Capture the palace reflected on the water at night." }, bulguksa: { name: "Bulguksa Temple", description: "Find the ancient promise between the two pagodas." }, seokguram: { name: "Seokguram Grotto", description: "Follow the Buddha's gaze toward the East Sea." } },
    myPage: { personalInfo: { back: "Go back", title: "Edit Personal Information", description: "Manage your profile information", basicInfo: "Basic Information", nickname: "Nickname", nicknamePlaceholder: "Enter your nickname", email: "Email", emailPlaceholder: "Enter your email", country: "Country", countryPlaceholder: "Enter your country", birthDate: "Date of Birth", noticeTitle: "Profile Information", noticeDescription: "The information you enter will be used to display your profile and travel records.", save: "Save", updated: "Your personal information has been updated.", updateFailed: "Failed to update your personal information." }, visitedPlaces: {ticketTitle: "Gyeongju Travel Tickets", ticketDescription: "Your visited places collected as travel tickets."},guide: "See the app guide again", title: "My travel settings", nickname: "Nickname", nicknameSaved: "Nickname saved.", language: "Language", visited: "Places I visited", visitedDescription: "Check the Gyeongju places you have visited.", noVisited: "You have not completed any visits yet.", saveFailed: "Could not save the language setting.", saved: "Language setting saved.", unavailable: "The {name} screen will be available after backend integration.", privacy: "Edit personal information", places: "Places I visited", contact: "Contact us.", withdraw: "Delete account" },
    notifications: { label: "Notifications", empty: "No new notifications.", SPOT_LIKE: { title: "New like", message: "Someone liked your spot." }, QUEST_COMPLETED: { title: "Quest complete", message: "You completed a quest." } },
    spots: { title: "My Gyeongju spots", navLabel: "Spot navigation", ranking: "Ranking", spots: "Spots", create: "Add my spot", rankingTitle: "Today's spot ranking", publicTitle: "Public spots", mineTitle: "My posts", postTitle: "Spot post", pending: "Pending review", approved: "Approved", rejected: "Rejected", like: "Like", unlike: "Unlike", comment: "Comment", bookmark: "Bookmark", unbookmark: "Remove bookmark", deleteMine: "Delete my spot", firstComment: "Be the first to comment.", commentPlaceholder: "Leave a comment", submitComment: "Post", noMine: "You have not posted any spots yet.", sortLabel: "Sort spots", sort: "Sort", sortLikes: "Most liked", sortNewest: "Newest", searchLabel: "Search for a place", locationPlaceholder: "Where did you find it?", locating: "Finding nearby places...", resetLabel: "As of 00:00 today", nearby: "Places near me", radius: "Within 2 km of your location", nearest: "Nearest first", photo: "Photo", choosePhoto: "Choose photo", review: "Short review", reviewPlaceholder: "Describe your Gyeongju moment in up to 350 characters.", submitting: "Posting...", share: "Share spot", geolocationUnsupported: "Location is not available in this browser.", nearbyLoaded: "Loaded places near your current location.", nearbyEmpty: "No places were found near your current location.", permissionDenied: "Location permission is required. Allow access or search manually.", positionUnavailable: "Your location is unavailable. Search for a place manually.", timeout: "Location lookup timed out. Please try again.", locationFailed: "Could not determine your location.", selectPlace: "Choose a search result and enter a short review.", blockedReview: "The review contains an unsupported expression.", created: "Spot posted. It will be temporarily approved in 10 seconds.", deleteConfirm: "Delete this spot?", deleted: "Spot deleted.", blockedComment: "The comment contains an unsupported expression.", commentCreated: "Comment submitted. It will appear after approval.", photoAlt: "Photo of {name}", openPost: "Open the {name} post", previewAlt: "Preview of {name}", postPhotoAlt: "Photo in the {name} post", spotPlaceholder: "Spot card placeholder {index}", rankingPlaceholder: "Ranking card placeholder {rank}" },
  },
  ja: {
    common: { close: "閉じる", save: "保存", change: "変更", ready: "準備中", networkError: "サーバーに接続できませんでした。", requestError: "リクエストを処理できませんでした。" },
    intro: { title: "千年の慶州、\n物語をたどって。", description: "トンギョンとミッションを解き、自分だけの慶州旅行を完成させましょう。", login: "ログイン", artworkLabel: "動く紙の波に囲まれた瞻星台のイラスト" },
    auth: { login: "ログイン", signup: "会員登録", signupSubmit: "同意して始める", id: "ID", idPlaceholder: "ログインID", nickname: "ニックネーム", nicknamePlaceholder: "旅行者名", email: "メール", password: "パスワード", passwordConfirm: "パスワード確認", passwordConfirmPlaceholder: "もう一度入力してください", country: "国", countryPlaceholder: "国を選択", birthDate: "生年月日", consent: "訪問データの収集と利用規約に同意します。", or: "または", google: "Googleで続ける", kakao: "Kakaoで続ける", consentRequired: "規約に同意してください。", requiredFields: "必須項目をすべて入力してください。", passwordMismatch: "パスワードが一致しません。", loginRequired: "IDとパスワードを入力してください。", signupFailed: "会員登録に失敗しました。", loginFailed: "ログインに失敗しました。" },
    nav: { label: "メインメニュー", home: "ホーム", donggyeong: "トンギョン", map: "地図", spots: "スポット", my: "マイ" },
    guide: { skip: "スキップ", next: "次へ", start: "キャラクターを選ぶ", notification: "画面上のベルを押すと新しいお知らせを確認できます。", home: { title: "ホーム", description: "慶州のニュース、今月のイベント、おすすめの観光地" }, donggyeong: { title: "トンギョン", description: "旅で集めたアイテムでトンギョンを着せ替えます" }, map: { title: "地図", description: "選んだキャラクターのコースを確認できます" }, spots: { title: "スポット", description: "ほかの旅行者のおすすめスポットを見て、自分のスポットも紹介できます" }, my: { title: "マイページ", description: "基本情報を修正し、訪れた場所を確認できます" } },
    home: { title: "トンギョンと千年の都を歩きましょう", description: "文化遺産と開催中のイベントをひと目で確認できます。", nearby: "近くの場所を見る", notice: "お知らせ", noticeCount: "{count}件", noNotice: "新しいお知らせはありません。", detail: "詳しく見る", hideToday: "今日は表示しない", news: "慶州ニュース", noBanner: "表示中のバナーはありません。", festivals: "開催予定のイベント", noFestival: "予定されているイベントはありません。", starts: "{date}開始", ends: "{date}終了", festivalInfo: "イベント情報", recommended: "おすすめ観光地", recommendedPage: "おすすめ観光地 {page}ページ", noRecommended: "おすすめはまだありません。", tourismInfo: "慶州観光情報" },
    play: { logout: "ログアウト", courseFallback: "コースを読み込めないためサンプルを表示しています — {message}", courseLoadError: "コースを読み込めませんでした。", courseReady: "{name}コースを地図に表示しました。", coursePending: "{name}コースは準備中です。現在は王コースを表示しています。", coursePendingShort: "{name}コースは準備中です。", courseRerolled: "新しいコースを作成しました。", courseRerollError: "新しいコースを作成できませんでした。", visitCompleted: "訪問済みにしました。", docentPending: "{name}の音声ガイドを準備中です。", outfitSaved: "現在のコーデを保存しました。" },
    map: { title: "慶州2D地図", illustrationLabel: "実際の位置関係を反映した慶州イラスト地図", rangeLabel: "地図範囲", city: "市内中心部", all: "慶州全域", currentLocation: "現在地", findLocation: "現在地を探す", unsupportedLocation: "このブラウザでは位置情報を利用できません。", locating: "現在地を確認しています。", outside: "慶州観光圏外です。デモ位置を維持します。", located: "現在地を地図に表示しました。", permission: "位置情報を許可すると近くの場所を確認できます。", routeKey: "TMAPキーが必要です。", routeLoaded: "TMAP徒歩ルートを読み込みました。", routeFailed: "TMAPに接続できませんでした。", currentRole: "現在の役割", near: "近い", walkDistance: "徒歩距離", duration: "予想時間", routeLoading: "ルート読込中", routeAgain: "TMAPルートを再表示", route: "TMAPルート検索", visited: "訪問済み", complete: "クエスト完了", docent: "ガイドを聴く", pending: "準備中", minutes: "{minutes}分", hoursMinutes: "{hours}時間{minutes}分", start: "出発", closedNotice: " ※ 休業日要確認", reroll: "コースを作り直す", within1km: "1km以内", beyond1km: "1km超", selectPlace: "{name}を選択", zoomIn: "地図を拡大", zoomOut: "地図を縮小", zoomReset: "地図を元に戻す", operatingHours: "営業時間", parking: "駐車", restDate: "休業日", menu: "メニュー" },
    roles: { title: "役割を選択", guide: "新羅の人物を選ぶと、その人物が過ごしたような一日コースを地図に描きます。", courseReady: "コース準備完了", pending: "準備中", king: { name: "王", tagline: "宮殿と王陵をたどる", description: "月城から王陵へ。肉料理を中心に楽しむ一日。" }, scholar: { name: "学者", tagline: "書院と碑石の間を歩く", description: "古い文字が残る書院や碑石を訪ねる一日。" }, monk: { name: "学僧", tagline: "寺と仏像を訪ねる", description: "山寺と磨崖仏を巡り心を整える一日。" }, hwarang: { name: "花郎", tagline: "南山と渓谷を巡る", description: "山道と水辺で心身を鍛える一日。" }, court_lady: { name: "宮女", tagline: "宮中の物語をたどる", description: "宮殿の裏に残る足跡と小さな物語を探します。" }, merchant: { name: "商人", tagline: "市場を歩き回る", description: "市場や商店を巡り、慶州の品々を見る一日。" } },
    donggyeong: { title: "トンギョンを着せ替え", save: "コーデを保存", mine: "私のトンギョン", inventory: "アイテム", quests: "訪問クエスト", viewerLabel: "3Dトンギョンキャラクタービューア" },
    slots: { hat: "頭", accessory: "アクセサリー", clothes: "衣装", hand: "手" },
    items: { crown: "金冠", lotus: "蓮の飾り", hanbok: "青緑のトゥルマギ", camera: "旅行カメラ", lantern: "千年灯籠" },
    quests: { bunhwangsa: { name: "芬皇寺", description: "模塼石塔の仁王像を探しましょう。" }, cheomseongdae: { name: "瞻星台", description: "星を読んだ新羅の時代に出会いましょう。" }, donggung: { name: "東宮と月池", description: "水面に映る夜の宮殿を記録しましょう。" }, bulguksa: { name: "仏国寺", description: "二つの塔の間にある古い約束を探しましょう。" }, seokguram: { name: "石窟庵", description: "東海を見つめる本尊仏の視線をたどりましょう。" } },
    myPage: {personalInfo: { back: "戻る", title: "個人情報を編集", description: "プロフィール情報を管理します", basicInfo: "基本情報", nickname: "ニックネーム", nicknamePlaceholder: "ニックネームを入力してください", email: "メールアドレス", emailPlaceholder: "メールアドレスを入力してください", country: "国", countryPlaceholder: "国を入力してください", birthDate: "生年月日", noticeTitle: "プロフィール案内", noticeDescription: "入力した情報はプロフィールと旅行記録の表示に使用されます。", save: "保存する", updated: "個人情報を更新しました。", updateFailed: "個人情報の更新に失敗しました。" }, visitedPlaces: {ticketTitle: "慶州旅行チケット",ticketDescription: "訪れた場所を旅行チケットとして集めました。"}, guide: "アプリの使い方をもう一度見る", title: "旅行設定", nickname: "ニックネーム", nicknameSaved: "ニックネームを保存しました。", language: "言語設定", visited: "訪問した場所", visitedDescription: "訪れた慶州の名所を確認できます。", noVisited: "まだ訪問完了した場所はありません。", saveFailed: "言語設定を保存できませんでした。", saved: "言語設定を保存しました。", unavailable: "{name}画面はバックエンド接続後に利用できます。", privacy: "個人情報を編集", places: "訪問した場所", contact: "お問い合わせ", withdraw: "退会" },
    notifications: { label: "通知", empty: "新しい通知はありません。", SPOT_LIKE: { title: "新しいいいね", message: "あなたのスポットにいいねが付きました。" }, QUEST_COMPLETED: { title: "クエスト達成", message: "クエストを完了しました。" } },
    spots: { title: "私の慶州スポット", navLabel: "スポットメニュー", ranking: "ランキング", spots: "スポット", create: "スポット登録", rankingTitle: "今日のスポットランキング", publicTitle: "公開スポット", mineTitle: "自分の投稿", postTitle: "スポット投稿", pending: "審査待ち", approved: "承認", rejected: "却下", like: "いいね", unlike: "いいね取消", comment: "コメント", bookmark: "保存", unbookmark: "保存解除", deleteMine: "自分のスポットを削除", firstComment: "最初のコメントを残しましょう。", commentPlaceholder: "コメントを入力", submitComment: "投稿", noMine: "まだ投稿がありません。", sortLabel: "スポット並び順", sort: "並び順", sortLikes: "いいね順", sortNewest: "新着順", searchLabel: "場所を検索", locationPlaceholder: "どこで見つけましたか？", locating: "近くの場所を検索中...", resetLabel: "本日00:00時点", nearby: "現在地周辺", radius: "現在地から2km以内", nearest: "近い順", photo: "写真", choosePhoto: "写真を選択", review: "ひとこと", reviewPlaceholder: "慶州で見つけた瞬間を350字以内で残してください。", submitting: "登録中...", share: "スポットを共有", geolocationUnsupported: "このブラウザでは位置情報を利用できません。", nearbyLoaded: "現在地周辺の場所を読み込みました。", nearbyEmpty: "現在地周辺に登録できる場所がありません。", permissionDenied: "位置情報の許可が必要です。許可するか手動で検索してください。", positionUnavailable: "現在地を確認できません。手動で検索してください。", timeout: "位置情報の確認がタイムアウトしました。", locationFailed: "現在地を確認できませんでした。", selectPlace: "検索結果から場所を選び、ひとことを入力してください。", blockedReview: "ひとことに使用できない表現があります。", created: "スポットを登録しました。10秒後に仮承認されます。", deleteConfirm: "このスポットを削除しますか？", deleted: "スポットを削除しました。", blockedComment: "コメントに使用できない表現があります。", commentCreated: "コメントを登録しました。承認後に表示されます。", photoAlt: "{name}の写真", openPost: "{name}の投稿を開く", previewAlt: "{name}のプレビュー", postPhotoAlt: "{name}の投稿写真", spotPlaceholder: "スポットカード枠 {index}", rankingPlaceholder: "ランキングカード枠 {rank}" },
  },
  zh: {
    common: { close: "关闭", save: "保存", change: "更改", ready: "准备中", networkError: "无法连接服务器。", requestError: "无法处理请求。" },
    intro: { title: "千年庆州，\n循着故事前行。", description: "与东庆一起完成任务，打造属于你的庆州之旅。", login: "登录", artworkLabel: "动态纸浪中的瞻星台插画" },
    auth: { login: "登录", signup: "注册", signupSubmit: "同意并开始", id: "用户名", idPlaceholder: "登录用户名", nickname: "昵称", nicknamePlaceholder: "旅行者名称", email: "邮箱", password: "密码", passwordConfirm: "确认密码", passwordConfirmPlaceholder: "请再次输入密码", country: "国家", countryPlaceholder: "请选择国家", birthDate: "出生日期", consent: "我同意收集访问数据及服务条款。", or: "或", google: "使用 Google 继续", kakao: "使用 Kakao 继续", consentRequired: "请同意条款。", requiredFields: "请填写所有必填项。", passwordMismatch: "两次密码不一致。", loginRequired: "请输入用户名和密码。", signupFailed: "注册失败。", loginFailed: "登录失败。" },
    nav: { label: "主菜单", home: "首页", donggyeong: "东庆", map: "地图", spots: "景点", my: "我的" },
    guide: { skip: "跳过", next: "下一步", start: "去选择角色", notification: "点击屏幕上方的铃铛即可查看新消息。", home: { title: "首页", description: "庆州资讯、本月活动和推荐景点一目了然" }, donggyeong: { title: "东庆", description: "用旅途中收集的道具装扮你的东庆" }, map: { title: "地图", description: "可以查看所选角色的路线" }, spots: { title: "景点", description: "浏览其他旅行者推荐的景点，也可以推荐自己的" }, my: { title: "我的页面", description: "修改基本信息，查看去过的地方" } },
    home: { title: "与东庆漫步千年古都", description: "一眼查看文化遗产和正在举行的活动。", nearby: "查看附近地点", notice: "最新通知", noticeCount: "{count}条", noNotice: "暂无新通知。", detail: "查看详情", hideToday: "今天不再显示", news: "庆州资讯", noBanner: "暂无展示中的横幅。", festivals: "即将举行的活动", noFestival: "暂无即将举行的活动。", starts: "{date}开始", ends: "{date}结束", festivalInfo: "活动信息", recommended: "推荐景点", recommendedPage: "推荐景点第{page}页", noRecommended: "暂无推荐景点。", tourismInfo: "庆州旅游信息" },
    play: { logout: "退出登录", courseFallback: "路线加载失败，正在显示示例地点 — {message}", courseLoadError: "无法加载路线。", courseReady: "已在地图上显示{name}路线。", coursePending: "{name}路线正在准备中，目前显示王路线。", coursePendingShort: "{name}路线正在准备中。", courseRerolled: "已生成新路线。", courseRerollError: "无法生成新路线。", visitCompleted: "已标记为到访。", docentPending: "{name}语音导览正在准备中。", outfitSaved: "当前装扮已保存。" },
    map: { title: "庆州2D地图", illustrationLabel: "反映实际位置比例的庆州插画地图", rangeLabel: "地图范围", city: "市中心", all: "庆州全域", currentLocation: "当前位置", findLocation: "查找当前位置", unsupportedLocation: "此浏览器无法使用定位功能。", locating: "正在确认当前位置。", outside: "您位于庆州旅游区域之外，将保留演示位置。", located: "已在地图上显示当前位置。", permission: "允许定位后即可查看附近地点。", routeKey: "需要连接 TMAP 密钥。", routeLoaded: "已加载 TMAP 步行路线。", routeFailed: "无法连接 TMAP，请稍后重试。", currentRole: "当前角色", near: "很近", walkDistance: "步行距离", duration: "预计时间", routeLoading: "正在加载路线", routeAgain: "再次查看 TMAP 路线", route: "TMAP 导航", visited: "已到访", complete: "完成任务", docent: "收听导览", pending: "准备中", minutes: "{minutes}分钟", hoursMinutes: "{hours}小时{minutes}分钟", start: "出发", closedNotice: " ※ 请确认休息日", reroll: "重新生成路线", within1km: "1公里以内", beyond1km: "超过1公里", selectPlace: "选择{name}", zoomIn: "放大地图", zoomOut: "缩小地图", zoomReset: "重置地图", operatingHours: "营业时间", parking: "停车", restDate: "休息日", menu: "菜单" },
    roles: { title: "选择角色", guide: "选择一位新罗人物，我们会在地图上规划他可能经历的一日路线。", courseReady: "路线已就绪", pending: "准备中", king: { name: "王", tagline: "沿着宫殿与王陵", description: "从月城出发连接王陵，以肉食为主的一天。" }, scholar: { name: "学者", tagline: "穿行书院与碑石之间", description: "沿着留有古文的书院和碑石漫步一天。" }, monk: { name: "学僧", tagline: "探访寺院与佛像", description: "巡游山寺和摩崖佛，静心的一天。" }, hwarang: { name: "花郎", tagline: "穿越南山与溪谷", description: "在山路和水道间修炼身心的一天。" }, court_lady: { name: "宫女", tagline: "追寻宫中的故事", description: "寻找宫殿背后留下的痕迹与小故事。" }, merchant: { name: "商人", tagline: "穿梭市集", description: "逛市场和商铺，了解庆州物产的一天。" } },
    donggyeong: { title: "装扮东庆", save: "保存装扮", mine: "我的东庆", inventory: "物品栏", quests: "到访任务", viewerLabel: "3D东庆角色查看器" },
    slots: { hat: "头部", accessory: "饰品", clothes: "服装", hand: "手持" },
    items: { crown: "金冠", lotus: "莲花饰品", hanbok: "青绿色长袍", camera: "旅行相机", lantern: "千年灯笼" },
    quests: { bunhwangsa: { name: "芬皇寺", description: "寻找模砖石塔上的仁王像。" }, cheomseongdae: { name: "瞻星台", description: "感受新罗观星的岁月。" }, donggung: { name: "东宫与月池", description: "记录水面倒映的夜间宫殿。" }, bulguksa: { name: "佛国寺", description: "寻找两座塔之间古老的约定。" }, seokguram: { name: "石窟庵", description: "追随本尊佛望向东海的目光。" } },
    myPage: {personalInfo: { back: "返回", title: "修改个人信息", description: "管理您的个人资料信息", basicInfo: "基本信息", nickname: "昵称", nicknamePlaceholder: "请输入昵称", email: "邮箱", emailPlaceholder: "请输入邮箱", country: "国家", countryPlaceholder: "请输入国家", birthDate: "出生日期", noticeTitle: "个人资料说明", noticeDescription: "您输入的信息将用于显示个人资料和旅行记录。", save: "保存", updated: "个人信息已更新。", updateFailed: "个人信息更新失败。" },visitedPlaces: {ticketTitle: "庆州旅行票",ticketDescription: "将您去过的地方收集成旅行票。"}, guide: "再看一次应用指南", title: "我的旅行设置", nickname: "昵称", nicknameSaved: "昵称已保存。", language: "语言设置", visited: "我去过的地方", visitedDescription: "查看您去过的庆州景点。", noVisited: "您还没有完成任何到访。", saveFailed: "无法保存语言设置。", saved: "语言设置已保存。", unavailable: "连接后端后将提供{name}页面。", privacy: "修改个人信息", places: "我去过的地方", contact: "联系我们", withdraw: "注销账号" },
    notifications: { label: "通知", empty: "暂无新通知。", SPOT_LIKE: { title: "新的点赞", message: "有人赞了你的景点。" }, QUEST_COMPLETED: { title: "任务完成", message: "你完成了一项任务。" } },
    spots: { title: "我的庆州景点", navLabel: "景点菜单", ranking: "排行", spots: "景点", create: "发布我的景点", rankingTitle: "今日景点排行", publicTitle: "公开景点", mineTitle: "我的帖子", postTitle: "景点帖子", pending: "待审核", approved: "已通过", rejected: "已拒绝", like: "点赞", unlike: "取消点赞", comment: "评论", bookmark: "收藏", unbookmark: "取消收藏", deleteMine: "删除我的景点", firstComment: "来留下第一条评论吧。", commentPlaceholder: "发表评论", submitComment: "发布", noMine: "您还没有发布景点。", sortLabel: "景点排序", sort: "排序", sortLikes: "点赞最多", sortNewest: "最新", searchLabel: "搜索地点", locationPlaceholder: "在哪里发现的？", locating: "正在查找附近地点...", resetLabel: "截至今日00:00", nearby: "我附近的地点", radius: "当前位置2公里内", nearest: "距离最近", photo: "照片", choosePhoto: "选择照片", review: "一句话点评", reviewPlaceholder: "请在350字以内记录你在庆州发现的瞬间。", submitting: "发布中...", share: "分享景点", geolocationUnsupported: "此浏览器无法使用定位功能。", nearbyLoaded: "已加载当前位置附近的地点。", nearbyEmpty: "当前位置附近没有可发布的地点。", permissionDenied: "需要位置权限，请允许定位或手动搜索地点。", positionUnavailable: "无法确认当前位置，请手动搜索地点。", timeout: "定位超时，请重试。", locationFailed: "无法确认当前位置。", selectPlace: "请从搜索结果中选择地点并填写一句话点评。", blockedReview: "点评中含有不可使用的表达。", created: "景点已发布，10秒后将临时通过并公开。", deleteConfirm: "要删除这个景点吗？", deleted: "景点已删除。", blockedComment: "评论中含有不可使用的表达。", commentCreated: "评论已提交，审核后将对其他用户显示。", photoAlt: "{name}照片", openPost: "打开{name}帖子", previewAlt: "{name}预览", postPhotoAlt: "{name}帖子照片", spotPlaceholder: "景点卡片占位 {index}", rankingPlaceholder: "排行卡片占位 {rank}" },
  },
};

function getMessage(messages, key) {
  return key.split(".").reduce((value, part) => value?.[part], messages);
}

export function createTranslator(language) {
  const messages = MESSAGES[SUPPORTED_LANGUAGES.includes(language) ? language : "ko"];
  return (key, values = {}) => {
    const template = getMessage(messages, key) ?? getMessage(MESSAGES.ko, key) ?? key;
    if (typeof template !== "string") return key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
  };
}

export function translateError(error, t, fallbackKey = "common.requestError") {
  if (error?.code === "NETWORK_ERROR") return t("common.networkError");
  return t(fallbackKey);
}

export function localizeQuest(quest, t) {
  if (!quest || !MESSAGES.ko.quests[quest.id]) return quest;
  return {
    ...quest,
    name: t(`quests.${quest.id}.name`),
    description: t(`quests.${quest.id}.description`),
  };
}
