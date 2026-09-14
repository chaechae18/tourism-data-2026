"use client"; // 이 컴포넌트는 브라우저에서 동작 (위치·클릭 등 사용)

import { useEffect, useMemo, useRef, useState } from "react";
// 버튼/마커에 쓰는 아이콘들 (lucide 아이콘 라이브러리)
import { CalendarDays, Car, Check, ChevronRight, Clock, Crown, Footprints, Headphones, List, LocateFixed, Map as MapIcon, MapPin, Maximize, Minus, Navigation, Plus, RefreshCw, Route, UtensilsCrossed } from "lucide-react";
// 지도 범례 문구, 장소(퀘스트) 데이터
import { QUESTS } from "../../lib/app-data";
// 지도 "계산 엔진"에서 가져오는 함수/데이터들 (lib/map/gyeongju-map.js)
import {
  clampMapView,
  coordinatesToPath,
  DEFAULT_CURRENT_LOCATION,
  DEFAULT_MAP_VIEW,
  formatDistance,
  getDistanceMeters,
  HYEONGSAN_RIVER,
  ILLUSTRATED_ROADS,
  isWithinBounds,
  MAP_SCOPES,
  MAP_VIEWBOX,
  MAP_ZOOM,
  projectCoordinate,
  scaleMapView,
} from "../../lib/map/gyeongju-map";
// 지도 위 경로 그리기는 TMAP, 실제 길찾기 이동은 카카오맵을 쓴다.
import { requestTmapPedestrianRoute } from "../../lib/tmap/pedestrian-route";
import { buildKakaoRouteUrl } from "../../lib/kakao/route-link";
// 공통 버튼 컴포넌트 / 도슨트 재생 시트
import AppButton, { IconButton } from "../ui/AppButton";
import DocentPlayer from "./DocentPlayer";
import { useI18n } from "../i18n/LanguageProvider";

// 1000(m) 이내면 "가까운 장소"로 표시
const NEARBY_DISTANCE_METERS = 1000;
// TMAP 앱 키 (환경변수) / 없으면 길찾기 대신 안내문구만 표시
const TMAP_APP_KEY = process.env.NEXT_PUBLIC_TMAP_APP_KEY || "";
// 지도 언덕 장식
const HILL_POSITIONS = [[45, 155], [329, 139], [349, 294], [42, 400], [288, 433]];
// 지도 나무 장식 
const TREE_POSITIONS = [[62, 184], [95, 162], [306, 185], [337, 359], [96, 430], [274, 147], [57, 346], [319, 423]];
// 지도 화면 위쪽 전환 탭 (지도 그림 / 방문 순서 리스트)
const MAP_VIEWS = [
  { id: "map", label: "지도", icon: MapIcon },
  { id: "list", label: "리스트", icon: List },
];
// 특정 명소 이름표가 마커에 겹치지 않게 밀어주는 위치 보정값
const LANDMARK_LABEL_OFFSETS = {
  bunhwangsa: { x: 0, y: -31 },
  cheomseongdae: { x: -30, y: 32 },
  donggung: { x: 34, y: 30 },
  bulguksa: { x: -27, y: 32 },
  seokguram: { x: 27, y: -31 },
};

// 확대 버튼을 눌렀을 때 기준이 되는 지도 화면 한가운데
const MAP_CENTER = { x: MAP_VIEWBOX.width / 2, y: MAP_VIEWBOX.height / 2 };
// 손가락을 이 정도(지도 좌표 기준)보다 많이 움직이면 "끌었다"고 보고 마커 클릭을 취소한다
const DRAG_THRESHOLD = 3;

// 브라우저 화면 좌표(clientX/Y) → 지도 SVG 안쪽 좌표로 환산
function toMapPoint(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * MAP_VIEWBOX.width / rect.width,
    y: (clientY - rect.top) * MAP_VIEWBOX.height / rect.height,
  };
}

function getMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function getSpread(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 손가락(핀치·드래그)·마우스(휠·드래그)로 지도를 확대/이동시키는 상태와 이벤트 핸들러 묶음
function useMapZoom() {
  const [view, setView] = useState(DEFAULT_MAP_VIEW);
  const svgRef = useRef(null);
  const pointersRef = useRef(new Map());  // 지금 지도에 닿아 있는 손가락/마우스들
  const gestureRef = useRef(null);        // 동작을 시작한 순간의 기준값 (배율·기준점)
  const draggedRef = useRef(false);       // 끌었는지 여부 (끌었으면 마커가 선택되지 않게 막는다)

  // 손가락이 닿거나 떨어질 때마다, 남아 있는 손가락 기준으로 동작을 새로 시작한다.
  const restartGesture = (currentView) => {
    const points = [...pointersRef.current.values()];
    if (points.length === 0) {
      gestureRef.current = null;
      return;
    }
    gestureRef.current = points.length >= 2
      ? { view: currentView, anchor: getMidpoint(points[0], points[1]), spread: getSpread(points[0], points[1]) }
      : { view: currentView, anchor: points[0], spread: 0 };
  };

  const handlePointerDown = (event) => {
    if (!svgRef.current) return;
    pointersRef.current.set(event.pointerId, toMapPoint(svgRef.current, event.clientX, event.clientY));
    draggedRef.current = false;
    restartGesture(view);
  };

  const handlePointerMove = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || !svgRef.current || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, toMapPoint(svgRef.current, event.clientX, event.clientY));
    const points = [...pointersRef.current.values()];

    // 손가락 두 개 = 핀치 확대/축소 (벌린 비율만큼 배율을 키우고, 중점 이동만큼 같이 끌어 준다)
    if (points.length >= 2 && gesture.spread > 0) {
      const focus = getMidpoint(points[0], points[1]);
      const nextScale = gesture.view.scale * (getSpread(points[0], points[1]) / gesture.spread);
      draggedRef.current = true;
      setView(scaleMapView(gesture.view, nextScale, gesture.anchor, focus));
      return;
    }

    // 손가락 하나 / 마우스 드래그 = 지도 이동
    const deltaX = points[0].x - gesture.anchor.x;
    const deltaY = points[0].y - gesture.anchor.y;
    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) draggedRef.current = true;
    setView(clampMapView({ scale: gesture.view.scale, x: gesture.view.x + deltaX, y: gesture.view.y + deltaY }));
  };

  const handlePointerEnd = (event) => {
    if (!pointersRef.current.delete(event.pointerId)) return;
    restartGesture(view);
  };

  // 드래그로 지도를 옮긴 직후에는 손을 뗀 자리의 마커가 선택되지 않도록 클릭을 막는다.
  const handleClickCapture = (event) => {
    if (!draggedRef.current) return;
    draggedRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  // 마우스 휠 확대 (React onWheel은 스크롤을 막을 수 없어서 직접 등록한다)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const handleWheel = (event) => {
      event.preventDefault();
      const focus = toMapPoint(svg, event.clientX, event.clientY);
      setView((current) => scaleMapView(current, current.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), focus));
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  return {
    view,
    svgRef,
    // 화면 한가운데를 고정한 채 한 단계 확대/축소
    zoomBy: (factor) => setView((current) => scaleMapView(current, current.scale * factor, MAP_CENTER)),
    resetView: () => setView(DEFAULT_MAP_VIEW),
    mapHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onPointerLeave: handlePointerEnd,
      onClickCapture: handleClickCapture,
    },
  };
}

