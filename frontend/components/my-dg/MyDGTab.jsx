import {
  Camera,
  Check,
  ChevronRight,
  Crown,
  Flower2,
  Lamp,
  MapPin,
  Package,
  Save,
  Shirt,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DG_INVENTORY, DG_SLOTS, DONGGYEONG_NUMBER, QUESTS } from "../../lib/app-data";
import { listDonggyeongItems } from "../../lib/api/donggyeong";
import Donggyeong3D from "../donggyeong/Donggyeong3D";
import AppButton from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";
import { useI18n } from "../i18n/LanguageProvider";

const ITEM_PRESENTATION = Object.fromEntries(
  DG_INVENTORY.map((item) => [item.name, item]),
);

function repairUtf8Mojibake(value) {
  if (!value || /[\uac00-\ud7a3]/.test(value)) return value;

  try {
    const bytes = [];
    for (const character of value) {
      const codePoint = character.codePointAt(0);
      if (codePoint <= 0xff) {
        bytes.push(codePoint);
        continue;
      }

      const windows1252Byte = {
        0x2013: 0x96,
        0x2014: 0x97,
        0x2018: 0x91,
        0x2019: 0x92,
        0x201c: 0x93,
        0x201d: 0x94,
        0x201e: 0x84,
        0x2030: 0x89,
        0x2039: 0x8b,
        0x2022: 0x95,
        0x2026: 0x85,
        0x20ac: 0x80,
        0x02c6: 0x88,
        0x0192: 0x83,
        0x0160: 0x8a,
        0x0152: 0x8c,
        0x017d: 0x8e,
        0x02dc: 0x98,
        0x0161: 0x9a,
        0x0153: 0x9c,
        0x017e: 0x9e,
        0x0178: 0x9f,
        0x2122: 0x99,
      }[codePoint];
      if (windows1252Byte === undefined) return value;
      bytes.push(windows1252Byte);
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

function normalizeInventory(items) {
  const normalized = new Map();

  items.forEach((item) => {
    const name = repairUtf8Mojibake(item.name);
    const presentation = ITEM_PRESENTATION[name];
    const normalizedItem = {
      ...item,
      name,
      color: presentation?.color || "#747579",
      modelUrl: item.modelUrl || presentation?.modelUrl,
    };
    const key = presentation?.id || `${item.slot}:${name}`;
    const current = normalized.get(key);

    if (!current || (!current.modelUrl && normalizedItem.modelUrl)) {
      normalized.set(key, normalizedItem);
    }
  });

  return [...normalized.values()];
}

const ITEM_ICONS = {
  camera: Camera,
  crown: Crown,
  hanbok: Shirt,
  lantern: Lamp,
  lotus: Flower2,
};

function ItemIcon({ item }) {
  const iconId = item?.presentationId || ITEM_PRESENTATION[item?.name]?.id || item?.id;
  const Icon = ITEM_ICONS[iconId] || Package;

  return <Icon aria-hidden="true" size={21} strokeWidth={1.8} />;
}

function SlotButton({ item, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed border-[#d8ddda] bg-white px-2 text-center hover:border-[#bd8c31] hover:bg-[#f4f6f4]">
      <span className="flex h-6 items-center justify-center" style={{ color: item?.color || "#747579" }}>
        {item ? <ItemIcon item={item} /> : "+"}
      </span>
      <span className="mt-1 text-[11px] font-semibold text-[#747579]">{item?.name || label}</span>
    </button>
  );
}

// places: 지금 지도에 그려 둔 코스 장소들. 없으면 샘플 장소를 쓴다.
export default function MyDGTab({ completedQuestIds, onMapQuest, onSaveOutfit, outfit, places = QUESTS, setOutfit }) {
  const { t } = useI18n();
  const [inventory, setInventory] = useState(DG_INVENTORY);
  const getItem = (itemId) => inventory.find((item) => item.id === itemId);
  const getDisplayedItem = (itemId) => {
    const item = getItem(itemId);
    const presentation = item && ITEM_PRESENTATION[item.name];
    return presentation
      ? { ...item, name: t(`items.${presentation.id}`), presentationId: presentation.id }
      : item;
  };
  const equipItem = (item) => setOutfit((current) => ({ ...current, [item.slot]: item.id }));
  const equippedItems = DG_SLOTS
    .map((slot) => getItem(outfit[slot.id]))
    .filter((item) => item?.modelUrl);

  useEffect(() => {
    let active = true;
    listDonggyeongItems()
      .then((items) => {
        if (!active || items.length === 0) return;
        setInventory(normalizeInventory(items).map((item) => ({
          ...item,
          id: String(item.id),
        })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow="My Donggyeong" title={t("donggyeong.title")} action={<AppButton icon={Save} size="sm" onClick={onSaveOutfit}>{t("donggyeong.save")}</AppButton>} />
      <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-3">
        <div className="grid grid-rows-2 gap-3">
          {DG_SLOTS.slice(0, 2).map((slot) => <SlotButton key={slot.id} label={t(`slots.${slot.id}`)} item={getDisplayedItem(outfit[slot.id])} onClick={() => setOutfit((current) => ({ ...current, [slot.id]: undefined }))} />)}
        </div>
        <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-[#314c5b] bg-[radial-gradient(circle_at_50%_28%,#405d6c_0%,#18272f_70%)]">
          <Donggyeong3D className="absolute inset-0" items={equippedItems} />
          <p className="pointer-events-none absolute left-4 top-4 text-xs font-semibold text-[#f7e9c8]">{DONGGYEONG_NUMBER} · {t("donggyeong.mine")}</p>
        </div>
        <div className="grid grid-rows-2 gap-3">
          {DG_SLOTS.slice(2).map((slot) => <SlotButton key={slot.id} label={t(`slots.${slot.id}`)} item={getDisplayedItem(outfit[slot.id])} onClick={() => setOutfit((current) => ({ ...current, [slot.id]: undefined }))} />)}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[#343235]">{t("donggyeong.inventory")}</p>
        <div className="grid grid-cols-5 gap-2">
          {inventory.map((item) => {
            const selected = outfit[item.slot] === item.id;
            return (
              <button key={item.id} type="button" onClick={() => equipItem(item)} data-model-url={item.modelUrl || undefined} className={`aspect-square rounded-lg border p-1 text-center transition-colors ${selected ? "border-[#bd8c31] bg-[#f8f0de]" : "border-[#e2e4e0] bg-white hover:bg-[#f1f4f2]"}`}>
                <span className="flex h-7 items-center justify-center pt-1" style={{ color: item.color }}>
                  <ItemIcon item={item} />
                </span>
                <span className="mt-1 block truncate text-[10px] font-semibold text-[#55565a]">{ITEM_PRESENTATION[item.name] ? t(`items.${ITEM_PRESENTATION[item.name].id}`) : item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionHeading eyebrow="Quest" title={t("donggyeong.quests")} />
        <div className="space-y-2">
          {places.map((quest) => {
            const done = completedQuestIds.includes(quest.id);
            return (
              <button key={quest.id} type="button" onClick={() => onMapQuest(quest)} className="flex w-full items-center gap-3 rounded-lg border border-[#e2e4e0] bg-white p-3 text-left transition-colors hover:bg-[#f1f4f2]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-[#e4f1ed] text-[#24746f]" : "bg-[#f8f0de] text-[#a67927]"}`}>{done ? <Check size={17} /> : <MapPin size={17} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#343235]">{t(`quests.${quest.id}.name`)}</span><span className="mt-0.5 block truncate text-xs text-[#747579]">{quest.distance} · {t(`quests.${quest.id}.description`)}</span></span>
                <ChevronRight size={17} className="shrink-0 text-[#747579]" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
