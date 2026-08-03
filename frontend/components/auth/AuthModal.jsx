import { useState, useMemo } from "react";
import { Check, LockKeyhole, Mail, UserRound, Calendar } from "lucide-react";
import { AUTH_COPY } from "../../lib/app-data";
import AppModal from "../ui/AppModal";
import AppButton from "../ui/AppButton";
import Select from "react-select";
import countryList from "react-select-country-list";

const INITIAL_FORM = { id: "", nickname: "", email: "", password: "", confirmPassword: "", country: "KR", birthDate: "" };

export default function AuthModal({ mode, onClose, onComplete, onAuth }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [consented, setConsented] = useState(false);
  const isSignup = mode === "signup";
  const countries = useMemo(() => countryList().getData(), []);
  const title = isSignup ? "회원가입" : "로그인";
  const submitLabel = isSignup ? "동의하고 시작하기" : "로그인";
  const setField = (field) => (event) => setForm(current => ({ ...current, [field]: event.target.value }));

  const complete = async () => {
    if (isSignup) {
      if (!consented) return alert("약관에 동의해주세요.");
      if (!form.id || !form.nickname || !form.email || !form.password) return alert("필수 정보를 모두 입력해주세요.");
      if (form.password !== form.confirmPassword) return alert("비밀번호가 일치하지 않습니다.");
      try {
        const response = await fetch("http://localhost:8001/api/v1/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: form.id, nickname: form.nickname, email: form.email, password: form.password, country: form.country, birthDate: form.birthDate || null }) });
        const data = await response.json();
        if (!response.ok) return alert(data.detail || "회원가입 실패");
        alert("회원가입 성공");
        onComplete(data);
      } catch (e) { console.error(e); alert("서버 연결 실패"); return; }
    } else {
      onComplete({ email: form.email, password: form.password });
    }
    setForm(INITIAL_FORM);
    setConsented(false);
  };

  return (
    <AppModal open={Boolean(mode)} onClose={onClose} title={title}>
      <div className="space-y-3">
        {isSignup && <>
          <label className="block"><span>아이디</span><input value={form.id} onChange={setField("id")} placeholder="로그인 아이디" className="h-11 w-full border" /></label>
          <label className="block"><span>닉네임</span><input value={form.nickname} onChange={setField("nickname")} placeholder="여행자 이름" className="h-11 w-full border" /></label>
        </>}
        <label className="block"><span>이메일</span><input type="email" value={form.email} onChange={setField("email")} placeholder="name@example.com" className="h-11 w-full border" /></label>
        <label className="block"><span>비밀번호</span><input type="password" value={form.password} onChange={setField("password")} placeholder="비밀번호" className="h-11 w-full border" /></label>
        {isSignup && <>
          <label className="block"><span>비밀번호 확인</span><input type="password" value={form.confirmPassword} onChange={setField("confirmPassword")} placeholder="비밀번호 확인" className="h-11 w-full border" /></label>
          <label className="block"><span>국가</span><Select options={countries} value={countries.find(c => c.value === form.country)} onChange={s => setForm(c => ({ ...c, country: s?.value || "" }))} /></label>
          <label className="block"><span>생년월일</span><input type="date" value={form.birthDate} onChange={setField("birthDate")} className="h-11 w-full border" /></label>
          <label><input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} /> {AUTH_COPY.consent}</label>
        </>}
        <AppButton className="w-full" disabled={isSignup && !consented} icon={Check} onClick={complete}>{submitLabel}</AppButton>
        {!isSignup && <AppButton className="w-full mt-3" variant="outline" onClick={() => onAuth("signup")}>회원가입</AppButton>}
      </div>
    </AppModal>
  );
}