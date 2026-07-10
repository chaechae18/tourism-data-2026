import { Check, Headphones, MapPin, Navigation } from "lucide-react";
import { MAP_LEGEND, QUESTS } from "../../lib/app-data";
import AppButton from "../ui/AppButton";

const MAP_PATH = "M55 42 C88 18 150 24 185 45 C221 26 306 32 348 66 L337 124 C363 160 345 232 306 280 C257 316 176 310 121 292 C72 280 40 223 48 172 C26 124 30 69 55 42 Z";
const ROAD_PATHS = ["M70 128 C135 145 201 130 320 202", "M112 70 C155 118 190 168 290 258", "M78 229 C146 207 218 203 326 145"];
const NEARBY_DISTANCE_COUNT = 2;

function PlaceMarker({ active, completed, onClick, place, nearby }) {
  const color = completed ? "#287c70" : nearby ? "#b8661c" : "#9a8b7e";
  return (
    <g className="cursor-pointer" onClick={onClick} role="button" tabIndex="0" aria-label={`${place.name} 선택`} onKeyDown={(event) => event.key === "Enter" && onClick()}>
      {active && <circle cx={place.mapX} cy={place.mapY} fill="none" r="18" stroke={color} strokeWidth="2" />}
      <circle cx={place.mapX} cy={place.mapY} fill={color} r={nearby ? "9" : "7"} />
      <circle cx={place.mapX} cy={place.mapY - 2} fill="#fffaf4" r="2.5" />
      <text x={place.mapX} y={place.mapY + 23} textAnchor="middle" className="fill-[#5f5044] text-[9px] font-bold">{place.name}</text>
    </g>
  );
}

export default function GyeongjuMap2D({ completedQuestIds, onComplete, onDocent, onSelect, selectedPlace }) {
  const selectedIndex = QUESTS.findIndex((quest) => quest.id === selectedPlace.id);
  const selectedNearby = selectedIndex < NEARBY_DISTANCE_COUNT;
  const completed = completedQuestIds.includes(selectedPlace.id);

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#e6ddd2] bg-[#dceddf] p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-bold text-[#5f5044]">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#b8661c]" />{MAP_LEGEND.nearby}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#9a8b7e]" />{MAP_LEGEND.distant}</span>
          <span className="inline-flex items-center gap-1"><Navigation size={14} className="text-[#405a9d]" />{MAP_LEGEND.current}</span>
        </div>
        <svg viewBox="0 0 390 330" className="h-auto w-full" aria-label="경주 2D 지도" role="img">
          <path d={MAP_PATH} fill="#f8f0dc" stroke="#b9ab98" strokeWidth="2" />
          <path d="M269 38 C319 67 352 102 341 170 C333 213 309 248 275 278" fill="none" stroke="#a9d5e4" strokeWidth="18" />
          {ROAD_PATHS.map((path) => <path key={path} d={path} fill="none" stroke="#e4ceb1" strokeLinecap="round" strokeWidth="7" />)}
          <path d="M102 90 C154 70 190 77 242 99" fill="none" stroke="#a8c48f" strokeDasharray="4 6" strokeWidth="8" />
          <circle cx="174" cy="147" fill="#405a9d" r="8" stroke="#fff" strokeWidth="4" />
          <text x="174" y="171" textAnchor="middle" className="fill-[#405a9d] text-[9px] font-bold">현재 위치</text>
          {QUESTS.map((place, index) => <PlaceMarker key={place.id} active={place.id === selectedPlace.id} completed={completedQuestIds.includes(place.id)} nearby={index < NEARBY_DISTANCE_COUNT} onClick={() => onSelect(place)} place={place} />)}
        </svg>
      </div>

      <article className="border border-[#e6ddd2] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${completed ? "bg-[#e0f0eb] text-[#287c70]" : selectedNearby ? "bg-[#fff1df] text-[#a45118]" : "bg-[#f3ece3] text-[#7c6d61]"}`}>{completed ? <Check size={19} /> : <MapPin size={19} />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-[#241b16]">{selectedPlace.name}</h2><span className="text-xs font-bold text-[#7c6d61]">{selectedPlace.distance}</span></div>
            <p className="mt-1 text-sm leading-6 text-[#6f6256]">{selectedPlace.description}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <AppButton icon={completed ? Check : MapPin} variant={completed ? "outline" : "primary"} onClick={() => onComplete(selectedPlace.id)}>{completed ? "방문 완료" : "퀘스트 완료"}</AppButton>
          <AppButton disabled={!selectedPlace.docent} icon={Headphones} variant="outline" onClick={() => onDocent(selectedPlace)}>{selectedPlace.docent ? "도슨트 듣기" : "도슨트 준비 중"}</AppButton>
        </div>
      </article>
    </section>
  );
}
