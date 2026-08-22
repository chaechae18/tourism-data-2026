import { useState } from "react";
import { Check, ChevronRight, Globe2, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { LANGUAGES, PROFILE_MENU, QUESTS } from "../../lib/app-data";
import { createTranslator } from "../../lib/i18n";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";
import VisitedPlaces from "./VisitedPlaces";
import PersonalInfoEdit from "./PersonalInfoEdit";

export default function MyPageTab({ completedQuestIds, onLogout, onNotice, user, setUser }) {
  const { changeLanguage, language: currentLanguage, saving, t } = useI18n();
  const [nickname, setNickname] = useState(user.nickname);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [showVisitedPlaces, setShowVisitedPlaces] = useState(false);
  const saveNickname = () => {
    setUser((current) => ({ ...current, nickname: nickname.trim() || current.nickname }));
    onNotice(t("myPage.nicknameSaved"));
  };
  const selectLanguage = async (language) => {
    try {
      await changeLanguage(language.id);
      onNotice(createTranslator(language.id)("myPage.saved"));
    } catch {
      onNotice(t("myPage.saveFailed"));
    }
  };

  if (showVisitedPlaces) {
    return (
      <VisitedPlaces
        completedQuestIds={completedQuestIds}
        onClose={() => setShowVisitedPlaces(false)}
      />
    );
  }

  if (showPersonalInfo) {
    return (
      <PersonalInfoEdit
        user={user}
        setUser={setUser}
        onClose={() => setShowPersonalInfo(false)}
        onNotice={onNotice}
      />
    );
  }

  return (

    
    <section className="space-y-8">
      <SectionHeading eyebrow="My page" title={t("myPage.title")} />

      <button 
        type="button" 
        onClick={() => setShowVisitedPlaces(true)} 
        className="flex w-full items-center justify-between rounded-2xl border border-[#e2e4e0] bg-white p-4 text-left shadow-sm transition-colors duration-200 hover:bg-[#faf9f6]" 
      >
        <div className="flex items-center gap-3"> 
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f1e9] text-[#bd8c31]"> 
            <MapPin size={20} /> 
          </div> 

          <div> 
            <p className="text-sm font-bold text-[#343235]"> 
              내가 다녀간 장소 
            </p> 

            <p className="mt-1 text-xs text-[#747579]"> 
              방문한 경주 명소를 확인해보세요. 
            </p> 
          </div> 
        </div> 

        <ChevronRight 
          size={19} 
          className="text-[#a0a1a3]" 
        /> 
      </button>
      <div>
        <p className="mb-3 text-sm font-bold text-[#241b16]">
          {t("myPage.language")}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((language) => (
            <button
              key={language.id}
              type="button"
              disabled={saving}
              onClick={() => selectLanguage(language)}
              className={`h-11 rounded-lg border text-sm font-bold disabled:opacity-60 ${
                currentLanguage === language.id
                  ? "border-[#b8661c] bg-[#fff1df] text-[#8f4515]"
                  : "border-[#d9cfc2] bg-white text-[#6f6256]"
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-bold text-[#241b16]">
          {t("myPage.privacy")}
        </p>

        <div className="divide-y divide-[#e6ddd2] border-y border-[#e6ddd2]">

          {PROFILE_MENU.map((item) => {
            const label = t(`myPage.${item.id}`);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "privacy") {
                    setShowPersonalInfo(true);
                    return;
                  }

                  if (item.id === "withdraw") {
                    onLogout();
                    return;
                  }

                  onNotice(
                    t("myPage.unavailable", {
                      name: label,
                    })
                  );
                }}
                className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:bg-[#faf9f6]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f8f3ed] text-[#7c6d61]">
                  {item.id === "privacy" ? (
                    <ShieldCheck size={16} />
                  ) : item.id === "contact" ? (
                    <Globe2 size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>

                <span className="flex-1 text-sm font-bold text-[#241b16]">
                  {label}
                </span>

                <ChevronRight
                  size={16}
                  className="text-[#8a7d71]"
                />
              </button>
            );
          })}

        </div>
      </div>
     
    </section>
  );
}
