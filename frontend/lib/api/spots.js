const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
const LOCAL_USER_NO = 1;

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("서버에 연결하지 못했습니다.", "NETWORK_ERROR", null);
  }
  if (response.status === 204) return null;
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

function userHeaders(json = false) {
  return {
    "X-User-No": String(LOCAL_USER_NO),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export async function searchPlaces(query, { signal } = {}) {
  const parameters = new URLSearchParams({ query, size: "10" });
  return request(`/api/v1/places/search?${parameters}`, { signal });
}

export async function searchNearbyPlaces({
  latitude,
  longitude,
  radius = 2000,
}) {
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius: String(radius),
    size: "15",
  });
  return request(`/api/v1/places/nearby?${parameters}`);
}

export async function uploadSpotImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/v1/uploads/images", {
    method: "POST",
    headers: userHeaders(),
    body: formData,
  });
}

export async function createSpot(body) {
  return request("/api/v1/spots", {
    method: "POST",
    headers: userHeaders(true),
    body: JSON.stringify(body),
  });
}

export async function listPublicSpots(sort = "likes") {
  const parameters = new URLSearchParams({ limit: "20", sort });
  return request(`/api/v1/spots?${parameters}`, {
    headers: userHeaders(),
  });
}

export async function listSpotRanking() {
  return request("/api/v1/spots/ranking?limit=20", {
    headers: userHeaders(),
  });
}

export async function listMySpots() {
  return request("/api/v1/spots/me?limit=50", {
    headers: userHeaders(),
  });
}

export async function deleteSpot(spotId) {
  return request(`/api/v1/spots/${spotId}`, {
    method: "DELETE",
    headers: userHeaders(),
  });
}

export async function setSpotReaction(spotId, type, active) {
  return request(`/api/v1/spots/${spotId}/reactions/${type}`, {
    method: active ? "PUT" : "DELETE",
    headers: userHeaders(),
  });
}

export async function listSpotComments(spotId) {
  return request(`/api/v1/spots/${spotId}/comments`, {
    headers: userHeaders(),
  });
}

export async function createSpotComment(spotId, content) {
  return request(`/api/v1/spots/${spotId}/comments`, {
    method: "POST",
    headers: userHeaders(true),
    body: JSON.stringify({ content }),
  });
}
