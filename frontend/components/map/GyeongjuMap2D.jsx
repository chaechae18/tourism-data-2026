"use client"; // 이 컴포넌트는 브라우저에서 동작 (위치·클릭 등 사용)

import { useMemo, useState } from "react";
// 버튼/마커에 쓰는 아이콘들 (lucide 아이콘 라이브러리)
import { Check, Footprints, Headphones, LocateFixed, MapPin, Navigation, Route } from "lucide-react";
// 지도 범례 문구, 장소(퀘스트) 데이터
import { MAP_LEGEND, QUESTS } from "../../lib/app-data";
// 지도 "계산 엔진"에서 가져오는 함수/데이터들 (lib/map/gyeongju-map.js)
import {
  coordinatesToPath,
  DEFAULT_CURRENT_LOCATION,
  formatDistance,
  getDistanceMeters,
  HYEONGSAN_RIVER,
  ILLUSTRATED_ROADS,
  isWithinBounds,
  MAP_SCOPES,
  MAP_VIEWBOX,
  projectCoordinate,
} from "../../lib/map/gyeongju-map";
// TMAP 실제 도보 경로 요청 함수
import { requestTmapPedestrianRoute } from "../../lib/tmap/pedestrian-route";
// 공통 버튼 컴포넌트
import AppButton, { IconButton } from "../ui/AppButton";

// 1000(m) 이내면 "가까운 장소"로 표시
const NEARBY_DISTANCE_METERS = 1000;
// TMAP 앱 키 (환경변수) / 없으면 길찾기 대신 안내문구만 표시
const TMAP_APP_KEY = process.env.NEXT_PUBLIC_TMAP_APP_KEY || "";
// 지도 언덕 장식
const HILL_POSITIONS = [[45, 155], [329, 139], [349, 294], [42, 400], [288, 433]];
// 지도 나무 장식 
const TREE_POSITIONS = [[62, 184], [95, 162], [306, 185], [337, 359], [96, 430], [274, 147], [57, 346], [319, 423]];
// 특정 명소 이름표가 마커에 겹치지 않게 밀어주는 위치 보정값
const LANDMARK_LABEL_OFFSETS = {
  bunhwangsa: { x: 0, y: -31 },
  cheomseongdae: { x: -30, y: 32 },
  donggung: { x: 34, y: 30 },
  bulguksa: { x: -27, y: 32 },
  seokguram: { x: 27, y: -31 },
};

// 초 단위 시간을 "35분" / "1시간 20분" 형태로 변환
function formatDuration(durationSeconds) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

// 지도 좌하단 "1km 축척 막대"의 픽셀 길이 계산
function getScaleBarWidth(bounds) {
  const latitude = (bounds.north + bounds.south) / 2;
  const longitude = (bounds.west + bounds.east) / 2;
  const oneKilometerLongitude = 1 / (111.32 * Math.cos(latitude * Math.PI / 180));
  const start = projectCoordinate({ latitude, longitude }, bounds);
  const end = projectCoordinate({ latitude, longitude: longitude + oneKilometerLongitude }, bounds);
  return Math.abs(end.x - start.x);
}

