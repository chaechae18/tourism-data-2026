-- Map-tab owned schema
-- 목적:
-- 1. frontend/lib/app-data.js 의 map 데이터 shape(id, name, quest, distance, latitude, longitude, icon, docent)에 맞는 장소 마스터 정의
-- 2. SNS 전용 spot 테이블과 분리된 실제 map 탭 전용 테이블 정의
-- 3. 공통 사용자 테이블(users)은 재정의하지 않고 참조만 사용

create table map_places (
    map_place_id bigint primary key,
    place_code varchar(50) not null unique,
    place_name varchar(150) not null,
    quest text not null,
    display_distance varchar(20),
    latitude decimal(9, 6) not null,
    longitude decimal(9, 6) not null,
    marker_icon_type varchar(30) not null,
    has_docent boolean not null default false,
    verification_radius_m integer,
    external_url varchar(1000),
    opening_hours varchar(255),
    is_active boolean not null default true,
    created_at timestamp,
    updated_at timestamp
);

create table map_place_docent_contents (
    docent_content_id bigint primary key,
    map_place_id bigint not null references map_places(map_place_id),
    language_code varchar(10),
    title varchar(200) not null,
    content text not null,
    audio_url varchar(1000),
    sort_order integer,
    is_active boolean not null default true,
    created_at timestamp,
    updated_at timestamp
);

create table map_place_missions (
    map_place_mission_id bigint primary key,
    map_place_id bigint not null references map_places(map_place_id),
    mission_code varchar(50) not null unique,
    mission_title varchar(200) not null,
    mission_description text,
    mission_type varchar(30),
    is_active boolean not null default true,
    created_at timestamp,
    updated_at timestamp
);

create table user_map_place_status (
    user_map_place_status_id bigint primary key,
    user_id bigint not null references users(user_id),
    map_place_id bigint not null references map_places(map_place_id),
    visit_status varchar(20),
    is_verified boolean not null default false,
    first_visited_at timestamp,
    last_visited_at timestamp,
    completed_at timestamp
);

create table user_map_visit_records (
    map_visit_id bigint primary key,
    user_id bigint not null references users(user_id),
    map_place_id bigint not null references map_places(map_place_id),
    latitude decimal(9, 6) not null,
    longitude decimal(9, 6) not null,
    distance_m integer,
    is_verified boolean not null default false,
    source varchar(20),
    visited_at timestamp
);

-- 연결 기준
-- 1. map 탭은 map_places 를 기준으로 동작
-- 2. SNS 탭의 spot 테이블은 별도 유지
-- 3. 필요하면 SNS spot 테이블에 map_place_id nullable FK를 추가해 "어느 map 장소와 연관된 게시물인지"만 연결
-- 4. 방문기록 성격의 공통 테이블을 따로 둘 경우 spot_id 가 아니라 map_place_id 를 참조하는 것이 맞음
