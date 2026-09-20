# 동경이 완성 착장 4컷

- 결과: donggyeong-four-roles.png (2400 × 2400 PNG)
- 순서: 왼쪽 위 왕, 오른쪽 위 궁녀, 왼쪽 아래 무사, 오른쪽 아래 승려.
- 각 역할의 hat, top, bottom, hand, effect 5개 아이템을 모두 착용.
- 기존 Donggyeong3D.jsx 및 role-outfit.js를 직접 사용해 브라우저에서 렌더링한 뒤 drawTo로 PNG 저장.
- 기본 모델 1개와 아이템 20개 모두 manifest의 SHA-256과 일치함을 검증. source-assets.json 참고.
- 원본 앱 코드 및 에셋 변경 없음. 캐릭터와 의상은 AI로 다시 그리지 않음.
- 재실행: python3 output/donggyeong-four-roles/server.py 실행 후 http://127.0.0.1:4318/ 접속.
