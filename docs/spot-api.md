# 스팟 장소 검색·등록 API 명세

## 공통

- Base URL: `http://localhost:8000`
- 요청·응답 형식: `application/json`
- 사용자 식별: `X-User-No` 헤더
  - 현재 인증 API가 없어서 사용하는 임시 계약입니다.
  - 로컬 개발 사용자는 `X-User-No: 1`입니다.
  - 로그인 도입 후에는 클라이언트가 사용자 번호를 보내지 않고,
    서버가 액세스 토큰에서 사용자 번호를 가져와야 합니다.

오류 응답은 아래 형식으로 통일합니다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 값을 확인해 주세요."
  }
}
```

## 1. Kakao 장소 검색

`GET /api/v1/places/search`

Kakao Local 키워드 검색을 서버에서 대행합니다. REST API 키는 브라우저로
전달되지 않습니다.

### Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `query` | string | O | - | 검색어, 1~100자 |
| `page` | integer | X | `1` | 페이지, 1~45 |
| `size` | integer | X | `15` | 페이지 크기, 1~15 |
| `categoryGroupCode` | string | X | - | Kakao 카테고리 그룹 코드 (`AT4`, `FD6`, `CE7` 등) |
| `longitude` | number | X | - | 중심 경도 |
| `latitude` | number | X | - | 중심 위도 |
| `radius` | integer | X | - | 검색 반경(m), 0~20,000 |
| `sort` | string | X | `accuracy` | `accuracy` 또는 `distance` |

`longitude`와 `latitude`는 함께 보내야 합니다. `radius` 또는
`sort=distance`를 사용하려면 두 중심 좌표가 필요합니다.

### Example

```http
GET /api/v1/places/search?query=첨성대&longitude=129.2191&latitude=35.8347&radius=5000&sort=distance
```

```json
{
  "meta": {
    "totalCount": 1,
    "pageableCount": 1,
    "isEnd": true
  },
  "places": [
    {
      "id": "12345",
      "name": "첨성대",
      "address": "경북 경주시 인왕동 839-1",
      "roadAddress": "경북 경주시 첨성로 140-25",
      "latitude": 35.8347,
      "longitude": 129.2191,
      "categoryName": "여행 > 관광,명소",
      "categoryGroupCode": "AT4",
      "categoryGroupName": "관광명소",
      "phone": "",
      "placeUrl": "http://place.map.kakao.com/12345",
      "distance": 120
    }
  ]
}
```

### Errors

| 상태 | 코드 | 조건 |
| --- | --- | --- |
| `422` | `VALIDATION_ERROR` | 검색어, 좌표 또는 범위가 잘못됨 |
| `502` | `KAKAO_UPSTREAM_ERROR` | Kakao API 호출 실패 |
| `503` | `KAKAO_NOT_CONFIGURED` | 서버에 REST API 키가 없음 |

## 2. 사용자 스팟 등록

`POST /api/v1/spots`

장소 검색 응답에서 사용자가 선택한 `place` 객체를 그대로 전달합니다.
서버는 `PLACE`를 `SOURCE=KAKAO`, `CONTENT_ID=place.id` 기준으로
upsert한 뒤 `SPOTS` 게시물을 생성합니다. 같은 장소에 게시물을 여러 개
등록해도 `PLACE`는 중복 생성되지 않습니다.

### Headers

```http
X-User-No: 1
Content-Type: application/json
```

### Request body

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `place` | object | O | 장소 검색 응답의 장소 객체 |
| `placeType` | string | O | `TOUR` 또는 `FOOD` |
| `caption` | string | O | 한줄평, 공백 제외 1~350자 |
| `photoUrl` | string/null | X | 업로드 완료된 이미지 URL, 최대 500자 |

```json
{
  "place": {
    "id": "12345",
    "name": "첨성대",
    "address": "경북 경주시 인왕동 839-1",
    "roadAddress": "경북 경주시 첨성로 140-25",
    "latitude": 35.8347,
    "longitude": 129.2191,
    "categoryName": "여행 > 관광,명소",
    "categoryGroupCode": "AT4",
    "categoryGroupName": "관광명소",
    "phone": "",
    "placeUrl": "http://place.map.kakao.com/12345",
    "distance": 120
  },
  "placeType": "TOUR",
  "caption": "해 질 무렵의 첨성대가 아름다워요.",
  "photoUrl": "https://cdn.example.com/spots/photo.jpg"
}
```

### Success response

`201 Created`

```json
{
  "id": 7,
  "userNo": 1,
  "authorNickname": "lotus_traveler",
  "place": {
    "placeId": 3,
    "mapPlaceId": "12345",
    "type": "TOUR",
    "name": "첨성대",
    "address": "경북 경주시 첨성로 140-25",
    "latitude": 35.8347,
    "longitude": 129.2191
  },
  "photoUrl": "https://cdn.example.com/spots/photo.jpg",
  "caption": "해 질 무렵의 첨성대가 아름다워요.",
  "likeCount": 0,
  "moderationStatus": 0,
  "createdAt": "2026-07-29T10:30:00"
}
```

신규 게시물의 `moderationStatus`는 `0`(대기)입니다.

### Errors

| 상태 | 코드 | 조건 |
| --- | --- | --- |
| `404` | `USER_NOT_FOUND` | 활성 사용자를 찾을 수 없음 |
| `422` | `VALIDATION_ERROR` | 필수 값, 좌표, 글자 수 등이 잘못됨 |

## 3. 내가 등록한 스팟 목록

`GET /api/v1/spots/me`

### Headers

```http
X-User-No: 1
```

### Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `limit` | integer | X | `20` | 최근 게시물 개수, 1~100 |

응답은 사용자 본인의 스팟 배열이며 각 원소의 형식은 등록 성공 응답과
같습니다. 검증 대기·승인·거절 상태를 모두 반환합니다.

## 프론트 연동 순서

1. 장소 입력 중 `GET /api/v1/places/search`를 호출합니다.
2. 사용자가 검색 결과 하나를 선택합니다.
3. 이미지가 있다면 별도 업로드 API/스토리지에서 URL을 먼저 받습니다.
4. 선택한 장소 객체, 한줄평, 이미지 URL로 `POST /api/v1/spots`를 호출합니다.
5. 내 게시물 화면은 `GET /api/v1/spots/me`로 갱신합니다.

현재 범위에는 이미지 바이너리 업로드와 실제 로그인 토큰 검증이 포함되지
않습니다. 두 기능이 준비되면 `photoUrl`과 `X-User-No` 계약만 교체하면
장소·게시물 저장 구조는 그대로 사용할 수 있습니다.
