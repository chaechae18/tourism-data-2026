# 개발 환경 실행 안내

> 현재 Docker 기본 구성은 `backend/.env`의 운영 DB에 연결합니다.
> 실행은 [Docker 운영 DB 연결 안내](docker.md)를 따르세요.
> 아래 로컬 MySQL·자동 적재 설명은 이전 로컬 환경 기준이며 현재 기본 실행에는 적용되지 않습니다.

서비스 소개와 GIF 데모는 [프로젝트 소개](../README.md)를 참고해 주세요.

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
| `OPENAI_API_KEY` | 공식 외국어 API에 없는 장소·필드를 번역할 수 없음 |
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

## 5단계 — 데이터 자동 적재

`docker compose up -d --build` 하면 `sync` 서비스가 DB를 확인합니다. 관광지 또는 영·일·중
번역이 비어 있으면 관광공사 API에서 경주 장소와 축제를 받아 자동 적재합니다. 이미 필요한
데이터가 있으면 최초 적재를 건너뛰므로 같은 데이터를 여러 번 넣지 않습니다.
첫 적재에는 몇 분이 걸리며 `backend/.env` 의 `TOURAPI_SERVICE_KEY`와
`OPENAI_API_KEY`가 채워져 있어야 합니다. 공식 외국어 API에 없는 값만 OpenAI API로 번역하고,
결과와 원문 변경 확인용 해시는 DB에 저장합니다.

이후로는 `sync` 서비스가 **주 1회 알아서 돌면서**, 공사 쪽에서
수정된 건만 상세를 다시 받습니다(목록의 `modifiedtime` 을 DB와 대조). 바뀐 게 없는 주에는
API 호출이 목록 조회 십여 번으로 끝납니다. 간격은 `backend/.env` 의 `SYNC_INTERVAL_DAYS` 로
바꿉니다.

장소 적재와 번역 후에는 GPT로 캐릭터별 적합도를 자동 채점합니다. 컨테이너 시작 시에도
기존 DB의 누락·변경 점수를 확인하므로 별도 채점 명령은 필요 없습니다. 좌표와 설명이 있는
장소만 채점하며, 내용이 같으면 API 호출을 건너뛰고 수동 점수는 보존합니다.
채점 실패 시 완료 시각을 갱신하지 않고 1시간 뒤 재시도합니다. `OPENAI_API_KEY`가 필요하며,
신규·변경 장소의 번역과 채점에는 API 사용 요금이 발생합니다.

```bash
docker compose logs -f sync    # 다음 동기화까지 얼마 남았는지 / 지난 회차 결과
```

상태 볼륨이 남아 있어도 DB가 비어 있으면 즉시 적재하고, DB는 완성됐지만 상태 볼륨만 없으면
API를 다시 호출하지 않고 주기만 기록합니다.

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

DB 구조를 바꾸는 방법은 [backend/README.md](../backend/README.md)의 "DB 마이그레이션"을 보세요.

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
