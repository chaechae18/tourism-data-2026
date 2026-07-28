# Play Gyeongju Backend

FastAPI와 SQLite를 사용하는 로컬 API 서버입니다.

## 실행

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

`.env`의 `KAKAO_REST_API_KEY`에 Kakao Developers에서 발급한 REST API
키를 입력한 뒤 서버를 실행합니다.

```bash
uvicorn app.main:app --reload --port 8000
```

첫 실행 시 `data/play_gyeongju.db`가 생성되고 SQLite 스키마와 로컬
개발용 사용자(`X-User-No: 1`)가 준비됩니다.

- API 문서: `http://localhost:8000/docs`
- 상태 확인: `http://localhost:8000/health`
- 상세 명세: [`../docs/spot-api.md`](../docs/spot-api.md)

## 테스트

```bash
pytest
```
