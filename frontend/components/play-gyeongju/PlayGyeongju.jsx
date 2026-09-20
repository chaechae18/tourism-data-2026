"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_USER, QUESTS } from "../../lib/app-data";
import { localizeQuest, translateError } from "../../lib/i18n";
import { notifyQuestCompleted } from "../../lib/api/notifications";
import { fetchInventory, saveOutfit } from "../../lib/api/inventory";
import { DONGGYEONG_ITEMS } from "../../lib/donggyeong/role-outfit";
import {
  completeQuest as saveQuestCompletion,
  fetchCourse,
  fetchSelectedRole,
} from "../../lib/api/journey";
import RoleSelect, { ROLES } from "../journey/RoleSelect";
import AuthModal from "../auth/AuthModal";
import HomeTab from "../home/HomeTab";
import AppGuide from "../intro/AppGuide";
import IntroScreen from "../intro/IntroScreen";
import BottomNavigation from "../layout/BottomNavigation";
import GyeongjuMap2D from "../map/GyeongjuMap2D";
import MyDGTab from "../my-dg/MyDGTab";
import MyPageTab from "../my-page/MyPageTab";
import NotificationButton from "../notifications/NotificationButton";
import SpotsTab from "../spots/SpotsTab";
import { useI18n } from "../i18n/LanguageProvider";

