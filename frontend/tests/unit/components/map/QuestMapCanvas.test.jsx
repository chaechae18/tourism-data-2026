import { maps, markers } from "../../../helpers/maplibre";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import QuestMapCanvas from "../../../../components/map/QuestMapCanvas";
import { DEFAULT_CURRENT_LOCATION, MAP_SCOPES } from "../../../../lib/map/gyeongju-map";
import { getQuestAsset, routeFeature } from "../../../../lib/map/quest-assets";

const PLACES = [
  { id: "place-41", placeId: 41, questId: 101, name: "첨성대", latitude: 35.8347, longitude: 129.219, icon: "tower" },
  { id: "place-82", placeId: 82, questId: 102, name: "한옥 식당", latitude: 35.839, longitude: 129.215, icon: "food" },
];
const props = { bounds: MAP_SCOPES.all.bounds, completedQuestIds: [], currentLocation: DEFAULT_CURRENT_LOCATION, onSelect: vi.fn(), route: null, selectedPlace: PLACES[0], visiblePlaces: PLACES };

async function ready() { return screen.findByRole("button", { name: "첨성대 선택" }); }

describe("QuestMapCanvas", () => {
  it("anchors image assets to DB longitude/latitude and keeps the original place object on selection", async () => {
    const onSelect = vi.fn();
    render(<QuestMapCanvas {...props} onSelect={onSelect} />);
    const building = await ready();
    expect(building.querySelector("img")).toHaveAttribute("src", "/images/map-quests/tower-simple.webp");
    expect(building.querySelector("img")).toHaveAttribute("width", "40");
    expect(markers[0].coordinates).toEqual([129.219, 35.8347]);
    expect(markers[0].anchor).toBe("bottom");
    fireEvent.click(building);
    expect(onSelect).toHaveBeenCalledWith(PLACES[0]);
  });

  it("updates course/translated labels/completion without recreating the map", async () => {
    const { rerender } = render(<QuestMapCanvas {...props} />);
    await ready();
    const firstMap = maps[0];
    const changed = [{ ...PLACES[0], name: "Cheomseongdae", longitude: 129.22 }];
    rerender(<QuestMapCanvas {...props} visiblePlaces={changed} selectedPlace={changed[0]} completedQuestIds={[changed[0].id]} />);
    const building = await screen.findByRole("button", { name: "Cheomseongdae 선택" });
    expect(building).toHaveAttribute("data-completed", "true");
    expect(building).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "한옥 식당 선택" })).toBeNull();
    expect(markers.at(-1).coordinates).toEqual([129.22, 35.8347]);
    expect(maps).toHaveLength(1);
    expect(firstMap.remove).not.toHaveBeenCalled();
  });

  it("updates and clears the real route and current-location layers", async () => {
    const { rerender } = render(<QuestMapCanvas {...props} />);
    await ready();
    const route = { coordinates: [DEFAULT_CURRENT_LOCATION, PLACES[0]] };
    rerender(<QuestMapCanvas {...props} route={route} currentLocation={PLACES[1]} />);
    expect(maps[0].getSource("quest-route").setData).toHaveBeenLastCalledWith(routeFeature(route));
    expect(maps[0].getSource("quest-location").setData.mock.lastCall[0].features[0].geometry.coordinates).toEqual([129.215, 35.839]);
    expect(maps[0].fitBounds).toHaveBeenCalled();
    rerender(<QuestMapCanvas {...props} currentLocation={{ latitude: 37.5, longitude: 127 }} />);
    expect(maps[0].getSource("quest-route").setData).toHaveBeenLastCalledWith(routeFeature(null));
    expect(maps[0].getSource("quest-location").setData.mock.lastCall[0].features).toEqual([]);
  });

  it("uses native zoom and never transforms the building image size", async () => {
    render(<QuestMapCanvas {...props} />);
    const building = await ready();
    fireEvent.click(screen.getByRole("button", { name: "지도 확대" }));
    fireEvent.click(screen.getByRole("button", { name: "지도 축소" }));
    expect(maps[0].zoomIn).toHaveBeenCalledOnce();
    expect(maps[0].zoomOut).toHaveBeenCalledOnce();
    expect(building.querySelector("img")).toHaveAttribute("width", "40");
  });

  it("aligns place labels to physical pixels without a text transform", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 100.25, width: 44 });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(87);
    vi.stubGlobal("devicePixelRatio", 2);
    try {
      render(<QuestMapCanvas {...props} />);
      const building = await ready();
      const label = building.querySelector("img").nextElementSibling;
      expect(label).toHaveTextContent("첨성대");
      expect(label.style.left).toBe("-21.25px");
      expect(label.style.transform).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not select a building at the end of a map drag", async () => {
    const onSelect = vi.fn();
    render(<QuestMapCanvas {...props} onSelect={onSelect} />);
    const building = await ready();
    fireEvent.pointerDown(building);
    act(() => maps[0].emit("dragstart"));
    fireEvent.click(building, { detail: 1 });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.pointerDown(building);
    fireEvent.click(building, { detail: 1 });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("shows recoverable map errors and cleans up when retried or unmounted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<QuestMapCanvas {...props} />);
    await ready();
    const first = maps[0];
    act(() => first.emit("error"));
    expect(screen.getByRole("status")).toHaveTextContent("리스트");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(maps).toHaveLength(2));
    await ready();
    expect(first.remove).toHaveBeenCalledOnce();
    unmount();
    expect(maps[1].remove).toHaveBeenCalledOnce();
    expect(markers.every((marker) => marker.remove.mock.calls.length === 1)).toBe(true);
  });
});

it("provides safe category fallbacks without interpolating arbitrary paths", () => {
  expect(getQuestAsset("food")).toBe("/images/map-quests/hanok-simple.webp");
  expect(getQuestAsset("palace")).toBe("/images/map-quests/temple-simple.webp");
  expect(getQuestAsset("grotto")).toBe("/images/map-quests/grotto-simple.webp");
  expect(getQuestAsset("unknown")).toBe("/images/map-quests/hanok-simple.webp");
  expect(routeFeature({ coordinates: [PLACES[0]] }).features).toEqual([]);
});
