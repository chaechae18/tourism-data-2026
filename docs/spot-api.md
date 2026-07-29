# 스팟 API 명세

## 공통

- Base URL: `http://localhost:8000`
- JSON 요청: `Content-Type: application/json`
- 사용자 인증(임시): `X-User-No: 1`
- 관리자 인증(임시): `X-Admin-Key: {ADMIN_API_KEY}`
- Swagger UI: `http://localhost:8000/docs`

로그인 API가 준비되면 클라이언트가 `X-User-No`를 직접 보내지 않고,
서버가 액세스 토큰에서 사용자 번호를 가져와야 합니다. 관리자 키도 실제
관리자 권한 검사로 교체해야 합니다.

오류 응답 형식:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 값을 확인해 주세요."
  }
}
```

검수 상태:

| 값 | 의미 |
| --- | --- |
| `0` | 대기 |
| `1` | 승인 |
| `2` | 반려 |

## 엔드포인트 요약

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/v1/places/search` | Kakao 우선, Naver fallback 장소 검색 |
| `GET` | `/api/v1/places/nearby` | 현재 좌표 주변 장소 검색 |
| `POST` | `/api/v1/uploads/images` | 로컬 이미지 업로드 |
| `POST` | `/api/v1/spots` | 사용자 스팟 등록 |
| `GET` | `/api/v1/spots` | 승인된 공개 스팟 목록 |
| `GET` | `/api/v1/spots/me` | 내가 등록한 스팟 목록 |
| `DELETE` | `/api/v1/spots/{spotId}` | 내 스팟 삭제 |
| `PUT` | `/api/v1/spots/{spotId}/reactions/{type}` | 좋아요·북마크 설정 |
| `DELETE` | `/api/v1/spots/{spotId}/reactions/{type}` | 좋아요·북마크 해제 |
| `GET` | `/api/v1/spots/{spotId}/comments` | 댓글 목록 |
| `POST` | `/api/v1/spots/{spotId}/comments` | 댓글 등록 |
| `PATCH` | `/api/v1/admin/{targetType}/{targetId}/moderation` | 스팟·댓글 검수 |

## 1. 장소 검색

`GET /api/v1/places/search`

Kakao Local API를 먼저 호출합니다. Kakao 호출이 실패하거나 결과가 0건이면
Naver 지역 검색 API를 호출합니다. 두 제공자의 인증 키는 브라우저에
노출되지 않습니다.

### Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `query` | string | O | - | 검색어, 1~100자 |
| `page` | integer | X | `1` | 페이지, 1~45 |
| `size` | integer | X | `15` | 페이지 크기, 1~15 |
| `categoryGroupCode` | string | X | - | Kakao 카테고리 코드 |
| `longitude` | number | X | - | 중심 경도 |
| `latitude` | number | X | - | 중심 위도 |
| `radius` | integer | X | - | Kakao 검색 반경(m), 최대 20,000 |
| `sort` | string | X | `accuracy` | `accuracy` 또는 `distance` |

`longitude`와 `latitude`는 함께 보내야 합니다. `radius` 또는
`sort=distance`를 사용하려면 중심 좌표가 필요합니다.

### Response headers

| 이름 | 값 | 설명 |
| --- | --- | --- |
| `X-Place-Provider` | `KAKAO` / `NAVER` | 실제 결과 제공자 |
| `X-Search-Cache` | `HIT` / `MISS` | 메모리 캐시 사용 여부 |
| `Retry-After` | 초 | `429` 발생 시 재요청 대기 시간 |

동일 검색 결과는 기본 5분 동안 캐시합니다. IP별 기본 제한은 1분 30회입니다.

### Example response

```json
{
  "meta": {
    "totalCount": 1,
    "pageableCount": 1,
    "isEnd": true
  },
  "places": [
    {
      "provider": "KAKAO",
      "id": "8089382",
      "name": "첨성대",
      "address": "경북 경주시 인왕동 839-1",
      "roadAddress": "",
      "latitude": 35.8347,
      "longitude": 129.2191,
      "categoryName": "여행 > 관광,명소",
      "categoryGroupCode": "AT4",
      "categoryGroupName": "관광명소",
      "phone": "",
      "placeUrl": "http://place.map.kakao.com/8089382",
      "distance": null
    }
  ]
}
```

Naver 결과의 `id`는 Naver 응답의 링크·장소명·주소·좌표로 생성한 안정적인
식별자입니다. `provider + id` 조합을 장소 식별자로 사용해야 합니다.

### Errors

