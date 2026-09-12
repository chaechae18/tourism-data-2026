import {
  ChevronLeft,
  Mail,
  User,
  Globe2,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";

import AppButton from "../ui/AppButton";

export default function PersonalInfoEdit({
  user,
  setUser,
  onClose,
  onNotice,
}) {
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const handleSave = async () => {
    try {
      const updateData = {
        nickname: nickname.trim(),
        country: country.trim(),
        birthDate: birthDate || null,
        email: email.trim(),
      };

      const response = await fetch(
        "http://localhost:8001/api/v1/auth/update-user",
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        throw new Error("개인정보 수정에 실패했습니다.");
      }

      const data = await response.json();

      setUser((current) => ({
        ...current,
        ...(data?.user ?? updateData),
      }));

      onNotice?.("개인정보가 수정되었습니다.");
      onClose?.();
    } catch (error) {
      console.error("개인정보 수정 실패:", error);
      onNotice?.(
        error.message || "개인정보 수정에 실패했습니다."
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
              text-[#bd8c31]
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
            개인정보 수정
          </h2>

          <p className="mt-1 text-[11px] text-[#969087]">
            나의 프로필 정보를 관리해보세요
          </p>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div
        className="
          overflow-hidden
          rounded-2xl
          border border-[#ebe5dc]
          bg-white
          shadow-[0_5px_20px_rgba(70,55,35,0.05)]
        "
      >
        {/* 카드 제목 */}
        <div className="border-b border-[#f0ece6] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#bd8c31]" />

            <h3 className="text-[13px] font-bold text-[#45413d]">
              기본 정보
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
                className="text-[#bd8c31]"
              />
              닉네임
            </label>

            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
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
              placeholder="닉네임을 입력해주세요"
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
                className="text-[#bd8c31]"
              />
              이메일
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              placeholder="이메일을 입력해주세요"
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
                className="text-[#bd8c31]"
              />
              국가
            </label>

            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
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
              placeholder="국가를 입력해주세요"
            />
          </div>

          {/* 생년월일 */}
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
              <CalendarDays
                size={14}
                className="text-[#bd8c31]"
              />
              생년월일
            </label>

            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
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
                hover:border-[#d8d0c4]
                focus:border-[#c9a15a]
                focus:bg-white
                focus:ring-4
                focus:ring-[#bd8c31]/10
              "
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
              프로필 안내
            </p>

            <p
              className="
                mt-1
                text-[11px]
                leading-5
                text-[#958c82]
              "
            >
              입력한 정보는 프로필과 여행 기록을
              표시하는 데 사용됩니다.
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
          !bg-[#bd8c31]
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
        저장하기
      </AppButton>
    </section>
  );
}