import {
  clampMapView,
  createDemoRoute,
  DEFAULT_CURRENT_LOCATION,
  DEFAULT_MAP_VIEW,
  getDistanceMeters,
  MAP_SCOPES,
  MAP_VIEWBOX,
  MAP_ZOOM,
  projectCoordinate,
  scaleMapView,
} from "../../../../lib/map/gyeongju-map";

describe("gyeongju map projection", () => {
  it("projects eastern coordinates to the right", () => {
    const bounds = MAP_SCOPES.all.bounds;
    const west = projectCoordinate({ latitude: 35.8, longitude: bounds.west }, bounds);
    const east = projectCoordinate({ latitude: 35.8, longitude: bounds.east }, bounds);

    expect(east.x).toBeGreaterThan(west.x);
  });

  it("projects northern coordinates above southern coordinates", () => {
    const bounds = MAP_SCOPES.all.bounds;
    const north = projectCoordinate({ latitude: bounds.north, longitude: 129.25 }, bounds);
    const south = projectCoordinate({ latitude: bounds.south, longitude: 129.25 }, bounds);

    expect(north.y).toBeLessThan(south.y);
  });

  it("creates a demo route that ends at the destination", () => {
    const destination = { latitude: 35.8347, longitude: 129.2191 };
    const route = createDemoRoute(DEFAULT_CURRENT_LOCATION, destination);

    expect(route.at(-1)).toEqual(destination);
  });

  it("calculates distance from geographic coordinates", () => {
    const destination = { latitude: 35.8347, longitude: 129.2191 };

    expect(getDistanceMeters(DEFAULT_CURRENT_LOCATION, destination)).toBeGreaterThan(0);
  });
});

describe("gyeongju map zoom", () => {
  const CENTER = { x: MAP_VIEWBOX.width / 2, y: MAP_VIEWBOX.height / 2 };

  it("keeps the zoom focus in the same place on screen", () => {
    const focus = { x: 120, y: 300 };
    const zoomed = scaleMapView(DEFAULT_MAP_VIEW, 2, focus);

    // 확대 전 focus에 있던 지도 지점이 확대 후에도 같은 화면 자리에 있어야 한다.
    expect(focus.x * zoomed.scale + zoomed.x).toBeCloseTo(focus.x);
    expect(focus.y * zoomed.scale + zoomed.y).toBeCloseTo(focus.y);
  });

  it("separates clustered landmarks faster than it grows the markers", () => {
    const bounds = MAP_SCOPES.all.bounds;
    const cheomseongdae = projectCoordinate({ latitude: 35.8347, longitude: 129.2191 }, bounds);
    const donggung = projectCoordinate({ latitude: 35.8349, longitude: 129.2267 }, bounds);
    const gap = Math.hypot(cheomseongdae.x - donggung.x, cheomseongdae.y - donggung.y);

    // 마커 지름은 36. 1배에서는 겹치지만, 3배로 확대하면 마커 크기는 그대로여서 떨어진다.
    expect(gap).toBeLessThan(36);
    expect(gap * 3).toBeGreaterThan(36);
  });

  it("never lets the view drift off the map edges", () => {
    const dragged = clampMapView({ scale: 2, x: 500, y: -9000 });

    expect(dragged.x).toBe(0);
    expect(dragged.y).toBe(MAP_VIEWBOX.height * -1);
  });

  it("snaps back to the full map when zoomed all the way out", () => {
    const zoomedOut = scaleMapView({ scale: 2, x: -100, y: -140 }, 0.2, CENTER);

    expect(zoomedOut).toEqual(DEFAULT_MAP_VIEW);
  });

  it("stops zooming in at the maximum scale", () => {
    expect(scaleMapView(DEFAULT_MAP_VIEW, 99, CENTER).scale).toBe(MAP_ZOOM.max);
  });
});
