import { useState } from "react";
import { Check, LockKeyhole, Mail, UserRound, Globe, Calendar } from "lucide-react";
import { AUTH_COPY } from "../../lib/app-data";
import AppModal from "../ui/AppModal";
import AppButton from "../ui/AppButton";
import { useMemo } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";

const INITIAL_FORM = {
  id: "",
  nickname: "",
  email: "",
  password: "",
  confirmPassword: "",
  country: "KR",
  birthDate: "",
};

export default function AuthModal({ mode, onClose, onComplete, onAuth }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [consented, setConsented] = useState(false);

  const isSignup = mode === "signup";
  const countries = useMemo(() => countryList().getData(), []);
  const title = isSignup ? "회원가입" : "로그인";
  const submitLabel = isSignup ? "동의하고 시작하기" : "로그인";

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const complete = () => {
    if (isSignup) {
      if (!consented) {
        alert("약관에 동의해주세요.");
        return;
      }

      if (!form.id || !form.nickname || !form.email || !form.password) {
        alert("필수 정보를 모두 입력해주세요.");
        return;
      }

      if (form.password !== form.confirmPassword) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
      }

      onComplete({
        id: form.id,
        nickname: form.nickname,
        email: form.email,
        password: form.password,
        country: form.country,
        birthDate: form.birthDate,
      });
    } else {
      onComplete({
        email: form.email,
        password: form.password,
      });
    }

    setForm(INITIAL_FORM);
    setConsented(false);
  };

  return (
    <AppModal open={Boolean(mode)} onClose={onClose} title={title}>
      <div className="space-y-3">

        {isSignup && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">아이디</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <UserRound size={17} className="text-[#747579]" />
                <input value={form.id} onChange={setField("id")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="로그인 아이디" />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">닉네임</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <UserRound size={17} className="text-[#747579]" />
                <input value={form.nickname} onChange={setField("nickname")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="여행자 이름" />
              </div>
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">이메일</span>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <Mail size={17} className="text-[#747579]" />
            <input type="email" value={form.email} onChange={setField("email")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="name@example.com" />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">비밀번호</span>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <LockKeyhole size={17} className="text-[#747579]" />
            <input type="password" value={form.password} onChange={setField("password")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="비밀번호" />
          </div>
        </label>

        {isSignup && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">비밀번호 확인</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <LockKeyhole size={17} className="text-[#747579]" />
                <input type="password" value={form.confirmPassword} onChange={setField("confirmPassword")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="비밀번호를 다시 입력하세요" />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">국가</span>
              <Select
                options={countries}
                value={countries.find(country => country.value === form.country)}
                onChange={(selected) => setForm(current => ({ ...current, country: selected?.value || "" }))}
                placeholder="국가를 선택하세요"
                isSearchable
                className="text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">생년월일</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <Calendar size={17} className="text-[#747579]" />
                <input type="date" value={form.birthDate} onChange={setField("birthDate")} className="h-11 w-full bg-transparent text-sm outline-none" />
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f4f6f4] p-3 text-sm text-[#55565a]">
              <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#bd8c31]" />
              <span>{AUTH_COPY.consent}</span>
            </label>
          </>
        )}

        <AppButton className="w-full" disabled={isSignup && !consented} icon={Check} onClick={complete}>{submitLabel}</AppButton>

        {!isSignup && <AppButton className="w-full mt-3" variant="outline" onClick={() => onAuth("signup")}>회원가입</AppButton>}

        <div className="flex items-center gap-3 py-1 text-xs text-[#747579]">
          <span className="h-px flex-1 bg-[#e2e4e0]" />
          또는
          <span className="h-px flex-1 bg-[#e2e4e0]" />
        </div>

        {AUTH_COPY.oauth.map((label) => (
          <AppButton key={label} className="w-full" variant="outline" onClick={complete}>{label}</AppButton>
        ))}

      </div>
    </AppModal>
  );
}