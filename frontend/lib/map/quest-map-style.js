const source = "gyeongju-base";

const roadLayer = (
  id,
  classes,
  minzoom,
  color,
  width,
  casing = false,
) => ({
  id,
  type: "line",
  source,
  "source-layer": "transportation",
  minzoom,
  filter: ["in", ["get", "class"], ["literal", classes]],
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": color,
    "line-width": width,
    "line-opacity": casing ? 0.58 : 0.98,
  },
});

export const GAME_MAP_STYLE = {
  version: 8,
  name: "Silla Walk",
  sources: {
    [source]: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "ground", type: "background", paint: { "background-color": "#eee9dc" } },
    {
      id: "landuse-residential", type: "fill", source, "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
      paint: { "fill-color": "#e8e1d1", "fill-opacity": 0.62 },
    },
    {
      id: "landcover-grass", type: "fill", source, "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "farmland"]]],
      paint: { "fill-color": "#cbd6b4", "fill-opacity": 0.62 },
    },
    {
      id: "landcover-wood", type: "fill", source, "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": "#8eae8e", "fill-opacity": 0.62 },
    },
    {
      id: "parks", type: "fill", source, "source-layer": "park",
      paint: { "fill-color": "#b6cba3", "fill-opacity": 0.66 },
    },
    {
      id: "water", type: "fill", source, "source-layer": "water",
      paint: { "fill-color": "#86bdc7", "fill-opacity": 0.9 },
    },
    {
      id: "waterway", type: "line", source, "source-layer": "waterway", minzoom: 10,
      paint: {
        "line-color": "#72adb8",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 15, 2.4],
        "line-opacity": 0.82,
      },
    },
    {
      id: "buildings", type: "fill", source, "source-layer": "building", minzoom: 14,
      paint: { "fill-color": "#d8cdb8", "fill-outline-color": "#c9bca6", "fill-opacity": 0.48 },
    },
    roadLayer("major-casing", ["motorway", "trunk", "primary"], 8, "#af8e62", ["interpolate", ["linear"], ["zoom"], 9, 2.4, 15, 9.5], true),
    roadLayer("major-road", ["motorway", "trunk", "primary"], 8, "#fffaf0", ["interpolate", ["linear"], ["zoom"], 9, 1.5, 15, 7.2]),
    roadLayer("middle-casing", ["secondary", "tertiary"], 11, "#c3aa84", ["interpolate", ["linear"], ["zoom"], 11, 1.5, 16, 6.8], true),
    roadLayer("middle-road", ["secondary", "tertiary"], 11, "#fffdf6", ["interpolate", ["linear"], ["zoom"], 11, 1, 16, 5.2]),
    roadLayer("minor-road", ["minor", "service"], 13.4, "#fffdf8", ["interpolate", ["linear"], ["zoom"], 13.4, 0.8, 17, 3.4]),
    {
      id: "walking-paths", type: "line", source, "source-layer": "transportation", minzoom: 14.2,
      filter: ["in", ["get", "class"], ["literal", ["path", "track"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#b59a66",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.7, 17, 2],
        "line-dasharray": [1.4, 1.6],
        "line-opacity": 0.66,
      },
    },
  ],
};
