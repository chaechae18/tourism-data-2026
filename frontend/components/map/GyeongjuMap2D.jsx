"use client"; // 이 컴포넌트는 브라우저에서 동작 (위치·클릭 등 사용)

import { useMemo, useState } from "react";
// 버튼/마커에 쓰는 아이콘들 (lucide 아이콘 라이브러리)
import { CalendarDays, Car, Check, ChevronRight, Clock, Crown, Footprints, Headphones, List, LocateFixed, Map as MapIcon, MapPin, Navigation, RefreshCw, Route, UtensilsCrossed } from "lucide-react";
// 지도 범례 문구, 장소(퀘스트) 데이터
import { QUESTS } from "../../lib/app-data";
// 지도 "계산 엔진"에서 가져오는 함수/데이터들 (lib/map/gyeongju-map.js)
import {
  DEFAULT_CURRENT_LOCATION,
  formatDistance,
  getDistanceMeters,
  isWithinBounds,
  MAP_SCOPES,
} from "../../lib/map/gyeongju-map";
// 지도 위 경로 그리기는 TMAP, 실제 길찾기 이동은 카카오맵을 쓴다.
import { requestTmapPedestrianRoute } from "../../lib/tmap/pedestrian-route";
import { buildKakaoRouteUrl } from "../../lib/kakao/route-link";
// 공통 버튼 컴포넌트 / 도슨트 재생 시트
import AppButton, { IconButton } from "../ui/AppButton";
import QuestMapCanvas from "./QuestMapCanvas";
import DocentPlayer from "./DocentPlayer";
import { useI18n } from "../i18n/LanguageProvider";

// 1000(m) 이내면 "가까운 장소"로 표시
const NEARBY_DISTANCE_METERS = 1000;
// TMAP 앱 키 (환경변수) / 없으면 길찾기 대신 안내문구만 표시
const TMAP_APP_KEY = process.env.NEXT_PUBLIC_TMAP_APP_KEY || "";
// 지도 화면 위쪽 전환 탭 (지도 그림 / 방문 순서 리스트)
const MAP_VIEWS = [
  { id: "map", label: "지도", icon: MapIcon },
  { id: "list", label: "리스트", icon: List },
];
// 초 단위 시간을 "35분" / "1시간 20분" 형태로 변환
function formatDuration(durationSeconds, t) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return minutes >= 60
    ? t("map.hoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
    : t("map.minutes", { minutes });
}

// 지도 좌하단 "1km 축척 막대"의 픽셀 길이 계산
function LandmarkGlyph({ icon }) {
  if (icon === "tower") {
    return (
      <g>
        <path d="M-5 7 L-4 -7 L4 -7 L6 7 Z" fill="#efe3c6" stroke="#685d51" strokeWidth="1.3" />
        <path d="M-7 -8 L7 -8 L5 -11 L-5 -11 Z" fill="#d7c398" stroke="#685d51" strokeWidth="1.3" />
        <rect x="-1.5" y="-3" width="3" height="4" rx="0.5" fill="#685d51" />
      </g>
    );
  }

  if (icon === "palace") {
    return (
      <g>
        <path d="M-9 -5 Q0 -13 9 -5 L6 -3 L-6 -3 Z" fill="#426c6a" stroke="#304d4b" strokeWidth="1.2" />
        <rect x="-7" y="-3" width="14" height="10" rx="1" fill="#f2d6a0" stroke="#685d51" strokeWidth="1.2" />
        <path d="M-3 7 V1 M3 7 V1" stroke="#9f5c45" strokeWidth="2" />
      </g>
    );
  }

  // 밥집: 고봉밥이 담긴 밥그릇
  if (icon === "food") {
    return (
      <g>
        <path d="M-6.5 -2.5 Q0 -10.5 6.5 -2.5 Z" fill="#fdfaf1" stroke="#7d4630" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M-9.5 -2.5 H9.5 L6.5 6.5 Q0 9.5 -6.5 6.5 Z" fill="#c9714e" stroke="#7d4630" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M-7.5 0.5 Q0 3 7.5 0.5" fill="none" stroke="#f2e2c8" strokeLinecap="round" strokeWidth="1.4" opacity="0.75" />
        <path d="M-3.5 10 H3.5" stroke="#7d4630" strokeLinecap="round" strokeWidth="1.8" />
      </g>
    );
  }

  if (icon === "grotto") {
    return (
      <g>
        <path d="M-10 7 Q-8 -8 0 -10 Q8 -8 10 7 Z" fill="#a4b67d" stroke="#647151" strokeWidth="1.3" />
        <path d="M-3 7 V0 Q0 -5 3 0 V7 Z" fill="#4f5049" />
      </g>
    );
  }

  return (
    <g>
      <path d="M-10 -3 L0 -11 L10 -3 Z" fill="#446d67" stroke="#304d4b" strokeWidth="1.2" />
      <rect x="-7" y="-3" width="14" height="10" rx="1" fill="#f1d09a" stroke="#685d51" strokeWidth="1.2" />
      <path d="M-3 7 V1 M3 7 V1" stroke="#9f5c45" strokeWidth="2" />
    </g>
  );
}

