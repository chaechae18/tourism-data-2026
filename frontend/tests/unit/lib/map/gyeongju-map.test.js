import {
  createDemoRoute,
  DEFAULT_CURRENT_LOCATION,
  getDistanceMeters,
  MAP_SCOPES,
  projectCoordinate,
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
