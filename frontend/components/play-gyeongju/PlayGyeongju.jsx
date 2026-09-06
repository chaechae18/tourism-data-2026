"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut, PawPrint } from "lucide-react";
import { DEFAULT_USER, QUESTS } from "../../lib/app-data";
import { localizeQuest, translateError } from "../../lib/i18n";
import { notifyQuestCompleted } from "../../lib/api/notifications";
import {
  completeQuest as saveQuestCompletion,
  fetchCourse,
  fetchSelectedRole,
  refreshCourse,
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
import { IconButton } from "../ui/AppButton";
import { useI18n } from "../i18n/LanguageProvider";

const INITIAL_TAB = "home";
const INITIAL_SELECTED_QUEST_ID = "bunhwangsa";
const NOTICE_DURATION = 2800;
const GUIDE_SEEN_KEY = "playgyeongju.guideSeen";

export default function PlayGyeongju() {
  const { language, t } = useI18n();
  const [entered, setEntered] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState(null);
  const [activeTab, setActiveTab] = useState(INITIAL_TAB);
  const [user, setUser] = useState(DEFAULT_USER);
  const [completedQuestIds, setCompletedQuestIds] = useState([]);
  const [selectedQuestId, setSelectedQuestId] = useState(INITIAL_SELECTED_QUEST_ID);
  const [outfit, setOutfit] = useState({});
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

  // 지난번에 고른 역할로 돌아간다. 처음 들어온 사용자면 기본값(왕)으로 시작한다.
  useEffect(() => {
    if (!entered) return undefined;

    const controller = new AbortController();
    fetchSelectedRole({ signal: controller.signal })
      .then((saved) => {
        const known = saved?.key && ROLES.some((item) => item.key === saved.key);
        setRoleKey(known ? saved.key : ROLES[0].key);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setRoleKey(ROLES[0].key);
      });
    return () => controller.abort();
  }, [entered]);

  useEffect(() => {
  const checkLogin = async () => {
    try {
      const response = await fetch(
        "http://localhost:8001/api/v1/auth/me",
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
}, []);

  useEffect(() => {
    if (!entered || !courseRoleKey) return undefined;

    const controller = new AbortController();
    setCourseError("");
    fetchCourse({ language, persona: courseRoleKey, signal: controller.signal, t })
      .then((course) => {
        if (!course.places.length) return;
        setCoursePlaces(course.places);
        setSelectedQuestId(course.places[0].id);
        // 서버에 저장해 둔 방문 완료 기록을 그대로 되살린다.
        setCompletedQuestIds(course.places.filter((place) => place.completed).map((place) => place.id));
      })
      // 코스를 못 받아오면 기존 샘플 장소로 지도를 그린다. 왜 실패했는지는 알려 준다.
      .catch((error) => {
        if (error.name === "AbortError") return;
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

  const rerollCourse = () => {
    if (!role.ready) {
      showNotice(t("play.coursePendingShort", { name: roleName }));
      return;
    }
    refreshCourse({ language, persona: role.key, t })
      .then((course) => {
        if (!course.places.length) return;
        setCoursePlaces(course.places);
        setSelectedQuestId(course.places[0].id);
        // 코스가 바뀌면 퀘스트도 새로 생기므로 완료 표시도 새 코스 기준으로 맞춘다.
        setCompletedQuestIds(course.places.filter((place) => place.completed).map((place) => place.id));
        showNotice(t("play.courseRerolled"));
      })
      .catch((error) => {
        console.error("[코스 다시 뽑기 실패]", error);
        showNotice(translateError(error, t, "play.courseRerollError"));
      });
  };

  const selectRole = (nextRole) => {
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

  const enterApp = (data = {}) => {
    const profile = data?.user ?? data;

    setUser({
      ...DEFAULT_USER,
      ...profile,
    });

    setAuthMode(null);
    setEntered(true);
  };
  
  const logout = () => {
    setEntered(false);
    setUser(DEFAULT_USER);
    setCompletedQuestIds([]);
    setSelectedQuestId(INITIAL_SELECTED_QUEST_ID);
    setOutfit({});
    setNotificationVersion(0);
  };

  const completeQuest = async (id) => {
    if (completedQuestIds.includes(id)) return;
    // 지금 지도에 그린 장소들 중에서 찾는다. (샘플 장소든 서버 코스든 여기 들어 있다)
    const quest = places.find((item) => item.id === id);
    if (!quest) return;

    setCompletedQuestIds((current) => [...current, id]);

    // 서버 코스에서 온 장소면 방문 완료를 저장한다. 저장에 실패하면 완료 표시를 되돌린다.
    if (quest.questId) {
      try {
        await saveQuestCompletion({ questId: quest.questId });
      } catch (error) {
        setCompletedQuestIds((current) => current.filter((item) => item !== id));
        showNotice(error.message || "방문 완료를 저장하지 못했어요.");
        return;
      }
      showNotice("방문 완료를 저장했어요.");
    } else {
      showNotice("방문 완료로 표시했어요.");
    }

    try {
      await notifyQuestCompleted(quest);
      setNotificationVersion((current) => current + 1);
    } catch (error) {
      showNotice(translateError(error, t));
    }
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
    <div className="min-h-[100svh] bg-[#edf0ed]">
      <div className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-[#f7f7f5] pb-24 shadow-[0_0_32px_rgba(52,50,53,0.08)]">
      <header className="border-b border-[#e2e4e0] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => setActiveTab("home")} className="flex items-center gap-2 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bd8c31] text-white"><PawPrint size={18} /></span><span><span className="block font-semibold text-[#343235]">Play Gyeongju</span><span className="block text-xs text-[#747579]">{user.nickname}</span></span></button>
          <div className="flex items-center gap-2">
            <NotificationButton refreshKey={notificationVersion} />
            <IconButton icon={LogOut} label={t("play.logout")} onClick={() => setEntered(false)} />
          </div>
        </div>
      </header>

      {courseError && (
        <p className="mx-4 mt-3 rounded-lg border border-[#e3c2b4] bg-[#fbeee8] px-3 py-2 text-xs font-semibold text-[#9f4a2c]">
          {t("play.courseFallback", { message: courseError })}
        </p>
      )}

      <main className="w-full px-4 py-6">
        {activeTab === "home" && <HomeTab language={language} onMapOpen={() => setActiveTab("map")} popupHidden={guideOpen} />}
        {activeTab === "my-dg" && <MyDGTab completedQuestIds={completedQuestIds} onMapQuest={openQuestOnMap} onSaveOutfit={() => showNotice(t("play.outfitSaved"))} outfit={outfit} places={places} setOutfit={setOutfit} />}
        {activeTab === "map" && <GyeongjuMap2D completedQuestIds={completedQuestIds} onComplete={completeQuest} onOpenRoles={() => setRoleOpen(true)} onReroll={rerollCourse} onSelect={(quest) => setSelectedQuestId(quest.id)} places={places} roleName={roleName} selectedPlace={selectedQuest} />}
        {activeTab === "spots" && <SpotsTab user={user} />}
        {activeTab === "my-page" && <MyPageTab completedQuestIds={completedQuestIds} onLogout={logout} onNotice={showNotice} onOpenGuide={reopenGuide} setUser={setUser} user={user} />}
      </main>

      {notice && <div className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-lg bg-[#343235] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">{notice}</div>}
      {guideOpen && <AppGuide onDone={finishGuide} onTabChange={setActiveTab} />}
      <RoleSelect onClose={() => setRoleOpen(false)} onSelect={selectRole} open={roleOpen} selectedKey={roleKey} />
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}
