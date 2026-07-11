# Map 탭 DB 스키마 설명

이 문서는 [map-tab-ddl.sql](/abs/path/C:/tourism-data-2026/docs/DB/map-tab-ddl.sql) 기준으로, frontend의 map 탭이 사용하는 데이터 구조를 설명합니다.

핵심 원칙은 아래와 같습니다.

- map 탭 실사용 장소 데이터는 `map_places`를 기준으로 관리합니다.
- SNS 전용 `spot` 테이블과 map 탭 장소 테이블은 분리합니다.
- 공통 사용자 테이블 `users`는 별도 소유이며, map 탭 테이블은 이를 참조만 합니다.

## 1. frontend 기준 최종 데이터 포맷

현재 frontend map 탭은 최종적으로 아래 shape의 배열을 소비하는 구조입니다.

| 필드명 | 타입 | 설명 | DDL 매핑 |
| --- | --- | --- | --- |
| id | string | 프론트에서 장소를 식별하는 값 | map_places.place_code |
| name | string | 지도 마커와 상세 카드에 보여주는 장소명 | map_places.place_name |
| quest | string | 사용자에게 보여줄 퀘스트/행동 유도 문구 | map_places.quest |
| distance | string | 화면에 보여줄 거리 문자열 | map_places.display_distance |
| latitude | number | 장소 위도 | map_places.latitude |
| longitude | number | 장소 경도 | map_places.longitude |
| icon | string | 지도 마커 아이콘 타입 | map_places.marker_icon_type |
| docent | boolean | 도슨트 제공 여부 | map_places.has_docent |

예시:

```js
{
  id: "cheomseongdae_demo",
  name: "첨성대 (데모)",
  quest: "첨성대 근처로 가보세요 (데모)",
  distance: "280m",
  latitude: 35.8347,
  longitude: 129.2191,
  icon: "tower",
  docent: true
}
```

## 2. map_places

테이블 설명: map 탭의 실제 장소 마스터 테이블입니다. frontend가 직접 소비하는 핵심 데이터를 담습니다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| map_place_id | bigint | map 장소 고유 ID입니다. 기본키입니다. |
| place_code | varchar(50) | frontend의 `id`로 매핑할 수 있는 고유 코드입니다. |
| place_name | varchar(150) | 장소명입니다. frontend의 `name`에 대응합니다. |
| quest | text | 사용자에게 보여줄 퀘스트 문구입니다. frontend의 `quest`에 대응합니다. |
| display_distance | varchar(20) | 화면에 표시할 거리 문자열입니다. 예: `280m`, `1.1km` |
| latitude | decimal(9, 6) | 장소 위도입니다. |
| longitude | decimal(9, 6) | 장소 경도입니다. |
| marker_icon_type | varchar(30) | 마커 아이콘 타입입니다. frontend의 `icon`에 대응합니다. |
| has_docent | boolean | 도슨트 제공 여부입니다. frontend의 `docent`에 대응합니다. |
| verification_radius_m | integer | 위치 인증 반경(미터)입니다. |
| external_url | varchar(1000) | 외부 상세 페이지 URL입니다. |
| opening_hours | varchar(255) | 운영 시간 문자열입니다. |
| is_active | boolean | 활성화 여부입니다. |
| created_at | timestamp | 생성 일시입니다. |
| updated_at | timestamp | 수정 일시입니다. |

## 3. map_place_docent_contents

테이블 설명: 장소별 도슨트 상세 콘텐츠를 저장하는 테이블입니다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| docent_content_id | bigint | 도슨트 콘텐츠 고유 ID입니다. 기본키입니다. |
| map_place_id | bigint | 연결된 map 장소 ID입니다. `map_places.map_place_id`를 참조합니다. |
| language_code | varchar(10) | 언어 코드입니다. 예: `ko`, `en`, `zh`, `ja` |
| title | varchar(200) | 도슨트 콘텐츠 제목입니다. |
| content | text | 도슨트 본문입니다. |
| audio_url | varchar(1000) | 도슨트 오디오 파일 URL입니다. |
| sort_order | integer | 노출 순서입니다. |
| is_active | boolean | 활성화 여부입니다. |
| created_at | timestamp | 생성 일시입니다. |
| updated_at | timestamp | 수정 일시입니다. |

