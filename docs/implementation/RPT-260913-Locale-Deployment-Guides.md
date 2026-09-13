# RPT-260913 — 국가별 세팅·배포·커스터마이징 가이드 실행 보고

- 근거: REQ/PLN-260913-Locale-Deployment-Guides (승인 "승인, 2" 2026-09-13) · TCR-260913-Locale-Deployment-Guides
- PR: **#519** (squash → main `e3e3993`, 2026-09-13)

## 1. 산출물
| 구분 | 파일 | 내용 |
|---|---|---|
| P1 가이드 | `docs/guide/GUIDE-260913-SharpTalk-Basic-Setup.md` | 별칭·프로필 모델(포크 금지·self-hosted 기준·국가=배포 1벌), 기술 스택(이미지 태그), 아키텍처·데이터 위치·egress, 서버 사양(스테이징 4/8/80, 프로덕션 8/16/200+), 설치 5단계, env 카탈로그(필수/기능/튜닝/도메인 5키), 초기화 9항목, 운영(SQL 선적용·검증 401/404/502·백업 2종·롤백·모니터링), 보안 기본값, 스모크 10항목, 알려진 결함 |
| | `GUIDE-260913-Locale-Customization.md` | 4층 모델, 항목별 지도 6절(언어·시간·통화 / 개인정보 / 저장소 / 위젯 / 연동·AI / 브랜딩·초기 데이터), 국가 프로필 체크리스트 20, 테넌트 설정 이관 4단계, 코드 갭 G1~G18(우선순위 P0/P1/P2·국가), 별칭 운영 규칙 6 |
| | `GUIDE-260913-SharpTalk-VN-Go2Joy-Staging.md` | 프로필 요약(PDPD·ICT·VND·Notion/Haravan/허브/SDK), 선행 P0 갭 6, 서버·도메인·env diff 13키·배포 특이점·어드민·테넌트 이관·베트남 체크리스트 10·운영·승격 |
| | `GUIDE-260913-SharpTalk-USA-IVY-Staging.md` | 프로필 요약(CCPA/CPRA·ET·USD·Shopify/Klaviyo/Yotpo/Gorgias/GA4), P0 없음, Shopify 앱 전략 결정, env diff·이관·미국 체크리스트 9·운영·승격 |
| P2 프로필 | `deploy/profiles/{SharpTalk-VN-Go2Joy,SharpTalk-USA-IVY}/` + `README.md` | `.env.<alias>.example`(self-hosted 템플릿 파생·값 없음), `secrets.template.md`, `CHECKLIST.md`, `tenant-snapshot.example.json` |
| P2 템플릿 | `docker/staging/.env.staging.example` | `UPLOAD_DIR`·`QDRANT_URL`·`VOYAGE_*` 추가, `DB_SYNCHRONIZE=false` |
| | `docker/production/.env.production.example` | `UPLOAD_DIR`·`APP_PUBLIC_URL`·`PUBLIC_BASE_URL`·`MESSENGER_WEBHOOK_BASE_URL`·`QDRANT_URL`·`VOYAGE_*`·`FILE_URL_SECRET` |
| | `docker/production/{docker-compose.production.yml, Dockerfile.widget, nginx.widget.conf, nginx.conf, nginx.web.conf}` | widget 서비스 신설, edge `/widget` 라우트(resolver+변수 proxy_pass), web `.md` MIME |
| | `.gitignore`, `docs/guide/DEPLOYMENT-STRATEGY.md` §1 | self-hosted env·widget-config·프로필 실 env 제외; 국가 배포 단락·링크 |

## 2. 조사 결과 요약 (가이드에 반영)
- 배포 스택 3벌 중 self-hosted만 검사·검증·백업이 갖춰짐 → 국가 스테이징 기준 스택으로 채택.
- staging/production env 템플릿에 `UPLOAD_DIR`·Qdrant·Voyage 누락, production에 widget 없음 → P2에서 수정.
- 한국 스테이징 폴백이 코드에 남음(`APP_PUBLIC_URL`·`VITE_WIDGET_URL`(임베드 스니펫)·`ALERT_EMAIL_FROM`·Cafe24·pwa/mobile·`shopify.app.toml`) → env 필수화 안내 + 갭 P1.
- 로컬라이제이션은 4층으로 정리; 테넌트 이관은 설정 스냅샷(같은 테넌트 복원만)+커스텀 위젯 패키지+KB 라운드트립, 자격증명은 재입력.
- 베트남 착수 전 코드 갭 P0: 기본 언어 en 고정(G1/G2), 핸드오프 타임존 목록(G3), VN 전화 PII(G6), AI 국외이전 고지 문구(G7), 시드 KB(G11), 사고 통지 매트릭스(G10). USA는 P0 없음.

## 3. 검증 (TCR-260913)
- `npm run env:check` OK · `git check-ignore` 규칙 · production `compose config`(widget 포함 8서비스) · `nginx -t` edge/web/widget 3/3
- 가이드 링크·경로·env 키 실존 검사(결손 1건 정정, 위양성 3건), 사실 대조 8항목 일치
- CI "typecheck · test · build" pass

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL | 없음 |
| 한국 스테이징 | 런타임 무영향(문서·템플릿·미배포 production 스택). 체크아웃만 main 동기화 |
| VN·USA 스테이징 | **호스트·도메인 미정** — 프로필 CHECKLIST의 "결정" 항목 확정 후 Basic §4로 설치. 첫 실배포 시 TCR 갱신 |
| production | 미배포 |

## 5. 잔여·후속
- **VN P0 갭 구현 REQ**(G1/G2·G3·G6·G7·G11·G10) — 베트남 프로덕션 전 필수.
- 설정 스냅샷 **파일 반입(import)** 라우트 — 이관 3단계 수동 입력 제거.
- 한국 스테이징 폴백 URL 제거·env 필수화(P1), 제품명 env화(G14), `ALERT_EMAIL_FROM` 폴백 제거(G15).
- production 스택 pwa/`/app`은 미포함(설계) — 필요 시 staging 참고.
- 영어판 가이드는 요청 시.
