# 동경이 GLB 메모리 캐시

`GlbMemoryCache`는 같은 URL의 GLB/GLTF를 여러 컴포넌트가 요청할 때 네트워크
요청과 파싱을 한 번만 수행합니다. `acquire()`는 캐시된 Promise와 해제 함수를
반환하며, 사용이 끝난 컴포넌트는 반드시 `release()`를 호출해야 합니다.

참조 수가 0인 모델만 `evict()` 또는 `clearUnused()`로 제거할 수 있습니다. 제거할
때 geometry, material, texture의 `dispose()`를 호출해 GPU 메모리도 함께 반환합니다.
현재 동경이는 절차형 기본 모델 위에 아이템 GLB를 장착합니다. 기본 아이템은
`frontend/public/models/donggyeong/items`에 있으며, `MyDGTab`이 현재 착용한
아이템의 `modelUrl`을 `Donggyeong3D`에 전달합니다.

```js
const handle = await donggyeongModelCache.acquire(item.modelUrl);
scene.add(handle.asset.scene.clone(true));

// 컴포넌트 정리 시
handle.release();
await donggyeongModelCache.clearUnused();
```

아이템 GLB 5종은 Blender에서 다음 명령으로 다시 생성할 수 있습니다.

```bash
blender --background --python assets/blender/create_donggyeong_items.py
```

각 GLB는 동경이 루트와 같은 Three.js 좌표를 사용해 장착 위치가 포함된 상태로
내보냅니다. 인벤토리 슬롯에는 모자 1종, 장식 1종, 의상 1종, 손 아이템 2종이
등록되어 있습니다.

지원 확장자는 `ModelAssetFile`에서 `.glb`, `.gltf`로 제한합니다. URL의 query와
fragment는 확장자 판정에서 제외합니다.
