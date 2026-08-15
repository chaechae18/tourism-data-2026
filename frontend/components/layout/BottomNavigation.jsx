import { Home, Map, PawPrint, Sparkles, UserRound } from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";

const NAV_ITEMS = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "my-dg", labelKey: "nav.donggyeong", icon: PawPrint },
  { id: "map", labelKey: "nav.map", icon: Map },
  { id: "spots", labelKey: "nav.spots", icon: Sparkles },
  { id: "my-page", labelKey: "nav.my", icon: UserRound },
];

export default function BottomNavigation({ activeTab, onChange }) {
  const { t } = useI18n();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[#e2e4e0] bg-white/95 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur" aria-label={t("nav.label")}>
      <div className="flex w-full justify-between gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${active ? "bg-[#eaf3f0] text-[#24746f]" : "text-[#747579] hover:bg-[#f1f4f2]"}`}
            >
              <Icon size={18} />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
