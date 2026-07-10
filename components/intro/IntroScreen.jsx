import { LogIn } from "lucide-react";
import { APP_NAME, AUTH_COPY } from "../../lib/app-data";
import AppButton from "../ui/AppButton";

export default function IntroScreen({ onAuth }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f7f5]">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-7 sm:px-10 sm:py-9">
        <p className="relative z-10 text-sm font-semibold tracking-wide text-[#356b98]">{APP_NAME}</p>
        <img
          alt="별이 빛나는 밤의 첨성대 종이 공예 일러스트"
          className="pointer-events-none absolute bottom-0 right-[-18%] h-[73%] max-w-none object-contain opacity-95 sm:right-[-9%] sm:h-[86%] lg:right-0"
          src="/images/cheomseongdae-paper-cut.png"
        />
        <section className="relative z-10 mt-auto max-w-xl pb-[19rem] sm:pb-20 lg:pb-28">
          <h1 className="whitespace-pre-line text-4xl font-semibold leading-[1.15] text-[#343235] sm:text-6xl">{AUTH_COPY.introTitle}</h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-[#747579]">{AUTH_COPY.introDescription}</p>
          <AppButton className="mt-8" icon={LogIn} onClick={() => onAuth("login")}>로그인</AppButton>
        </section>
      </div>
    </main>
  );
}
