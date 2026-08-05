import { ApiError } from "./spots";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

async function request(path, lang, signal) {
  const parameters = lang ? `?${new URLSearchParams({ lang })}` : "";
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${parameters}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("서버에 연결하지 못했습니다.", "NETWORK_ERROR", null);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message || "요청을 처리하지 못했습니다.",
      payload.error?.code || "UNKNOWN_ERROR",
      response.status,
    );
  }
  return payload;
}

export async function listBanners(lang, { signal } = {}) {
  return request("/api/v1/main/banners", lang, signal);
}

export async function listPopups(lang, { signal } = {}) {
  return request("/api/v1/main/popup", lang, signal);
}

export async function listFestivals(lang, { signal } = {}) {
  return request("/api/v1/main/festivals", lang, signal);
}

export async function listRecommendedPlaces(lang, { signal } = {}) {
  return request("/api/v1/main/places/recommended", lang, signal);
}
