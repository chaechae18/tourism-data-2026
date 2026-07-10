"use client";

import { useMemo, useState } from "react";
import { Check, Footprints, Headphones, LocateFixed, MapPin, Navigation, Route } from "lucide-react";
import { MAP_LEGEND, QUESTS } from "../../lib/app-data";
import {
  coordinatesToPath,
  createDemoRoute,
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
import { requestTmapPedestrianRoute } from "../../lib/tmap/pedestrian-route";
import AppButton, { IconButton } from "../ui/AppButton";

const NEARBY_DISTANCE_METERS = 1000;
const WALKING_METERS_PER_SECOND = 1.2;
const TMAP_APP_KEY = process.env.NEXT_PUBLIC_TMAP_APP_KEY || "";
const HILL_POSITIONS = [[62, 74], [305, 82], [330, 238], [91, 330], [265, 369]];
const TREE_POSITIONS = [[78, 119], [111, 99], [289, 132], [319, 297], [126, 370], [243, 94]];

function formatDuration(durationSeconds) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

function getScaleBarWidth(bounds) {
  const latitude = (bounds.north + bounds.south) / 2;
  const longitude = (bounds.west + bounds.east) / 2;
  const oneKilometerLongitude = 1 / (111.32 * Math.cos(latitude * Math.PI / 180));
  const start = projectCoordinate({ latitude, longitude }, bounds);
  const end = projectCoordinate({ latitude, longitude: longitude + oneKilometerLongitude }, bounds);
  return Math.abs(end.x - start.x);
}

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

function PlaceMarker({ active, completed, nearby, onClick, place, point, showLabel }) {
  const markerColor = completed ? "#2d8c86" : nearby ? "#bd8c31" : "#7f8582";
  return (
    <g
      aria-label={`${place.name} 선택`}
      className="cursor-pointer outline-none"
      onClick={onClick}
      onKeyDown={(event) => event.key === "Enter" && onClick()}
      role="button"
      tabIndex="0"
      transform={`translate(${point.x} ${point.y})`}
    >
      {active && <circle fill="none" r="23" stroke={markerColor} strokeDasharray="3 3" strokeWidth="2" />}
      <circle fill="#fffdf7" r="17" stroke={markerColor} strokeWidth={active ? "3" : "2"} />
      <LandmarkGlyph icon={place.icon} />
      {completed && <circle cx="12" cy="-12" fill="#2d8c86" r="6" stroke="#fff" strokeWidth="2" />}
      {showLabel && (
        <g transform="translate(0 29)">
          <rect x="-38" y="-10" width="76" height="20" rx="8" fill="#fffdf7" stroke="#d6ddd5" />
          <text dominantBaseline="middle" textAnchor="middle" className="fill-[#4f504f] text-[9px] font-bold">{place.name}</text>
        </g>
      )}
    </g>
  );
}

function IllustratedMap({ bounds, completedQuestIds, currentLocation, onSelect, route, selectedPlace, visiblePlaces }) {
  const currentPoint = projectCoordinate(currentLocation, bounds);
  const routePath = route ? coordinatesToPath(route.coordinates, bounds) : "";
  const riverPath = coordinatesToPath(HYEONGSAN_RIVER, bounds);

  return (
    <svg viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} className="h-auto w-full" aria-label="실제 위치 비율을 반영한 경주 일러스트 지도" role="img">
      <defs>
        <filter id="paper-grain" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence baseFrequency="0.7" numOctaves="2" seed="8" type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .045 0" />
        </filter>
      </defs>
      <rect width="390" height="430" fill="#dceab2" />
      <g>
        <rect width="390" height="430" fill="#69775d" filter="url(#paper-grain)" opacity="0.38" />
        <path d={riverPath} fill="none" stroke="#a9dbe2" strokeLinecap="round" strokeWidth="20" />
        {ILLUSTRATED_ROADS.map((road) => (
          <path key={road.map((point) => `${point.latitude}-${point.longitude}`).join("_")} d={coordinatesToPath(road, bounds)} fill="none" stroke="#fffdf7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
        ))}
        {HILL_POSITIONS.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} opacity="0.72">
            <path d="M-22 12 L-9 -8 L0 3 L9 -13 L24 12 Z" fill="#9fbd78" />
            <path d="M-9 12 L1 -2 L13 12 Z" fill="#83a467" />
          </g>
        ))}
        {TREE_POSITIONS.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} opacity="0.82">
            <path d="M0 8 V18" stroke="#765f46" strokeWidth="3" />
            <circle cy="2" fill="#6f9a58" r="9" />
            <circle cx="-7" cy="7" fill="#7faa61" r="6" />
            <circle cx="7" cy="7" fill="#5f8b50" r="6" />
          </g>
        ))}
      </g>

      {routePath && (
        <g>
          <path d={routePath} fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" opacity="0.9" />
          <path d={routePath} fill="none" stroke="#356b98" strokeDasharray={route.source === "demo" ? "7 6" : undefined} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        </g>
      )}

      {visiblePlaces.map((place) => {
        const distance = getDistanceMeters(currentLocation, place);
        return (
          <PlaceMarker
            key={place.id}
            active={place.id === selectedPlace.id}
            completed={completedQuestIds.includes(place.id)}
            nearby={distance <= NEARBY_DISTANCE_METERS}
            onClick={() => onSelect(place)}
            place={place}
            point={projectCoordinate(place, bounds)}
            showLabel={place.id === selectedPlace.id}
          />
        );
      })}

      {isWithinBounds(currentLocation, bounds) && (
        <g transform={`translate(${currentPoint.x} ${currentPoint.y})`}>
          <circle fill="#356b98" opacity="0.16" r="15" />
          <circle fill="#356b98" r="6" stroke="#fff" strokeWidth="3" />
          <path d="M0 -17 L4 -10 L0 -12 L-4 -10 Z" fill="#356b98" />
        </g>
      )}

      <g transform="translate(26 397)">
        <path d={`M0 0 H${getScaleBarWidth(bounds)}`} stroke="#555b57" strokeWidth="2" />
        <path d="M0 -4 V4" stroke="#555b57" strokeWidth="2" />
        <path d={`M${getScaleBarWidth(bounds)} -4 V4`} stroke="#555b57" strokeWidth="2" />
        <text x={getScaleBarWidth(bounds) / 2} y="14" textAnchor="middle" className="fill-[#555b57] text-[8px] font-bold">1km</text>
      </g>
    </svg>
  );
}

