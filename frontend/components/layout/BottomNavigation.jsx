import { Home, Map, PawPrint, Sparkles, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "my-dg", label: "MyDG", icon: PawPrint },
  { id: "map", label: "Map", icon: Map },
  { id: "spots", label: "Spots", icon: Sparkles },
  { id: "my-page", label: "My", icon: UserRound },
];

export default function BottomNavigation({ activeTab, onChange }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[#e2e4e0] bg-white/95 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur" aria-label="주요 메뉴">
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
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
