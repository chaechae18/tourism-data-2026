"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Plus } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { GAME_MAP_STYLE } from "../../lib/map/quest-map-style";
import { getQuestAsset, routeFeature } from "../../lib/map/quest-assets";
import { getDistanceMeters, isWithinBounds } from "../../lib/map/gyeongju-map";
import { useI18n } from "../i18n/LanguageProvider";
import { IconButton } from "../ui/AppButton";
import styles from "./QuestMapCanvas.module.css";

const STATUS_TEXT = {
  ko: ["경주 지도를 불러오는 중…", "지도를 불러오지 못했습니다. 연결을 확인하거나 리스트를 이용해 주세요.", "다시 시도"],
  en: ["Loading Gyeongju map…", "Map unavailable. Check your connection or use the list.", "Retry"],
  ja: ["慶州の地図を読み込み中…", "地図を読み込めません。接続を確認するかリストをご利用ください。", "再試行"],
  zh: ["正在加载庆州地图…", "地图加载失败。请检查网络或使用列表。", "重试"],
};

// translateX(-50%)로 글씨가 반 픽셀에 걸리지 않도록 실제 화면 픽셀에 맞춘다.
function alignPlaceLabel(label) {
  if (!label) return;
  const parent = label.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const centered = parent.left + (parent.width - label.offsetWidth) / 2;
  label.style.left = `${Math.round(centered * ratio) / ratio - parent.left}px`;
}

