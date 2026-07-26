import SectionStatus, { SkeletonBlock } from "./SectionStatus";

/**
 * GET /api/main/banners — 노출 기간 내 메인 배너.
 *
 * The API already applies the display window and sort order, so this only
 * lays them out. Banners have no translation table, so `lang` does not change
 * what arrives here.
 */
export default function BannerCarousel({ banners, loading, error, onRetry }) {
  return (
    <SectionStatus
      empty={Array.isArray(banners) && banners.length === 0}
      emptyLabel="지금 노출 중인 배너가 없어요."
      error={error}
      loading={loading}
      onRetry={onRetry}
      skeleton={<SkeletonBlock className="h-44 w-full" />}
    >
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {(banners ?? []).map((banner, index) => (
          <li key={`${banner.title}-${index}`} className="w-[86%] shrink-0 snap-start sm:w-[420px]">
            <BannerCard banner={banner} />
          </li>
        ))}
      </ul>
    </SectionStatus>
  );
}

function BannerCard({ banner }) {
  const body = (
    <article className="relative h-44 overflow-hidden rounded-xl bg-[#2c1e19]">
      {banner.img && (
        // Remote banner URLs are editor-supplied, so next/image would need a
        // host allowlist per campaign. A plain img keeps content ops unblocked.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" aria-hidden="true" className="h-full w-full object-cover" src={banner.img} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#2c1e19] via-[#2c1e19]/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-[#fff8ec]">
        {banner.sub_title && <p className="text-xs font-bold text-[#ffd4a0]">{banner.sub_title}</p>}
        <h3 className="mt-1 text-lg font-bold leading-snug">{banner.title}</h3>
      </div>
    </article>
  );

  if (!banner.link) return body;

  return (
    <a className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bd8c31]" href={banner.link}>
      {body}
    </a>
  );
}
