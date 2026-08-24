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
    // 방문 완료 저장에 쓰는 퀘스트 번호 (QUEST.IDX)
    questId: stop.questId,
    completed: Boolean(stop.completed),
    name: stop.name,
    description: `${details}${notice}`,
    // 상세 카드에 줄줄이 보여 주는 실용 정보
    menu: stop.menu,
    operatingHours: stop.operatingHours,
    parking: stop.parking,
    restDate: stop.restDate,
    distance: stop.order === 1 ? t("map.start") : `${stop.distanceKm}km`,
    latitude: stop.latitude,
    longitude: stop.longitude,
    icon: stop.icon,
    // 서버에 읽어 줄 설명(PLACE.TEXT)이 있으면 도슨트 버튼이 켜진다.
    docent: Boolean(stop.docent),
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

// 마지막에 고른 역할. 앱을 다시 열었을 때 그 역할로 돌아가기 위해 쓴다.
// 아직 고른 적이 없으면 null 을 준다. (처음 들어온 사용자)
export async function fetchSelectedRole({ signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/journey/characters/selected`, {
      headers: { "X-User-No": String(LOCAL_USER_NO) },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return null;
  }
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

// 방문 완료를 서버에 저장한다. 저장해 두면 다시 들어와도 완료 상태가 남는다.
export async function completeQuest({ questId, signal } = {}) {
  if (!questId) throw new ApiError("퀘스트 번호가 없습니다.", "QUEST_ID_MISSING", null);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/journey/quests/${questId}/complete`, {
      method: "POST",
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
      payload.error?.message || "방문 완료를 저장하지 못했습니다.",
      payload.error?.code || "UNKNOWN_ERROR",
      response.status,
    );
  }
  return payload;
}
