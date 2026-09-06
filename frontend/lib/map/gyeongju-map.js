const EARTH_KM_PER_LATITUDE_DEGREE = 111.32;

export const MAP_VIEWBOX = {
  width: 390,
  height: 500,
  padding: 24,
};

// 지도는 경주 관광권 전체 하나만 사용한다. (도심권 범위 전환은 없앰)
export const MAP_SCOPES = {
  all: {
    id: "all",
    label: "지도",
    bounds: { west: 129.17, east: 129.37, north: 35.9, south: 35.72 },
  },
};

// 지도 확대 배율 범위와 +/- 버튼 한 번에 움직이는 크기
export const MAP_ZOOM = { min: 1, max: 4, step: 1.6 };

// 확대하지 않은 기본 상태 (1배, 이동 없음)
export const DEFAULT_MAP_VIEW = { scale: 1, x: 0, y: 0 };

export function clampMapScale(scale) {
  return Math.min(MAP_ZOOM.max, Math.max(MAP_ZOOM.min, scale));
}

// 확대 상태를 지도 밖 여백이 보이지 않는 범위 안에 가둔다.
// 배율 s로 키운 지도의 이동값은 (지도크기 × (1 - s)) ~ 0 사이여야 화면이 지도로 꽉 찬다.
export function clampMapView(view, viewbox = MAP_VIEWBOX) {
  const scale = clampMapScale(view.scale);
  return {
    scale,
    x: Math.min(0, Math.max(viewbox.width * (1 - scale), view.x)),
    y: Math.min(0, Math.max(viewbox.height * (1 - scale), view.y)),
  };
}

// 배율을 nextScale로 바꾸되, 화면의 anchor 지점에 있던 곳이 focus 자리로 오도록 이동값을 다시 계산한다.
//  - 휠/버튼 확대: anchor와 focus가 같다 (커서·화면 중앙이 제자리에 고정)
//  - 손가락 핀치: anchor=두 손가락 시작 중점, focus=지금 중점 (확대하면서 같이 끌리는 효과)
export function scaleMapView(view, nextScale, anchor, focus = anchor, viewbox = MAP_VIEWBOX) {
  const scale = clampMapScale(nextScale);
  const ratio = scale / view.scale;
  return clampMapView({
    scale,
    x: focus.x - (anchor.x - view.x) * ratio,
    y: focus.y - (anchor.y - view.y) * ratio,
  }, viewbox);
}

export const DEFAULT_CURRENT_LOCATION = {
  name: "대릉원 인근",
  latitude: 35.8351,
  longitude: 129.2167,
};

export const ILLUSTRATED_ROADS = [
  [
    { latitude: 35.872, longitude: 129.214 },
    { latitude: 35.838, longitude: 129.216 },
    { latitude: 35.804, longitude: 129.23 },
    { latitude: 35.79, longitude: 129.332 },
  ],
  [
    { latitude: 35.847, longitude: 129.196 },
    { latitude: 35.837, longitude: 129.226 },
    { latitude: 35.838, longitude: 129.276 },
    { latitude: 35.795, longitude: 129.349 },
  ],
  [
    { latitude: 35.817, longitude: 129.19 },
    { latitude: 35.832, longitude: 129.217 },
    { latitude: 35.856, longitude: 129.246 },
  ],
];

export const HYEONGSAN_RIVER = [
  { latitude: 35.895, longitude: 129.187 },
  { latitude: 35.86, longitude: 129.194 },
  { latitude: 35.83, longitude: 129.198 },
  { latitude: 35.79, longitude: 129.211 },
  { latitude: 35.74, longitude: 129.233 },
];

export function isWithinBounds(point, bounds) {
  return point.longitude >= bounds.west
    && point.longitude <= bounds.east
    && point.latitude >= bounds.south
    && point.latitude <= bounds.north;
}

export function projectCoordinate(point, bounds, viewbox = MAP_VIEWBOX) {
  const centerLatitude = (bounds.north + bounds.south) / 2;
  const longitudeKm = EARTH_KM_PER_LATITUDE_DEGREE * Math.cos(centerLatitude * Math.PI / 180);
  const latitudeKm = EARTH_KM_PER_LATITUDE_DEGREE;
  const mapWidthKm = (bounds.east - bounds.west) * longitudeKm;
  const mapHeightKm = (bounds.north - bounds.south) * latitudeKm;
  const drawableWidth = viewbox.width - viewbox.padding * 2;
  const drawableHeight = viewbox.height - viewbox.padding * 2;
  const scale = Math.min(drawableWidth / mapWidthKm, drawableHeight / mapHeightKm);
  const renderedWidth = mapWidthKm * scale;
  const renderedHeight = mapHeightKm * scale;
  const offsetX = viewbox.padding + (drawableWidth - renderedWidth) / 2;
  const offsetY = viewbox.padding + (drawableHeight - renderedHeight) / 2;

  return {
    x: offsetX + (point.longitude - bounds.west) * longitudeKm * scale,
    y: offsetY + (bounds.north - point.latitude) * latitudeKm * scale,
  };
}

export function coordinatesToPath(coordinates, bounds) {
  return coordinates.map((coordinate, index) => {
    const point = projectCoordinate(coordinate, bounds);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" ");
}

export function getDistanceMeters(start, end) {
  const latitudeDelta = (end.latitude - start.latitude) * Math.PI / 180;
  const longitudeDelta = (end.longitude - start.longitude) * Math.PI / 180;
  const startLatitude = start.latitude * Math.PI / 180;
  const endLatitude = end.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

export function formatDistance(distanceMeters) {
  if (distanceMeters < 1000) return `${distanceMeters}m`;
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export function createDemoRoute(start, end) {
  const latitudeDelta = end.latitude - start.latitude;
  const longitudeDelta = end.longitude - start.longitude;
  return [
    start,
    {
      latitude: start.latitude + latitudeDelta * 0.35 + longitudeDelta * 0.025,
      longitude: start.longitude + longitudeDelta * 0.35 - latitudeDelta * 0.025,
    },
    {
      latitude: start.latitude + latitudeDelta * 0.68 - longitudeDelta * 0.018,
      longitude: start.longitude + longitudeDelta * 0.68 + latitudeDelta * 0.018,
    },
    end,
  ];
}
