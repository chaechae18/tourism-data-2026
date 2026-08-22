// 카카오맵 길찾기 주소를 만든다. (API 키가 필요 없는 공개 링크 방식)
//  - 휴대폰: 카카오맵 앱의 길찾기 화면. 출발지(현재 위치)와 도착지가 모두 채워진 상태로 열린다.
//  - PC: 카카오맵 웹 길찾기 페이지. 도착지가 찍힌 상태로 열리고 출발지는 "현 위치"로 지정한다.
const KAKAO_MAP_LINK_URL = "https://map.kakao.com/link/to";
const KAKAO_MAP_APP_SCHEME = "kakaomap://route";

// 이동 수단: CAR(자동차) / PUBLICTRANSIT(대중교통) / FOOT(도보)
export const KAKAO_ROUTE_MODE = "FOOT";

function isMobile(userAgent = "") {
  return /android|iphone|ipad|ipod/i.test(userAgent);
}

export function buildKakaoRouteUrl({ end, start, userAgent = "" } = {}) {
  if (!end) return "";

  if (isMobile(userAgent) && start) {
    const parameters = new URLSearchParams({
      sp: `${start.latitude},${start.longitude}`,
      ep: `${end.latitude},${end.longitude}`,
      by: KAKAO_ROUTE_MODE,
    });
    return `${KAKAO_MAP_APP_SCHEME}?${parameters}`;
  }

  // 링크 방식은 "이름,위도,경도" 순서를 지켜야 한다. 쉼표는 그대로 두고 이름만 인코딩한다.
  const name = encodeURIComponent(end.name || "목적지");
  return `${KAKAO_MAP_LINK_URL}/${name},${end.latitude},${end.longitude}`;
}