const INITIAL_TAB = "home";
const INITIAL_SELECTED_QUEST_ID = "bunhwangsa";
const NOTICE_DURATION = 2800;
const GUIDE_SEEN_KEY = "playgyeongju.guideSeen";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export default function PlayGyeongju() {
  const { language, reloadLanguage, resetLanguage, t } = useI18n();
  const [entered, setEntered] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState(null);
  const [activeTab, setActiveTab] = useState(INITIAL_TAB);
  const [user, setUser] = useState(DEFAULT_USER);
  const [completedQuestIds, setCompletedQuestIds] = useState([]);
  const [selectedQuestId, setSelectedQuestId] = useState(INITIAL_SELECTED_QUEST_ID);
  const [outfit, setOutfit] = useState({});
  const [ownedItemIds, setOwnedItemIds] = useState([]);
  const inventoryRevision = useRef(0);
  const availableItems = useMemo(() => DONGGYEONG_ITEMS.filter((item) => ownedItemIds.includes(item.id)), [ownedItemIds]);
  const [notice, setNotice] = useState("");
  const [notificationVersion, setNotificationVersion] = useState(0);
  // 캐릭터 코스는 백엔드가 뽑아서 저장해 둔다. 다시 들어와도 같은 코스가 나온다.
  const [coursePlaces, setCoursePlaces] = useState(null);
  const [courseError, setCourseError] = useState("");
  // null = 서버에 저장된 역할을 아직 읽는 중. 다 읽기 전에는 코스를 부르지 않는다.
  // (먼저 부르면 기본값인 왕이 '고른 역할'로 저장돼 버린다)
  const [roleKey, setRoleKey] = useState(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const role = ROLES.find((item) => item.key === roleKey) || ROLES[0];
  const roleName = t(`roles.${role.key}.name`);

  // 역할을 아직 못 읽었으면 코스도 부르지 않는다.
  const courseRoleKey = roleKey && role.ready ? role.key : null;

  const applyInventory = (saved) => {
    setOwnedItemIds(saved.items.map((item) => item.id));
    setOutfit(saved.outfit);
  };

  useEffect(() => {
    const revision = ++inventoryRevision.current;
    setOwnedItemIds([]);
    setOutfit({});
    if (!entered || !courseRoleKey) return undefined;
    const controller = new AbortController();
    fetchInventory({ persona: courseRoleKey, signal: controller.signal })
      .then((saved) => {
        if (!controller.signal.aborted && revision === inventoryRevision.current) applyInventory(saved);
      })
      .catch((error) => {
        if (!controller.signal.aborted) showNotice(error.message);
      });
    return () => controller.abort();
  }, [entered, courseRoleKey]);

  const persistOutfit = async () => {
    const revision = ++inventoryRevision.current;
    try {
      const saved = await saveOutfit({ persona: courseRoleKey, outfit });
      if (revision !== inventoryRevision.current) return;
      applyInventory(saved);
      showNotice(t("play.outfitSaved"));
    } catch (error) {
      showNotice(error.message);
    }
  };

  // OAuth 로그인 결과 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error === "USER_DELETED") {
      alert("탈퇴한 회원입니다.");

      // URL에서 error 파라미터 제거
      params.delete("error");

      const query = params.toString();

      const cleanUrl =
        window.location.pathname +
        (query ? `?${query}` : "") +
        window.location.hash;

      window.history.replaceState({}, "", cleanUrl);

      return;
    }

    if (error === "KAKAO_LOGIN_ERROR") {
      alert("카카오 로그인 중 오류가 발생했습니다.");

      params.delete("error");

      const query = params.toString();

      const cleanUrl =
        window.location.pathname +
        (query ? `?${query}` : "") +
        window.location.hash;

      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);
  // 선택 이력이 없으면 코스를 만들기 전에 역할 선택 창을 연다.
  useEffect(() => {
    if (!entered) return undefined;

    const controller = new AbortController();
    fetchSelectedRole({ signal: controller.signal })
      .then((saved) => {
        if (controller.signal.aborted) return;
        const known = saved?.key && ROLES.some((item) => item.key === saved.key);
        setRoleKey(known ? saved.key : null);
        if (!known) setRoleOpen(true);
      })
      .catch((error) => {
        if (controller.signal.aborted || error.name === "AbortError") return;
        setRoleKey(null);
        setRoleOpen(true);
      });
    return () => controller.abort();
  }, [entered]);

  useEffect(() => {
  const checkLogin = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/me`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        setEntered(false);
        setAuthMode(null);
        return;
      }

      const data = await response.json();

      if (data?.user) {
        setUser((current) => ({
          ...DEFAULT_USER,
          ...data.user,
        }));

        await reloadLanguage().catch(() => undefined);
        setEntered(true);
      }
    } catch (error) {
      console.error("로그인 상태 확인 실패:", error);
      setEntered(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  checkLogin();
}, [reloadLanguage]);

  useEffect(() => {
    if (!entered || !courseRoleKey) return undefined;

    const controller = new AbortController();
    setCourseError("");
    fetchCourse({ language, persona: courseRoleKey, signal: controller.signal, t })
      .then((course) => {
        if (controller.signal.aborted) return;
        if (!course.places.length) return;
        setCoursePlaces(course.places);
        setSelectedQuestId(course.places[0].id);
        // 서버에 저장해 둔 방문 완료 기록을 그대로 되살린다.
        setCompletedQuestIds(course.places.filter((place) => place.completed).map((place) => place.id));
      })
      // 코스를 못 받아오면 기존 샘플 장소로 지도를 그린다. 왜 실패했는지는 알려 준다.
      .catch((error) => {
        if (controller.signal.aborted || error.name === "AbortError") return;
        console.error("[코스 불러오기 실패]", error);
        setCourseError(translateError(error, t, "play.courseLoadError"));
      });
    return () => controller.abort();
  }, [courseRoleKey, entered, language, t]);

  // 앱 설명은 처음 들어온 사람에게만 한 번 띄운다. 다시 보기는 내 정보 탭에서.
  useEffect(() => {
    if (!entered || window.localStorage.getItem(GUIDE_SEEN_KEY)) return;
    setGuideOpen(true);
  }, [entered]);

  const finishGuide = () => {
    window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
    setGuideOpen(false);
    setActiveTab(INITIAL_TAB);
    setRoleOpen(true);
  };

  const reopenGuide = () => {
    window.localStorage.removeItem(GUIDE_SEEN_KEY);
    setGuideOpen(true);
  };

  const selectRole = (nextRole) => {
    if (nextRole.key !== roleKey) {
      inventoryRevision.current += 1;
      setCoursePlaces(null);
      setCompletedQuestIds([]);
    }
    setRoleKey(nextRole.key);
    setRoleOpen(false);
    showNotice(
      nextRole.ready
        ? t("play.courseReady", { name: nextRole.name })
        : t("play.coursePending", { name: nextRole.name }),
    );
  };

  const fallbackPlaces = useMemo(() => QUESTS.map((quest) => localizeQuest(quest, t)), [t]);
  const places = coursePlaces || fallbackPlaces;
  const selectedQuest = places.find((quest) => quest.id === selectedQuestId) || places[0];

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), NOTICE_DURATION);
  };

  const enterApp = async (data = {}) => {
    const profile = data?.user ?? data;

    resetLanguage();
    setRoleKey(null);
    setCoursePlaces(null);
    setCompletedQuestIds([]);
    setSelectedQuestId(INITIAL_SELECTED_QUEST_ID);
    setUser({
      ...DEFAULT_USER,
      ...profile,
    });

    setAuthMode(null);
    await reloadLanguage().catch(() => undefined);
    setEntered(true);
    setActiveTab(INITIAL_TAB);
  };
  
  const logout = async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/auth/logout`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error("로그아웃 API 실패:", response.status);
    }
  } catch (error) {
    console.error("로그아웃 요청 실패:", error);
  } finally {
    setEntered(false);
    setUser(DEFAULT_USER);
    setCompletedQuestIds([]);
    setSelectedQuestId(INITIAL_SELECTED_QUEST_ID);
    setOutfit({});
    setNotificationVersion(0);
    setCoursePlaces(null);
    setCourseError("");
    setRoleKey(null);
    resetLanguage();
    setAuthMode(null);
  }
};
  const handleWithdraw = async () => {
  const confirmed = window.confirm(
    "정말 회원탈퇴하시겠습니까?\n탈퇴한 계정은 복구할 수 없습니다."
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/auth/withdraw`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "회원탈퇴에 실패했습니다.");
    }

    alert("회원탈퇴가 완료되었습니다.");

    // 로그아웃과 동일하게 프론트 상태 초기화
    setEntered(false);
    setUser(DEFAULT_USER);
    setCompletedQuestIds([]);
    setSelectedQuestId(INITIAL_SELECTED_QUEST_ID);
    setOutfit({});
    setNotificationVersion(0);
    setCoursePlaces(null);
    setCourseError("");
    setAuthMode(null);

  } catch (error) {
    console.error("회원탈퇴 실패:", error);
    alert(error.message || "회원탈퇴에 실패했습니다.");
  }
};
  const completeQuest = async (id, position) => {
    if (completedQuestIds.includes(id)) return false;
    const quest = places.find((item) => item.id === id);
    if (!quest) return false;

    // 서버가 확인한 완료와 보상만 반영한다. 샘플 장소는 지급할 수 없다.
    if (!quest.questId) throw new Error("코스를 불러온 후 다시 시도해 주세요.");
    const revision = ++inventoryRevision.current;
    const saved = await saveQuestCompletion({ questId: quest.questId, ...position });
    if (!saved.completed || revision !== inventoryRevision.current) return false;
    applyInventory(saved.inventory);

    setCompletedQuestIds((current) => [...current, id]);
    try {
      await notifyQuestCompleted(quest);
      setNotificationVersion((current) => current + 1);
    } catch (error) {
      showNotice(translateError(error, t));
    }
    return saved;
  };

  const openQuestOnMap = (quest) => {
    setSelectedQuestId(quest.id);
    setActiveTab("map");
  };

  if (checkingAuth) {
    return null;
  }

  if (!entered) {
    return (
      <>
        <IntroScreen onAuth={setAuthMode} />
        <AuthModal mode={authMode}  onClose={() => setAuthMode(authMode === "signup" ? "login" : null)} onComplete={enterApp} onAuth={setAuthMode} />
      </>
    );
  }

  return (
    <div className="min-h-[100svh] bg-white">
      <div className={`mx-auto w-full max-w-[430px] bg-white shadow-[0_0_32px_rgba(52,50,53,0.08)] ${activeTab === "spots" ? "flex h-[100dvh] flex-col overflow-hidden pb-[var(--bottom-nav-height)]" : "min-h-[100svh] pb-24"}`}>
      <header className="relative z-30 shrink-0 bg-white/90 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => setActiveTab("home")} className="text-left font-semibold text-[#343235]">Play Gyeongju</button>
          <NotificationButton refreshKey={notificationVersion} />
        </div>
      </header>


      {courseError && (
        <p className="mx-4 mt-3 rounded-lg border border-[#e3c2b4] bg-[#fbeee8] px-3 py-2 text-xs font-semibold text-[#9f4a2c]">
          {t("play.courseFallback", { message: courseError })}
        </p>
      )}

      <main className={`w-full px-4 ${activeTab === "map" ? "pt-0" : "pt-1"} ${activeTab === "spots" ? "flex min-h-0 flex-1 flex-col" : "pb-6"}`}>
        {activeTab === "home" && <HomeTab language={language} onMapOpen={() => setActiveTab("map")} popupHidden={guideOpen} />}
        {activeTab === "my-dg" && <MyDGTab availableItems={availableItems} completedQuestIds={completedQuestIds} onMapQuest={openQuestOnMap} onSaveOutfit={persistOutfit} outfit={outfit} places={places} setOutfit={setOutfit} />}
        {activeTab === "map" && <GyeongjuMap2D completedQuestIds={completedQuestIds} onComplete={completeQuest} onOpenRoles={() => setRoleOpen(true)} onSelect={(quest) => setSelectedQuestId(quest.id)} places={places} roleName={roleName} selectedPlace={selectedQuest} />}
        {activeTab === "spots" && <SpotsTab key={user.user_no ?? user.userNo ?? user.userId ?? "guest"} user={user} />}
        {activeTab === "my-page" && <MyPageTab completedQuestIds={completedQuestIds} onLogout={logout} onNotice={showNotice} onOpenGuide={reopenGuide} setUser={setUser} user={user} onWithdraw={handleWithdraw} />}
      </main>

      {notice && <div className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-lg bg-[#343235] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">{notice}</div>}
      {guideOpen && <AppGuide onDone={finishGuide} onTabChange={setActiveTab} />}
      <RoleSelect onClose={() => setRoleOpen(false)} onSelect={selectRole} open={roleOpen} selectedKey={roleKey} />
      {activeTab !== "home" && <p className="pb-24 text-center text-[12px] font-normal text-[#aaa59d]">출처: ⓒ한국관광공사</p>}
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}
