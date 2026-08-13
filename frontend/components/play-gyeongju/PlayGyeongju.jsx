"use client";

import { useEffect, useState } from "react";
import { LogOut, PawPrint } from "lucide-react";
import { DEFAULT_USER, QUESTS } from "../../lib/app-data";
import { notifyQuestCompleted } from "../../lib/api/notifications";
import { completeQuest as saveQuestCompletion, fetchCourse, refreshCourse } from "../../lib/api/journey";
import RoleSelect, { ROLES } from "../journey/RoleSelect";
import AuthModal from "../auth/AuthModal";
import HomeTab from "../home/HomeTab";
import IntroScreen from "../intro/IntroScreen";
import BottomNavigation from "../layout/BottomNavigation";
import GyeongjuMap2D from "../map/GyeongjuMap2D";
import MyDGTab from "../my-dg/MyDGTab";
import MyPageTab from "../my-page/MyPageTab";
import NotificationButton from "../notifications/NotificationButton";
import SpotsTab from "../spots/SpotsTab";
import { IconButton } from "../ui/AppButton";

const INITIAL_TAB = "home";
const INITIAL_SELECTED_QUEST_ID = "bunhwangsa";
const NOTICE_DURATION = 2800;

export default function PlayGyeongju() {
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
  // 캐릭터 코스는 백엔드가 뽑아 준다. 아직 저장하지 않아서 새로고침하면 달라진다.
  const [coursePlaces, setCoursePlaces] = useState(null);
  const [courseError, setCourseError] = useState("");
  const [roleKey, setRoleKey] = useState("king");
  const [roleOpen, setRoleOpen] = useState(false);

  const role = ROLES.find((item) => item.key === roleKey) || ROLES[0];

  // 코스 규칙이 아직 없는 역할은 왕 코스를 그대로 둔다.
  const courseRoleKey = role.ready ? role.key : null;

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
    fetchCourse({ persona: courseRoleKey, signal: controller.signal })
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
        setCourseError(error.message || "코스를 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [courseRoleKey, entered]);

  const rerollCourse = () => {
    if (!role.ready) {
      showNotice(`${role.name} 코스는 준비 중이에요.`);
      return;
    }
    refreshCourse({ persona: role.key })
      .then((course) => {
        if (!course.places.length) return;
        setCoursePlaces(course.places);
        setSelectedQuestId(course.places[0].id);
        // 코스가 바뀌면 퀘스트도 새로 생기므로 완료 표시도 새 코스 기준으로 맞춘다.
        setCompletedQuestIds(course.places.filter((place) => place.completed).map((place) => place.id));
        showNotice("새 코스를 뽑았어요.");
      })
      .catch((error) => {
        console.error("[코스 다시 뽑기 실패]", error);
        showNotice(error.message || "코스를 다시 뽑지 못했어요.");
      });
  };

  const selectRole = (nextRole) => {
    setRoleKey(nextRole.key);
    setRoleOpen(false);
    showNotice(
      nextRole.ready
        ? `${nextRole.name} 코스를 지도에 그렸어요.`
        : `${nextRole.name} 코스는 준비 중이에요. 지금은 왕 코스가 보여요.`,
    );
  };

  const places = coursePlaces || QUESTS;
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
      showNotice(error.message);
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
            <IconButton icon={LogOut} label="로그아웃" onClick={() => setEntered(false)} />
          </div>
        </div>
      </header>

      {courseError && (
        <p className="mx-4 mt-3 rounded-lg border border-[#e3c2b4] bg-[#fbeee8] px-3 py-2 text-xs font-semibold text-[#9f4a2c]">
          코스를 불러오지 못해 샘플 장소를 보여주고 있어요 — {courseError}
        </p>
      )}

      <main className="w-full px-4 py-6">
        {activeTab === "home" && <HomeTab language={user.language} onMapOpen={() => setActiveTab("map")} />}
        {activeTab === "my-dg" && <MyDGTab completedQuestIds={completedQuestIds} onMapQuest={openQuestOnMap} onSaveOutfit={() => showNotice("현재 착장을 저장했어요.")} outfit={outfit} places={places} setOutfit={setOutfit} />}
        {activeTab === "map" && <GyeongjuMap2D completedQuestIds={completedQuestIds} onComplete={completeQuest} onOpenRoles={() => setRoleOpen(true)} onReroll={rerollCourse} onSelect={(quest) => setSelectedQuestId(quest.id)} places={places} roleName={role.name} selectedPlace={selectedQuest} />}
        {activeTab === "spots" && <SpotsTab user={user} />}
        {activeTab === "my-page" && <MyPageTab completedQuestIds={completedQuestIds} onLogout={logout} onNotice={showNotice} setUser={setUser} user={user} />}
      </main>

      {notice && <div className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-lg bg-[#343235] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">{notice}</div>}
      <RoleSelect onClose={() => setRoleOpen(false)} onSelect={selectRole} open={roleOpen} selectedKey={roleKey} />
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}
