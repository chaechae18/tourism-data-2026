import { MapPin, Ticket } from "lucide-react";
import SectionStatus, { SkeletonBlock } from "./SectionStatus";

/**
 * GET /api/main/places/recommended — 메인 추천 관광지, 조회수 내림차순.
 *
 * PLACE has no translation table, so `lang` does not change what arrives here.
 */
export default function RecommendedPlaces({ places, loading, error, onRetry }) {
  return (
    <SectionStatus
      empty={Array.isArray(places) && places.length === 0}
      emptyLabel="추천 중인 관광지가 없어요."
      error={error}
      loading={loading}
      onRetry={onRetry}
      skeleton={
        <>
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-24 w-full" />
        </>
      }
    >
      <ul className="space-y-3">
        {(places ?? []).map((place, index) => (
          <li key={`${place.name}-${index}`}>
            <article className="rounded-lg border border-[#e6ddd2] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-[#241b16]">{place.name}</h3>
                {place.admission_fee && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff1df] px-2.5 py-1 text-xs font-bold text-[#a45118]">
                    <Ticket size={13} />
                    {place.admission_fee}
                  </span>
                )}
              </div>

              {place.text && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6f6256]">{place.text}</p>}

              {place.address && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-[#8a7d71]">
                  <MapPin className="mt-0.5 shrink-0" size={13} />
                  {place.address}
                </p>
              )}
            </article>
          </li>
        ))}
      </ul>
    </SectionStatus>
  );
}
