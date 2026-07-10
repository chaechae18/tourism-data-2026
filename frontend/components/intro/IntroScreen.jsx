import { LogIn } from "lucide-react";
import { APP_NAME, AUTH_COPY } from "../../lib/app-data";
import AppButton from "../ui/AppButton";
import CheomseongdaeArtwork from "./CheomseongdaeArtwork";

export default function IntroScreen({ onAuth }) {
  return (
    <main className="min-h-[100svh] bg-[#f7f8f7]">
      <div className="mx-auto grid min-h-[100svh] w-full max-w-[430px] grid-rows-[auto_1fr_auto] bg-[#fdfdfc] px-6 py-7 shadow-[0_0_32px_rgba(52,50,53,0.06)]">
        <p className="text-center text-sm font-semibold tracking-wide text-[#356b98]">{APP_NAME}</p>
        <div className="flex min-h-0 items-center justify-center py-4">
          <div className="w-full max-w-[340px]">
            <CheomseongdaeArtwork />
          </div>
        </div>
        <section className="pb-2 text-center">
          <h1 className="whitespace-pre-line text-3xl font-semibold leading-[1.2] text-[#343235]">{AUTH_COPY.introTitle}</h1>
          <AppButton className="mt-5" icon={LogIn} onClick={() => onAuth("login")}>로그인</AppButton>
        </section>
      </div>
    </main>
  );
}
