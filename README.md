# Play Gyeongju

경주 여행 앱의 모노레포 작업공간입니다.

```text
frontend/  Next.js + React + Tailwind CSS
backend/   FastAPI + MySQL API 서버
```

---

# 처음 시작하는 사람용 가이드

**필요한 것**: Docker Desktop, git. (프론트를 도커 없이 돌리려면 Node 22)

## 1단계 — 코드 받기

```bash
git clone <저장소 주소>
cd tourism-data-2026
```

## 2단계 — 환경파일 만들기 ⚠️ 이걸 빼먹으면 안 됩니다

`.env` 파일들은 보안 때문에 git에 올라가지 않습니다. **직접 만들어야 합니다.**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

그다음 `backend/.env`를 열어 **API 키를 채웁니다.** 키는 팀 내부에서 따로 전달받으세요.

| 키 | 없으면 |
|---|---|
| `TOURAPI_SERVICE_KEY` | 관광 데이터를 새로 받아올 수 없음 |
| `GOOGLE_TTS_API_KEY` | 도슨트 음성 재생 불가 |
| `KAKAO_REST_API_KEY`, `NAVER_CLIENT_*` | 장소 검색 기능 불가 |

MySQL 계정은 비워 둬도 기본값으로 동작하니 건드리지 않아도 됩니다.

## 3단계 — 도커 실행

```bash
docker compose up --build
```

MySQL + 백엔드 + 프론트엔드가 한 번에 뜹니다. 첫 실행은 이미지를 만드느라 몇 분 걸립니다.

- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:8001`
- API 문서: `http://localhost:8001/docs`

> 프론트를 `npm run dev`로 직접 돌리고 싶으면 `docker compose up -d --build db backend`로
> 백엔드만 띄우세요. **도커 프론트와 로컬 `npm run dev`를 동시에 쓰면 3000 포트가 충돌합니다.**

## 4단계 — 잘 떴는지 확인

```bash
docker compose ps                                    # 세 개 다 healthy 인지
curl http://localhost:8001/health                    # {"status":"ok"} 가 나와야 정상
```

**DB 구조(테이블)는 백엔드가 뜰 때 자동으로 만들어집니다.** 따로 칠 명령어가 없습니다.

## 5단계 — 데이터 채우기

DB 구조는 자동으로 준비되지만 **관광지 데이터는 비어 있습니다.** 아래 명령으로 채웁니다.

```bash
docker compose exec backend python sync_tourapi.py
```

관광공사 API에서 경주 장소와 축제를 받아 `PLACE` / `FESTIVAL` 에 저장합니다. 몇 분 걸립니다.
`backend/.env` 의 `TOURAPI_SERVICE_KEY` 가 채워져 있어야 합니다.

> ⚠️ **팀에서 인증키 하나를 같이 쓰고 있다면 주의하세요.** 한 번 돌릴 때 API를 500회 넘게
> 호출해서(장소마다 상세 조회 2회), 여러 명이 같은 날 각자 돌리면 일일 한도가 바닥납니다.
> 각자 공공데이터포털에서 키를 발급받는 게 가장 깔끔합니다. 키를 못 받는 상황이면
> 이미 채워 둔 사람이 덤프를 떠서 넘겨주세요.
>
> ```bash
> # 넘겨주는 쪽
> docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" play_gyeongju' > dump.sql
> # 받는 쪽
> docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" play_gyeongju' < dump.sql
> ```

확인:

```bash
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" play_gyeongju -e "SELECT COUNT(*) FROM PLACE;"'
```

## 6단계 — 접속

`http://localhost:3000` 으로 들어갑니다. **반드시 3000번입니다** (백엔드가 3000에서 오는 요청만 허용).

---

# 코드를 받은 뒤 (매번)

```bash
git pull
docker compose up -d --build       # 재빌드 = 새 라이브러리 설치 + DB 구조 자동 갱신
```

**`--build`를 빼먹으면** 새로 추가된 라이브러리나 DB 변경이 반영되지 않아 오류가 납니다.

DB 구조를 바꾸는 방법은 [backend/README.md](./backend/README.md)의 "DB 마이그레이션"을 보세요.

---

# 자주 나는 오류

### 화면에 "코스를 불러오지 못해 샘플 장소를 보여주고 있어요"

붙어 있는 뒷문장으로 원인이 갈립니다.

| 뒷문장 | 원인 | 해결 |
|---|---|---|
| **서버에 연결하지 못했습니다** | 백엔드가 안 떠 있거나 3000이 아닌 포트로 접속 중 | `docker compose ps` 확인 → 3000으로 접속 |
| **코스를 불러오지 못했습니다** | 백엔드는 살아 있는데 500 에러 | `docker compose logs --tail 50 backend` 로 원인 확인 |
| 배너 없이 샘플 장소만 보임 | 정상. **DB에 데이터가 없는 것** | 5단계 데이터 채우기 |

### 콘솔에 CORS 오류가 뜬다

3000으로 접속했는데도 CORS 오류가 뜬다면 **진짜 원인은 CORS가 아니라 백엔드 500 에러**입니다.
FastAPI는 처리되지 않은 오류가 나면 CORS 헤더를 못 붙여서, 브라우저가 CORS 문제로 오해합니다.
진짜 원인은 여기서 확인하세요.

```bash
docker compose logs --tail 50 backend
```

### 3000 대신 3001로 뜬다

이미 다른 dev 서버가 3000을 쓰고 있다는 뜻입니다. 정리하고 하나만 띄우세요.

```bash
pkill -f "next dev"
```

### 프론트가 Internal Server Error를 뱉는다

`npm start`를 쓰지 마세요. 그건 **빌드 결과물을 서빙하는 명령**이라 개발 중에는 실패합니다.

```bash
cd frontend && npm run dev      # 개발할 땐 이것
```

그래도 안 되면 `frontend/.next` 폴더를 지우고 다시 띄우세요.

### 3306 포트 충돌 (`port is already allocated`)

컴퓨터에 MySQL이 이미 깔려 있는 경우입니다. 그 MySQL을 끄거나, 루트에 `.env`를 만들어
`MYSQL_PORT=3307`처럼 다른 포트를 지정하세요.

---

# 종료 / 초기화

```bash
docker compose down          # 종료 (DB 데이터는 보존됨)
docker compose down -v       # ⚠️ DB 데이터까지 전부 삭제
```

`-v`는 되돌릴 수 없습니다. 데이터를 다시 채워야 하니 꼭 필요할 때만 쓰세요.
