import { useState } from "react";
import { Check, LockKeyhole, Mail, UserRound } from "lucide-react";
import { AUTH_COPY } from "../../lib/app-data";
import AppModal from "../ui/AppModal";
import AppButton from "../ui/AppButton";

const INITIAL_FORM = { email: "", password: "", nickname: "" };

export default function AuthModal({ mode, onClose, onComplete, onAuth}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [consented, setConsented] = useState(false);
  const isSignup = mode === "signup";
  const title = isSignup ? "회원가입" : "로그인";
  const submitLabel = isSignup ? "동의하고 시작하기" : "로그인";
  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const complete = () => {
    if (isSignup && !consented) return;
    onComplete({ nickname: form.nickname || "lotus_traveler", email: form.email || "traveler@example.com" });
  };

  return (
    <AppModal open={Boolean(mode)} onClose={onClose} title={title}>
      <div className="space-y-3">
        {isSignup && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[#343235]">닉네임</span>
            <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
              <UserRound size={17} className="text-[#747579]" />
              <input value={form.nickname} onChange={setField("nickname")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="여행자 이름" />
            </div>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">이메일</span>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <Mail size={17} className="text-[#747579]" />
            <input value={form.email} onChange={setField("email")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="name@example.com" type="email" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">비밀번호</span>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <LockKeyhole size={17} className="text-[#747579]" />
            <input value={form.password} onChange={setField("password")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="비밀번호" type="password" />
          </div>
        </label>
        {isSignup && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f4f6f4] p-3 text-sm text-[#55565a]">
            <input checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#bd8c31]" type="checkbox" />
            <span>{AUTH_COPY.consent}</span>
          </label>
        )}
        <AppButton className="w-full" disabled={isSignup && !consented} icon={Check} onClick={complete}>{submitLabel}</AppButton>
        {!isSignup && (
          <AppButton className="w-full mt-3" variant="outline" onClick={() => onAuth("signup")}>
            회원가입
          </AppButton>
        )}
        <div className="flex items-center gap-3 py-1 text-xs text-[#747579]"><span className="h-px flex-1 bg-[#e2e4e0]" />또는<span className="h-px flex-1 bg-[#e2e4e0]" /></div>
        {AUTH_COPY.oauth.map((label) => (
          <AppButton key={label} className="w-full" variant="outline" onClick={complete}>{label}</AppButton>
        ))}
        
      </div>
    </AppModal>
  );
}
