import {
  ChevronLeft,
  Mail,
  User,
  Globe2,
} from "lucide-react";
import { useMemo, useState } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";

import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

export default function PersonalInfoEdit({
  user,
  setUser,
  onClose,
  onNotice,
}) {
  const { t, language } = useI18n();

  const [nickname, setNickname] = useState(
    user?.nickname ?? ""
  );

  const [country, setCountry] = useState(
    user?.country ?? ""
  );

  const [email, setEmail] = useState(
    user?.email ?? ""
  );

  // 회원가입 화면과 동일한 국가 목록
  const countries = useMemo(() => {
    const options = countryList().getData();

    if (!Intl.DisplayNames) {
      return options;
    }

    const displayNames = new Intl.DisplayNames(
      [language === "ko"
        ? "ko-KR"
        : language === "en"
        ? "en-US"
        : language === "zh"
        ? "zh-CN"
        : "ja-JP"],
      {
        type: "region",
      }
    );

    return options.map((item) => ({
      ...item,
      label:
        displayNames.of(item.value) || item.label,
    }));
  }, [language]);

  const selectedCountry = countries.find(
    (item) => item.value === country
  ) || null;

  const handleSave = async () => {
    try {
      const updateData = {
        nickname: nickname.trim(),
        country: country.trim(),
        email: email.trim(),
      };

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/update-user`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            t("myPage.personalInfo.updateFailed")
        );
      }

      setUser((current) => ({
        ...current,
        ...(data?.user ?? updateData),
      }));

      onNotice?.(
        t("myPage.personalInfo.updated")
      );

      onClose?.();
    } catch (error) {
      console.error(
        "개인정보 수정 실패:",
        error
      );

      onNotice?.(
        error.message ||
          t("myPage.personalInfo.updateFailed")
      );
    }
  };

  return (
    <section className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="flex items-center border-b border-[#eee9e1] pb-5">
        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={onClose}
          className="
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            border border-[#e8e2d8]
            bg-white
            text-[#66615b]
            shadow-[0_2px_8px_rgba(70,55,35,0.04)]
            transition-all
            hover:bg-[#faf7f2]
            hover:shadow-[0_3px_10px_rgba(70,55,35,0.07)]
          "
          aria-label="뒤로가기"
        >
          <ChevronLeft size={19} />
        </button>

        {/* 제목 */}
        <div className="ml-4">
          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-brand
            "
          >
            PROFILE
          </p>

          <h2
            className="
              mt-1
              text-[20px]
              font-bold
              tracking-[-0.02em]
              text-[#343235]
            "
          >
            {t("myPage.personalInfo.title")}
          </h2>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div
        className="
          rounded-2xl
          border border-[#ebe5dc]
          bg-white
          shadow-[0_5px_20px_rgba(70,55,35,0.05)]
        "
      >
        {/* 카드 제목 */}
        <div className="border-b border-[#f0ece6] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />

            <h3 className="text-[13px] font-bold text-[#45413d]">
              {t("myPage.personalInfo.basicInfo")}
            </h3>
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="space-y-5 px-5 py-5">
          {/* 닉네임 */}
          <div>
            <label
              className="
                mb-2
                flex
                items-center
                gap-1.5
                text-[12px]
                font-semibold
                text-[#55514c]
              "
            >
              <User
                size={14}
                className="text-brand"
              />

              {t("myPage.personalInfo.nickname")}
            </label>

            <input
              type="text"
              value={nickname}
              onChange={(e) =>
                setNickname(e.target.value)
              }
              className="
                h-[50px]
                w-full
                rounded-xl
                border border-[#e6e1d9]
                bg-[#fcfbf9]
                px-4
                text-[13px]
                text-[#393633]
                outline-none
                transition-all
                placeholder:text-[#b5afa7]
                hover:border-[#d8d0c4]
                focus:border-[#c9a15a]
                focus:bg-white
                focus:ring-4
                focus:ring-[#bd8c31]/10
              "
              placeholder={t(
                "myPage.personalInfo.nickname"
              )}
            />
          </div>

          {/* 이메일 */}
          <div>
            <label
              className="
                mb-2
                flex
                items-center
                gap-1.5
                text-[12px]
                font-semibold
                text-[#55514c]
              "
            >
              <Mail
                size={14}
                className="text-brand"
              />

              {t("myPage.personalInfo.email")}
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="
                h-[50px]
                w-full
                rounded-xl
                border border-[#e6e1d9]
                bg-[#fcfbf9]
                px-4
                text-[13px]
                text-[#393633]
                outline-none
                transition-all
                placeholder:text-[#b5afa7]
                hover:border-[#d8d0c4]
                focus:border-[#c9a15a]
                focus:bg-white
                focus:ring-4
                focus:ring-[#bd8c31]/10
              "
              placeholder={t(
                "myPage.personalInfo.emailPlaceholder"
              )}
            />
          </div>

          {/* 국가 */}
          <div>
            <label
              className="
                mb-2
                flex
                items-center
                gap-1.5
                text-[12px]
                font-semibold
                text-[#55514c]
              "
            >
              <Globe2
                size={14}
                className="text-brand"
              />

              {t("myPage.personalInfo.country")}
            </label>

            <Select
              options={countries}
              value={selectedCountry}
              onChange={(selected) =>
                setCountry(
                  selected?.value || ""
                )
              }
              placeholder={t(
                "myPage.personalInfo.countryPlaceholder"
              )}
              isSearchable
              isClearable={false}
              className="text-sm"
              classNamePrefix="country-select"
            />
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div
        className="
          rounded-2xl
          border border-[#eadfce]
          bg-gradient-to-r
          from-[#fffaf3]
          to-[#fdf8ef]
          px-5
          py-4
        "
      >
        <div className="flex gap-3">
          <div
            className="
              flex h-7 w-7
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-[#f3e4c9]
              text-[11px]
              font-bold
              text-[#a87927]
            "
          >
            i
          </div>

          <div>
            <p className="text-[12px] font-semibold text-[#625b53]">
              {t(
                "myPage.personalInfo.noticeTitle"
              )}
            </p>

            <p
              className="
                mt-1
                text-[11px]
                leading-5
                text-[#958c82]
              "
            >
              {t(
                "myPage.personalInfo.noticeDescription"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <AppButton
        className="
          !h-[52px]
          w-full
          rounded-xl
          !bg-brand
          !text-white
          font-semibold
          shadow-[0_5px_14px_rgba(189,140,49,0.22)]
          transition-all
          hover:!bg-[#ad7d25]
          hover:shadow-[0_7px_18px_rgba(189,140,49,0.28)]
          active:scale-[0.98]
        "
        onClick={handleSave}
      >
        {t("myPage.personalInfo.save")}
      </AppButton>
    </section>
  );
}