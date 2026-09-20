"use client"; // 이 컴포넌트는 브라우저에서 동작 (위치·클릭 등 사용)

import { useId, useMemo, useState } from "react";
// 버튼/마커에 쓰는 아이콘들 (lucide 아이콘 라이브러리)
import { CalendarDays, Car, Check, ChevronRight, Clock, Crown, Footprints, Headphones, List, LocateFixed, Map as MapIcon, MapPin, Navigation, RefreshCw, Route, UtensilsCrossed } from "lucide-react";
// 지도 범례 문구, 장소(퀘스트) 데이터
import { QUESTS } from "../../lib/app-data";
import { getQuestAsset } from "../../lib/map/quest-assets";
// 지도 "계산 엔진"에서 가져오는 함수/데이터들 (lib/map/gyeongju-map.js)
import {
  DEFAULT_CURRENT_LOCATION,
  formatDistance,
  getCourseBounds,
  getDistanceMeters,
  isWithinBounds,
} from "../../lib/map/gyeongju-map";
// 지도 위 경로 그리기는 TMAP, 실제 길찾기 이동은 카카오맵을 쓴다.
import { requestTmapPedestrianRoute } from "../../lib/tmap/pedestrian-route";
import { buildKakaoRouteUrl } from "../../lib/kakao/route-link";
// 공통 버튼 컴포넌트 / 도슨트 재생 시트
import AppButton, { IconButton } from "../ui/AppButton";
import QuestResultModal from "./QuestResultModal";
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
            : "border-[#ece7da] bg-white"
        }`}
      >
        {/* 아이콘 + 방문 순서 번호 */}
        <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${completed ? "border-[#bfe0da] bg-[#e9f4f1]" : nearby ? "border-brand-border bg-brand-soft" : "border-[#e5e7e3] bg-[#f3f5f2]"}`}>
          <img src={getQuestAsset(place.icon)} width="28" height="28" className="h-7 w-7 object-contain" alt="" />
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
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${nearby ? "bg-brand-soft text-[#8a641f]" : "bg-[#eef0ee] text-[#686d69]"}`}>
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
export default function GyeongjuMap2D({ completedQuestIds, onComplete, onOpenRoles, onSelect, places = QUESTS, roleName, selectedPlace }) {
  const { t } = useI18n();
  const currentRoleName = roleName || t("roles.king.name");

  // --- 화면 상태(state)들 ---
  const [completing, setCompleting] = useState(false);
  const demoHelpId = useId();
  const [demoHelpOpen, setDemoHelpOpen] = useState(false);
  const [questResult, setQuestResult] = useState(null);
  const [viewId, setViewId] = useState("map");  // 보기 방식(지도 그림 / 코스 리스트)
  const [docentPlace, setDocentPlace] = useState(null);  // 도슨트를 듣고 있는 장소
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_CURRENT_LOCATION);  // 현재 위치
  const [locationMessage, setLocationMessage] = useState("");  // 위치 관련 안내문구
  const [route, setRoute] = useState(null);  // 길찾기 경로 결과
  const [routeLoading, setRouteLoading] = useState(false);  // 경로 불러오는 중 여부
  const [routeMessage, setRouteMessage] = useState("");  // 경로 관련 안내문구

  // --- 파생값(state로부터 계산) ---
  const bounds = useMemo(() => getCourseBounds(places), [places]);
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

  const completeAtCurrentLocation = async () => {
    if (completed || completing) return;
    const showLocationHelp = (message) => setQuestResult({ type: "location", name: selectedPlace.name, message });
    if (!navigator.geolocation) {
      showLocationHelp("현재 위치를 사용할 수 없어 퀘스트를 완료할 수 없어요.");
      return;
    }
    setCompleting(true);
    setQuestResult(null);
    try {
      const { coords } = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        }),
      );
      const position = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
      if (!Object.values(position).every(Number.isFinite) || coords.accuracy < 0 || coords.accuracy > 100) {
        showLocationHelp("위치가 부정확해요. 탁 트인 곳에서 다시 시도해 주세요.");
        return;
      }
      const distance = getDistanceMeters(position, selectedPlace, false);
      if (!Number.isFinite(distance) || distance > 100) {
        setQuestResult({ type: "nearby", name: selectedPlace.name });
        return;
      }
      const saved = await onComplete(selectedPlace.id, position);
      if (saved !== false) setQuestResult({ type: "success", name: selectedPlace.name, reward: saved?.reward });
    } catch (error) {
      if (error.code === "QUEST_LOCATION_INVALID") {
        setQuestResult({ type: "nearby", name: selectedPlace.name });
        return;
      }
      showLocationHelp(error.code === 1
        ? "퀘스트를 완료하려면 위치 권한을 허용해 주세요."
        : error.message || "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setCompleting(false);
    }
  };

  const completeForDemo = async () => {
    if (completed || completing) return;
    const place = selectedPlace;
    setCompleting(true);
    setQuestResult(null);
    try {
      const saved = await onComplete(place.id, { demoCompletion: true });
      if (saved !== false) setQuestResult({ type: "success", name: place.name, demo: true, reward: saved?.reward });
    } catch (error) {
      setQuestResult({ type: "location", name: place.name, message: error.message || "체험 완료를 저장하지 못했어요. 다시 시도해 주세요." });
    } finally {
      setCompleting(false);
    }
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
    <section className="-mx-4 pb-2">
      {/* 지도 영역 (둥근 하단 카드) */}
      <div className="relative overflow-hidden rounded-b-[2rem] bg-[#dceab2] shadow-[0_12px_28px_rgba(69,76,59,0.14)]">
        {/* 현재위치 버튼 */}
        <div className="absolute inset-x-4 top-[4.25rem] z-10 flex justify-end">
          <IconButton className="border-white/70 bg-white/90 shadow-sm" icon={LocateFixed} label={t("map.findLocation")} onClick={findCurrentLocation} />
        </div>
        {/* 보기 전환 버튼 (지도 / 리스트) */}
        <div className="absolute inset-x-4 top-3 z-10 grid grid-cols-2 rounded-full bg-white/80 p-1 shadow-sm backdrop-blur" aria-label="지도 보기 방식">
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
          className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(52,50,53,0.10)] transition-colors"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink"><Crown size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[#343235]">{t("map.followingRole", { name: currentRoleName })}</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#f2f4f1] px-2.5 py-1 text-[11px] font-bold text-[#626762]">{t("common.change")}</span>
        </button>

        <article className="rounded-2xl bg-white p-4 shadow-[0_12px_30px_rgba(52,50,53,0.12)]">
          {/* 장소 이름 + 거리/상태 뱃지 + 설명 */}
          <div className="flex items-center gap-2">
            <span className="relative h-7 w-7 shrink-0">
              <img src={getQuestAsset(selectedPlace.icon)} width="28" height="28" className="h-7 w-7 object-contain" alt="" />
              {completed && <span className="absolute -bottom-1 -right-1 rounded-full bg-[#e4f1ed] p-0.5 text-[#24746f]" aria-label={t("map.visited")}><Check size={10} /></span>}
            </span>
            <h2 className="min-w-0 break-keep font-bold text-[#343235]">{selectedPlace.name}</h2>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedNearby ? "bg-brand-soft text-[#8a641f]" : "bg-[#eef0ee] text-[#686d69]"}`}>{selectedNearby ? t("map.near") : formatDistance(selectedDistance)}</span>
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
            <AppButton className="!border-0" icon={completed ? Check : MapPin} variant={completed ? "outline" : "secondary"} disabled={completed || completing} onClick={completeAtCurrentLocation}>{completed ? t("map.visited") : completing ? "위치 확인 중…" : t("map.complete")}</AppButton>
            <AppButton className="!border-0" disabled={!docentReady} icon={Headphones} variant="outline" onClick={() => setDocentPlace(selectedPlace)}>{docentReady ? t("map.docent") : t("map.pending")}</AppButton>
          </div>

          <div className="relative mt-3 rounded-xl border border-dashed border-[#d6c9ab] bg-[#faf7ef] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#826b39]">심사·시연용 예비 버튼</span>
              <button type="button" aria-label="예비 버튼을 만든 이유" aria-expanded={demoHelpOpen}
                aria-controls={demoHelpId} onClick={() => setDemoHelpOpen((open) => !open)}
                className="text-xs text-[#826b39] underline underline-offset-2">왜 필요한가요?</button>
            </div>
            <div className="group">
              <AppButton variant="outline" size="sm" className="w-full" disabled={completed || completing}
                aria-describedby={demoHelpId} onClick={completeForDemo}>
                {completed ? "방문 완료" : "예비용 · 방문 완료 체험"}
              </AppButton>
              <p id={demoHelpId} role="tooltip" className={`${demoHelpOpen ? "block" : "hidden group-hover:block group-focus-within:block"} mt-2 text-xs leading-5 text-[#776b54]`}>
                실제 방문 완료는 장소 100m 이내에서만 가능해요. 현장 방문이 어려운 심사위원도 기능을 확인할 수 있도록 마련한 예비 버튼이에요. 위치 확인 없이 현재 코스에 완료 상태가 저장됩니다.
              </p>
            </div>
          </div>

          {/* 앱을 벗어나지 않고 지도 위에 도보 경로만 그려 보는 보조 버튼 (지도 보기에서만) */}
          {viewId === "map" && (
            <button
              type="button"
              disabled={routeLoading}
              onClick={previewRoute}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[#626762] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
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

      {questResult && <QuestResultModal result={questResult} onClose={() => setQuestResult(null)} />}

      {/* 도슨트 재생 시트 (장소 설명을 소리로 읽어 준다) */}
      {docentPlace && <DocentPlayer onClose={() => setDocentPlace(null)} place={docentPlace} />}
    </section>
  );
}
