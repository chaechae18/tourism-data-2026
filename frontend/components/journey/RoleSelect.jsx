import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import AppButton from "../ui/AppButton";
import AppModal from "../ui/AppModal";
import { useI18n } from "../i18n/LanguageProvider";

// 신라 시대 역할. key 는 백엔드 personas.py 의 페르소나 key 와 맞춘다.
// ready 는 백엔드에 그 역할의 코스가 준비됐는지. 여섯 역할 모두 코스가 나온다.
export const ROLES = [
  {
    key: "king",
    name: "왕",
    tagline: "궁궐과 왕릉을 따라",
    description: "월성에서 시작해 왕릉을 잇는 하루. 상차림은 고기 위주로.",
    accent: "rgb(var(--color-brand))",
    tint: "rgb(var(--color-brand-soft))",
    ready: true,
  },
  {
    key: "scholar",
    name: "학자",
    tagline: "서원과 비석 사이에서",
    description: "옛 글이 남은 서원과 비석을 따라 걷는 하루.",
    accent: "#2d6a8c",
    tint: "#e8f1f6",
    ready: true,
  },
  {
    key: "monk",
    name: "스님",
    tagline: "절과 불상을 찾아",
    description: "산사와 마애불을 돌며 마음을 다스리는 하루.",
    accent: "#4f7a5c",
    tint: "#e9f2eb",
    ready: true,
  },
  {
    key: "hwarang",
    name: "화랑",
    tagline: "남산과 계곡을 누비며",
    description: "산길과 물길에서 몸과 마음을 닦는 하루.",
    accent: "#8c3d3d",
    tint: "#f7e9e8",
    ready: true,
  },
  {
    key: "court_lady",
    name: "궁녀",
    tagline: "궁 안의 이야기를 따라",
    description: "궁궐 뒤편에 남은 자취와 소소한 이야기를 찾아서.",
    accent: "#a8557f",
    tint: "#f8eaf1",
    ready: true,
  },
  {
    key: "merchant",
    name: "상인",
    tagline: "저잣거리를 누비며",
    description: "시장과 상가를 돌며 경주의 물건을 살피는 하루.",
    accent: "#a8763d",
    tint: "#f8efe2",
    ready: true,
  },
];

function RoleCarousel({ onSelect, selectedKey }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(() => Math.max(0, ROLES.findIndex((role) => role.key === selectedKey)));
  const role = ROLES[index];
  const localizedRole = {
    ...role,
    name: t(`roles.${role.key}.name`),
    tagline: t(`roles.${role.key}.tagline`),
    description: t(`roles.${role.key}.description`),
  };
  const portrait = role.key === "hwarang" ? "warrior" : role.key;
  const move = (direction) => setIndex((current) => (current + direction + ROLES.length) % ROLES.length);

  return (
    <div className="pb-4">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <button type="button" aria-label={t("roles.previous")} onClick={() => move(-1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f6f3] text-[#343235] transition-colors">
          <ChevronLeft size={24} />
        </button>
        <Image
          key={role.key}
          src={`/images/donggyeong-intro/${portrait}-portrait.png`}
          alt={localizedRole.name}
          width={400}
          height={440}
          sizes="(max-width: 430px) 65vw, 278px"
          priority
          className="mx-auto h-[clamp(180px,34svh,300px)] w-full object-contain"
        />
        <button type="button" aria-label={t("roles.next")} onClick={() => move(1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f6f3] text-[#343235] transition-colors">
          <ChevronRight size={24} />
        </button>
      </div>
      <div className="mt-5 min-h-28 text-center" aria-live="polite" aria-atomic="true">
        <h3 className="text-2xl font-bold text-[#343235]">{localizedRole.name}</h3>
        <p className="mt-2 text-sm font-semibold" style={{ color: role.accent }}>{localizedRole.tagline}</p>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-[#7c7a76]">{localizedRole.description}</p>
      </div>
      <AppButton className="mt-6 w-full" onClick={() => onSelect(localizedRole)}>
        {t("roles.select", { name: localizedRole.name })}
      </AppButton>
    </div>
  );
}

export default function RoleSelect({ onClose, onSelect, open, selectedKey }) {
  const { t } = useI18n();
  return (
    <AppModal onClose={onClose} open={open} title={t("roles.title")}>
      <p className="-mt-2 mb-5 flex items-start gap-2 rounded-xl bg-[#f4f6f3] px-3 py-2.5 text-xs leading-5 text-[#5f6560]">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-brand" />
        <span>{t("roles.guide")}</span>
      </p>
      <RoleCarousel key={selectedKey} onSelect={onSelect} selectedKey={selectedKey} />
    </AppModal>
  );
}
