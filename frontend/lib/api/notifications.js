const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: "include" });
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

export function listNotifications({ unreadOnly = false, lang } = {}) {
  const parameters = new URLSearchParams({
    unreadOnly: String(unreadOnly),
    limit: "30",
  });
  if (lang) parameters.set("lang", lang);
  return request(`/api/v1/notifications?${parameters}`);
}

export function markNotificationRead(notificationId) {
  return request(`/api/v1/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function notifyQuestCompleted(quest) {
  return request("/api/v1/notifications/quest-completed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questId: quest.id, questName: quest.name }),
  });
}
