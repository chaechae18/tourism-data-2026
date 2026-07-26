# 홈 API 직접 확인 체크리스트

`python manage.py seed_demo` 로 표본 데이터를 넣은 뒤, 서버를 띄우고 아래를
하나씩 확인하면 됩니다. **응답 어디에도 `[안 보여야 함]` 이 나오면 안 됩니다.**

```bash
python manage.py seed_demo
python manage.py runserver 8123
```

---

## 1. GET /api/main/banners

```bash
curl 'http://localhost:8123/api/main/banners'
```

넣은 배너는 5건인데 **2건만** 나와야 합니다.

- [ ] `경주의 밤` 이 첫 번째 (SORT=0)
- [ ] `벚꽃 시즌` 이 두 번째 (SORT=1, 시작/종료일이 비어 있어도 노출)
- [ ] 기간 지난 배너가 안 보인다
- [ ] 삭제된 배너(`IS_TRASH=1`)가 안 보인다
- [ ] 비노출 배너(`IS_DISPLAY=0`)가 안 보인다
- [ ] 필드가 `img`, `title`, `sub_title`, `link` 네 개뿐이다

## 2. GET /api/main/popup

```bash
curl 'http://localhost:8123/api/main/popup'
curl 'http://localhost:8123/api/main/popup?lang=en'
curl 'http://localhost:8123/api/main/popup?lang=fr'
curl -H 'Accept-Language: en-US,en;q=0.9' 'http://localhost:8123/api/main/popup'
```

- [ ] 기본(`lang` 없음)은 `시스템 점검 안내`
- [ ] `?lang=en` 은 `Scheduled maintenance`
- [ ] `?lang=fr` (지원 안 하는 언어)도 **에러 없이 200**, 한국어로 나온다
- [ ] `Accept-Language` 헤더만 줘도 영어로 나온다
- [ ] 언어와 무관하게 `img`, `link` 는 항상 원본 값이다
- [ ] 비노출 팝업이 안 보인다

## 3. GET /api/main/festivals

```bash
curl 'http://localhost:8123/api/main/festivals'
curl 'http://localhost:8123/api/main/festivals?lang=en'
```

넣은 축제는 3건인데 **2건만** 나와야 합니다.

- [ ] 끝난 축제가 안 보인다
- [ ] 시작일이 빠른 `신라문화제` 가 먼저 나온다
- [ ] `?lang=en` 에서 `신라문화제` → `Silla Cultural Festival` 로 바뀐다
- [ ] **같은 응답 안에서** `번역 없는 축제` 는 한국어 그대로 나온다
      (축제마다 따로 폴백된다는 뜻입니다)
- [ ] `start_date`, `end_date`, `img`, `url` 은 언어와 무관하게 동일하다

## 4. GET /api/main/places/recommended

```bash
curl 'http://localhost:8123/api/main/places/recommended'
curl 'http://localhost:8123/api/main/places/recommended?lang=en'
```

넣은 관광지는 5건인데 **3건만** 나와야 합니다.

- [ ] 순서가 `불국사`(1520) → `첨성대`(980) → `좌표 깨진 곳`(5)
- [ ] 조회수가 99999인 `추천 아님` 이 안 보인다 (`IS_RECOMMENDED=0`)
- [ ] 조회수가 88888인 `검수 대기 맛집` 이 안 보인다 (`IS_DISPLAY=0`)
      — 추천이면서 조회수 2위인데도 빠지는 게 정상입니다
- [ ] `불국사` 의 `latitude` 가 `"35.790102"` 가 아니라 **따옴표 없는 숫자** `35.790102`
- [ ] `좌표 깨진 곳` 의 `latitude`, `longitude` 가 `null`
- [ ] `admission_fee` 가 없는 곳은 `null`
- [ ] `?lang=en` 에서 `불국사` → `Bulguksa Temple`, 입장료 → `Adults KRW 6,000`,
      주소 → `385 Bulguk-ro, Gyeongju-si` 로 바뀐다
- [ ] 같은 응답에서 `첨성대` 는 번역이 없어 한국어 그대로다
- [ ] 언어를 바꿔도 `latitude`/`longitude` 는 동일하다 (좌표는 번역 대상이 아님)

---

## 5. 프론트엔드에서 부르기

프론트는 `NEXT_PUBLIC_API_BASE_URL` 을 보고 있으니, 8123 포트로 띄웠다면
`frontend/.env.local` 을 잠깐 맞춰주면 됩니다.

```bash
curl -s -D - -o /dev/null -X OPTIONS \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: GET' \
  'http://localhost:8123/api/main/banners' | grep -i access-control-allow-origin
```

- [ ] `access-control-allow-origin: http://localhost:3000` 가 나온다
      (안 나오면 브라우저에서 CORS 에러가 납니다)

---

## 참고: 포트 8000

이 PC 의 8000 포트는 다른 파이썬 프로세스가 이미 쓰고 있습니다. 그대로
`runserver` 를 하면 그쪽 서버가 응답해서 `{"detail": "Not Found"}` 만 나옵니다.
8123 처럼 비어 있는 포트를 쓰세요.

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN   # 누가 쓰고 있는지 확인
```
