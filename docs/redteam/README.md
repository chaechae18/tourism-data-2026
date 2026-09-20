# Play Gyeongju 레드팀

금융 프로젝트의 [시나리오 카탈로그](https://github.com/yeony-park/finance-ai-challenge-2026/blob/integration/src/lib/spine/redteam/scenarios.ts)와 [실행·판정·보고서 구조](https://github.com/yeony-park/finance-ai-challenge-2026/blob/integration/src/lib/spine/redteam/runner.ts)를 참고했습니다. 이 서비스에서는 로그인, 사용자별 데이터 접근, 방문 보상, 업로드를 검증합니다.

## 실행

Docker가 실행 중이고 `backend/.venv`에 `backend/requirements-dev.txt`가 설치되어 있어야 합니다. 저장소 루트에서 실행합니다.

```sh
backend/.venv/bin/python backend/scripts/redteam.py
```

- 임시 `mysql:8.4` 컨테이너를 생성하고 임의의 **127.0.0.1 전용 포트**에 연결합니다.
- DB·세션 비밀키는 실행마다 임의 생성합니다. 운영 `.env` 로딩과 환경변수 상속을 차단합니다.
- `play_gyeongju_redteam` DB에 가짜 계정·장소만 생성합니다. 테스트가 테이블을 초기화하므로 별도 DB 주소를 받는 옵션은 제공하지 않습니다.
- 테스트 소켓 연결은 임시 MySQL의 주소·포트만 허용합니다. 번역 API는 가짜 제공자로 교체하며 OAuth 토큰 교환은 호출하지 않습니다.
- 정상 종료·실패 시 자신의 컨테이너와 임시 업로드 파일을 정리합니다. 강제 프로세스 종료(SIGKILL 등) 시 남은 `gyeongju-redteam-*` 컨테이너는 수동 정리가 필요할 수 있습니다.
- 결과는 [report.md](report.md), [report.json](report.json)에 저장합니다. 소스·테스트 해시와 미커밋 변경 여부도 기록합니다.

종료 코드 **0**은 전체 통과, **1**은 보안 기대 조건 미충족, **2**는 실행 오류·누락·스킵입니다. 실패를 `xfail` 처리하거나 취약한 응답을 성공 기대값으로 바꾸지 않습니다.

## 구성

- [실행기](../../backend/scripts/redteam.py): DB 격리, 실행, 결과 집계, 정리
- [시나리오](../../backend/tests/redteam/scenarios.py): 공격 요청, 기대 조건, 관찰값
- [실행 보호 장치](../../backend/tests/redteam/conftest.py): 네트워크 차단, 가짜 설정, 실행 경로 확인
- [검토 결과와 수정 우선순위](review.md)
- [의존성 검사 결과](dependency-audit.json)

일반 `pytest`는 `norecursedirs = redteam`으로 이 디렉터리를 제외합니다. 레드팀 실행기는 시나리오 파일을 명시해 실행합니다. 기능 회귀 테스트가 통과해도 레드팀에 실패가 남을 수 있으며, 두 결과는 별도로 확인해야 합니다. 수정 후에는 일반 테스트와 레드팀을 모두 재실행합니다.

각 테스트의 `redteam(위험도, 기대조건)` 메타데이터와 pytest 매개변수가 시나리오 카탈로그 역할을 합니다. 새로운 보안 요구를 추가할 때 버전도 갱신합니다. `control`은 정상 기능과 검사 환경 자체가 작동하는지 확인하는 대조군입니다.

## 의존성 검사

의존성 권고 조회는 공개 패키지 레지스트리에 네트워크 요청이 필요하므로 격리된 공격 테스트와 별도로 실행합니다. 운영 자격 증명은 필요하지 않습니다.

```sh
cd frontend
npm audit --omit=dev --json
```

Python은 배포 대상과 같은 환경에서 설치된 패키지 버전을 고정한 파일을 만든 뒤 `pip-audit --no-deps --disable-pip -r <파일> --format=json`으로 검사합니다. 이번 결과는 로컬 백엔드 가상환경 32개 패키지 기준입니다. 재배포 이미지와 버전이 다르면 재검사가 필요합니다.

## 범위와 한계

보고서는 **실행 당시 로컬 미커밋 코드**에 대한 결과입니다. 운영 사이트 공격이나 실제 사용자 데이터 조작은 하지 않습니다. ASGI HTTP 경로와 실제 임시 MySQL을 사용하지만 실제 브라우저의 쿠키 정책·프록시·Vercel 방화벽까지 검증한 것은 아닙니다.

실제 LLM에 대한 프롬프트 인젝션, 외부 OAuth 계정 로그인, 부하 공격, 전체 Git 이력 비밀키 검사, 배포 환경변수·인프라 권한 검토는 포함하지 않습니다. 번역 mock 통과는 실제 AI 모델의 안전성 입증이 아닙니다. 앱 레드팀이 0개 실패가 되어도 정적 검토·의존성 권고의 미해결 항목은 [review.md](review.md)에서 별도로 확인합니다.
