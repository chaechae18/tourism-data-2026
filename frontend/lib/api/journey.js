import { ApiError } from "./spots";
import { createTranslator } from "../i18n";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
// 로그인이 붙기 전까지는 테스트 사용자(USERS.NO = 1)로 저장한다.
// 로그인이 생기면 이 값만 로그인한 사용자 번호로 바꾸면 된다.
const LOCAL_USER_NO = 1;

// 코스 API 응답을 지도 컴포넌트가 쓰는 장소 모양으로 바꾼다.
// (id / name / description / distance / latitude / longitude / icon / docent)
function toPlace(stop, t) {
  const details = [stop.timeSlot, stop.category].filter(Boolean).join(" · ");
  const notice = stop.hoursUnknown ? t("map.closedNotice") : "";
  return {
    id: `place-${stop.placeId}`,
    placeId: stop.placeId,
    name: stop.name,
    description: `${details}${stop.menu ? ` — ${stop.menu}` : ""}${notice}`,
    distance: stop.order === 1 ? t("map.start") : `${stop.distanceKm}km`,
    latitude: stop.latitude,
    longitude: stop.longitude,
    icon: stop.icon,
    docent: false,
    timeSlot: stop.timeSlot,
    order: stop.order,
    img: stop.img,
    address: stop.address,
  };
}

async function requestCourse({ persona, date, language = "ko", method, signal, t = createTranslator(language) }) {
  const parameters = new URLSearchParams({ persona });
  if (date) parameters.set("date", date);
  parameters.set("lang", language);

  const path = method === "POST" ? "/api/v1/journey/course/refresh" : "/api/v1/journey/course";
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}?${parameters}`, {
      method,
      headers: { "X-User-No": String(LOCAL_USER_NO) },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("서버에 연결하지 못했습니다.", "NETWORK_ERROR", null);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message || "코스를 불러오지 못했습니다.",
      payload.error?.code || "UNKNOWN_ERROR",
      response.status,
    );
  }

  return { ...payload, places: (payload.stops || []).map((stop) => toPlace(stop, t)) };
}

// 저장된 코스를 준다. 없으면 서버가 이때 한 번 뽑아 저장한다.
export async function fetchCourse({ persona = "king", date, language, signal, t } = {}) {
  return requestCourse({ persona, date, language, method: "GET", signal, t });
}

// 코스를 새로 뽑아 저장한다. 이전 코스는 비활성으로 내려간다.
export async function refreshCourse({ persona = "king", date, language, signal, t } = {}) {
  return requestCourse({ persona, date, language, method: "POST", signal, t });
}
