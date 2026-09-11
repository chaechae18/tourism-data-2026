import { beforeEach, vi } from "vitest";

export const maps = [];
export const markers = [];

vi.mock("maplibre-gl", () => ({
  Map: vi.fn(function (options) {
    const handlers = {};
    const sources = {};
    this.options = options;
    this.touchZoomRotate = { disableRotation: vi.fn() };
    this.addControl = vi.fn();
    this.addLayer = vi.fn();
    this.addSource = vi.fn((id, spec) => { sources[id] = { ...spec, setData: vi.fn() }; });
    this.getSource = (id) => sources[id];
    this.on = (event, callback) => { handlers[event] = callback; };
    this.emit = (event) => handlers[event]?.();
    this.once = (event, callback) => { if (event === "load") queueMicrotask(callback); };
    this.getZoom = () => options.zoom;
    this.zoomIn = vi.fn();
    this.zoomOut = vi.fn();
    this.easeTo = vi.fn();
    this.fitBounds = vi.fn();
    this.resize = vi.fn();
    this.remove = vi.fn();
    this.isStyleLoaded = () => true;
    maps.push(this);
  }),
  Marker: vi.fn(function ({ element, anchor }) {
    this.element = element;
    this.anchor = anchor;
    this.setLngLat = vi.fn((coordinates) => { this.coordinates = coordinates; return this; });
    this.addTo = (map) => { map.options.container.appendChild(element); return this; };
    this.remove = vi.fn(() => element.remove());
    markers.push(this);
  }),
  AttributionControl: vi.fn(),
  ScaleControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}));

beforeEach(() => { maps.length = 0; markers.length = 0; });