// 지도 인스턴스는 한 번만 생성하고 장소·현재 위치·경로는 각각 갱신한다.
// 코스 API, 위치 권한 요청, 퀘스트 저장은 기존 GyeongjuMap2D가 담당한다.
export default function QuestMapCanvas({ bounds, completedQuestIds, currentLocation, onSelect, route, selectedPlace, visiblePlaces }) {
  const { language, t } = useI18n();
  const containerRef = useRef(null);
  const draggedRef = useRef(false);
  const [runtime, setRuntime] = useState(null);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(13.6);
  const [loadingText, errorText, retryText] = STATUS_TEXT[language] || STATUS_TEXT.ko;
  const { west, south, east, north } = bounds;

  useEffect(() => {
    let disposed = false;
    let map;
    let observer;
    let timer;
    setRuntime(null);
    setStatus("loading");

    import("maplibre-gl").then(({ Map, Marker, AttributionControl, ScaleControl, setWorkerUrl }) => {
      if (disposed) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: containerRef.current,
        style: GAME_MAP_STYLE,
        center: [129.2224, 35.8338],
        zoom: 13.6,
        minZoom: 10.5,
        maxZoom: 18,
        maxBounds: [[west, south], [east, north]],
        pitch: 0,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        renderWorldCopies: false,
        // 지도는 앱의 스크롤 화면 안에 있다. 한 손가락은 페이지 스크롤에 남겨 둔다.
        cooperativeGestures: true,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new ScaleControl({ maxWidth: 75, unit: "metric" }), "bottom-left");
      map.on("dragstart", () => { draggedRef.current = true; });
      map.on("zoomend", () => { if (!disposed) setZoom(map.getZoom()); });
      map.on("error", (event) => {
        if (!disposed) {
          console.error("[경주 지도]", event?.error);
          setStatus("error");
        }
      });
      // 일시적인 타일 오류 뒤에 정상적으로 복구된 경우 오류 안내도 내린다.
      map.on("idle", () => { if (!disposed && map.isStyleLoaded()) setStatus("ready"); });
      timer = window.setTimeout(() => { if (!disposed) setStatus("error"); }, 15000);
      map.once("load", () => {
        if (disposed) return;
        window.clearTimeout(timer);
        map.addSource("quest-route", { type: "geojson", data: routeFeature(null) });
        for (const [id, color, width] of [["quest-route-shadow", "#fffdf3", 8], ["quest-route-line", "#1caa8b", 4]]) {
          map.addLayer({ id, type: "line", source: "quest-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": width } });
        }
        map.addSource("quest-location", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "quest-location-halo", type: "circle", source: "quest-location", paint: { "circle-radius": 15, "circle-color": "#356b98", "circle-opacity": 0.16 } });
        map.addLayer({ id: "quest-location-dot", type: "circle", source: "quest-location", paint: { "circle-radius": 6, "circle-color": "#356b98", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        setRuntime({ map, Marker });
        setStatus("ready");
      });
      observer = new ResizeObserver(() => map.resize());
      observer.observe(containerRef.current);
    }).catch(() => { if (!disposed) setStatus("error"); });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      map?.remove();
    };
  }, [attempt, west, south, east, north]);

  useEffect(() => {
    if (!runtime) { setEntries([]); return undefined; }
    const next = visiblePlaces.map((place) => {
      const element = document.createElement("div");
      element.className = styles.marker;
      const marker = new runtime.Marker({ element, anchor: "bottom" })
        .setLngLat([place.longitude, place.latitude])
        .addTo(runtime.map);
      return { place, element, marker };
    });
    setEntries(next);
    return () => next.forEach(({ marker }) => marker.remove());
  }, [runtime, visiblePlaces]);

  const selectedId = selectedPlace?.id;
  const selectedLongitude = selectedPlace?.longitude;
  const selectedLatitude = selectedPlace?.latitude;
  useEffect(() => {
    if (!runtime || selectedLongitude == null || selectedLatitude == null) return;
    runtime.map.easeTo({ center: [selectedLongitude, selectedLatitude], zoom: Math.max(runtime.map.getZoom(), 13.6), duration: 450 });
  }, [runtime, selectedId, selectedLongitude, selectedLatitude]);

  useEffect(() => {
    if (!runtime) return;
    runtime.map.getSource("quest-route").setData(routeFeature(route));
    if (route?.coordinates?.length >= 2) {
      const lngs = route.coordinates.map((point) => point.longitude);
      const lats = route.coordinates.map((point) => point.latitude);
      runtime.map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 140, bottom: 110, left: 60, right: 60 }, maxZoom: 15, duration: 450 });
    }
  }, [runtime, route]);

  useEffect(() => {
    if (!runtime) return;
    const inside = isWithinBounds(currentLocation, { west, south, east, north });
    runtime.map.getSource("quest-location").setData({
      type: "FeatureCollection",
      features: inside ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [currentLocation.longitude, currentLocation.latitude] } }] : [],
    });
  }, [runtime, currentLocation, west, south, east, north]);

  return (
    <div className={styles.stage} role="region" aria-label={t("map.illustrationLabel")}>
      <div ref={containerRef} className={styles.canvas} />
      {entries.map(({ place, element }) => createPortal(
        <button
          type="button"
          className={styles.building}
          aria-label={t("map.selectPlace", { name: place.name })}
          aria-pressed={place.id === selectedId}
          data-completed={completedQuestIds.includes(place.id)}
          data-nearby={getDistanceMeters(currentLocation, place) <= 1000}
          title={place.name}
          onPointerDown={() => { draggedRef.current = false; }}
          onClick={(event) => { if (!draggedRef.current || event.detail === 0) onSelect(place); }}
        >
          <img src={getQuestAsset(place.icon)} width="40" height="40" alt="" draggable="false" />
          <span ref={alignPlaceLabel} className={styles.label}>{place.name}</span>
          {completedQuestIds.includes(place.id) && <span className={styles.badge} aria-label={t("map.visited")}><Check size={12} /></span>}
        </button>, element, place.id,
      ))}
      <div className={styles.tools}>
        <IconButton icon={Plus} label={t("map.zoomIn")} disabled={!runtime || zoom >= 18} onClick={() => runtime.map.zoomIn()} className="border-white/70 bg-white/90 shadow-sm" />
        <IconButton icon={Minus} label={t("map.zoomOut")} disabled={!runtime || zoom <= 10.5} onClick={() => runtime.map.zoomOut()} className="border-white/70 bg-white/90 shadow-sm" />
      </div>
      {status !== "ready" && <div className={styles.status} role="status">
        {status === "loading" ? loadingText : errorText}
        {status === "error" && <button type="button" className={styles.retry} onClick={() => setAttempt((value) => value + 1)}>{retryText}</button>}
      </div>}
    </div>
  );
}
