import { useState } from "react";
import { Check, ChevronRight, Crown, Hand, Image, MapPin, Package, Save, Shirt } from "lucide-react";
import { DONGGYEONG_NUMBER, QUESTS } from "../../lib/app-data";
import { DONGGYEONG_ITEMS } from "../../lib/donggyeong/role-outfit";
import manifest from "../../public/models/donggyeong/manifest.json";
import Donggyeong3D from "../donggyeong/Donggyeong3D";
import AppButton from "../ui/AppButton";
import AppModal from "../ui/AppModal";
import SectionHeading from "../ui/SectionHeading";
import { useI18n } from "../i18n/LanguageProvider";

const ITEM_ICONS = { hat: Crown, hand: Hand, top: Shirt, bottom: Shirt, effect: Image };
const DG_SLOTS = manifest.slots.map((id) => ({ id }));

function ItemIcon({ item }) {
  const Icon = ITEM_ICONS[item?.slot] || Package;

  return <Icon aria-hidden="true" size={21} strokeWidth={1.8} />;
}

function SlotButton({ item, label, onClick }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed border-[#d8ddda] bg-white px-2 text-center">
      <span className="flex h-6 items-center justify-center" style={{ color: item?.color || "#747579" }}>
        {item ? <ItemIcon item={item} /> : "+"}
      </span>
      <span className="mt-1 text-[11px] font-semibold text-[#747579]">{item?.name || label}</span>
    </button>
  );
}

// places: 지금 지도에 그려 둔 코스 장소들. 없으면 샘플 장소를 쓴다.
export default function MyDGTab({ availableItems = [], completedQuestIds, onMapQuest, onSaveOutfit, outfit, places = QUESTS, setOutfit }) {
  const { t } = useI18n();
  const [activeSlot, setActiveSlot] = useState(null);
  const getItem = (itemId) => DONGGYEONG_ITEMS.find((item) => item.id === itemId);
  const getDisplayedItem = getItem;
  const equippedItems = DG_SLOTS.map((slot) => getItem(outfit[slot.id])).filter(Boolean);

  const slotItems = availableItems.filter((item) => item.slot === activeSlot);
  const equipItem = (itemId) => {
    setOutfit((current) => ({ ...current, [activeSlot]: itemId }));
    setActiveSlot(null);
  };

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow="My Donggyeong" title={t("donggyeong.title")} action={<AppButton icon={Save} size="sm" onClick={onSaveOutfit}>{t("donggyeong.save")}</AppButton>} />
      <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-3">
        <div className="grid grid-rows-2 gap-3">
          {DG_SLOTS.slice(0, 2).map((slot) => <SlotButton key={slot.id} label={t(`slots.${slot.id}`)} item={getDisplayedItem(outfit[slot.id])} onClick={() => setActiveSlot(slot.id)} />)}
        </div>
        <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-[#314c5b] bg-[radial-gradient(circle_at_50%_28%,#405d6c_0%,#18272f_70%)]">
          <Donggyeong3D className="absolute inset-0" items={equippedItems} />
          <p className="pointer-events-none absolute left-4 top-4 text-xs font-semibold text-[#f7e9c8]">{DONGGYEONG_NUMBER} · {t("donggyeong.mine")}</p>
        </div>
        <div className="grid grid-rows-3 gap-3">
          {DG_SLOTS.slice(2).map((slot) => <SlotButton key={slot.id} label={t(`slots.${slot.id}`)} item={getDisplayedItem(outfit[slot.id])} onClick={() => setActiveSlot(slot.id)} />)}
        </div>
      </div>

      <div>
        <SectionHeading eyebrow="Quest" title={t("donggyeong.quests")} />
        <div className="space-y-2">
          {places.map((quest) => {
            const done = completedQuestIds.includes(quest.id);
            return (
              <button key={quest.id} type="button" onClick={() => onMapQuest(quest)} className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left transition-colors">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-[#e4f1ed] text-[#24746f]" : "bg-brand-soft text-brand-ink"}`}>{done ? <Check size={17} /> : <MapPin size={17} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#343235]">{t(`quests.${quest.id}.name`)}</span><span className="mt-0.5 block truncate text-xs text-[#747579]">{quest.distance} · {t(`quests.${quest.id}.description`)}</span></span>
                <ChevronRight size={17} className="shrink-0 text-[#747579]" />
              </button>
            );
          })}
        </div>
      </div>
      <AppModal open={activeSlot !== null} onClose={() => setActiveSlot(null)} title={activeSlot ? t(`slots.${activeSlot}`) : ""}>
        <div className="space-y-2">
          {slotItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={outfit[activeSlot] === item.id}
              onClick={() => equipItem(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg p-4 text-left text-sm font-semibold ${outfit[activeSlot] === item.id ? "bg-brand-soft text-brand-ink" : "bg-[#f7f7f5] text-[#343235]"}`}
            >
              <ItemIcon item={item} />
              <span className="flex-1">{item.name}</span>
              {outfit[activeSlot] === item.id && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
          {slotItems.length === 0 && <p className="py-6 text-center text-sm text-[#747579]">{t("donggyeong.noItems")}</p>}
        </div>
        {outfit[activeSlot] && <AppButton variant="outline" className="mt-5 w-full !border-0" onClick={() => equipItem(undefined)}>{t("donggyeong.unequip")}</AppButton>}
      </AppModal>
    </section>
  );
}
