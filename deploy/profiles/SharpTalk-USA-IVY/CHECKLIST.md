# SharpTalk-USA-IVY — 세팅 체크리스트

가이드: `docs/guide/GUIDE-260913-SharpTalk-USA-IVY-Staging.md` (절 번호는 그 문서 기준)

## 결정
- [ ] 호스트·클라우드·리전(미국): 
- [ ] 도메인(한 오리진): talk-us.<DOMAIN> → 
- [ ] TLS 종단 방식: 
- [ ] Shopify 앱: 기존 앱 콜백 추가(스테이징) / 신규 등록(프로덕션): 
- [ ] 백업 저장소(미국 내): 
- [ ] 요금제(custom), 워크플로우(bridge/native), 커스텀 CSS 허용: 
- [ ] 보존 기간(처리방침과 동일): 

## 설치 (§1~§4)
- [ ] 서버 사양·UTC·Docker 24+·egress 허용(Shopify·Klaviyo·Yotpo·Gorgias·GA4)
- [ ] `cp deploy/profiles/SharpTalk-USA-IVY/.env.SharpTalk-USA-IVY.example docker/self-hosted/.env.self-hosted` → `<DOMAIN>`·Shopify 값 치환
- [ ] `bash scripts/gen-secrets.sh` → 붙여넣기
- [ ] `bash scripts/deploy-self-hosted.sh --check` 통과
- [ ] `bash scripts/deploy-self-hosted.sh` → 헬스 ok
- [ ] `SEED_ON_BOOT=false`로 변경 → API 재생성
- [ ] Basic §9 스모크 + Shopify OAuth 콜백·웹훅 4/4

## 어드민 초기화 (§5)
- [ ] AI 엔진 등록·활성
- [ ] 테넌트 ivyusa(시드) 이름·도메인 정정, 요금제 custom, 애드온
- [ ] master/director·상담원 초대

## 테넌트 이관 (§6)
- [ ] 설정 12항목 수동 입력(타임존 America/New_York, 로그인 redirect, 스토어프런트)
- [ ] 위젯 테마·커스텀 위젯 패키지 → 사용함, 임베드 오리진·시크릿 재발급 → 테마 스니펫 갱신
- [ ] KB: 정책 224건 일괄등록, 카탈로그 동기화, 사용법 가이드, 재색인 확인
- [ ] Shopify 재설치·필수 웹훅 3종·동기화 1회
- [ ] Klaviyo·Yotpo·Gorgias 자격증명 → 연결 테스트, Gorgias L2 웹훅 재등록
- [ ] 핸드오프(ET), 개인정보 URL·동의 버전·GA4, AI 설정(응답 규칙 5번)

## 미국 커스터마이징 (§7)
- [ ] CCPA opt-out 경로 안내, DSAR SLA
- [ ] GA4 동의 모드 실측
- [ ] 스니펫 widgetUrl = 새 오리진(테마 코드 검사)
- [ ] 위젯 로그인·주문 탭 E2E

## 운영 (§8)
- [ ] 백업 일 1회 + 리허설 분기 1회
- [ ] Shopify 웹훅 실패 주간 점검
