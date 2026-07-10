import { LogIn } from "lucide-react";
import { AUTH_COPY } from "../../lib/app-data";
import AppButton from "../ui/AppButton";
import CheomseongdaeArtwork from "./CheomseongdaeArtwork";

const LANDING_LOGO = "PlayGyeongju";

export default function IntroScreen({ onAuth }) {
  return (
    <main className="min-h-[100svh] bg-[#f7f8f7]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col bg-[#fdfdfc] px-6 py-6 shadow-[0_0_32px_rgba(52,50,53,0.06)]">
        <p className="landing-logo" aria-label={LANDING_LOGO}>
          <span className="landing-logo__base" aria-hidden="true">{LANDING_LOGO}</span>
          <span className="landing-logo__fill" aria-hidden="true">{LANDING_LOGO}</span>
          <span className="landing-logo__track" aria-hidden="true"><span /></span>
        </p>
        <div className="flex min-h-0 flex-1 items-start justify-center pt-7">
          <div className="w-full max-w-[350px]">
            <CheomseongdaeArtwork />
          </div>
        </div>
        <section className="pb-16 text-center">
          <h1 className="whitespace-pre-line text-3xl font-semibold leading-[1.2] text-[#343235]">{AUTH_COPY.introTitle}</h1>
          <AppButton className="mt-5" icon={LogIn} onClick={() => onAuth("login")}>로그인</AppButton>
        </section>
      </div>
    </main>
  );
}
