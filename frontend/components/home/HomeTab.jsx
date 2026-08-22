"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, MapPin, MapPinned, Ticket, X } from "lucide-react";
import {
  listBanners,
  listFestivals,
  listPopups,
  listRecommendedPlaces,
} from "../../lib/api/home";
import { HOME_CONTENT } from "../../lib/app-data";
import { createTranslator, translateError } from "../../lib/i18n";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";

const ACCENTS = ["#c96d2d", "#287c70", "#405a9d", "#8f4515"];
const PLACES_PER_PAGE = 2;
const NOTICE_SEEN_KEY = "gyeongju.noticeSeenOn";
// 경주 소식 배너는 번역본이 없어 당분간 숨긴다. 되살릴 때는 이 값만 true 로 바꾼다.
const SHOW_NEWS_BANNERS = false;

function toDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function short(date) {
  return `${date.getMonth() + 1}. ${date.getDate()}`;
}

function formatPeriod(startIso, endIso, t) {
  const start = toDate(startIso);
  const end = toDate(endIso);

  if (start && end) return `${short(start)} - ${short(end)}`;
  if (start) return t("home.starts", { date: short(start) });
  if (end) return t("home.ends", { date: short(end) });
  return null;
}

// 배너·공지 링크는 운영자가 넣는 값이라 javascript: 같은 스킴이 섞일 수 있다.
// 외부 주소와 앱 내부 경로만 통과시킨다.
function safeHref(value) {
  const url = typeof value === "string" ? value.trim() : "";
  return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : null;
}

function BannerCard({ banner }) {
  const link = safeHref(banner.link);
  const body = (
    <article className="relative h-44 overflow-hidden rounded-xl bg-[#2c1e19]">
      {banner.img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" aria-hidden="true" className="h-full w-full object-cover" src={banner.img} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#2c1e19] via-[#2c1e19]/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-[#fff8ec]">
        {banner.subTitle && <p className="text-xs font-bold text-[#ffd4a0]">{banner.subTitle}</p>}
        <h3 className="mt-1 text-lg font-bold leading-snug">{banner.title}</h3>
      </div>
    </article>
  );

  if (!link) return body;
  return (
    <a className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bd8c31]" href={link}>
      {body}
    </a>
  );
}

