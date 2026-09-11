import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Navigation,
} from "lucide-react";

import { QUESTS } from "../../lib/app-data";
import { localizeQuest } from "../../lib/i18n";
import { useI18n } from "../i18n/LanguageProvider";

export default function VisitedPlaces({
  completedQuestIds = [],
  onMapQuest,
  onClose,
}) {
  const { t } = useI18n();

  /*
   * UI 확인용 예시 데이터
   * 실제 데이터 연결 전까지 분황사 + 첨성대 표시
   */
  const previewVisitedQuestIds = [
    "bunhwangsa",
    "cheomseongdae",
  ];

  const visitedPlaces = QUESTS
    .filter((quest) =>
      previewVisitedQuestIds.includes(quest.id)
    )
    .map((quest) => localizeQuest(quest, t));

  /*
   * 장소별 이미지
   */
  const placeImages = {
    bunhwangsa:
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=85",

    cheomseongdae:
      "https://images.unsplash.com/photo-1534274867514-d5b47ef89ed7?auto=format&fit=crop&w=1200&q=85",
  };

  return (
    <section className="space-y-6 pb-6">

      {/* ========================================
          헤더
      ======================================== */}

      <div className="flex items-center gap-3">

        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e2e4e0] bg-white text-[#55565a] transition-colors"
          aria-label="뒤로가기"
        >
          <ChevronLeft size={19} />
        </button>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
            MY TRAVEL TICKETS
          </p>

          <h2 className="mt-0.5 text-xl font-bold text-[#343235]">
            내가 다녀간 장소
          </h2>
        </div>

      </div>


      {/* ========================================
          상단 요약
      ======================================== */}

      <div className="rounded-2xl border border-[#e4ddd2] bg-[#fffaf3] p-5">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#343235] text-brand">
              <MapPin size={20} />
            </div>

            <div>
              <p className="text-sm font-bold text-[#343235]">
                경주 여행 티켓
              </p>

              <p className="mt-0.5 text-xs text-[#88847e]">
                내가 방문한 장소를 티켓으로 모아봤어요.
              </p>
            </div>

          </div>

          <Navigation
            size={21}
            className="rotate-45 text-brand"
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


        <div className="space-y-5">

          {visitedPlaces.map((place, index) => (

            <button
              key={place.id}
              type="button"
              onClick={() => onMapQuest?.(place)}
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

                  <img
                    src={placeImages[place.id]}
                    alt={place.name}
                    className="h-full w-full object-cover"
                  />

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

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <MapPin size={19} />
                    </div>


                    {/* 장소 정보 */}

                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-bold text-[#343235]">
                        {place.name}
                      </p>

                      {place.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#85817c]">
                          {place.description}
                        </p>
                      )}

                    </div>


                    {/* ==================================
                        사용 완료 스탬프
                    ================================== */}

                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-brand/70 text-brand">

                      <div className="absolute inset-1 rounded-full border border-dashed border-brand/50" />

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

                    <div className="flex items-center gap-2">

                      <span className="text-[9px] font-medium tracking-[0.12em] text-[#aaa39a]">
                        TRAVEL RECORD
                      </span>

                      <span className="h-1 w-1 rounded-full bg-[#c7beb3]" />

                      <span className="text-[9px] text-[#aaa39a]">
                        GYEONGJU
                      </span>

                    </div>

                    <ChevronRight
                      size={15}
                      className="text-[#b9b1a8]"
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

