const TMAP_PEDESTRIAN_ROUTE_URL = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json";

function getSummary(features) {
  const properties = features.find((feature) => (
    feature.properties?.totalDistance || feature.properties?.totalTime
  ))?.properties || {};

  return {
    distanceMeters: Number(properties.totalDistance) || 0,
    durationSeconds: Number(properties.totalTime) || 0,
  };
}

export async function requestTmapPedestrianRoute({ appKey, end, fetcher = fetch, start }) {
  if (!appKey) throw new Error("TMAP_APP_KEY_MISSING");

  const response = await fetcher(TMAP_PEDESTRIAN_ROUTE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      appKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startX: start.longitude,
      startY: start.latitude,
      endX: end.longitude,
      endY: end.latitude,
      reqCoordType: "WGS84GEO",
      resCoordType: "WGS84GEO",
      startName: start.name || "현재 위치",
      endName: end.name,
      searchOption: "0",
    }),
  });

  if (!response.ok) throw new Error(`TMAP_ROUTE_FAILED_${response.status}`);

  const data = await response.json();
  const features = data.features || [];
  const coordinates = features
    .filter((feature) => feature.geometry?.type === "LineString")
    .flatMap((feature) => feature.geometry.coordinates)
    .map(([longitude, latitude]) => ({ latitude, longitude }));

  if (coordinates.length < 2) throw new Error("TMAP_ROUTE_EMPTY");

  return {
    coordinates,
    ...getSummary(features),
    source: "tmap",
  };
}