// 앱 안의 그림지도는 도심권 좌표만 그릴 수 있어서, 추천 관광지는 카카오맵으로 넘긴다.
function PlaceAddress({ place }) {
  const style = "mt-3 flex items-start gap-1.5 text-xs text-[#8a7d71]";
  const body = (
    <>
      <MapPin className="mt-0.5 shrink-0" size={13} />
      {place.address}
    </>
  );

  if (place.latitude == null || place.longitude == null) return <p className={style}>{body}</p>;

  const name = encodeURIComponent(place.name || "관광지");
  return (
    <a
      className={`${style} hover:text-[#9a4e17]`}
      href={`https://map.kakao.com/link/map/${name},${place.latitude},${place.longitude}`}
      rel="noreferrer"
      target="_blank"
    >
      {body}
    </a>
  );
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// 공지는 홈에 계속 띄우지 않고 들어올 때 한 번만 보여준다. "오늘 하루 보지 않기" 를
// 누르면 그날 날짜가 남아 다음 날 다시 뜬다.
function NoticePopup({ popups, t }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (popups.length === 0) return;
    setOpen(window.localStorage.getItem(NOTICE_SEEN_KEY) !== today());
  }, [popups]);

  const close = (hideToday) => {
    if (hideToday) window.localStorage.setItem(NOTICE_SEEN_KEY, today());
    setOpen(false);
  };

  if (!open || popups.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241b16]/45 px-8">
      <section aria-label={t("home.notice")} aria-modal="true" className="w-full max-w-[19rem] overflow-hidden rounded-2xl bg-white shadow-xl" role="dialog">
        <div className="flex items-center justify-between gap-3 border-b border-[#f0e8de] px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a67927]">Notice</p>
          <button aria-label={t("common.close")} className="text-[#8a7d71] hover:text-[#241b16]" onClick={() => close(false)} type="button">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[20rem] space-y-4 overflow-y-auto px-5 py-4">
          {popups.map((popup, index) => (
            <div className="flex items-start gap-3" key={`${popup.title}-${index}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1df] text-[#a45118]"><CalendarDays size={18} /></div>
              <div className="min-w-0">
                <p className="font-bold text-[#241b16]">{popup.title}</p>
                {popup.content && <p className="mt-1 text-sm leading-6 text-[#6f6256]">{popup.content}</p>}
                {popup.img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" aria-hidden="true" className="mt-3 w-full rounded-md object-cover" src={popup.img} />
                )}
                {safeHref(popup.link) && (
                  <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210]" href={safeHref(popup.link)}>
                    {t("home.detail")} <ChevronRight size={15} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <button className="w-full border-t border-[#f0e8de] bg-[#fff8f0] py-3 text-xs font-bold text-[#a45118] hover:bg-[#fff1df]" onClick={() => close(true)} type="button">
          {t("home.hideToday")}
        </button>
      </section>
    </div>
  );
}


export default function HomeTab({ onMapOpen, language: languageProp, popupHidden }) {
  const { language: contextLanguage } = useI18n();
  const language = languageProp || contextLanguage;
  const t = useMemo(() => createTranslator(language), [language]);
  const [banners, setBanners] = useState([]);
  const [popups, setPopups] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [places, setPlaces] = useState([]);
  const [placePage, setPlacePage] = useState(0);
  const [notice, setNotice] = useState("");

  const loadHome = useCallback(async () => {
    // 한 섹션이 실패해도 나머지는 그대로 보여준다.
    const results = await Promise.allSettled([
      SHOW_NEWS_BANNERS ? listBanners(language) : [],
      listPopups(language),
      listFestivals(language),
      listRecommendedPlaces(language),
    ]);
    const [bannerItems, popupItems, festivalItems, placeItems] = results.map(
      (result) => (result.status === "fulfilled" ? result.value : []),
    );
    setBanners(bannerItems);
    setPopups(popupItems);
    setFestivals(festivalItems);
    setPlaces(placeItems);
    setPlacePage(0);

    const failed = results.find((result) => result.status === "rejected");
    setNotice(failed ? translateError(failed.reason, t) : "");
  }, [language, t]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const placePageCount = Math.ceil(places.length / PLACES_PER_PAGE);
  const pagedPlaces = places.slice(placePage * PLACES_PER_PAGE, (placePage + 1) * PLACES_PER_PAGE);

  return (
    <section className="space-y-7">
      <div className="overflow-hidden rounded-xl bg-[#2c1e19] px-6 py-4 text-[#fff8ec]">
        <p className="text-xs font-bold text-[#e0b06a]">Gyeongju</p>
        <h1 className="mt-1 text-xl font-bold leading-7">{t("home.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f0dcc4]">{t("home.description")}</p>
        <AppButton className="mt-3" icon={MapPinned} onClick={onMapOpen} variant="light">{t("home.nearby")}</AppButton>
        {notice && <p className="mt-3 text-sm font-bold text-[#ffd4a0]">{notice}</p>}
      </div>

      <div>
        <SectionHeading eyebrow="Festival" title={t("home.festivals")} />
        <div className="space-y-3">
          {festivals.length === 0 && <p className="text-sm text-[#7c6d61]">{t("home.noFestival")}</p>}
          {festivals.map((festival, index) => {
            const period = formatPeriod(festival.startDate, festival.endDate, t);
            const url = safeHref(festival.url);
            return (
              <article className="flex gap-4 rounded-lg border border-[#e6ddd2] bg-white p-4" key={`${festival.name}-${index}`}>
                {festival.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" aria-hidden="true" className="aspect-[5/7] w-[4.5rem] shrink-0 rounded-md object-cover" src={festival.img} />
                ) : (
                  <div className="aspect-[5/7] w-[4.5rem] shrink-0 rounded-md" style={{ background: ACCENTS[index % ACCENTS.length] }} />
                )}
                <div className="min-w-0">
                  {festival.location && <p className="text-xs font-bold text-[#8a7d71]">{festival.location}</p>}
                  <h2 className="mt-1 font-bold text-[#241b16]">{festival.name}</h2>
                  {period && <p className="mt-2 text-sm text-[#6f6256]">{period}</p>}
                  {url && (
                    <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210]" href={url} rel="noreferrer" target="_blank">
                      {t("home.festivalInfo")} <ChevronRight size={15} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div>
        <SectionHeading eyebrow="Recommended" title={t("home.recommended")} />
        <ul className="space-y-3">
          {places.length === 0 && <li className="text-sm text-[#7c6d61]">{t("home.noRecommended")}</li>}
          {pagedPlaces.map((place, index) => (
            <li key={`${place.name}-${index}`}>
              <article className="rounded-lg border border-[#e6ddd2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-[#241b16]">{place.name}</h3>
                  {place.admissionFee && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff1df] px-2.5 py-1 text-xs font-bold text-[#a45118]">
                      <Ticket size={13} />
                      {place.admissionFee}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 h-12 whitespace-pre-line text-sm leading-6 text-[#6f6256]">{place.text}</p>
                {place.address && <PlaceAddress place={place} />}
              </article>
            </li>
          ))}
        </ul>
        {placePageCount > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: placePageCount }, (_, page) => (
              <button
                aria-current={page === placePage}
                aria-label={t("home.recommendedPage", { page: page + 1 })}
                className={`h-2 rounded-full transition-all ${page === placePage ? "w-5 bg-[#9a4e17]" : "w-2 bg-[#ded2c4]"}`}
                key={page}
                onClick={() => setPlacePage(page)}
                type="button"
              />
            ))}
          </div>
        )}
      </div>

      {SHOW_NEWS_BANNERS && (
        <div>
          <SectionHeading eyebrow="Banner" title={t("home.news")} />
          {banners.length === 0 ? (
            <p className="text-sm text-[#7c6d61]">{t("home.noBanner")}</p>
          ) : (
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {banners.map((banner, index) => (
                <li key={`${banner.title}-${index}`} className="w-[86%] shrink-0 snap-start sm:w-[420px]">
                  <BannerCard banner={banner} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border-t border-[#e6ddd2] pt-5">
        <a href={HOME_CONTENT.tourismUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-[#9a4e17] hover:text-[#6f3210]">
          {t("home.tourismInfo")} <ChevronRight size={16} />
        </a>
      </div>

      {!popupHidden && <NoticePopup popups={popups} t={t} />}
    </section>
  );
}
