import { ApiError } from "./spots";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

async function requestInventory({ persona, signal, outfit }) {
  const saving = outfit !== undefined;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/donggyeong/${saving ? "outfit" : "inventory"}?persona=${encodeURIComponent(persona)}`, {
      method: saving ? "PUT" : "GET",
      credentials: "include",
      signal,
      ...(saving ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outfit }) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("아이템 서버에 연결하지 못했습니다.", "NETWORK_ERROR", null);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error?.message || "아이템 정보를 저장하거나 불러오지 못했습니다.", payload.error?.code || "INVENTORY_ERROR", response.status);
  return payload;
}

export function fetchInventory({ persona, signal }) {
  return requestInventory({ persona, signal });
}

export function saveOutfit({ persona, outfit }) {
  return requestInventory({ persona, outfit });
}
