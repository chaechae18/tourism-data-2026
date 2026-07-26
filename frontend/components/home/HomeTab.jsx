"use client";

import { CalendarDays, ChevronRight, MapPinned } from "lucide-react";
import { HOME_CONTENT } from "../../lib/app-data";
import { formatPeriod } from "../../lib/format-date";
import useApiResource from "../../lib/api/useApiResource";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";
import BannerCarousel from "./BannerCarousel";
import RecommendedPlaces from "./RecommendedPlaces";
import SectionStatus, { SkeletonBlock } from "./SectionStatus";

// Decoration only — the API carries no colour, and inventing one per festival
// would be inventing content. Cycling a fixed palette keeps the cards distinct.
const ACCENTS = ["#c96d2d", "#287c70", "#405a9d", "#8f4515"];

export default function HomeTab({ onMapOpen, language = "ko" }) {
  const banners = useApiResource("/api/main/banners", { lang: language });
  const popups = useApiResource("/api/main/popup", { lang: language });
  const festivals = useApiResource("/api/main/festivals", { lang: language });
  const places = useApiResource("/api/main/places/recommended", { lang: language });

  return (
    <section className="space-y-7">
      <div className="overflow-hidden rounded-xl bg-[#2c1e19] p-6 text-[#fff8ec]">
        <p className="text-sm font-bold text-[#ffd4a0]">{HOME_CONTENT.hero.eyebrow}</p>
        <h1 className="mt-2 max-w-lg text-3xl font-bold leading-tight">{HOME_CONTENT.hero.title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-[#f8dec0]">{HOME_CONTENT.hero.description}</p>
        <AppButton className="mt-5" icon={MapPinned} variant="secondary" onClick={onMapOpen}>가까운 장소 보기</AppButton>
      </div>

      <div>
        <SectionHeading eyebrow="Notice" title="지금 알려드려요" />
        <PopupNotice {...popups} />
      </div>

      <div>
        {/* 배너는 운영자가 등록하는 홍보물이고, 노출 기간은 MAIN_BANNER 의
            START_DATE/END_DATE 가 정합니다. "이번 주" 같은 기간을 제목에 박으면
            매주 손대야 하는 것처럼 읽혀서 쓰지 않습니다. */}
        <SectionHeading eyebrow="Banner" title="경주 소식" />
        <BannerCarousel banners={banners.data} error={banners.error} loading={banners.loading} onRetry={banners.retry} />
      </div>

      <div>
        <SectionHeading eyebrow="Festival" title="지금 열리는 행사" />
        <FestivalList {...festivals} />
      </div>

      <div>
        <SectionHeading eyebrow="Recommended" title="추천 관광지" />
        <RecommendedPlaces error={places.error} loading={places.loading} onRetry={places.retry} places={places.data} />
      </div>

      <div className="border-t border-[#e6ddd2] pt-5">
        <a href={HOME_CONTENT.tourismUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210]">경주 관광 정보 <ChevronRight size={16} /></a>
      </div>
    </section>
  );
}

function PopupNotice({ data, error, loading, retry }) {
  return (
    <SectionStatus
      empty={Array.isArray(data) && data.length === 0}
      emptyLabel="새로운 공지가 없어요."
      error={error}
      loading={loading}
      onRetry={retry}
      skeleton={<SkeletonBlock className="h-20 w-full" />}
    >
      <div className="space-y-4">
        {(data ?? []).map((popup, index) => (
          <div className="flex items-start gap-3" key={`${popup.title}-${index}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1df] text-[#a45118]"><CalendarDays size={18} /></div>
            <div>
              <p className="font-bold text-[#241b16]">{popup.title}</p>
              {popup.content && <p className="mt-1 text-sm leading-6 text-[#6f6256]">{popup.content}</p>}
              {popup.link && (
                <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210]" href={popup.link}>
                  자세히 보기 <ChevronRight size={15} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionStatus>
  );
}

function FestivalList({ data, error, loading, retry }) {
  return (
    <SectionStatus
      empty={Array.isArray(data) && data.length === 0}
      emptyLabel="예정된 행사가 없어요."
      error={error}
      loading={loading}
      onRetry={retry}
      skeleton={
        <>
          <SkeletonBlock className="h-28 w-full" />
          <SkeletonBlock className="h-28 w-full" />
        </>
      }
    >
      <div className="space-y-3">
        {(data ?? []).map((festival, index) => {
          const period = formatPeriod(festival.start_date, festival.end_date);
          return (
            <article className="rounded-lg border border-[#e6ddd2] bg-white p-4" key={`${festival.name}-${index}`}>
              <div className="h-1.5 w-12 rounded-full" style={{ background: ACCENTS[index % ACCENTS.length] }} />
              {festival.location && <p className="mt-4 text-xs font-bold text-[#8a7d71]">{festival.location}</p>}
              <h2 className="mt-1 font-bold text-[#241b16]">{festival.name}</h2>
              {period && <p className="mt-2 text-sm text-[#6f6256]">{period}</p>}
              {festival.url && (
                <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210]" href={festival.url} rel="noreferrer" target="_blank">
                  행사 정보 <ChevronRight size={15} />
                </a>
              )}
            </article>
          );
        })}
      </div>
    </SectionStatus>
  );
}