// 마커 안에 들어가는 아이콘 그림(SVG). 장소 종류(icon)에 따라 다른 모양 반환
// tower=첨성대풍 / palace=궁궐풍 / grotto=석굴풍 / 그 외=기본 건물
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
function PlaceMarker({ active, completed, nearby, onClick, place, point }) {
  const markerColor = completed ? "#2d8c86" : nearby ? "#bd8c31" : "#7f8582";
  const labelOffset = LANDMARK_LABEL_OFFSETS[place.id] || { x: 0, y: 30 };
  return (
    <g
      aria-label={`${place.name} 선택`}  // 접근성 라벨 (테스트도 이 이름으로 마커를 찾음)
      className="cursor-pointer outline-none"
      onClick={onClick}  // 마커 클릭 시 장소 선택
      onKeyDown={(event) => event.key === "Enter" && onClick()}  // 키보드 Enter로도 선택
      role="button"
      tabIndex="0"
      transform={`translate(${point.x} ${point.y})`}  // 계산된 화면 좌표로 이동
    >
      <ellipse cy="14" fill="#365e40" opacity="0.18" rx="15" ry="5" />  {/* 마커 그림자 */}
      {active && <circle className="map-marker-pulse" fill="none" r="24" stroke={markerColor} strokeWidth="2" />}  {/* 선택 시 퍼지는 원 */}
      <circle fill="#fffaf0" filter="url(#landmark-shadow)" r="18" stroke={markerColor} strokeWidth={active ? "3" : "2"} />  {/* 마커 원 */}
      <LandmarkGlyph icon={place.icon} />  {/* 가운데 아이콘 */}
      {completed && <circle cx="12" cy="-12" fill="#2d8c86" r="6" stroke="#fff" strokeWidth="2" />}  {/* 완료 배지 */}
      <g transform={`translate(${labelOffset.x} ${labelOffset.y})`}>  {/* 이름표 */}
        <rect
          x="-34"
          y="-10"
          width="68"
          height="20"
          rx="10"
          fill={active ? "#343235" : "#fffaf0"}
          stroke={active ? "#343235" : "#d7d2c5"}
        />
        <text dominantBaseline="middle" textAnchor="middle" className={`text-[9px] font-bold ${active ? "fill-white" : "fill-[#4f504f]"}`}>{place.name}</text>
      </g>
    </g>
  );
}

