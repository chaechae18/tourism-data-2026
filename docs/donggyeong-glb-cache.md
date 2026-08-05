# 동경이 GLB 메모리 캐시

`GlbMemoryCache`는 같은 URL의 GLB/GLTF를 여러 컴포넌트가 요청할 때 네트워크
요청과 파싱을 한 번만 수행합니다. `acquire()`는 캐시된 Promise와 해제 함수를
반환하며, 사용이 끝난 컴포넌트는 반드시 `release()`를 호출해야 합니다.

참조 수가 0인 모델만 `evict()` 또는 `clearUnused()`로 제거할 수 있습니다. 제거할
때 geometry, material, texture의 `dispose()`를 호출해 GPU 메모리도 함께 반환합니다.
현재 동경이는 절차형 모델을 사용하므로 아이템 GLB가 준비되면 이 캐시를 장착 슬롯의
로더에서 사용합니다.

```js
const handle = await donggyeongModelCache.acquire(item.modelUrl);
scene.add(handle.asset.scene.clone(true));

// 컴포넌트 정리 시
handle.release();
await donggyeongModelCache.clearUnused();
```

지원 확장자는 `ModelAssetFile`에서 `.glb`, `.gltf`로 제한합니다. URL의 query와
fragment는 확장자 판정에서 제외합니다.
