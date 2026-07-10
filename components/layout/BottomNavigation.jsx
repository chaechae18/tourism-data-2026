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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e6ddd2] bg-white/95 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:static lg:rounded-lg lg:border lg:p-2" aria-label="주요 메뉴">
      <div className="mx-auto flex w-full max-w-5xl justify-between gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-bold transition-colors ${active ? "bg-[#fff1df] text-[#8f4515]" : "text-[#7c6d61] hover:bg-[#f8f3ed]"}`}
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