export default function GyeongjuMap2D({ completedQuestIds, onComplete, onDocent, onSelect, selectedPlace }) {
  const initialScope = isWithinBounds(selectedPlace, MAP_SCOPES.core.bounds) ? "core" : "all";
  const [scopeId, setScopeId] = useState(initialScope);
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_CURRENT_LOCATION);
  const [locationMessage, setLocationMessage] = useState("");
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMessage, setRouteMessage] = useState("");
  const scope = MAP_SCOPES[scopeId];
  const selectedDistance = getDistanceMeters(currentLocation, selectedPlace);
  const selectedNearby = selectedDistance <= NEARBY_DISTANCE_METERS;
  const completed = completedQuestIds.includes(selectedPlace.id);
  const visiblePlaces = useMemo(
    () => QUESTS.filter((place) => isWithinBounds(place, scope.bounds)),
    [scope.bounds],
  );

  const selectPlace = (place) => {
    setRoute(null);
    setRouteMessage("");
    onSelect(place);
  };

  const findCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("현재 브라우저에서는 위치 기능을 사용할 수 없어요.");
      return;
    }

    setLocationMessage("현재 위치를 확인하고 있어요.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { name: "현재 위치", latitude: coords.latitude, longitude: coords.longitude };
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

  const previewRoute = async () => {
    setRouteLoading(true);
    setRouteMessage("");

    try {
      if (TMAP_APP_KEY) {
        const tmapRoute = await requestTmapPedestrianRoute({
          appKey: TMAP_APP_KEY,
          start: currentLocation,
          end: selectedPlace,
        });
        setRoute(tmapRoute);
        setRouteMessage("TMAP 도보 경로를 불러왔어요.");
      } else {
        const distanceMeters = getDistanceMeters(currentLocation, selectedPlace);
        setRoute({
          coordinates: createDemoRoute(currentLocation, selectedPlace),
          distanceMeters,
          durationSeconds: Math.round(distanceMeters / WALKING_METERS_PER_SECOND),
          source: "demo",
        });
        setRouteMessage("TMAP 키 연결 전이라 데모 경로를 표시합니다.");
      }
    } catch {
      const distanceMeters = getDistanceMeters(currentLocation, selectedPlace);
      setRoute({
        coordinates: createDemoRoute(currentLocation, selectedPlace),
        distanceMeters,
        durationSeconds: Math.round(distanceMeters / WALKING_METERS_PER_SECOND),
        source: "demo",
      });
      setRouteMessage("TMAP 연결에 실패해 데모 경로를 표시합니다.");
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <section className="-mx-4 -mt-6 space-y-4">
      <div className="relative overflow-hidden bg-[#dceab2]">
        <div className="absolute inset-x-4 top-3 z-10 flex items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-2 rounded-lg bg-white/85 p-1 shadow-sm backdrop-blur" aria-label="지도 범위">
            {Object.values(MAP_SCOPES).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={scopeId === item.id}
                onClick={() => setScopeId(item.id)}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors ${scopeId === item.id ? "bg-white text-[#343235] shadow-sm" : "text-[#747579]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <IconButton className="border-white/70 bg-white/90" icon={LocateFixed} label="현재 위치 찾기" onClick={findCurrentLocation} />
        </div>
        <div className="absolute left-4 top-[4.25rem] z-10 flex flex-wrap items-center gap-3 rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-[#626762] shadow-sm backdrop-blur">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#bd8c31]" />{MAP_LEGEND.nearby}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7f8582]" />{MAP_LEGEND.distant}</span>
          <span className="inline-flex items-center gap-1"><Navigation size={13} className="text-[#356b98]" />{MAP_LEGEND.current}</span>
        </div>
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

      <div className="space-y-4 px-4">
        {(locationMessage || routeMessage) && (
          <p className="rounded-lg bg-[#eef3ef] px-3 py-2 text-xs leading-5 text-[#626762]" role="status">{routeMessage || locationMessage}</p>
        )}

        {route && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#e9f0f5] p-3 text-center">
            <div><p className="text-[10px] font-semibold text-[#6d7479]">도보 거리</p><p className="mt-1 text-sm font-bold text-[#315d7f]">{formatDistance(route.distanceMeters || selectedDistance)}</p></div>
            <div><p className="text-[10px] font-semibold text-[#6d7479]">예상 시간</p><p className="mt-1 text-sm font-bold text-[#315d7f]">{formatDuration(route.durationSeconds || selectedDistance / WALKING_METERS_PER_SECOND)}</p></div>
          </div>
        )}

        <article className="rounded-lg border border-[#e2e4e0] bg-white p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${completed ? "bg-[#e4f1ed] text-[#24746f]" : selectedNearby ? "bg-[#f8f0de] text-[#a67927]" : "bg-[#eef0ee] text-[#747579]"}`}>{completed ? <Check size={19} /> : <MapPin size={19} />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-[#343235]">{selectedPlace.name}</h2><span className="text-xs font-semibold text-[#747579]">{formatDistance(selectedDistance)}</span></div>
            <p className="mt-1 text-sm leading-6 text-[#626367]">{selectedPlace.description}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <AppButton className="col-span-2" disabled={routeLoading} icon={route ? Route : Footprints} onClick={previewRoute}>{routeLoading ? "경로 불러오는 중" : route ? "TMAP 경로 다시 보기" : "TMAP 길찾기"}</AppButton>
          <AppButton icon={completed ? Check : MapPin} variant={completed ? "outline" : "secondary"} onClick={() => onComplete(selectedPlace.id)}>{completed ? "방문 완료" : "퀘스트 완료"}</AppButton>
          <AppButton disabled={!selectedPlace.docent} icon={Headphones} variant="outline" onClick={() => onDocent(selectedPlace)}>{selectedPlace.docent ? "도슨트 듣기" : "준비 중"}</AppButton>
        </div>
        </article>
      </div>
    </section>
  );
}
