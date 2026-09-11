const ROOT = "/images/map-quests";

// PLACE_ID / 퀘스트 ID는 그대로 두고, 기존 장소 종류에 맞는 표현만 고른다.
// 실제 건물 외관 사진이 아니라 퀘스트 종류를 나타내는 일러스트다.
export function getQuestAsset(icon) {
  const asset = { tower: "tower", palace: "temple", temple: "temple", grotto: "grotto", food: "hanok" }[icon] || "hanok";
  return `${ROOT}/${asset}-simple.webp`;
}

export function routeFeature(route) {
  return {
    type: "FeatureCollection",
    features: route?.coordinates?.length >= 2 ? [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: route.coordinates.map(({ longitude, latitude }) => [longitude, latitude]),
      },
    }] : [],
  };
}
