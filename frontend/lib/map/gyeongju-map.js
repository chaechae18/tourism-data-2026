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
