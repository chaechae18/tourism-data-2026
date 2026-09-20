import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  LockKeyhole,
  LogIn,
  Mail,
  UserRound,
} from "lucide-react";
import Select from "react-select";
import countryList from "react-select-country-list";
import {
  createTranslator,
  LANGUAGE_LOCALES,
} from "../../lib/i18n";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";
import AppModal from "../ui/AppModal";

const AUTH_API_BASE_URL = `${
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001"
}/api/v1/auth`;

const INITIAL_FORM = {
  id: "",
  nickname: "",
  email: "",
  password: "",
  confirmPassword: "",
  country: "KR",
  languageCode: "ko",
  birthDate: "",
};

const LANGUAGES = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
  { id: "ja", label: "日本語" },
];

export default function AuthModal({
  mode,
  onClose,
  onComplete,
  onAuth,
}) {
  const { language } = useI18n();

  const [form, setForm] = useState(INITIAL_FORM);
  const [consented, setConsented] = useState(false);
  const [idChecked, setIdChecked] = useState(false);
  const [idAvailable, setIdAvailable] = useState(false);

  const isSignup = mode === "signup";

  useEffect(() => {
    setForm(INITIAL_FORM);
    setConsented(false);
    setIdChecked(false);
    setIdAvailable(false);
  }, [mode]);

  /*
   * 회원가입 화면에서 선택한 언어만 로컬로 변경
   * LanguageProvider는 건드리지 않음
   */
  const signupLanguage = form.languageCode || language;

  const signupT = useMemo(
    () => createTranslator(signupLanguage),
    [signupLanguage]
  );

  const countries = useMemo(() => {
    const options = countryList().getData();

    if (!Intl.DisplayNames) return options;

    const displayNames = new Intl.DisplayNames(
      [LANGUAGE_LOCALES[signupLanguage]],
      { type: "region" }
    );

    return options.map((country) => ({
      ...country,
      label:
        displayNames.of(country.value) || country.label,
    }));
  }, [signupLanguage]);

  const title = isSignup
    ? signupT("auth.signup")
    : signupT("auth.login");

  const submitLabel = isSignup
    ? signupT("auth.signupSubmit")
    : signupT("auth.login");

  const setField = (field) => (event) => {
    const value = event.target.value;

    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === "id") {
      setIdChecked(false);
      setIdAvailable(false);
    }
  };

  // 아이디 중복확인
  const checkId = async () => {
    const userId = form.id.trim();

    if (!userId) {
      return alert(signupT("auth.idRequired"));
    }

    try {
      const response = await fetch(
        `${AUTH_API_BASE_URL}/check-id?id=${encodeURIComponent(
          userId
        )}`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return alert(
          data?.detail ||
            "아이디 중복확인에 실패했습니다."
        );
      }

      setIdChecked(true);
      setIdAvailable(data.available);

      alert(data.message);
    } catch {
      alert(signupT("common.networkError"));
    }
  };

  const validatePassword = (password) => {
    const letterCount = (password.match(/[A-Za-z]/g) || []).length;
    const numberCount = (password.match(/[0-9]/g) || []).length;
    const specialCount = (password.match(/[^A-Za-z0-9]/g) || []).length;

    return (
      letterCount >= 4 &&
      numberCount >= 4 &&
      specialCount >= 1
    );
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setConsented(false);
    setIdChecked(false);
    setIdAvailable(false);
  };

  const complete = async () => {
  if (isSignup) {
    if (!consented) {
      return alert(signupT("auth.consentRequired"));
    }

    if (!idChecked || !idAvailable) {
      return alert("아이디 중복확인을 해주세요.");
    }

    if (!form.id || !form.nickname || !form.email || !form.password) {
      return alert(signupT("auth.requiredFields"));
    }

    if (!validatePassword(form.password)) {
      return alert(
        "비밀번호는 영문자 4자 이상, 숫자 4자 이상, 특수문자 1개 이상을 포함해야 합니다."
      );
    }

    if (form.password !== form.confirmPassword) {
      return alert(signupT("auth.passwordMismatch"));
    }
  } else if (!form.id || !form.password) {
    return alert(signupT("auth.loginRequired"));
  }

  let response;

  try {
    response = await fetch(
      `${AUTH_API_BASE_URL}/${isSignup ? "signup" : "login"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(
          isSignup
            ? {
                id: form.id,
                nickname: form.nickname,
                email: form.email,
                password: form.password,
                country: form.country,
                languageCode: form.languageCode,
                birthDate: form.birthDate || null,
              }
            : {
                id: form.id,
                password: form.password,
              }
        ),
      }
    );
  } catch (error) {
    console.error("AUTH FETCH ERROR:", error);
    alert(signupT("common.networkError"));
    return;
  }

  const data = await response.json().catch(() => ({}));

  console.log("AUTH RESPONSE:", response.status, data);

  if (!response.ok) {
    if (data?.detail?.code === "USER_DELETED") {
      return alert("탈퇴한 회원입니다.");
    }

    return alert(
      data?.detail ||
        data?.error?.message ||
        signupT(
          isSignup
            ? "auth.signupFailed"
            : "auth.loginFailed"
        )
    );
  }

  // 서버 응답까지 정상적으로 받은 상태
  console.log("회원가입/로그인 성공:", data);

  try {
    onComplete(data);
  } catch (error) {
    console.error("onComplete ERROR:", error);
    return;
  }

  setForm(INITIAL_FORM);
  setConsented(false);
  setIdChecked(false);
  setIdAvailable(false);
};

  return (
    <AppModal
      open={Boolean(mode)}
      onClose={onClose}
      title={title}
    >
      <div className="space-y-3">
        {/* 아이디 */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
            {signupT("auth.id")}
          </span>

          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <UserRound
              size={17}
              className="text-[#747579]"
            />

            <input
              value={form.id}
              onChange={setField("id")}
              className="h-11 w-full bg-transparent text-sm outline-none"
              placeholder={signupT(
                "auth.idPlaceholder"
              )}
            />

            {isSignup && (
              <button
                type="button"
                onClick={checkId}
                className="shrink-0 whitespace-nowrap rounded-md bg-[#343235] px-3 py-2 text-xs font-semibold text-white"
              >
                중복확인
              </button>
            )}
          </div>

          {isSignup && idChecked && (
            <p
              className={`mt-1 text-xs ${
                idAvailable
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {idAvailable
                ? "사용 가능한 아이디입니다."
                : "이미 사용 중인 아이디입니다."}
            </p>
          )}
        </label>

        {/* 회원가입 전용 */}
        {isSignup && (
          <>
            {/* 닉네임 */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
                {signupT("auth.nickname")}
              </span>

              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <UserRound
                  size={17}
                  className="text-[#747579]"
                />

                <input
                  value={form.nickname}
                  onChange={setField("nickname")}
                  className="h-11 w-full bg-transparent text-sm outline-none"
                  placeholder={signupT(
                    "auth.nicknamePlaceholder"
                  )}
                />
              </div>
            </label>

            {/* 이메일 */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
                {signupT("auth.email")}
              </span>

              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <Mail
                  size={17}
                  className="text-[#747579]"
                />

                <input
                  type="email"
                  value={form.email}
                  onChange={setField("email")}
                  className="h-11 w-full bg-transparent text-sm outline-none"
                  placeholder="name@example.com"
                />
              </div>
            </label>
          </>
        )}

        {/* 비밀번호 */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
            {signupT("auth.password")}
          </span>

          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <LockKeyhole
              size={17}
              className="text-[#747579]"
            />
            <input type="password" value={form.password} onChange={setField("password")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder={signupT("auth.password")}/>
          </div>
          {isSignup && form.password.length > 0 && (
            <div className="mt-1.5 flex items-center gap-3 px-1 text-xs">
              <p
                className={
                  (form.password.match(/[A-Za-z]/g) || []).length >= 4
                    ? "text-green-600"
                    : "text-red-500"
                }
              >
                {`영문자 4자 이상 ${
                  (form.password.match(/[A-Za-z]/g) || []).length >= 4
                    ? "✓"
                    : ""
                }`}
              </p>

              <p
                className={
                  (form.password.match(/[0-9]/g) || []).length >= 4
                    ? "text-green-600"
                    : "text-red-500"
                }
              >
                {`숫자 4자 이상 ${
                  (form.password.match(/[0-9]/g) || []).length >= 4
                    ? "✓"
                    : ""
                }`}
              </p>

              <p
                className={
                  (form.password.match(/[^A-Za-z0-9]/g) || []).length >= 1
                    ? "text-green-600"
                    : "text-red-500"
                }
              >
                {`특수문자 1개 이상 ${
                  (form.password.match(/[^A-Za-z0-9]/g) || []).length >= 1
                    ? "✓"
                    : ""
                }`}
              </p>
            </div>
          )}
        </label>

        {/* 회원가입 추가 정보 */}
        {isSignup && (
          <>
            {/* 비밀번호 확인 */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
                {signupT(
                  "auth.passwordConfirm"
                )}
              </span>

              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <LockKeyhole
                  size={17}
                  className="text-[#747579]"
                />

                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={setField(
                    "confirmPassword"
                  )}
                  className="h-11 w-full bg-transparent text-sm outline-none"
                  placeholder={signupT(
                    "auth.passwordConfirmPlaceholder"
                  )}
                />
              </div>

              {/* 비밀번호 일치 여부 */}
              {form.confirmPassword.length > 0 && (
                <p
                  className={`mt-1 px-1 text-xs ${
                    form.password === form.confirmPassword
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {form.password === form.confirmPassword
                    ? "비밀번호가 일치합니다. ✓"
                    : "비밀번호가 일치하지 않습니다."}
                </p>
              )}
            </label>

            {/* 국가 */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
                {signupT("auth.country")}
              </span>

              <Select
                options={countries}
                value={countries.find(
                  (country) =>
                    country.value === form.country
                )}
                onChange={(selected) =>
                  setForm((current) => ({
                    ...current,
                    country:
                      selected?.value || "",
                  }))
                }
                placeholder={signupT(
                  "auth.countryPlaceholder"
                )}
                isSearchable
                className="text-sm"
              />
            </label>

            {/* 언어 */}
            <div>
              <p className="mb-3 text-sm font-bold text-[#241b16]">
                언어
              </p>

              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        languageCode: item.id,
                      }));
                    }}
                    className={`h-11 rounded-lg border text-sm font-bold ${
                      form.languageCode === item.id
                        ? "border-brand bg-brand-soft text-brand-ink"
                        : "border-[#d9cfc2] bg-white text-[#6f6256]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 생년월일 */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">
                {signupT("auth.birthDate")}
              </span>

              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <Calendar
                  size={17}
                  className="text-[#747579]"
                />

                <input
                  type="date"
                  value={form.birthDate}
                  onChange={setField("birthDate")}
                  className="h-11 w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            {/* 약관 동의 */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f4f6f4] p-3 text-sm text-[#55565a]">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) =>
                  setConsented(
                    event.target.checked
                  )
                }
                className="mt-0.5 h-4 w-4 accent-brand"
              />

              <span>
                {signupT("auth.consent")}
              </span>
            </label>
          </>
        )}

        {/* 로그인 / 회원가입 버튼 */}
        <AppButton
          type="button"
          className="w-full"
          disabled={isSignup && !consented}
          icon={isSignup ? Check : LogIn}
          onClick={complete}
        >
          {submitLabel}
        </AppButton>

        {/* 로그인 화면에서 회원가입 */}
        {!isSignup && (
          <AppButton
            type="button"
            className="mt-3 w-full"
            variant="outline"
            onClick={() => {resetForm(); onAuth("signup");}}>
            {signupT("auth.signup")}
          </AppButton>
        )}

        {/* 간편 로그인 */}
        {!isSignup && (
          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#e7e8e4]" />

              <span className="whitespace-nowrap text-[11px] font-medium tracking-wide text-[#9a9b97]">
                간편 로그인
              </span>

              <div className="h-px flex-1 bg-[#e7e8e4]" />
            </div>

            <div className="space-y-2.5">
              {/* 카카오 */}
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    `${AUTH_API_BASE_URL}/kakao/login`;
                }}
                className="
                  relative flex h-12 w-full items-center justify-center
                  rounded-xl
                  bg-[#FEE500]
                  text-[14px] font-semibold text-[#191919]
                "
              >
                <span className="absolute left-4 flex h-7 w-7 items-center justify-center">
                  <svg
                    width="25"
                    height="23"
                    viewBox="0 0 25 23"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.5 0C5.596 0 0 4.314 0 9.637C0 13.04 2.293 16.02 5.757 17.7L4.51 22.15C4.43 22.435 4.758 22.664 5.005 22.494L10.25 18.91C10.976 19.006 11.725 19.274 12.5 19.274C19.404 19.274 25 14.96 25 9.637C25 4.314 19.404 0 12.5 0Z"
                      fill="#191919"
                    />
                  </svg>
                </span>

                <span>카카오로 로그인</span>
              </button>

              {/* 네이버 */}
              {/*
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    `${AUTH_API_BASE_URL}/naver/login`;
                }}
                className="
                  relative flex h-12 w-full items-center justify-center
                  rounded-xl
                  bg-[#03C75A]
                  text-[14px] font-semibold text-white
                "
              >
                <span
                  className="
                    absolute left-4
                    flex h-7 w-7 items-center justify-center
                    rounded-md
                    bg-white
                    text-[17px] font-black leading-none
                    text-[#03C75A]
                  "
                >
                  N
                </span>

                <span>네이버로 로그인</span>
              </button>
              */}

              {/* Google */}
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    `${AUTH_API_BASE_URL}/google/login`;
                }}
                className="
                  relative flex h-12 w-full items-center justify-center
                  rounded-xl
                  border border-[#dadce0]
                  bg-white
                  text-[14px] font-semibold text-[#3c4043]
                "
              >
                <span className="absolute left-4 flex h-7 w-7 items-center justify-center">
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21.805 12.23c0-.638-.057-1.252-.164-1.841H12v3.481h5.489a4.69 4.69 0 0 1-2.037 3.077v2.558h3.295c1.93-1.777 3.058-4.395 3.058-7.275Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 22c2.754 0 5.064-.912 6.752-2.495l-3.295-2.558c-.913.612-2.077.973-3.457.973-2.658 0-4.91-1.796-5.719-4.209H2.875v2.641A10.2 10.2 0 0 0 12 22Z"
                      fill="#34A853"
                    />
                    <path
                      d="M6.281 13.711A6.13 6.13 0 0 1 5.96 12c0-.594.102-1.17.321-1.711V7.648H2.875A10 10 0 0 0 1.8 12c0 1.402.336 2.726.975 3.896l3.506-2.185Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 6.08c1.498 0 2.844.515 3.904 1.526l2.928-2.928C17.06 2.96 14.75 2 12 2a10.2 10.2 0 0 0-9.125 5.648l3.506 2.641C7.09 7.876 9.342 6.08 12 6.08Z"
                      fill="#EA4335"
                    />
                  </svg>
                </span>

                <span>Google로 로그인</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}