// 지도 위의 장소 마커 (클릭 가능). 상태에 따라 색/표시가 달라짐
//  - completed=방문완료(초록) / nearby=가까움(주황) / 그 외=회색
//  - active=지금 선택된 장소면 테두리 강조 + 펄스 효과
//  - markerScale: 지도를 확대해도 마커·이름표는 원래 크기를 유지하기 위한 보정값(1/배율).
//    이게 없으면 확대할 때 간격과 마커가 똑같이 커져서 뭉친 게 그대로 뭉쳐 있다.
// 장소 상세에 붙는 실용 정보 (운영시간·주차·휴무일·메뉴).
// 서버에 값이 없는 항목은 줄 자체를 그리지 않는다. "정보 없음"을 늘어놓으면 지저분해진다.
function PlaceFacts({ place, t }) {
  const facts = [
    { icon: Clock, label: t("map.operatingHours"), value: place.operatingHours },
    { icon: Car, label: t("map.parking"), value: place.parking },
    { icon: CalendarDays, label: t("map.restDate"), value: place.restDate },
    { icon: UtensilsCrossed, label: t("map.menu"), value: place.menu },
  ].filter((fact) => fact.value);

  if (!facts.length) return null;

  return (
    <dl className="mt-3 space-y-1.5 rounded-xl bg-[#f7f8f6] px-3 py-2.5">
      {facts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex gap-2 text-xs leading-5">
          <dt className="flex w-[4.5rem] shrink-0 items-center gap-1.5 font-bold text-[#8a8d89]">
            <Icon size={13} className="shrink-0" />{label}
          </dt>
          <dd className="min-w-0 flex-1 text-[#4f504f]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// 리스트 한 줄 = 코스에서 방문할 장소 하나. 누르면 그 장소가 선택된다.
//  - 왼쪽: 방문 순서 번호 + 마커와 같은 아이콘
//  - 가운데: 이름 / 설명 / 거리·도슨트 배지
//  - 오른쪽: 방문 완료 체크 또는 화살표
function PlaceListItem({ active, completed, distance, nearby, onClick, order, place }) {
  return (
    <li>
      <button
        type="button"
        aria-label={`${place.name} 선택`}  // 지도 마커와 같은 이름으로 찾을 수 있게
        aria-pressed={active}
        onClick={onClick}
        className={`relative flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
          active
            ? "border-[#343235] bg-[#fdfaf3] shadow-[0_8px_20px_rgba(52,50,53,0.13)]"
            : "border-[#ece7da] bg-white hover:bg-[#fdfaf3]"
        }`}
      >
        {/* 아이콘 + 방문 순서 번호 */}
        <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${completed ? "border-[#bfe0da] bg-[#e9f4f1]" : nearby ? "border-[#ecdcb6] bg-[#faf3e3]" : "border-[#e5e7e3] bg-[#f3f5f2]"}`}>
          <svg viewBox="-14 -14 28 28" className="h-7 w-7" aria-hidden="true"><LandmarkGlyph icon={place.icon} /></svg>
          <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#343235] text-[10px] font-bold text-white shadow-sm">{order}</span>
        </span>

        {/* 이름 / 설명 / 배지 */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-bold text-[#343235]">{place.name}</span>
            {completed && <span className="shrink-0 rounded-full bg-[#e4f1ed] px-2 py-0.5 text-[10px] font-bold text-[#24746f]">방문 완료</span>}
          </span>
          <span className="mt-0.5 block truncate text-xs leading-5 text-[#7c7d81]">{place.description}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${nearby ? "bg-[#f8f0de] text-[#8a641f]" : "bg-[#eef0ee] text-[#686d69]"}`}>
              <MapPin size={10} />{nearby ? "가까워요" : formatDistance(distance)}
            </span>
            {place.docent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#edf4f7] px-2 py-0.5 text-[10px] font-bold text-[#315d7f]">
                <Headphones size={10} />도슨트
              </span>
            )}
          </span>
        </span>

        {/* 오른쪽 상태 표시 */}
        {completed
          ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2d8c86] text-white"><Check size={14} /></span>
          : <ChevronRight size={17} className="shrink-0 text-[#b3b6b2]" />}
      </button>
    </li>
  );
}