| 상태 | 코드 | 조건 |
| --- | --- | --- |
| `422` | `VALIDATION_ERROR` | 검색어 또는 좌표가 잘못됨 |
| `429` | `SEARCH_RATE_LIMITED` | IP별 요청 제한 초과 |
| `502` | `PLACE_SEARCH_UNAVAILABLE` | 사용 가능한 검색 제공자 호출 실패 |
| `503` | `PLACE_SEARCH_NOT_CONFIGURED` | Kakao와 Naver 키가 모두 없음 |

## 2. 내 주변 장소 검색

`GET /api/v1/places/nearby`

브라우저에서 사용자의 위치 권한을 받은 뒤 현재 좌표를 전달합니다. Kakao
카테고리 검색으로 관광지(`AT4`), 음식점(`FD6`), 카페(`CE7`)를 조회하고
가까운 순서로 합쳐 반환합니다. 이 경로는 Kakao API만 사용합니다.

| 이름 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `longitude` | number | O | - | 현재 경도 |
| `latitude` | number | O | - | 현재 위도 |
| `radius` | integer | X | `2000` | 검색 반경(m), 100~20,000 |
| `size` | integer | X | `15` | 반환 개수, 1~15 |

응답 형식은 장소 검색과 동일하며 각 장소의 `distance`에 현재 위치로부터의
거리(m)가 포함됩니다. 위치 좌표는 DB에 저장하지 않으며, 사용자가 장소를
선택해 스팟을 등록할 때만 해당 장소가 `PLACE`에 저장됩니다.

## 3. 이미지 업로드

`POST /api/v1/uploads/images`

### Headers

```http
X-User-No: 1
Content-Type: multipart/form-data
```

`file` 필드로 JPEG, PNG 또는 WebP 이미지를 전송합니다. 기본 최대 크기는
10MB입니다.

### Success response

`201 Created`

```json
{
  "url": "http://localhost:8000/uploads/4d1c...e92.jpg",
  "filename": "4d1c...e92.jpg",
  "contentType": "image/jpeg",
  "size": 842315
}
```

반환된 `url`을 스팟 등록의 `photoUrl`로 전달합니다. 현재 저장 위치는
`backend/uploads`입니다. 운영 배포에서는 같은 응답 계약을 유지하고
S3 또는 R2 저장 구현으로 교체해야 합니다.

### Errors

| 상태 | 코드 | 조건 |
| --- | --- | --- |
| `404` | `USER_NOT_FOUND` | 활성 사용자가 아님 |
| `413` | `IMAGE_TOO_LARGE` | 최대 업로드 크기 초과 |
| `415` | `UNSUPPORTED_IMAGE_TYPE` | 지원하지 않는 이미지 형식 |
| `422` | `INVALID_IMAGE` | 실제 이미지가 아니거나 손상됨 |

## 4. 스팟 등록

`POST /api/v1/spots`

검색 응답에서 선택한 장소 객체를 그대로 `place`로 전달합니다. 서버는
`PLACE(SOURCE, CONTENT_ID)`를 `provider + id` 기준으로 upsert한 뒤
`SPOTS` 게시물을 생성합니다.

### Request

```http
X-User-No: 1
Content-Type: application/json
```

```json
{
  "place": {
    "provider": "KAKAO",
    "id": "8089382",
    "name": "첨성대",
    "address": "경북 경주시 인왕동 839-1",
    "roadAddress": "",
    "latitude": 35.8347,
    "longitude": 129.2191,
    "categoryName": "여행 > 관광,명소",
    "categoryGroupCode": "AT4",
    "categoryGroupName": "관광명소",
    "phone": "",
    "placeUrl": "http://place.map.kakao.com/8089382",
    "distance": null
  },
  "placeType": "TOUR",
  "caption": "해 질 무렵의 첨성대가 아름다워요.",
  "photoUrl": "http://localhost:8000/uploads/4d1c...e92.jpg"
}
```

`placeType`은 `TOUR` 또는 `FOOD`, `caption`은 공백 제외 1~350자입니다.
신규 게시물은 검수 대기 상태(`moderationStatus: 0`)입니다.

### Spot response