// 지도 전체를 그리는 SVG. 배경→강→도로→장식→경로→마커→현재위치 순으로 겹쳐 그림
function IllustratedMap({ bounds, completedQuestIds, currentLocation, onSelect, route, selectedPlace, visiblePlaces }) {
  const currentPoint = projectCoordinate(currentLocation, bounds);  // 현재위치 화면 좌표
  const routePath = route ? coordinatesToPath(route.coordinates, bounds) : "";  // 경로 선
  const riverPath = coordinatesToPath(HYEONGSAN_RIVER, bounds);  // 형산강 선

  return (
    <svg viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} className="h-auto w-full" aria-label="실제 위치 비율을 반영한 경주 일러스트 지도" role="img">
      {/* 그라데이션·종이질감·그림자 등 그림 효과 정의 */}
      <defs>
        <linearGradient id="gyeongju-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7edc1" />
          <stop offset="0.55" stopColor="#dce7ad" />
          <stop offset="1" stopColor="#ccd99d" />
        </linearGradient>
        <linearGradient id="gyeongju-forest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#91ad6c" />
          <stop offset="1" stopColor="#78975f" />
        </linearGradient>
        <filter id="paper-grain" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence baseFrequency="0.7" numOctaves="2" seed="8" type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .045 0" />
        </filter>
        <filter id="landmark-shadow" x="-50%" y="-50%" width="200%" height="220%">
          <feDropShadow dx="0" dy="2" floodColor="#3f4b3c" floodOpacity="0.22" stdDeviation="2" />
        </filter>
      </defs>
      {/* 바닥 배경색 */}
      <rect width={MAP_VIEWBOX.width} height={MAP_VIEWBOX.height} fill="url(#gyeongju-ground)" />
      {/* 숲/등고선/종이질감 배경 장식 */}
      <g>
        <path d="M0 115 Q42 84 86 105 T168 92 L182 0 H0 Z" fill="url(#gyeongju-forest)" opacity="0.72" />
        <path d="M286 0 L390 0 V212 Q356 185 334 203 T290 170 Z" fill="url(#gyeongju-forest)" opacity="0.78" />
        <path d="M0 360 Q52 327 105 363 T178 410 L160 500 H0 Z" fill="url(#gyeongju-forest)" opacity="0.62" />
        <path d="M270 394 Q330 356 390 382 V500 H246 Q276 454 270 394 Z" fill="url(#gyeongju-forest)" opacity="0.72" />
        <g fill="none" stroke="#7e9867" strokeWidth="1" opacity="0.42">
          <path d="M8 131 Q54 101 99 124 T181 109" />
          <path d="M-4 145 Q51 117 100 140 T182 124" />
          <path d="M284 37 Q337 16 392 42" />
          <path d="M280 54 Q337 32 395 61" />
          <path d="M-2 390 Q58 354 122 391 T190 433" />
          <path d="M260 425 Q324 384 395 411" />
        </g>
        <rect width={MAP_VIEWBOX.width} height={MAP_VIEWBOX.height} fill="#69775d" filter="url(#paper-grain)" opacity="0.32" />
        {/* 형산강 (파란 선) */}
        <path d={riverPath} fill="none" stroke="#a9dbe2" strokeLinecap="round" strokeWidth="20" />
        <path d={riverPath} fill="none" stroke="#d9f1f1" strokeDasharray="2 8" strokeLinecap="round" strokeWidth="2" opacity="0.82" />
        {/* 일러스트 도로들 */}
        {ILLUSTRATED_ROADS.map((road) => (
          <g key={road.map((point) => `${point.latitude}-${point.longitude}`).join("_")}>
            <path d={coordinatesToPath(road, bounds)} fill="none" stroke="#a4a78f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10" opacity="0.36" />
            <path d={coordinatesToPath(road, bounds)} fill="none" stroke="#fffaf0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
          </g>
        ))}
        {/* 언덕 장식 */}
        {HILL_POSITIONS.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} opacity="0.72">
            <path d="M-22 12 L-9 -8 L0 3 L9 -13 L24 12 Z" fill="#9fbd78" />
            <path d="M-9 12 L1 -2 L13 12 Z" fill="#83a467" />
          </g>
        ))}
        {/* 나무 장식 */}
        {TREE_POSITIONS.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} opacity="0.82">
            <path d="M0 8 V18" stroke="#765f46" strokeWidth="3" />
            <circle cy="2" fill="#6f9a58" r="9" />
            <circle cx="-7" cy="7" fill="#7faa61" r="6" />
            <circle cx="7" cy="7" fill="#5f8b50" r="6" />
          </g>
        ))}
      </g>

      {/* 길찾기 경로 선 (경로가 있을 때만) */}
      {routePath && (
        <g>
          <path d={routePath} fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" opacity="0.9" />
          <path className="map-route-line" d={routePath} fill="none" stroke="#356b98" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        </g>
      )}

      {/* 현재 지도 범위에 들어오는 장소들을 마커로 그림 */}
      {visiblePlaces.map((place) => {
        const distance = getDistanceMeters(currentLocation, place);  // 현재위치와의 거리
        return (
          <PlaceMarker
            key={place.id}
            active={place.id === selectedPlace.id}  // 선택된 장소인지
            completed={completedQuestIds.includes(place.id)}  // 방문 완료했는지
            nearby={distance <= NEARBY_DISTANCE_METERS}  // 가까운지
            onClick={() => onSelect(place)}
            place={place}
            point={projectCoordinate(place, bounds)}  // 실제 좌표 → 화면 좌표
          />
        );
      })}

      {/* 현재 위치 표시 (범위 안에 있을 때만) - 파란 점 + 펄스 */}
      {isWithinBounds(currentLocation, bounds) && (
        <g transform={`translate(${currentPoint.x} ${currentPoint.y})`}>
          <circle className="map-location-pulse" fill="#356b98" opacity="0.16" r="16" />
          <circle fill="#356b98" r="6" stroke="#fff" strokeWidth="3" />
          <path d="M0 -17 L4 -10 L0 -12 L-4 -10 Z" fill="#356b98" />
        </g>
      )}

      {/* 좌하단 1km 축척 막대 */}
      <g transform={`translate(26 ${MAP_VIEWBOX.height - 28})`}>
        <path d={`M0 0 H${getScaleBarWidth(bounds)}`} stroke="#555b57" strokeWidth="2" />
        <path d="M0 -4 V4" stroke="#555b57" strokeWidth="2" />
        <path d={`M${getScaleBarWidth(bounds)} -4 V4`} stroke="#555b57" strokeWidth="2" />
        <text x={getScaleBarWidth(bounds) / 2} y="14" textAnchor="middle" className="fill-[#555b57] text-[8px] font-bold">1km</text>
      </g>
      {/* 우하단 나침반(N) 표시 */}
      <g transform={`translate(356 ${MAP_VIEWBOX.height - 30})`} aria-hidden="true">
        <circle r="18" fill="#fffaf0" opacity="0.9" />
        <path d="M0 -11 L4 1 L0 -1 L-4 1 Z" fill="#bd4f3a" />
        <path d="M0 11 L4 -1 L0 1 L-4 -1 Z" fill="#5d665c" />
        <text y="-7" textAnchor="middle" className="fill-[#4f504f] text-[7px] font-bold">N</text>
      </g>
    </svg>
  );
}

