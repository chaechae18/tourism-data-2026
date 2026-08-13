import { Check, ChevronRight, MapPin, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { DG_INVENTORY, DG_SLOTS, DONGGYEONG_NUMBER, QUESTS } from "../../lib/app-data";
import { listDonggyeongItems } from "../../lib/api/donggyeong";
import Donggyeong3D from "../donggyeong/Donggyeong3D";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";

const ITEM_PRESENTATION = Object.fromEntries(
  DG_INVENTORY.map((item) => [item.name, item]),
);

function SlotButton({ item, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed border-[#d8ddda] bg-white px-2 text-center hover:border-[#bd8c31] hover:bg-[#f4f6f4]">
      <span className="text-xl" style={{ color: item?.color || "#747579" }}>{item?.symbol || "+"}</span>
      <span className="mt-1 text-[11px] font-semibold text-[#747579]">{item?.name || label}</span>
    </button>
  );
}

// places: 지금 지도에 그려 둔 코스 장소들. 없으면 샘플 장소를 쓴다.
export default function MyDGTab({ completedQuestIds, onMapQuest, onSaveOutfit, outfit, places = QUESTS, setOutfit }) {
  const [inventory, setInventory] = useState(DG_INVENTORY);
  const getItem = (itemId) => inventory.find((item) => item.id === itemId);
  const equipItem = (item) => setOutfit((current) => ({ ...current, [item.slot]: item.id }));

  useEffect(() => {
    let active = true;
    listDonggyeongItems()
      .then((items) => {
        if (!active || items.length === 0) return;
        setInventory(items.map((item) => ({
          ...item,
          id: String(item.id),
          color: ITEM_PRESENTATION[item.name]?.color || "#747579",
          symbol: ITEM_PRESENTATION[item.name]?.symbol || "◆",
        })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow="My Donggyeong" title="동경이 꾸미기" action={<AppButton icon={Save} size="sm" onClick={onSaveOutfit}>착장 저장</AppButton>} />
      <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-3">
        <div className="grid grid-rows-2 gap-3">
          {DG_SLOTS.slice(0, 2).map((slot) => <SlotButton key={slot.id} label={slot.label} item={getItem(outfit[slot.id])} onClick={() => setOutfit((current) => ({ ...current, [slot.id]: undefined }))} />)}
        </div>
        <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-[#314c5b] bg-[radial-gradient(circle_at_50%_28%,#405d6c_0%,#18272f_70%)]">
          <Donggyeong3D className="absolute inset-0" />
          <p className="pointer-events-none absolute left-4 top-4 text-xs font-semibold text-[#f7e9c8]">{DONGGYEONG_NUMBER} · 내 동경이</p>
        </div>
        <div className="grid grid-rows-2 gap-3">
          {DG_SLOTS.slice(2).map((slot) => <SlotButton key={slot.id} label={slot.label} item={getItem(outfit[slot.id])} onClick={() => setOutfit((current) => ({ ...current, [slot.id]: undefined }))} />)}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[#343235]">인벤토리</p>
        <div className="grid grid-cols-5 gap-2">
          {inventory.map((item) => {
            const selected = outfit[item.slot] === item.id;
            return (
              <button key={item.id} type="button" onClick={() => equipItem(item)} data-model-url={item.modelUrl || undefined} className={`aspect-square rounded-lg border p-1 text-center transition-colors ${selected ? "border-[#bd8c31] bg-[#f8f0de]" : "border-[#e2e4e0] bg-white hover:bg-[#f1f4f2]"}`}>
                <span className="block pt-1 text-xl" style={{ color: item.color }}>{item.symbol}</span>
                <span className="mt-1 block truncate text-[10px] font-semibold text-[#55565a]">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionHeading eyebrow="Quest" title="방문 퀘스트" />
        <div className="space-y-2">
          {places.map((quest) => {
            const done = completedQuestIds.includes(quest.id);
            return (
              <button key={quest.id} type="button" onClick={() => onMapQuest(quest)} className="flex w-full items-center gap-3 rounded-lg border border-[#e2e4e0] bg-white p-3 text-left transition-colors hover:bg-[#f1f4f2]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-[#e4f1ed] text-[#24746f]" : "bg-[#f8f0de] text-[#a67927]"}`}>{done ? <Check size={17} /> : <MapPin size={17} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#343235]">{quest.name}</span><span className="mt-0.5 block truncate text-xs text-[#747579]">{quest.distance} · {quest.description}</span></span>
                <ChevronRight size={17} className="shrink-0 text-[#747579]" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