```json
{
  "id": 7,
  "userNo": 1,
  "authorNickname": "lotus_traveler",
  "place": {
    "placeId": 3,
    "provider": "KAKAO",
    "mapPlaceId": "8089382",
    "type": "TOUR",
    "name": "첨성대",
    "address": "경북 경주시 인왕동 839-1",
    "latitude": 35.8347,
    "longitude": 129.2191
  },
  "photoUrl": "http://localhost:8000/uploads/4d1c...e92.jpg",
  "caption": "해 질 무렵의 첨성대가 아름다워요.",
  "likeCount": 0,
  "commentCount": 0,
  "isLiked": false,
  "isBookmarked": false,
  "isOwner": true,
  "moderationStatus": 0,
  "createdAt": "2026-07-29T10:30:00"
}
```

## 5. 스팟 목록·삭제

### 승인된 공개 목록

`GET /api/v1/spots?limit=20&beforeId=100`

- `X-User-No`는 선택 사항입니다.
- 승인 상태이며 삭제되지 않은 스팟만 최신순으로 반환합니다.
- 로그인 사용자를 전달하면 `isLiked`, `isBookmarked`, `isOwner`가 계산됩니다.
- 다음 페이지는 마지막 항목의 `id`를 `beforeId`로 전달합니다.

### 내 목록

`GET /api/v1/spots/me?limit=50`

`X-User-No`가 필수이며 대기·승인·반려된 본인 게시물을 모두 반환합니다.

### 내 스팟 삭제

`DELETE /api/v1/spots/{spotId}`

`X-User-No`가 필수입니다. 작성자만 삭제할 수 있으며 실제 행을 제거하지
않고 `DELETED_AT`을 기록합니다.

| 상태 | 코드 | 조건 |
| --- | --- | --- |
| `403` | `SPOT_FORBIDDEN` | 다른 사용자의 스팟 삭제 시도 |
| `404` | `SPOT_NOT_FOUND` | 스팟이 없거나 이미 삭제됨 |

## 6. 좋아요·북마크

`type`은 `like` 또는 `bookmark`입니다.

```http
PUT /api/v1/spots/{spotId}/reactions/{type}
DELETE /api/v1/spots/{spotId}/reactions/{type}
X-User-No: 1
```

PUT과 DELETE는 멱등입니다. 같은 요청을 반복해도 중복 반응이 생기지 않습니다.
승인된 스팟에만 반응할 수 있습니다.

```json
{
  "spotId": 7,
  "type": "like",
  "active": true,
  "likeCount": 12
}
```

## 7. 댓글

### 댓글 목록

`GET /api/v1/spots/{spotId}/comments?limit=50`

승인된 댓글만 공개합니다. `X-User-No`를 전달하면 해당 사용자가 작성한 검수
대기·반려 댓글도 함께 반환합니다.

### 댓글 등록

```http
POST /api/v1/spots/{spotId}/comments
X-User-No: 1
Content-Type: application/json
```

```json
{
  "content": "야경이 정말 좋아요."
}
```

댓글은 1~1,000자이며 신규 댓글은 검수 대기 상태입니다.

```json
{
  "id": 4,
  "spotId": 7,
  "userNo": 1,
  "authorNickname": "lotus_traveler",
  "content": "야경이 정말 좋아요.",
  "moderationStatus": 0,
  "isOwner": true,
  "createdAt": "2026-07-29T10:35:00"
}
```

## 8. 관리자 검수

```http
PATCH /api/v1/admin/{targetType}/{targetId}/moderation
X-Admin-Key: {ADMIN_API_KEY}
Content-Type: application/json
```

- `targetType`: `spot` 또는 `comment`
- `status`: `1`(승인) 또는 `2`(반려)

```json
{
  "status": 1
}
```

```json
{
  "targetType": "spot",
  "targetId": 7,
  "status": 1
}
```

검수 결과는 `MODERATION_LOG`에도 기록합니다.

## 프론트 연동 순서

1. 장소 입력을 300~400ms debounce하여 검색하거나 `내 주변 장소`를 누릅니다.
2. 주변 검색은 브라우저에서 현재 위치를 한 번만 받아 API에 전달합니다.
3. 사용자가 `provider + id` 기준의 검색 결과 하나를 선택합니다.
4. 사진이 있으면 이미지 업로드 API를 먼저 호출합니다.
5. 선택한 장소, 한줄평, `photoUrl`로 스팟을 등록합니다.
6. 등록 직후 내 목록을 갱신합니다.
7. 승인된 공개 목록에서 좋아요·북마크·댓글 기능을 제공합니다.
8. 본인 게시물에만 삭제 버튼을 표시합니다.

## 외부 API 참고

- [Kakao Local API](https://developers.kakao.com/docs/ko/local/dev-guide)
- [Naver 지역 검색 API](https://developers.naver.com/docs/serviceapi/search/local/)
