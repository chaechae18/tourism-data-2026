const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
const LOCAL_USER_NO = 1;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("서버에 연결하지 못했습니다.");
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "알림을 처리하지 못했습니다.");
  }
  return payload;
}

const userHeaders = (json = false) => ({
  "X-User-No": String(LOCAL_USER_NO),
  ...(json ? { "Content-Type": "application/json" } : {}),
});

export function listNotifications({ unreadOnly = false } = {}) {
  const parameters = new URLSearchParams({
    unreadOnly: String(unreadOnly),
    limit: "30",
  });
  return request(`/api/v1/notifications?${parameters}`, {
    headers: userHeaders(),
  });
}

export function markNotificationRead(notificationId) {
  return request(`/api/v1/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: userHeaders(),
  });
}

export function notifyQuestCompleted(quest) {
  return request("/api/v1/notifications/quest-completed", {
    method: "POST",
    headers: userHeaders(true),
    body: JSON.stringify({ questId: quest.id, questName: quest.name }),
  });
}
