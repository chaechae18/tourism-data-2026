const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

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
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: "include" });
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
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export async function searchPlaces(query, { signal } = {}) {
  const parameters = new URLSearchParams({ query, size: "10" });
  return request(`/api/v1/places/search?${parameters}`, { signal });
}

export async function uploadSpotImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new ApiError("JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.", "UNSUPPORTED_IMAGE_TYPE", 415);
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new ApiError("이미지는 10MB 이하만 업로드할 수 있습니다.", "IMAGE_TOO_LARGE", 413);
  }
  try {
    const { upload } = await import("@vercel/blob/client");
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
    return await upload(`spots/${crypto.randomUUID()}.${extension}`, file, {
      access: "public",
      handleUploadUrl: "/api/spot-images/upload",
      contentType: file.type,
    });
  } catch {
    throw new ApiError("사진 업로드에 실패했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.", "IMAGE_UPLOAD_FAILED", null);
  }
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
