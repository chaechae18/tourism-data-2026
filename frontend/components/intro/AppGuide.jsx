import { useEffect, useState } from "react";
import { Bell, Home, Map, PawPrint, Sparkles, UserRound } from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";

// tab 은 BottomNavigation 의 NAV_ITEMS id, key 는 i18n 의 guide 키. 안내가 진행되면 실제 탭이 같이 넘어간다.
const GUIDE_STEPS = [
  { key: "home", tab: "home", icon: Home, accent: "rgb(var(--color-brand))", tint: "rgb(var(--color-brand-soft))" },
  { key: "donggyeong", tab: "my-dg", icon: PawPrint, accent: "rgb(var(--color-brand))", tint: "rgb(var(--color-brand-soft))" },
  { key: "map", tab: "map", icon: Map, accent: "#2d6a8c", tint: "#e8f1f6" },
  { key: "spots", tab: "spots", icon: Sparkles, accent: "#a8557f", tint: "#f8eaf1" },
  { key: "my", tab: "my-page", icon: UserRound, accent: "#4f7a5c", tint: "#e9f2eb" },
];

export default function AppGuide({ onDone, onTabChange }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const step = GUIDE_STEPS[index];
  const last = index === GUIDE_STEPS.length - 1;
  const Icon = step.icon;

  useEffect(() => {
    onTabChange(GUIDE_STEPS[index].tab);
  }, [index, onTabChange]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div className="flex flex-1 items-end justify-center bg-[#343235]/60 px-4 pb-3">
        <div className="w-full max-w-[398px] rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgba(52,50,53,0.35)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: step.tint, color: step.accent }}>
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#343235]">{t(`guide.${step.key}.title`)}</p>
              <p className="mt-0.5 text-[12px] leading-[18px] text-[#7c7a76]">{t(`guide.${step.key}.description`)}</p>
            </div>
          </div>

          {index === 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#f4f6f3] px-3 py-2 text-[11px] leading-[17px] text-[#5f6560]">
              <Bell size={13} className="mt-0.5 shrink-0 text-brand" />
              <span>{t("guide.notification")}</span>
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden="true">
              {GUIDE_STEPS.map((item, dot) => (
                <span key={item.key} className="h-1.5 rounded-full transition-all" style={{ width: dot === index ? 18 : 6, backgroundColor: dot === index ? step.accent : "#dcdad5" }} />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <AppButton size="sm" variant="ghost" onClick={onDone}>{t("guide.skip")}</AppButton>
              <AppButton size="sm" onClick={() => (last ? onDone() : setIndex(index + 1))}>
                {last ? t("guide.start") : t("guide.next")}
              </AppButton>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 네비가 딤 밖으로 그대로 보이는 자리. 링만 실제 탭 위에 겹쳐 그린다. */}
      <div className="h-[74px]">
        <div className="mx-auto flex w-full max-w-[430px] gap-1 px-2 pt-2">
          {GUIDE_STEPS.map((item) => (
            <span
              key={item.key}
              className="h-[46px] flex-1 rounded-lg"
              style={item.key === step.key ? { boxShadow: `0 0 0 2px ${step.accent}` } : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
