import { ApiError } from "./spots";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
const LOCAL_USER_NO = 1;

async function requestPreferences(options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/users/me/preferences`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-User-No": String(LOCAL_USER_NO),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했습니다.", "NETWORK_ERROR", null);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message || "언어 설정을 저장하지 못했습니다.",
      payload.error?.code || "UNKNOWN_ERROR",
      response.status,
    );
  }
  return payload;
}

export function getUserPreferences() {
  return requestPreferences();
}

export function updateUserLanguage(language) {
  return requestPreferences({
    method: "PATCH",
    body: JSON.stringify({ language }),
  });
}