// ===================================================================
// 지도 화면 전체 컴포넌트 - 상태 관리 + 버튼 동작 + 화면 조립
// props: 완료한 퀘스트 목록, 완료/도슨트/선택 콜백, 현재 선택된 장소
// ===================================================================
export default function GyeongjuMap2D({ completedQuestIds, onComplete, onDocent, onSelect, selectedPlace }) {
  // 선택된 장소가 도심권 안이면 "도심권", 아니면 "전체 경주"로 시작
  const initialScope = isWithinBounds(selectedPlace, MAP_SCOPES.core.bounds) ? "core" : "all";

  // --- 화면 상태(state)들 ---
  const [scopeId, setScopeId] = useState(initialScope);  // 지도 범위(도심권/전체)
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_CURRENT_LOCATION);  // 현재 위치
  const [locationMessage, setLocationMessage] = useState("");  // 위치 관련 안내문구
  const [route, setRoute] = useState(null);  // 길찾기 경로 결과
  const [routeLoading, setRouteLoading] = useState(false);  // 경로 불러오는 중 여부
  const [routeMessage, setRouteMessage] = useState("");  // 경로 관련 안내문구

  // --- 파생값(state로부터 계산) ---
  const scope = MAP_SCOPES[scopeId];
  const selectedDistance = getDistanceMeters(currentLocation, selectedPlace);  // 선택 장소까지 거리
  const selectedNearby = selectedDistance <= NEARBY_DISTANCE_METERS;  // 가까운지
  const completed = completedQuestIds.includes(selectedPlace.id);  // 방문 완료했는지
  // 현재 범위 안에 있는 장소들만 추림 (범위 바뀔 때만 다시 계산 → useMemo로 최적화)
  const visiblePlaces = useMemo(
    () => QUESTS.filter((place) => isWithinBounds(place, scope.bounds)),
    [scope.bounds],
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
      setLocationMessage("현재 브라우저에서는 위치 기능을 사용할 수 없어요.");
      return;
    }

    setLocationMessage("현재 위치를 확인하고 있어요.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { name: "현재 위치", latitude: coords.latitude, longitude: coords.longitude };
        // 경주 관광권 밖이면 데모 위치 유지
        if (!isWithinBounds(nextLocation, MAP_SCOPES.all.bounds)) {
          setLocationMessage("경주 관광권 밖이에요. 데모 위치를 유지합니다.");
          return;
        }
        setCurrentLocation(nextLocation);
        setLocationMessage("현재 위치를 지도에 표시했어요.");
        setRoute(null);
      },
      () => setLocationMessage("위치 권한을 허용하면 가까운 장소를 확인할 수 있어요."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // "TMAP 길찾기" 버튼: 현재위치→선택장소 도보 경로 요청 (TMAP 전용)
  //  키가 없으면 안내문구만, 실패하면 경로 없이 안내문구만 표시
  const previewRoute = async () => {
    // TMAP 키가 없으면 경로를 그리지 않고 안내만
    if (!TMAP_APP_KEY) {
      setRoute(null);
      setRouteMessage("TMAP 키 연결이 필요해요.");
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
      setRouteMessage("TMAP 도보 경로를 불러왔어요.");
    } catch {
      // 실패 시 경로 없이 안내만
      setRoute(null);
      setRouteMessage("TMAP 연결에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setRouteLoading(false);
    }
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
            <p className="text-sm font-bold">경주 2D 지도</p>
          </div>
          <IconButton className="border-white/70 bg-white/90 shadow-sm" icon={LocateFixed} label="현재 위치 찾기" onClick={findCurrentLocation} />
        </div>
        {/* 지도 범위 전환 버튼 (도심권 / 전체 경주) */}
        <div className="absolute inset-x-4 top-[4.25rem] z-10 grid grid-cols-2 rounded-full bg-white/80 p-1 shadow-sm backdrop-blur" aria-label="지도 범위">
            {Object.values(MAP_SCOPES).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={scopeId === item.id}
                onClick={() => setScopeId(item.id)}
                className={`h-9 rounded-full text-xs font-semibold transition-colors ${scopeId === item.id ? "bg-[#343235] text-white shadow-sm" : "text-[#626762]"}`}
              >
                {item.label}
              </button>
            ))}
        </div>
        {/* 범례 (가까움/멀리/현재위치 색 설명) */}
        <div className="absolute bottom-[3.25rem] left-4 z-10 flex flex-wrap items-center gap-3 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-[#626762] shadow-sm backdrop-blur">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#bd8c31]" />{MAP_LEGEND.nearby}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7f8582]" />{MAP_LEGEND.distant}</span>
          <span className="inline-flex items-center gap-1"><Navigation size={13} className="text-[#356b98]" />{MAP_LEGEND.current}</span>
        </div>
        {/* 실제 지도 그림 */}
        <IllustratedMap
          bounds={scope.bounds}
          completedQuestIds={completedQuestIds}
          currentLocation={currentLocation}
          onSelect={selectPlace}
          route={route}
          selectedPlace={selectedPlace}
          visiblePlaces={visiblePlaces}
        />
      </div>

      {/* 지도 아래: 선택한 장소 상세 카드 */}
      <div className="relative z-20 -mt-7 space-y-3 px-4">
        <article className="rounded-2xl border border-[#e2e4e0] bg-white p-4 shadow-[0_12px_30px_rgba(52,50,53,0.12)]">
          {/* 장소 이름 + 거리/상태 뱃지 + 설명 */}
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${completed ? "bg-[#e4f1ed] text-[#24746f]" : selectedNearby ? "bg-[#f8f0de] text-[#a67927]" : "bg-[#eef0ee] text-[#747579]"}`}>{completed ? <Check size={19} /> : <MapPin size={19} />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[#343235]">{selectedPlace.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedNearby ? "bg-[#f8f0de] text-[#8a641f]" : "bg-[#eef0ee] text-[#686d69]"}`}>{selectedNearby ? "가까워요" : formatDistance(selectedDistance)}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-[#626367]">{selectedPlace.description}</p>
            </div>
          </div>

          {/* 경로가 있으면 도보 거리/예상 시간 표시 */}
          {route && (
            <div className="mt-4 grid grid-cols-2 divide-x divide-[#cbd9e3] rounded-xl bg-[#edf4f7] px-3 py-2.5 text-center">
              <div><p className="text-[10px] font-semibold text-[#6d7479]">도보 거리</p><p className="mt-0.5 text-sm font-bold text-[#315d7f]">{formatDistance(route.distanceMeters)}</p></div>
              <div><p className="text-[10px] font-semibold text-[#6d7479]">예상 시간</p><p className="mt-0.5 text-sm font-bold text-[#315d7f]">{formatDuration(route.durationSeconds)}</p></div>
            </div>
          )}

          {/* 하단 액션 버튼들: 길찾기 / 퀘스트 완료 / 도슨트 듣기 */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <AppButton className="col-span-2" disabled={routeLoading} icon={route ? Route : Footprints} onClick={previewRoute}>{routeLoading ? "경로 불러오는 중" : route ? "TMAP 경로 다시 보기" : "TMAP 길찾기"}</AppButton>
            <AppButton icon={completed ? Check : MapPin} variant={completed ? "outline" : "secondary"} onClick={() => onComplete(selectedPlace.id)}>{completed ? "방문 완료" : "퀘스트 완료"}</AppButton>
            <AppButton disabled={!selectedPlace.docent} icon={Headphones} variant="outline" onClick={() => onDocent(selectedPlace)}>{selectedPlace.docent ? "도슨트 듣기" : "준비 중"}</AppButton>
          </div>
        </article>

        {/* 안내문구 (위치/경로 메시지가 있을 때만) */}
        {(locationMessage || routeMessage) && (
          <p className="rounded-xl bg-[#eef3ef] px-3 py-2 text-xs leading-5 text-[#626762]" role="status">{routeMessage || locationMessage}</p>
        )}
      </div>
    </section>
  );
}
