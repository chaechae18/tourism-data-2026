import { ChevronLeft, Mail, User, Globe2, CalendarDays, Camera } from "lucide-react";
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
  const [profileImage, setProfileImage] = useState(
    user?.profileImage ?? ""
  );

  const handleSave = () => {
    setUser((current) => ({
      ...current,
      nickname: nickname.trim() || current.nickname,
      country: country.trim(),
      birthDate: birthDate || null,
      email: email.trim() || current.email,
      profileImage,
    }));

    onNotice?.("개인정보가 수정되었습니다.");
  };

  return (
    <section className="space-y-7 pb-6">

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e2e4e0] bg-white text-[#55565a] transition-colors"
          aria-label="뒤로가기"
        >
          <ChevronLeft size={19} />
        </button>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
            PROFILE
          </p>

          <h2 className="mt-0.5 text-xl font-bold text-[#343235]">
            개인정보 수정
          </h2>
        </div>
      </div>


      {/* 프로필 이미지 */}
      <div className="rounded-2xl border border-[#e2e4e0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">

          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-brand-ink">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="프로필 이미지"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={30} />
              )}
            </div>

            <label
              htmlFor="profile-image"
              className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-sm"
            >
              <Camera size={13} />
            </label>

            <input
              id="profile-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) return;

                const imageUrl = URL.createObjectURL(file);
                setProfileImage(imageUrl);
              }}
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-[#343235]">
              프로필 사진
            </p>

            <p className="mt-1 text-xs leading-5 text-[#8a8b8d]">
              여행 기록에 표시되는 프로필 사진을
              <br />
              변경할 수 있어요.
            </p>
          </div>

        </div>
      </div>


      {/* 기본 정보 */}
      <div className="space-y-5">

        {/* 닉네임 */}
        <div>
          <label
            htmlFor="nickname"
            className="mb-2 block text-sm font-bold text-[#343235]"
          >
            닉네임
          </label>

          <div className="relative">
            <User
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a1a3]"
            />

            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#d9d1c7] bg-white pl-10 pr-3 text-sm text-[#343235] outline-none transition-colors focus:border-brand"
              placeholder="닉네임을 입력해주세요"
            />
          </div>
        </div>


        {/* 이메일 */}
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-bold text-[#343235]"
          >
            이메일
          </label>

          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a1a3]"
            />

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#d9d1c7] bg-white pl-10 pr-3 text-sm text-[#343235] outline-none transition-colors focus:border-brand"
              placeholder="이메일을 입력해주세요"
            />
          </div>
        </div>


        {/* 국가 */}
        <div>
          <label
            htmlFor="country"
            className="mb-2 block text-sm font-bold text-[#343235]"
          >
            국가
          </label>

          <div className="relative">
            <Globe2
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a1a3]"
            />

            <input
              id="country"
              type="text"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#d9d1c7] bg-white pl-10 pr-3 text-sm text-[#343235] outline-none transition-colors focus:border-brand"
              placeholder="예: KR"
              maxLength={10}
            />
          </div>

          <p className="mt-1.5 text-[11px] text-[#9a9b9d]">
            국가 코드를 입력해주세요. 예: KR, JP, US
          </p>
        </div>


        {/* 생년월일 */}
        <div>
          <label
            htmlFor="birth-date"
            className="mb-2 block text-sm font-bold text-[#343235]"
          >
            생년월일
          </label>

          <div className="relative">
            <CalendarDays
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a1a3]"
            />

            <input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#d9d1c7] bg-white pl-10 pr-3 text-sm text-[#343235] outline-none transition-colors focus:border-brand"
            />
          </div>

          <p className="mt-1.5 text-[11px] text-[#9a9b9d]">
            선택 입력 항목입니다.
          </p>
        </div>

      </div>


      {/* 안내 */}
      <div className="rounded-xl border border-[#e8dfd3] bg-[#fffaf4] px-4 py-3">
        <p className="text-[11px] leading-5 text-[#8a8178]">
          입력한 정보는 프로필과 여행 기록을 표시하는 데
          사용됩니다.
        </p>
      </div>


      {/* 저장 */}
      <AppButton
        className="w-full"
        onClick={handleSave}
      >
        저장하기
      </AppButton>

    </section>
  );
}
