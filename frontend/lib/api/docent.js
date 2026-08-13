import { ApiError } from "./spots";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

// 도슨트 음성 주소. <audio src=...> 에 그대로 꽂으면 재생된다.
// 서버가 그때그때 만들어 흘려보내므로 앱에도 서버에도 mp3 파일은 남지 않는다.
export function docentAudioUrl(placeId) {
  return `${API_BASE_URL}/api/v1/journey/docent/${placeId}/audio`;
}

// 도슨트 원고(PLACE.TEXT). 화면에 같이 보여 준다.
export async function fetchDocentScript(placeId, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/journey/docent/${placeId}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("서버에 연결하지 못했습니다.", "NETWORK_ERROR", null);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message || "도슨트를 불러오지 못했습니다.",
      payload.error?.code || "UNKNOWN_ERROR",
      response.status,
    );
  }
  return payload;
}
