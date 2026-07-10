import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { APP_NAME, APP_SUBTITLE, AUTH_COPY } from "../../lib/app-data";
import Donggyeong3D from "../donggyeong/Donggyeong3D";
import AppButton from "../ui/AppButton";

export default function IntroScreen({ onAuth, onPreview }) {
  return (
    <main className="min-h-screen bg-[#f5efe6] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-xl border border-[#e6ddd2] bg-[#fffaf4] shadow-[0_18px_50px_rgba(69,44,28,0.12)] lg:grid-cols-[1fr_1fr]">
        <section className="flex flex-col justify-between p-7 sm:p-10">
          <div>
            <p className="text-sm font-bold text-[#9a4e17]">{APP_NAME}</p>
            <h1 className="mt-3 max-w-md text-4xl font-bold leading-tight text-[#241b16]">{AUTH_COPY.introTitle}</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-[#6f6256]">{AUTH_COPY.introDescription}</p>
          </div>
          <div className="mt-10 grid gap-3 sm:max-w-sm">
            <AppButton icon={UserPlus} onClick={() => onAuth("signup")}>회원가입</AppButton>
            <AppButton icon={LogIn} variant="outline" onClick={() => onAuth("login")}>로그인</AppButton>
            <button type="button" onClick={onPreview} className="mt-2 inline-flex items-center justify-center gap-1 text-sm font-bold text-[#7c6d61] hover:text-[#241b16]">{APP_SUBTITLE} <ArrowRight size={15} /></button>
          </div>
        </section>
        <section className="relative min-h-[420px] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#5a3727_0%,#201512_68%)]">
          <Donggyeong3D className="absolute inset-0" interactive={false} />
          <div className="pointer-events-none absolute inset-x-7 bottom-7 text-center text-[#fff8ec]">
            <p className="text-sm font-bold">Donggyeong</p>
            <p className="mt-1 text-xs text-[#ffe2bc]/75">여행의 시작을 함께할 동행</p>
          </div>
        </section>
      </div>
    </main>
  );
}
