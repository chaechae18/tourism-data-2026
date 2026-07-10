import { useState } from "react";
import { Check, ChevronRight, Globe2, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { LANGUAGES, PROFILE_MENU, QUESTS } from "../../lib/app-data";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";

export default function MyPageTab({ completedQuestIds, onLogout, onNotice, user, setUser }) {
  const [nickname, setNickname] = useState(user.nickname);
  const saveNickname = () => {
    setUser((current) => ({ ...current, nickname: nickname.trim() || current.nickname }));
    onNotice("닉네임을 저장했어요.");
  };

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow="My page" title="내 여행 설정" />
      <div className="border-y border-[#e6ddd2] py-5">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1df] text-[#a45118]"><Pencil size={20} /></div><div><p className="font-bold text-[#241b16]">{user.nickname}</p><p className="mt-0.5 text-xs text-[#7c6d61]">{user.email}</p></div></div>
        <div className="mt-4 flex gap-2"><input value={nickname} onChange={(event) => setNickname(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-[#d9cfc2] px-3 text-sm outline-none focus:border-[#b8661c]" aria-label="닉네임" /><AppButton size="sm" onClick={saveNickname}>저장</AppButton></div>
      </div>

      <div>
        <p className="mb-3 text-sm font-bold text-[#241b16]">언어 설정</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LANGUAGES.map((language) => <button key={language.id} type="button" onClick={() => setUser((current) => ({ ...current, language: language.id }))} className={`h-11 rounded-lg border text-sm font-bold ${user.language === language.id ? "border-[#b8661c] bg-[#fff1df] text-[#8f4515]" : "border-[#d9cfc2] bg-white text-[#6f6256]"}`}>{language.label}</button>)}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-bold text-[#241b16]">내가 다녀간 장소</p>
        <div className="space-y-2">
          {QUESTS.filter((quest) => completedQuestIds.includes(quest.id)).map((quest) => <div key={quest.id} className="flex items-center gap-3 border border-[#e6ddd2] bg-white p-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e0f0eb] text-[#287c70]"><Check size={16} /></span><span className="flex-1 font-bold text-[#241b16]">{quest.name}</span><MapPin size={16} className="text-[#8a7d71]" /></div>)}
          {!completedQuestIds.length && <p className="text-sm text-[#7c6d61]">아직 방문 완료한 장소가 없어요.</p>}
        </div>
      </div>

      <div className="divide-y divide-[#e6ddd2] border-y border-[#e6ddd2]">
        {PROFILE_MENU.map((item) => <button key={item.id} type="button" onClick={() => item.id === "withdraw" ? onLogout() : onNotice(`${item.label} 화면은 백엔드 연결 후 제공됩니다.`)} className="flex w-full items-center gap-3 py-4 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8f3ed] text-[#7c6d61]">{item.id === "privacy" ? <ShieldCheck size={16} /> : item.id === "contact" ? <Globe2 size={16} /> : <ChevronRight size={16} />}</span><span className="flex-1 text-sm font-bold text-[#241b16]">{item.label}</span><ChevronRight size={16} className="text-[#8a7d71]" /></button>)}
      </div>
    </section>
  );
}
