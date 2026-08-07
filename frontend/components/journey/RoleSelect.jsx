import { Check, Sparkles } from "lucide-react";
import AppModal from "../ui/AppModal";

// 신라 시대 역할. key 는 백엔드 personas.py 의 페르소나 key 와 맞춘다.
// ready=false 는 아직 코스 규칙이 없는 역할 (화면만 먼저 보여 주는 중).
export const ROLES = [
  {
    key: "king",
    name: "왕",
    tagline: "궁궐과 왕릉을 따라",
    description: "월성에서 시작해 왕릉을 잇는 하루. 상차림은 고기 위주로.",
    accent: "#bd8c31",
    tint: "#faf1de",
    ready: true,
  },
  {
    key: "scholar",
    name: "학자",
    tagline: "서원과 비석 사이에서",
    description: "옛 글이 남은 서원과 비석을 따라 걷는 하루.",
    accent: "#2d6a8c",
    tint: "#e8f1f6",
    ready: false,
  },
  {
    key: "monk",
    name: "학승",
    tagline: "절과 불상을 찾아",
    description: "산사와 마애불을 돌며 마음을 다스리는 하루.",
    accent: "#4f7a5c",
    tint: "#e9f2eb",
    ready: false,
  },
  {
    key: "hwarang",
    name: "화랑",
    tagline: "남산과 계곡을 누비며",
    description: "산길과 물길에서 몸과 마음을 닦는 하루.",
    accent: "#8c3d3d",
    tint: "#f7e9e8",
    ready: false,
  },
  {
    key: "court_lady",
    name: "궁녀",
    tagline: "궁 안의 이야기를 따라",
    description: "궁궐 뒤편에 남은 자취와 소소한 이야기를 찾아서.",
    accent: "#a8557f",
    tint: "#f8eaf1",
    ready: false,
  },
  {
    key: "merchant",
    name: "상인",
    tagline: "저잣거리를 누비며",
    description: "시장과 상가를 돌며 경주의 물건을 살피는 하루.",
    accent: "#a8763d",
    tint: "#f8efe2",
    ready: false,
  },
];

// 역할별 상징 그림. 지도 마커(LandmarkGlyph)와 같은 손그림 톤으로 맞췄다.
function RoleEmblem({ role }) {
  const { accent, key } = role;

  if (key === "king") {
    return (
      <g>
        <path d="M-11 4 L-13 -8 L-6 -3 L0 -11 L6 -3 L13 -8 L11 4 Z" fill={accent} stroke="#7a5a19" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="-11" y="4" width="22" height="5" rx="1.6" fill="#f2dcab" stroke="#7a5a19" strokeWidth="1.5" />
        <circle cx="0" cy="-2" r="1.9" fill="#fff6e0" />
      </g>
    );
  }

  if (key === "scholar") {
    return (
      <g>
        <rect x="-11" y="-9" width="15" height="18" rx="2" fill="#f4eee2" stroke={accent} strokeWidth="1.5" />
        <path d="M-7 -4 H0 M-7 0 H0 M-7 4 H-3" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M8 -12 L12 -8 L4 2 L1 3 L2 0 Z" fill={accent} stroke="#22485c" strokeWidth="1.3" strokeLinejoin="round" />
      </g>
    );
  }

  if (key === "monk") {
    return (
      <g>
        {[...Array(10)].map((_, index) => {
          const angle = (index / 10) * Math.PI * 2;
          return <circle key={index} cx={Math.sin(angle) * 9.5} cy={-Math.cos(angle) * 9.5} r="2.4" fill={accent} stroke="#38573f" strokeWidth="1" />;
        })}
        <circle cx="0" cy="0" r="3.4" fill="#f0ead8" stroke="#38573f" strokeWidth="1.3" />
      </g>
    );
  }

  if (key === "hwarang") {
    return (
      <g>
        <path d="M0 -13 L3.2 -8 V3 H-3.2 V-8 Z" fill="#e3e7ea" stroke="#5c6166" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="-9" y="3" width="18" height="3.2" rx="1.6" fill={accent} stroke="#5e2b2b" strokeWidth="1.3" />
        <rect x="-2.2" y="6" width="4.4" height="7" rx="1.8" fill="#8a5a3c" stroke="#5e2b2b" strokeWidth="1.3" />
      </g>
    );
  }

  if (key === "court_lady") {
    return (
      <g>
        <path d="M-10 11 L5 -5" stroke="#8a5a3c" strokeWidth="2.6" strokeLinecap="round" />
        {[...Array(5)].map((_, index) => {
          const angle = (index / 5) * Math.PI * 2;
          return <ellipse key={index} cx={7 + Math.sin(angle) * 4} cy={-7 - Math.cos(angle) * 4} rx="3.1" ry="3.1" fill={accent} opacity="0.85" />;
        })}
        <circle cx="7" cy="-7" r="2.2" fill="#fdf1f6" stroke="#7d3f60" strokeWidth="1.1" />
      </g>
    );
  }

  // 상인 — 엽전 두 닢
  return (
    <g>
      <circle cx="-4" cy="-1" r="9" fill="#e6c58c" stroke="#7d5a24" strokeWidth="1.4" />
      <circle cx="4" cy="2" r="9" fill={accent} stroke="#7d5a24" strokeWidth="1.4" />
      <rect x="1" y="-1" width="6" height="6" rx="1.2" fill="#f8efdc" stroke="#7d5a24" strokeWidth="1.2" />
    </g>
  );
}

function RoleCard({ onSelect, role, selected }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      aria-pressed={selected}
      className="group relative flex flex-col items-center rounded-2xl border-2 bg-white p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(52,50,53,0.12)]"
      style={{ borderColor: selected ? role.accent : "#e7e4de" }}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: role.accent }}>
          <Check size={12} strokeWidth={3} />
        </span>
      )}

      <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: role.tint }}>
        <svg viewBox="-20 -20 40 40" className="h-11 w-11" aria-hidden="true">
          <RoleEmblem role={role} />
        </svg>
      </span>

      <span className="mt-2 text-base font-bold text-[#343235]">{role.name}</span>
      <span className="mt-0.5 text-[11px] font-semibold leading-4" style={{ color: role.accent }}>{role.tagline}</span>
      <span className="mt-1.5 text-[11px] leading-4 text-[#7c7a76]">{role.description}</span>

      <span
        className="mt-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={
          role.ready
            ? { backgroundColor: role.tint, color: role.accent }
            : { backgroundColor: "#f0efec", color: "#9a978f" }
        }
      >
        {role.ready ? "코스 준비됨" : "준비 중"}
      </span>
    </button>
  );
}

export default function RoleSelect({ onClose, onSelect, open, selectedKey }) {
  return (
    <AppModal onClose={onClose} open={open} title="역할 선택">
      <p className="-mt-2 mb-5 flex items-start gap-2 rounded-xl bg-[#f4f6f3] px-3 py-2.5 text-xs leading-5 text-[#5f6560]">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-[#bd8c31]" />
        <span>신라 사람 중 하나를 고르면, 그 인물이 다녔을 법한 하루 코스를 지도에 그려 드려요.</span>
      </p>

      <div className="grid grid-cols-2 gap-3 pb-4">
        {ROLES.map((role) => (
          <RoleCard key={role.key} onSelect={onSelect} role={role} selected={role.key === selectedKey} />
        ))}
      </div>
    </AppModal>
  );
}
