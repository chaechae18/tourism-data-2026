# 동경이 GLB

기본형 `base.glb`와 여섯 역할의 아이템 30개를 제공한다. 파일 경로·SHA-256·가림 목록은 `manifest.json`을 기준으로 사용한다. 역할별 다섯 슬롯은 `hat`, `hand`, `top`, `bottom`, `effect`이며 다른 역할의 아이템도 섞어 착용할 수 있다.

## 앱 연결

`components/donggyeong/Donggyeong3D.jsx`에서 기본형과 선택한 아이템을 렌더링한다. 임시 로그인 우회·전체 아이템 지급·개발용 미리보기 경로는 포함하지 않는다. 보유 아이템은 `MyDGTab`의 `availableItems`로 전달하는 구조이며, 현재 서버는 전체 아이템 카탈로그만 제공하므로 이 PR에서는 보유 목록을 임의로 채우지 않는다. 새 5부위 아이템의 실제 획득·보유 목록 연결은 별도 작업이다. 백엔드 코드는 변경하지 않는다.

## 렌더링 규약

- Y 위, +Z 정면, 미터 단위, 발 사이 지면이 원점이다. 기본형과 아이템에 추가 위치/배율을 적용하지 않는다.
- `avatar.js`의 `createDonggyeong(baseAsset)`로 구성하고 기본형의 뼈를 이름으로 연결한다. 스킨 복제는 SkeletonUtils를 사용한다.
- `Idle`은 반복, `Select`는 인사이며 기본형 AnimationMixer 하나가 동작을 담당한다.
- `equip(slot, asset)`, `remove(slot)` 후 `setMasks(entries)`로 착용한 아이템 전체의 가림 목록을 적용한다.
- 배경 아이템은 `avatar.background`를 `scene.background`에 연결한다. 뷰어가 화면 비율에 맞게 크롭한다.
- `click-greeting.js`는 캐릭터 클릭만 인사로 처리하며 드래그·핀치·배경 클릭을 제외한다.
- URL에 manifest SHA를 붙여 캐시를 갱신한다. 선택한 아이템만 로드한다. 기본 GLB는 약 24 MiB이며 모바일 전송·렌더링 비용 최적화는 후속 작업이다.
- 텍스처와 버퍼는 GLB에 포함된다. 별도의 Draco/KTX 디코더는 필요 없다.

기존 아이템 GLB는 기존 화면과의 호환을 위해 유지한다. Blender 제작 원본과 대량 검수 이미지는 이 런타임 에셋 변경에 포함하지 않는다.
