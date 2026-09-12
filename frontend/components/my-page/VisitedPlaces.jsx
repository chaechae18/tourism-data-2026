import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Navigation,
} from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";


export default function VisitedPlaces({
  onClose,
}) {
  const { t } = useI18n();
  const [visitedPlaces, setVisitedPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisitedPlaces = async () => {
      try {
        const response = await fetch(
          "http://localhost:8001/api/v1/auth/visit-place",
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("방문 장소 조회에 실패했습니다.");
        }

        const data = await response.json();

        setVisitedPlaces(data.places ?? []);
      } catch (error) {
        console.error("방문 장소 조회 실패:", error);
        setVisitedPlaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitedPlaces();
  }, []);

  return (
    <section className="space-y-6 pb-6">

      {/* ========================================
          헤더
      ======================================== */}

      <div className="flex items-center gap-3">

        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e2e4e0] bg-white text-[#55565a] transition-colors hover:bg-[#f5f5f2]"
          aria-label="뒤로가기"
        >
          <ChevronLeft size={19} />
        </button>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#bd8c31]">
            MY TRAVEL TICKETS
          </p>

          <h2 className="mt-0.5 text-xl font-bold text-[#343235]">
            {t("myPage.visited")}
          </h2>
        </div>

      </div>


      {/* ========================================
          상단 요약
      ======================================== */}

      <div className="rounded-2xl border border-[#e4ddd2] bg-[#fffaf3] p-5">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#343235] text-[#bd8c31]">
              <MapPin size={20} />
            </div>

            <div>
              <p className="text-sm font-bold text-[#343235]">
                {t("myPage.visitedPlaces.ticketTitle")}
              </p>

              <p className="mt-0.5 text-xs text-[#88847e]">
                {t("myPage.visitedPlaces.ticketDescription")}
              </p>
            </div>

          </div>

          <Navigation
            size={21}
            className="rotate-45 text-[#bd8c31]"
          />

        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#e7ded2] pt-4">

          <span className="text-[11px] font-medium text-[#8a8580]">
            COLLECTED TICKETS
          </span>

          <span className="text-lg font-bold text-[#343235]">
            {visitedPlaces.length}

            <span className="ml-1 text-xs font-medium text-[#8a8580]">
              tickets
            </span>
          </span>

        </div>

      </div>


      {/* ========================================
          티켓 목록
      ======================================== */}

      <div>

        <div className="mb-3 flex items-center justify-between">

          <p className="text-sm font-bold text-[#343235]">
            방문 기록
          </p>

          <span className="text-[11px] font-medium text-[#9a9690]">
            {visitedPlaces.length}장의 티켓
          </span>

        </div>


        {/* 로딩 */}

        {loading ? (

          <div className="py-12 text-center">
            <p className="text-sm text-[#88847e]">
              방문 기록을 불러오는 중이에요.
            </p>
          </div>

        ) : visitedPlaces.length === 0 ? (

          /* 방문 기록 없음 */

          <div className="rounded-2xl border border-dashed border-[#d9d4ca] bg-[#faf9f6] px-5 py-12 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f4eee5] text-[#bd8c31]">
              <MapPin size={21} />
            </div>

            <p className="mt-4 text-sm font-bold text-[#343235]">
              아직 다녀간 장소가 없어요.
            </p>

            <p className="mt-1 text-[11px] text-[#99938b]">
              경주의 장소를 방문하고 여행 티켓을 모아보세요.
            </p>

          </div>

        ) : (

          /* 티켓 목록 */

          <div className="space-y-5">

            {visitedPlaces.map((place, index) => (

              <button
                key={place.place_idx}
                type="button"
                onClick={() => {
                  const url = `https://www.google.com/maps?q=${place.latitude},${place.longitude}`;
                  window.open(url, "_blank");
                }}
                className="group relative w-full text-left"
              >

                {/* ==================================
                    티켓 전체
                ================================== */}

                <div className="relative overflow-hidden rounded-2xl border border-[#ddd5ca] bg-[#fffdf9] shadow-[0_3px_12px_rgba(60,45,30,0.08)]">


                  {/* ==================================
                      사진 영역
                  ================================== */}

                  <div className="relative h-36 overflow-hidden">

                    {place.img ? (

                      <img
                        src={place.img}
                        alt={place.name}
                        className="h-full w-full object-cover"
                      />

                    ) : (

                      <div className="flex h-full w-full items-center justify-center bg-[#eee9e1] text-[#aaa39a]">
                        <MapPin size={30} />
                      </div>

                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />


                    {/* 좌측 티켓 라벨 */}

                    <div className="absolute left-4 top-4 rounded-md bg-white/95 px-3 py-1.5 shadow-sm">

                      <p className="text-[9px] font-bold tracking-[0.16em] text-[#343235]">
                        GYEONGJU
                      </p>

                    </div>


                    {/* 번호 */}

                    <div className="absolute bottom-3 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#343235]/85 text-xs font-bold text-white">

                      {String(index + 1).padStart(2, "0")}

                    </div>


                    {/* 장소 이름 */}

                    <div className="absolute bottom-4 left-4 right-14">

                      <p className="text-[9px] font-medium tracking-[0.14em] text-white/70">
                        DESTINATION
                      </p>

                      <h3 className="mt-0.5 truncate text-lg font-bold text-white">
                        {place.name}
                      </h3>

                    </div>

                  </div>


                  {/* ==================================
                      절취선
                  ================================== */}

                  <div className="relative flex items-center">

                    <div className="h-px flex-1 border-t border-dashed border-[#d5ccc0]" />

                    <div className="mx-3 text-[8px] font-bold tracking-[0.18em] text-[#b4ada5]">
                      VISITED
                    </div>

                    <div className="h-px flex-1 border-t border-dashed border-[#d5ccc0]" />

                  </div>


                  {/* ==================================
                      티켓 정보
                  ================================== */}

                  <div className="p-4">

                    <div className="flex items-center gap-4">


                      {/* 지도 아이콘 */}

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4eee5] text-[#bd8c31]">
                        <MapPin size={19} />
                      </div>


                      {/* 장소 정보 */}

                      <div className="min-w-0 flex-1">

                        <p className="truncate text-sm font-bold text-[#343235]">
                          {place.name}
                        </p>

                        {(place.text || place.content) && (

                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#85817c]">
                            {place.text || place.content}
                          </p>

                        )}

                        {place.address && (

                          <p className="mt-1 truncate text-[10px] text-[#aaa39a]">
                            {place.address}
                          </p>

                        )}

                      </div>


                      {/* ==================================
                          방문 완료 스탬프
                      ================================== */}

                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#bd8c31]/70 text-[#bd8c31]">

                        <div className="absolute inset-1 rounded-full border border-dashed border-[#bd8c31]/50" />

                        <div className="relative text-center">

                          <Check
                            size={15}
                            strokeWidth={3}
                            className="mx-auto"
                          />

                          <span className="mt-0.5 block text-[7px] font-bold tracking-[0.08em]">
                            VISITED
                          </span>

                        </div>

                      </div>

                    </div>


                    {/* ==================================
                        하단 티켓 정보
                    ================================== */}

                    <div className="mt-4 flex items-center justify-between border-t border-[#eee7de] pt-3">

                      <div className="flex min-w-0 items-center gap-2">

                        <span className="text-[9px] font-medium tracking-[0.12em] text-[#aaa39a]">
                          TRAVEL RECORD
                        </span>

                        <span className="h-1 w-1 shrink-0 rounded-full bg-[#c7beb3]" />

                        <span className="truncate text-[9px] text-[#aaa39a]">
                          {place.category_main || "GYEONGJU"}
                        </span>

                      </div>

                      <ChevronRight
                        size={15}
                        className="shrink-0 text-[#b9b1a8]"
                      />

                    </div>

                  </div>


                  {/* ==================================
                      티켓 좌우 절취용 반원
                  ================================== */}

                  <div className="absolute -left-3 top-[138px] h-6 w-6 rounded-full border border-[#ddd5ca] bg-[#f8f7f4]" />

                  <div className="absolute -right-3 top-[138px] h-6 w-6 rounded-full border border-[#ddd5ca] bg-[#f8f7f4]" />

                </div>

              </button>

            ))}

          </div>

        )}

      </div>


      {/* ========================================
          하단 안내
      ======================================== */}

      <div className="rounded-xl border border-dashed border-[#d9d4ca] bg-[#faf9f6] px-4 py-3">

        <p className="text-center text-[11px] leading-5 text-[#8a8b8d]">
          티켓을 누르면 해당 장소를
          <br />
          지도에서 확인할 수 있어요.
        </p>

      </div>

    </section>
  );
}