// 지도 그림 대신 보여주는 코스 리스트. 지도에 찍힌 장소들을 방문 순서대로 나열한다.
function PlaceList({ completedQuestIds, currentLocation, onSelect, places, selectedPlace }) {
  const completedCount = places.filter((place) => completedQuestIds.includes(place.id)).length;

  return (
    <div className="min-h-[26rem] px-4 pb-14 pt-[7.75rem]">
      <div className="rounded-3xl border border-white/70 bg-white/85 p-3 shadow-[0_10px_26px_rgba(69,76,59,0.14)] backdrop-blur">
        {/* 리스트 머리말 + 방문 진행 상황 */}
        <div className="flex items-center justify-between gap-3 px-1.5 pb-2.5 pt-1">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.12em] text-[#a09a8c]">추천 방문 순서</p>
            <p className="truncate text-sm font-bold text-[#343235]">오늘의 코스 {places.length}곳</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#f2f4f1] px-2.5 py-1 text-[11px] font-bold text-[#626762]">{completedCount}/{places.length} 방문</span>
        </div>

        {/* 코스 순서를 잇는 점선 + 장소 줄들 */}
        <ol className="relative space-y-2">
          <span aria-hidden="true" className="absolute left-[1.9rem] top-8 bottom-8 border-l border-dashed border-[#d9d4c5]" />
          {places.map((place, index) => {
            const distance = getDistanceMeters(currentLocation, place);
            return (
              <PlaceListItem
                key={place.id}
                active={place.id === selectedPlace.id}
                completed={completedQuestIds.includes(place.id)}
                distance={distance}
                nearby={distance <= NEARBY_DISTANCE_METERS}
                onClick={() => onSelect(place)}
                order={index + 1}
                place={place}
              />
            );
          })}
        </ol>

        {places.length === 0 && (
          <p className="px-1.5 py-6 text-center text-xs text-[#7c7d81]">보여줄 장소가 아직 없어요.</p>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// 지도 화면 전체 컴포넌트 - 상태 관리 + 버튼 동작 + 화면 조립
// props: 완료한 퀘스트 목록, 완료/도슨트/선택 콜백, 현재 선택된 장소
// ===================================================================
export default function GyeongjuMap2D({ completedQuestIds, onComplete, onOpenRoles, onReroll, onSelect, places = QUESTS, roleName, selectedPlace }) {
  const { t } = useI18n();
  const currentRoleName = roleName || t("roles.king.name");

  // --- 화면 상태(state)들 ---
  const [viewId, setViewId] = useState("map");  // 보기 방식(지도 그림 / 코스 리스트)
  const [docentPlace, setDocentPlace] = useState(null);  // 도슨트를 듣고 있는 장소
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_CURRENT_LOCATION);  // 현재 위치
  const [locationMessage, setLocationMessage] = useState("");  // 위치 관련 안내문구
  const [route, setRoute] = useState(null);  // 길찾기 경로 결과
  const [routeLoading, setRouteLoading] = useState(false);  // 경로 불러오는 중 여부
  const [routeMessage, setRouteMessage] = useState("");  // 경로 관련 안내문구

  // --- 파생값(state로부터 계산) ---
  const bounds = MAP_SCOPES.all.bounds;  // 지도는 경주 관광권 전체 하나만 쓴다
  const selectedDistance = getDistanceMeters(currentLocation, selectedPlace);  // 선택 장소까지 거리
  const selectedNearby = selectedDistance <= NEARBY_DISTANCE_METERS;  // 가까운지
  const completed = completedQuestIds.includes(selectedPlace.id);  // 방문 완료했는지
  // 읽어 줄 설명(PLACE.TEXT)이 있는 장소만 도슨트를 들을 수 있다.
  const docentReady = Boolean(selectedPlace.docent && selectedPlace.placeId);
  // 지도 범위 안에 있는 장소들만 추림 (장소 목록이 바뀔 때만 다시 계산 → useMemo로 최적화)
  const visiblePlaces = useMemo(
    () => places.filter((place) => isWithinBounds(place, bounds)),
    [places, bounds],
  );

  // 장소 선택 시: 기존 경로 지우고 알림
  const selectPlace = (place) => {
    setRoute(null);
    setRouteMessage("");
    onSelect(place);
  };

  // "현재 위치 찾기" 버튼: 브라우저 GPS로 실제 위치를 받아 지도에 반영
  const findCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(t("map.unsupportedLocation"));
      return;
    }

    setLocationMessage(t("map.locating"));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { name: t("map.currentLocation"), latitude: coords.latitude, longitude: coords.longitude };
        // 경주 관광권 밖이면 데모 위치 유지
        if (!isWithinBounds(nextLocation, MAP_SCOPES.all.bounds)) {
          setLocationMessage(t("map.outside"));
          return;
        }
        setCurrentLocation(nextLocation);
        setLocationMessage(t("map.located"));
        setRoute(null);
      },
      () => setLocationMessage(t("map.permission")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // "TMAP 길찾기" 버튼: 현재위치→선택장소 도보 경로 요청 (TMAP 전용)
  //  키가 없으면 안내문구만, 실패하면 경로 없이 안내문구만 표시
  const previewRoute = async () => {
    // TMAP 키가 없으면 경로를 그리지 않고 안내만
    if (!TMAP_APP_KEY) {
      setRoute(null);
      setRouteMessage(t("map.routeKey"));
      return;
    }

    setRouteLoading(true);
    setRouteMessage("");

    try {
      const tmapRoute = await requestTmapPedestrianRoute({
        appKey: TMAP_APP_KEY,
        start: currentLocation,
        end: selectedPlace,
      });
      setRoute(tmapRoute);
      setRouteMessage(t("map.routeLoaded"));
    } catch {
      // 실패 시 경로 없이 안내만
      setRoute(null);
      setRouteMessage(t("map.routeFailed"));
    } finally {
      setRouteLoading(false);
    }
  };

  // "카카오맵 길찾기" 버튼: 선택한 장소로 가는 카카오맵 길찾기를 새 탭으로 연다.
  //  휴대폰이면 카카오맵 앱에서 현재 위치 → 선택 장소 경로가 바로 잡힌다.
  const openKakaoRoute = () => {
    const url = buildKakaoRouteUrl({
      start: currentLocation,
      end: selectedPlace,
      userAgent: navigator.userAgent,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    setRouteMessage(`카카오맵에서 ${selectedPlace.name}까지 길찾기를 열었어요.`);
  };

  // --- 화면(JSX) ---
  return (
    <section className="-mx-4 -mt-6 pb-2">
      {/* 지도 영역 (둥근 하단 카드) */}
      <div className="relative overflow-hidden rounded-b-[2rem] bg-[#dceab2] shadow-[0_12px_28px_rgba(69,76,59,0.14)]">
        {/* 상단: 앱 타이틀 배지 + 현재위치 버튼 */}
        <div className="absolute inset-x-4 top-3 z-10 flex items-center justify-between gap-3">
          <div className="rounded-full bg-[#343235]/90 px-3.5 py-2 text-white shadow-sm backdrop-blur">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-white/70">SILLA WALK</p>
            <p className="text-sm font-bold">{viewId === "map" ? t("map.title") : "오늘의 코스"}</p>
          </div>
          <IconButton className="border-white/70 bg-white/90 shadow-sm" icon={LocateFixed} label={t("map.findLocation")} onClick={findCurrentLocation} />
        </div>
        {/* 보기 전환 버튼 (지도 / 리스트) */}
        <div className="absolute inset-x-4 top-[4.25rem] z-10 grid grid-cols-2 rounded-full bg-white/80 p-1 shadow-sm backdrop-blur" aria-label="지도 보기 방식">
            {MAP_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={viewId === item.id}
                onClick={() => setViewId(item.id)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${viewId === item.id ? "bg-[#343235] text-white shadow-sm" : "text-[#626762]"}`}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
        </div>
        {/* 범례 (가까움/멀리/현재위치 색 설명) - 지도 보기에서만 */}
        {viewId === "map" && (
          <div className="absolute bottom-[3.25rem] left-4 z-10 flex flex-wrap items-center gap-3 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-[#626762] shadow-sm backdrop-blur">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#bd8c31]" />{t("map.within1km")}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7f8582]" />{t("map.beyond1km")}</span>
            <span className="inline-flex items-center gap-1"><Navigation size={13} className="text-[#356b98]" />{t("map.currentLocation")}</span>
          </div>
        )}
        {/* 실제 지도 그림 / 코스 리스트 */}
        {viewId === "map" ? (
          <QuestMapCanvas
            bounds={bounds}
            completedQuestIds={completedQuestIds}
            currentLocation={currentLocation}
            onSelect={selectPlace}
            route={route}
            selectedPlace={selectedPlace}
            visiblePlaces={visiblePlaces}
          />
        ) : (
          <PlaceList
            completedQuestIds={completedQuestIds}
            currentLocation={currentLocation}
            onSelect={selectPlace}
            places={visiblePlaces}
            selectedPlace={selectedPlace}
          />
        )}
      </div>

      {/* 지도 아래: 선택한 장소 상세 카드 */}
      <div className="relative z-20 -mt-7 space-y-3 px-4">
        {/* 지금 고른 역할 + 바꾸기 */}
        <button
          type="button"
          onClick={onOpenRoles}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#e7e0cf] bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(52,50,53,0.10)] transition-colors hover:bg-[#fdfaf3]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#faf1de] text-[#a67927]"><Crown size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold tracking-[0.12em] text-[#a09a8c]">{t("map.currentRole")}</span>
            <span className="block truncate font-bold text-[#343235]">{currentRoleName}</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#f2f4f1] px-2.5 py-1 text-[11px] font-bold text-[#626762]">{t("common.change")}</span>
          <ChevronRight size={16} className="shrink-0 text-[#a5a8a4]" />
        </button>

        {/* 저장된 코스를 버리고 새로 뽑는다 */}
        <AppButton className="w-full" icon={RefreshCw} variant="outline" onClick={onReroll}>
          {t("map.reroll")}
        </AppButton>

        <article className="rounded-2xl border border-[#e2e4e0] bg-white p-4 shadow-[0_12px_30px_rgba(52,50,53,0.12)]">
          {/* 장소 이름 + 거리/상태 뱃지 + 설명 */}
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${completed ? "bg-[#e4f1ed] text-[#24746f]" : selectedNearby ? "bg-[#f8f0de] text-[#a67927]" : "bg-[#eef0ee] text-[#747579]"}`}>{completed ? <Check size={19} /> : <MapPin size={19} />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[#343235]">{selectedPlace.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedNearby ? "bg-[#f8f0de] text-[#8a641f]" : "bg-[#eef0ee] text-[#686d69]"}`}>{selectedNearby ? t("map.near") : formatDistance(selectedDistance)}</span>
              </div>
            </div>
          </div>

          {/* 시간대·분류 대신 가서 실제로 쓰이는 정보만 보여 준다. 없는 줄은 그리지 않는다. */}
          <PlaceFacts place={selectedPlace} t={t} />

          {/* 경로가 있으면 도보 거리/예상 시간 표시 */}
          {route && (
            <div className="mt-4 grid grid-cols-2 divide-x divide-[#cbd9e3] rounded-xl bg-[#edf4f7] px-3 py-2.5 text-center">
              <div><p className="text-[10px] font-semibold text-[#6d7479]">{t("map.walkDistance")}</p><p className="mt-0.5 text-sm font-bold text-[#315d7f]">{formatDistance(route.distanceMeters)}</p></div>
              <div><p className="text-[10px] font-semibold text-[#6d7479]">{t("map.duration")}</p><p className="mt-0.5 text-sm font-bold text-[#315d7f]">{formatDuration(route.durationSeconds, t)}</p></div>
            </div>
          )}

          {/* 하단 액션 버튼들: 카카오맵 길찾기 / 퀘스트 완료 / 도슨트 듣기 */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <AppButton className="col-span-2" icon={Navigation} onClick={openKakaoRoute}>카카오맵으로 길찾기</AppButton>
            <AppButton icon={completed ? Check : MapPin} variant={completed ? "outline" : "secondary"} onClick={() => onComplete(selectedPlace.id)}>{completed ? t("map.visited") : t("map.complete")}</AppButton>
            <AppButton disabled={!docentReady} icon={Headphones} variant="outline" onClick={() => setDocentPlace(selectedPlace)}>{docentReady ? t("map.docent") : t("map.pending")}</AppButton>
          </div>

          {/* 앱을 벗어나지 않고 지도 위에 도보 경로만 그려 보는 보조 버튼 (지도 보기에서만) */}
          {viewId === "map" && (
            <button
              type="button"
              disabled={routeLoading}
              onClick={previewRoute}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[#626762] transition-colors hover:bg-[#f1f4f2] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="text-[#8a8d89]">{route ? <Route size={14} /> : <Footprints size={14} />}</span>
              {routeLoading ? "경로 불러오는 중" : route ? "지도 경로 다시 계산" : "지도에 도보 경로 표시"}
            </button>
          )}
        </article>

        {/* 안내문구 (위치/경로 메시지가 있을 때만) */}
        {(locationMessage || routeMessage) && (
          <p className="rounded-xl bg-[#eef3ef] px-3 py-2 text-xs leading-5 text-[#626762]" role="status">{routeMessage || locationMessage}</p>
        )}
      </div>

      {/* 도슨트 재생 시트 (장소 설명을 소리로 읽어 준다) */}
      {docentPlace && <DocentPlayer onClose={() => setDocentPlace(null)} place={docentPlace} />}
    </section>
  );
}