## 4. map_place_missions

테이블 설명: map 장소별 추가 미션을 확장 관리하기 위한 테이블입니다. 현재 frontend는 `map_places.quest`를 바로 쓰지만, 추후 미션 구조를 세분화할 때 사용할 수 있습니다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| map_place_mission_id | bigint | 장소 미션 고유 ID입니다. 기본키입니다. |
| map_place_id | bigint | 연결된 map 장소 ID입니다. `map_places.map_place_id`를 참조합니다. |
| mission_code | varchar(50) | 미션 고유 코드입니다. |
| mission_title | varchar(200) | 미션 제목입니다. |
| mission_description | text | 미션 설명입니다. |
| mission_type | varchar(30) | 미션 유형입니다. |
| is_active | boolean | 활성화 여부입니다. |
| created_at | timestamp | 생성 일시입니다. |
| updated_at | timestamp | 수정 일시입니다. |

## 5. user_map_place_status

테이블 설명: 사용자별 map 장소 방문 상태와 완료 상태를 저장하는 테이블입니다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| user_map_place_status_id | bigint | 사용자-장소 상태 고유 ID입니다. 기본키입니다. |
| user_id | bigint | 사용자 ID입니다. `users.user_id`를 참조합니다. |
| map_place_id | bigint | map 장소 ID입니다. `map_places.map_place_id`를 참조합니다. |
| visit_status | varchar(20) | 방문 상태 값입니다. 예: `visited`, `in_progress`, `completed` |
| is_verified | boolean | 위치 인증 여부입니다. |
| first_visited_at | timestamp | 최초 방문 일시입니다. |
| last_visited_at | timestamp | 마지막 방문 일시입니다. |
| completed_at | timestamp | 완료 일시입니다. |

## 6. user_map_visit_records

테이블 설명: 사용자 방문 로그와 위치 인증 기록을 저장하는 테이블입니다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| map_visit_id | bigint | map 방문 기록 고유 ID입니다. 기본키입니다. |
| user_id | bigint | 사용자 ID입니다. `users.user_id`를 참조합니다. |
| map_place_id | bigint | map 장소 ID입니다. `map_places.map_place_id`를 참조합니다. |
| latitude | decimal(9, 6) | 방문 시점 위도입니다. |
| longitude | decimal(9, 6) | 방문 시점 경도입니다. |
| distance_m | integer | 장소 기준점과의 거리(미터)입니다. |
| is_verified | boolean | 위치 인증 성공 여부입니다. |
| source | varchar(20) | 기록 생성 출처입니다. 예: `gps`, `manual` |
| visited_at | timestamp | 방문 기록 시각입니다. |

## 7. 관계 요약

| 기준 테이블 | 연결 컬럼 | 참조 대상 | 설명 |
| --- | --- | --- | --- |
| map_place_docent_contents | map_place_id | map_places.map_place_id | 장소별 도슨트 콘텐츠 연결 |
| map_place_missions | map_place_id | map_places.map_place_id | 장소별 미션 연결 |
| user_map_place_status | user_id | users.user_id | 사용자 상태 연결 |
| user_map_place_status | map_place_id | map_places.map_place_id | 사용자-장소 상태 연결 |
| user_map_visit_records | user_id | users.user_id | 사용자 방문 로그 연결 |
| user_map_visit_records | map_place_id | map_places.map_place_id | 사용자-장소 방문 로그 연결 |

## 8. 운영 기준

- map 탭은 `map_places`를 기준으로 동작합니다.
- SNS 탭의 `spot` 테이블은 별도 유지합니다.
- SNS 게시물과 map 장소를 연결하려면 SNS 쪽에 `map_place_id` nullable FK를 추가하는 방식이 적절합니다.
- 방문기록 성격의 공통 테이블을 별도로 둘 경우 `spot_id`가 아니라 `map_place_id`를 참조하는 것이 맞습니다.
