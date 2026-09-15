import { LogIn } from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";
import DonggyeongGathering from "./DonggyeongGathering";

export default function IntroScreen({ onAuth }) {
  const { t } = useI18n();
  return (
    <main className="min-h-[100svh] bg-white">
      <div className="relative isolate mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col gap-12 overflow-hidden px-6 py-12">
        <div className="-mx-4 flex flex-1 items-center">
          <DonggyeongGathering />
        </div>
        <section className="shrink-0 text-center">
          <AppButton className="w-full max-w-[220px]" icon={LogIn} onClick={() => onAuth("login")}>{t("intro.login")}</AppButton>
        </section>
      </div>
    </main>
  );
}
