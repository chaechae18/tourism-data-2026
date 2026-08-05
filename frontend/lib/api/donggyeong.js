const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export async function listDonggyeongItems() {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/donggyeong/items`);
  } catch {
    throw new Error("서버에 연결하지 못했습니다.");
  }
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(payload.error?.message || "동경이 아이템을 불러오지 못했습니다.");
  }
  return payload;
}
