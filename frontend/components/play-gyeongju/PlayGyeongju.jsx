"use client";

import { useState } from "react";
import { LogOut, PawPrint } from "lucide-react";
import { DEFAULT_USER, QUESTS, SPOT_COMMENTS, SPOT_RANKING } from "../../lib/app-data";
import AuthModal from "../auth/AuthModal";
import HomeTab from "../home/HomeTab";
import IntroScreen from "../intro/IntroScreen";
import BottomNavigation from "../layout/BottomNavigation";
import GyeongjuMap2D from "../map/GyeongjuMap2D";
import MyDGTab from "../my-dg/MyDGTab";
import MyPageTab from "../my-page/MyPageTab";
import SpotsTab from "../spots/SpotsTab";
import { IconButton } from "../ui/AppButton";

const INITIAL_TAB = "home";
const INITIAL_SELECTED_QUEST_ID = "bunhwangsa";
const NOTICE_DURATION = 2800;

function cloneComments() {
  return Object.fromEntries(Object.entries(SPOT_COMMENTS).map(([id, comments]) => [id, [...comments]]));
}

export default function PlayGyeongju() {
  const [entered, setEntered] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [activeTab, setActiveTab] = useState(INITIAL_TAB);
  const [user, setUser] = useState(DEFAULT_USER);
  const [completedQuestIds, setCompletedQuestIds] = useState([]);
  const [selectedQuestId, setSelectedQuestId] = useState(INITIAL_SELECTED_QUEST_ID);
  const [outfit, setOutfit] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [spots, setSpots] = useState(() => SPOT_RANKING.map((spot) => ({ ...spot })));
  const [commentsBySpot, setCommentsBySpot] = useState(cloneComments);
  const [notice, setNotice] = useState("");

  const selectedQuest = QUESTS.find((quest) => quest.id === selectedQuestId) || QUESTS[0];

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), NOTICE_DURATION);
  };

  const enterApp = (profile = {}) => {
    setUser((current) => ({ ...current, ...profile }));
    setAuthMode(null);
    setEntered(true);
  };

  const completeQuest = (id) => {
    setCompletedQuestIds((current) => current.includes(id) ? current : [...current, id]);
    showNotice("방문 완료로 표시했어요.");
  };

  const openQuestOnMap = (quest) => {
    setSelectedQuestId(quest.id);
    setActiveTab("map");
  };

  const addSpot = ({ place, photo, review, user: author }) => {
    setSpots((current) => [{ id: `my-spot-${Date.now()}`, rank: 0, user: author, place, review, likes: 0, comments: 0, photo, isMyPost: true }, ...current]);
  };

  const likeSpot = (id) => {
    setSpots((current) => current.map((spot) => spot.id === id ? { ...spot, likes: spot.likes + 1 } : spot));
  };

  const bookmarkSpot = (id) => {
    setBookmarks((current) => current.includes(id) ? current.filter((bookmark) => bookmark !== id) : [...current, id]);
  };

  const addComment = (id, comment) => {
    setCommentsBySpot((current) => ({ ...current, [id]: [...(current[id] || []), comment] }));
  };

  if (!entered) {
    return (
      <>
        <IntroScreen onAuth={setAuthMode} />
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onComplete={enterApp} onAuth={setAuthMode} />
      </>
    );
  }

  return (
    <div className="min-h-[100svh] bg-[#edf0ed]">
      <div className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-[#f7f7f5] pb-24 shadow-[0_0_32px_rgba(52,50,53,0.08)]">
      <header className="border-b border-[#e2e4e0] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => setActiveTab("home")} className="flex items-center gap-2 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bd8c31] text-white"><PawPrint size={18} /></span><span><span className="block font-semibold text-[#343235]">Play Gyeongju</span><span className="block text-xs text-[#747579]">{user.nickname}</span></span></button>
          <IconButton icon={LogOut} label="로그아웃" onClick={() => setEntered(false)} />
        </div>
      </header>

      <main className="w-full px-4 py-6">
        {activeTab === "home" && <HomeTab onMapOpen={() => setActiveTab("map")} />}
        {activeTab === "my-dg" && <MyDGTab completedQuestIds={completedQuestIds} onMapQuest={openQuestOnMap} onSaveOutfit={() => showNotice("현재 착장을 저장했어요.")} outfit={outfit} setOutfit={setOutfit} />}
        {activeTab === "map" && <GyeongjuMap2D completedQuestIds={completedQuestIds} onComplete={completeQuest} onDocent={(quest) => showNotice(`${quest.name} 도슨트를 준비하고 있어요.`)} onSelect={(quest) => setSelectedQuestId(quest.id)} selectedPlace={selectedQuest} />}
        {activeTab === "spots" && <SpotsTab bookmarks={bookmarks} commentsBySpot={commentsBySpot} onAddComment={addComment} onAddSpot={addSpot} onBookmark={bookmarkSpot} onLike={likeSpot} spots={spots} user={user} />}
        {activeTab === "my-page" && <MyPageTab completedQuestIds={completedQuestIds} onLogout={() => setEntered(false)} onNotice={showNotice} setUser={setUser} user={user} />}
      </main>

      {notice && <div className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-lg bg-[#343235] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">{notice}</div>}
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}