// 초 단위 시간을 "35분" / "1시간 20분" 형태로 변환
function formatDuration(durationSeconds, t) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return minutes >= 60
    ? t("map.hoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
    : t("map.minutes", { minutes });
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
function PlaceMarker({ active, completed, markerScale = 1, nearby, onClick, place, point }) {
  const { t } = useI18n();
  const markerColor = completed ? "#2d8c86" : nearby ? "#bd8c31" : "#7f8582";
  const labelOffset = LANDMARK_LABEL_OFFSETS[place.id] || { x: 0, y: 30 };
  return (
    <g
      aria-label={t("map.selectPlace", { name: place.name })}  // 접근성 라벨 (테스트도 이 이름으로 마커를 찾음)
      className="cursor-pointer outline-none"
      onClick={onClick}  // 마커 클릭 시 장소 선택
      onKeyDown={(event) => event.key === "Enter" && onClick()}  // 키보드 Enter로도 선택
      role="button"
      tabIndex="0"
      transform={`translate(${point.x} ${point.y})`}  // 계산된 화면 좌표로 이동
    >
      <g transform={`scale(${markerScale})`}>
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
    </g>
  );
}

// 지도 전체를 그리는 SVG. 배경→강→도로→장식→경로→마커→현재위치 순으로 겹쳐 그림
function IllustratedMap({ bounds, completedQuestIds, currentLocation, onSelect, route, selectedPlace, visiblePlaces }) {
  const { t } = useI18n();
  const { mapHandlers, resetView, svgRef, view, zoomBy } = useMapZoom();
  const currentPoint = projectCoordinate(currentLocation, bounds);  // 현재위치 화면 좌표
  const routePath = route ? coordinatesToPath(route.coordinates, bounds) : "";  // 경로 선
  const riverPath = coordinatesToPath(HYEONGSAN_RIVER, bounds);  // 형산강 선
  const markerScale = 1 / view.scale;  // 마커·이름표를 원래 크기로 되돌리는 보정값
  const zoomed = view.scale > MAP_ZOOM.min;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        className="h-auto w-full select-none"
        aria-label={t("map.illustrationLabel")}
        role="img"
        ref={svgRef}
        // 확대하기 전에는 지도 위에서도 한 손가락 세로 스크롤로 페이지를 넘길 수 있게 두고,
        // 확대한 뒤에는 지도 이동이 우선이므로 브라우저 기본 동작을 모두 막는다.
        style={{ touchAction: zoomed ? "none" : "pan-y" }}
        {...mapHandlers}
      >
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
        {/* 여기서부터 마커까지가 "확대·이동하는 지도 본체". 축척 막대와 나침반은 바깥에 두어 고정된다. */}
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
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

          {/* 길찾기 경로 선 (경로가 있을 때만). 선 굵기는 확대해도 그대로 보이도록 배율만큼 나눈다. */}
          {routePath && (
            <g>
              <path d={routePath} fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8 * markerScale} opacity="0.9" />
              <path className="map-route-line" d={routePath} fill="none" stroke="#356b98" strokeLinecap="round" strokeLinejoin="round" strokeWidth={4 * markerScale} />
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
                markerScale={markerScale}  // 확대해도 마커 크기는 그대로 (간격만 벌어진다)
                nearby={distance <= NEARBY_DISTANCE_METERS}  // 가까운지
                onClick={() => onSelect(place)}
                place={place}
                point={projectCoordinate(place, bounds)}  // 실제 좌표 → 화면 좌표
              />
            );
          })}

          {/* 현재 위치 표시 (범위 안에 있을 때만) - 파란 점 + 펄스 */}
          {isWithinBounds(currentLocation, bounds) && (
            <g transform={`translate(${currentPoint.x} ${currentPoint.y}) scale(${markerScale})`}>
              <circle className="map-location-pulse" fill="#356b98" opacity="0.16" r="16" />
              <circle fill="#356b98" r="6" stroke="#fff" strokeWidth="3" />
              <path d="M0 -17 L4 -10 L0 -12 L-4 -10 Z" fill="#356b98" />
            </g>
          )}
        </g>

        {/* 좌하단 1km 축척 막대 (확대한 만큼 막대도 길어진다) */}
        <g transform={`translate(26 ${MAP_VIEWBOX.height - 28})`}>
          <path d={`M0 0 H${getScaleBarWidth(bounds) * view.scale}`} stroke="#555b57" strokeWidth="2" />
          <path d="M0 -4 V4" stroke="#555b57" strokeWidth="2" />
          <path d={`M${getScaleBarWidth(bounds) * view.scale} -4 V4`} stroke="#555b57" strokeWidth="2" />
          <text x={getScaleBarWidth(bounds) * view.scale / 2} y="14" textAnchor="middle" className="fill-[#555b57] text-[8px] font-bold">1km</text>
        </g>
        {/* 우하단 나침반(N) 표시 */}
        <g transform={`translate(356 ${MAP_VIEWBOX.height - 30})`} aria-hidden="true">
          <circle r="18" fill="#fffaf0" opacity="0.9" />
          <path d="M0 -11 L4 1 L0 -1 L-4 1 Z" fill="#bd4f3a" />
          <path d="M0 11 L4 -1 L0 1 L-4 -1 Z" fill="#5d665c" />
          <text y="-7" textAnchor="middle" className="fill-[#4f504f] text-[7px] font-bold">N</text>
        </g>
      </svg>

      {/* 확대/축소 버튼 (마우스·손가락 조작이 어려운 경우와 PC용) */}
      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5">
        <IconButton
          className="h-9 w-9 border-white/70 bg-white/90 shadow-sm backdrop-blur"
          disabled={view.scale >= MAP_ZOOM.max}
          icon={Plus}
          label={t("map.zoomIn")}
          onClick={() => zoomBy(MAP_ZOOM.step)}
        />
        <IconButton
          className="h-9 w-9 border-white/70 bg-white/90 shadow-sm backdrop-blur"
          disabled={!zoomed}
          icon={Minus}
          label={t("map.zoomOut")}
          onClick={() => zoomBy(1 / MAP_ZOOM.step)}
        />
        {zoomed && (
          <IconButton
            className="h-9 w-9 border-white/70 bg-white/90 shadow-sm backdrop-blur"
            icon={Maximize}
            label={t("map.zoomReset")}
            onClick={resetView}
          />
        )}
    </div>
    </div>
  );
}

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
          <IllustratedMap
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
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${completed ? "bg-[#e4f1ed] text-[#24746f]" : selectedNearby ? "bg-brand-soft text-brand-ink" : "bg-[#eef0ee] text-[#747579]"}`}>{completed ? <Check size={19} /> : <MapPin size={19} />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[#343235]">{selectedPlace.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedNearby ? "bg-brand-soft text-[#8a641f]" : "bg-[#eef0ee] text-[#686d69]"}`}>{selectedNearby ? t("map.near") : formatDistance(selectedDistance)}</span>
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
            <AppButton className="!border-0" icon={completed ? Check : MapPin} variant={completed ? "outline" : "secondary"} onClick={() => onComplete(selectedPlace.id)}>{completed ? t("map.visited") : t("map.complete")}</AppButton>
            <AppButton className="!border-0" disabled={!docentReady} icon={Headphones} variant="outline" onClick={() => setDocentPlace(selectedPlace)}>{docentReady ? t("map.docent") : t("map.pending")}</AppButton>
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

      {/* 도슨트 재생 시트 (장소 설명을 소리로 읽어 준다) */}
      {docentPlace && <DocentPlayer onClose={() => setDocentPlace(null)} place={docentPlace} />}
    </section>
  );
}
