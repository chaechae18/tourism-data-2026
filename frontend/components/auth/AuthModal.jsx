import { useMemo, useState } from "react";
import { Calendar, Check, LockKeyhole, Mail, UserRound } from "lucide-react";
import Select from "react-select";
import countryList from "react-select-country-list";
import { LANGUAGE_LOCALES } from "../../lib/i18n";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";
import AppModal from "../ui/AppModal";

const AUTH_API_BASE_URL = "http://localhost:8001/api/v1/auth";
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
  const { language, t } = useI18n();
  const [form, setForm] = useState(INITIAL_FORM);
  const [consented, setConsented] = useState(false);
  const isSignup = mode === "signup";
  const countries = useMemo(() => {
    const options = countryList().getData();
    if (!Intl.DisplayNames) return options;
    const displayNames = new Intl.DisplayNames([LANGUAGE_LOCALES[language]], { type: "region" });
    return options.map((country) => ({
      ...country,
      label: displayNames.of(country.value) || country.label,
    }));
  }, [language]);
  const title = isSignup ? t("auth.signup") : t("auth.login");
  const submitLabel = isSignup ? t("auth.signupSubmit") : t("auth.login");

  const setField = (field) => (event) => setForm((current) => ({
    ...current,
    [field]: event.target.value,
  }));

  const complete = async () => {
    if (isSignup) {
      if (!consented) return alert(t("auth.consentRequired"));
      if (!form.id || !form.nickname || !form.email || !form.password) {
        return alert(t("auth.requiredFields"));
      }
      if (form.password !== form.confirmPassword) return alert(t("auth.passwordMismatch"));
    } else if (!form.id || !form.password) {
      return alert(t("auth.loginRequired"));
    }

    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: isSignup ? "same-origin" : "include",
        body: JSON.stringify(isSignup ? {
          id: form.id,
          nickname: form.nickname,
          email: form.email,
          password: form.password,
          country: form.country,
          birthDate: form.birthDate || null,
        } : {
          id: form.id,
          password: form.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return alert(data?.detail || data?.error?.message || t(isSignup ? "auth.signupFailed" : "auth.loginFailed"));
      }
      onComplete(data);
      setForm(INITIAL_FORM);
      setConsented(false);
    } catch {
      alert(t("common.networkError"));
    }
  };

  return (
    <AppModal open={Boolean(mode)} onClose={onClose} title={title}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.id")}</span>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <UserRound size={17} className="text-[#747579]" />
            <input value={form.id} onChange={setField("id")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder={t("auth.idPlaceholder")} />
          </div>
        </label>

        {isSignup && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.nickname")}</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <UserRound size={17} className="text-[#747579]" />
                <input value={form.nickname} onChange={setField("nickname")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder={t("auth.nicknamePlaceholder")} />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.email")}</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <Mail size={17} className="text-[#747579]" />
                <input type="email" value={form.email} onChange={setField("email")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="name@example.com" />
              </div>
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.password")}</span>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
            <LockKeyhole size={17} className="text-[#747579]" />
            <input type="password" value={form.password} onChange={setField("password")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder={t("auth.password")} />
          </div>
        </label>

        {isSignup && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.passwordConfirm")}</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <LockKeyhole size={17} className="text-[#747579]" />
                <input type="password" value={form.confirmPassword} onChange={setField("confirmPassword")} className="h-11 w-full bg-transparent text-sm outline-none" placeholder={t("auth.passwordConfirmPlaceholder")} />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.country")}</span>
              <Select
                options={countries}
                value={countries.find((country) => country.value === form.country)}
                onChange={(selected) => setForm((current) => ({ ...current, country: selected?.value || "" }))}
                placeholder={t("auth.countryPlaceholder")}
                isSearchable
                className="text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#343235]">{t("auth.birthDate")}</span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e2e4e0] px-3">
                <Calendar size={17} className="text-[#747579]" />
                <input type="date" value={form.birthDate} onChange={setField("birthDate")} className="h-11 w-full bg-transparent text-sm outline-none" />
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f4f6f4] p-3 text-sm text-[#55565a]">
              <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#bd8c31]" />
              <span>{t("auth.consent")}</span>
            </label>
          </>
        )}

        <AppButton type="button" className="w-full" disabled={isSignup && !consented} icon={Check} onClick={complete}>
          {submitLabel}
        </AppButton>
        {!isSignup && (
          <AppButton type="button" className="mt-3 w-full" variant="outline" onClick={() => onAuth("signup")}>
            {t("auth.signup")}
          </AppButton>
        )}
      </div>
    </AppModal>
  );
}
