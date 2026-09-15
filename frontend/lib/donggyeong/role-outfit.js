import manifest from "../../public/models/donggyeong/manifest.json";

export const DONGGYEONG_ITEMS = manifest.items.map((item) => ({
  ...item,
  modelUrl: `${item.url}?v=${item.sha256.slice(0, 12)}`,
}));

export function getRoleItems(roleKey) {
  const role = manifest.roles.find((item) => item.appRoleKey === roleKey);
  return DONGGYEONG_ITEMS.filter((item) => role?.items.includes(item.id));
}

export function getRoleOutfit(roleKey) {
  return Object.fromEntries(getRoleItems(roleKey).map((item) => [item.slot, item.id]));
}
