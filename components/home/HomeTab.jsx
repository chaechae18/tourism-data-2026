import { CalendarDays, ChevronRight, MapPinned } from "lucide-react";
import { HOME_CONTENT } from "../../lib/app-data";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";

export default function HomeTab({ onMapOpen }) {
  return (
    <section className="space-y-7">
      <div className="overflow-hidden rounded-xl bg-[#2c1e19] p-6 text-[#fff8ec] sm:p-8">
        <p className="text-sm font-bold text-[#ffd4a0]">{HOME_CONTENT.hero.eyebrow}</p>
        <h1 className="mt-2 max-w-lg text-3xl font-bold leading-tight">{HOME_CONTENT.hero.title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-[#f8dec0]">{HOME_CONTENT.hero.description}</p>
        <AppButton className="mt-5" icon={MapPinned} variant="secondary" onClick={onMapOpen}>가까운 장소 보기</AppButton>
      </div>

      <div>
        <SectionHeading eyebrow="Festival" title="지금 열리는 행사" />
        <div className="grid gap-3 sm:grid-cols-3">
          {HOME_CONTENT.festivals.map((festival) => (
            <article key={festival.id} className="border border-[#e6ddd2] bg-white p-4">
              <div className="h-1.5 w-12 rounded-full" style={{ background: festival.color }} />
              <p className="mt-4 text-xs font-bold text-[#8a7d71]">{festival.type}</p>
              <h2 className="mt-1 font-bold text-[#241b16]">{festival.title}</h2>
              <p className="mt-2 text-sm text-[#6f6256]">{festival.period}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="border-y border-[#e6ddd2] py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1df] text-[#a45118]"><CalendarDays size={18} /></div>
          <div>
            <p className="font-bold text-[#241b16]">{HOME_CONTENT.popup.title}</p>
            <p className="mt-1 text-sm leading-6 text-[#6f6256]">{HOME_CONTENT.popup.description}</p>
          </div>
        </div>
        <a href={HOME_CONTENT.tourismUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210] sm:mt-0">경주 관광 정보 <ChevronRight size={16} /></a>
      </div>
    </section>
  );
}
