import { useState, useMemo } from "react";
import {
  Check,
  LockKeyhole,
  Mail,
  UserRound,
  Calendar,
} from "lucide-react";
import { AUTH_COPY } from "../../lib/app-data";
import AppModal from "../ui/AppModal";
import AppButton from "../ui/AppButton";
import Select from "react-select";
import countryList from "react-select-country-list";

console.log("AUTH MODAL FILE LOADED");

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

  console.log("AuthModal 렌더링:", { mode, isSignup });

  const setField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const complete = async () => {
    console.log("버튼 클릭");
    console.log("mode:", mode);
    console.log("form:", form);

    if (isSignup) {
      // 회원가입
      if (!consented) {
        return alert("약관에 동의해주세요.");
      }

      if (!form.id || !form.nickname || !form.email || !form.password) {
        return alert("필수 정보를 모두 입력해주세요.");
      }

      if (form.password !== form.confirmPassword) {
        return alert("비밀번호가 일치하지 않습니다.");
      }

      try {
        console.log("회원가입 API 요청 시작");

        const response = await fetch("http://localhost:8001/api/v1/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: form.id,
            nickname: form.nickname,
            email: form.email,
            password: form.password,
            country: form.country,
            birthDate: form.birthDate || null,
          }),
        });

        console.log("회원가입 응답:", response.status);

        const data = await response.json();

        console.log("회원가입 데이터:", data);

        if (!response.ok) {
          return alert(data?.detail || "회원가입 실패");
        }

        alert("회원가입 성공");

        onComplete(data);
      } catch (error) {
        console.error("회원가입 오류:", error);

        alert("서버 연결 실패");
        return;
      }
    } else {
      // 로그인
      console.log("로그인 분기 진입");

      if (!form.id || !form.password) {
        return alert("아이디와 비밀번호를 입력해주세요.");
      }

      try {
        console.log("로그인 API 요청 시작");

        const response = await fetch("http://localhost:8001/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            id: form.id,
            password: form.password,
          }),
        });

        console.log("로그인 API 응답:", response.status);

        const data = await response.json();

        console.log("로그인 API 데이터:", data);

        if (!response.ok) {
          return alert(data?.detail || data?.error?.message || "로그인 실패");
        }

        console.log("로그인 성공");

        onComplete(data);
      } catch (error) {
        console.error("로그인 API 오류:", error);

        alert("서버 연결 실패");
        return;
      }
    }

    setForm(INITIAL_FORM);
    setConsented(false);
  };

  return (
    <AppModal open={!!mode} onClose={onClose} title={title}>
      {isSignup && (
        <>
          아이디
          <input value={form.id} onChange={setField("id")} placeholder="로그인 아이디" className="h-11 w-full border" />

          닉네임
          <input value={form.nickname} onChange={setField("nickname")} placeholder="여행자 이름" className="h-11 w-full border" />
        </>
      )}

      {!isSignup && (
        <>
          아이디
          <input value={form.id} onChange={setField("id")} placeholder="로그인 아이디" className="h-11 w-full border" />
        </>
      )}

      {isSignup && (
        <>
          이메일
          <input type="email" value={form.email} onChange={setField("email")} placeholder="name@example.com" className="h-11 w-full border" />
        </>
      )}

      비밀번호
      <input type="password" value={form.password} onChange={setField("password")} placeholder="비밀번호" className="h-11 w-full border" />

      {isSignup && (
        <>
          비밀번호 확인
          <input type="password" value={form.confirmPassword} onChange={setField("confirmPassword")} placeholder="비밀번호 확인" className="h-11 w-full border" />

          국가
          <Select options={countries} value={countries.find((country) => country.value === form.country)} onChange={(selected) => setForm((current) => ({ ...current, country: selected?.value || "" }))} />

          생년월일
          <input type="date" value={form.birthDate} onChange={setField("birthDate")} className="h-11 w-full border" />

          <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />{" "}
          {AUTH_COPY.consent}
        </>
      )}

      <AppButton type="button" className="w-full" disabled={isSignup && !consented} icon={Check} onClick={() => { console.log("AppButton onClick 실행"); complete(); }}>
        {submitLabel}
      </AppButton>

      {!isSignup && (
        <AppButton type="button" className="w-full mt-3" variant="outline" onClick={() => { console.log("회원가입 버튼 클릭"); onAuth("signup"); }}>
          회원가입
        </AppButton>
      )}
    </AppModal>
  );
}
