# SharpTalk-USA-IVY — 미국 스테이징 세팅·배포·운영 가이드

> 버전 1.0 · 2026-09-13 · 코드 기준(main `48b3e31`) · 근거 REQ/PLN-260913-Locale-Deployment-Guides
> 공통 절차는 [SharpTalk-Basic 세팅 가이드](GUIDE-260913-SharpTalk-Basic-Setup.md), 항목별 위치는 [로컬 커스터마이징 가이드](GUIDE-260913-Locale-Customization.md). 이 문서는 **프로필 차이만** 적습니다.
> 프로필 파일: `deploy/profiles/SharpTalk-USA-IVY/` · 시크릿: `secrets/SharpTalk-USA-IVY-server.md`(gitignored)

---

## 0. 프로필 요약

| 항목 | 값 |
|---|---|
| 별칭 | **SharpTalk-USA-IVY** (국가 USA, 1차 고객사 IVY) |
| 고객사 | IVY USA — 화장품 커머스(Shopify). 위젯은 **스토어프런트 테마 임베드**. 앱 개편 F1~F4(카탈로그 2,275·찜·다이어리) 완료 |
| 현재 위치 | 한국 스테이징 테넌트 `ivyusa`(plan `custom`, 시드 테넌트) — Shopify OAuth·App Proxy·동기화·웹훅이 `ambshop-dev.myshopify.com`에 검증됨, KB 정책 224건 + 상품 지식 |
| 언어 | en 기본(es 보조 가능) |
| 타임존 | `America/New_York`(운영) — 핸드오프 목록에 ET/CT/MT/PT 있음 |
| 통화 | USD (Shopify) |
| 규제 | **CCPA/CPRA**: "Do Not Sell or Share" opt-out(`POST /privacy/opt-out`), 접근·삭제(`/privacy/export`·`/privacy/delete`), Shopify 필수 웹훅 3종(`customers/data_request`·`customers/redact`·`shop/redact`), 침해 통지 Cal. Civ. Code §1798.82 |
| 연동 | Shopify(앱 등록·PCD 승인·웹훅), Klaviyo·Yotpo(마케팅), Gorgias(헬프데스크, 워크플로우 `bridge` 시), GA4(동의 모드 v2), Gmail·Telegram(선택) |
| AI | Anthropic + Voyage — 미국 내 처리(위젯 고지 문구와 일치) |
| 결정 필요 | 호스트·클라우드·리전(`<US_HOST>`, 미국 리전), 도메인(`talk-us.<domain>` 가정), TLS 종단, **Shopify 앱: 기존 앱에 콜백 URL 추가 vs 프로덕션 앱 신규 등록**, 백업 저장소, 요금제(custom 유지) |

### 0.1 선행 요구사항
USA 프로필은 시드·시나리오·핸드오프 타임존·통화·PII 패턴이 모두 미국 기준으로 이미 맞아 **코드 갭 P0가 없습니다.** P1(폴백 URL 제거·`ALERT_EMAIL_FROM` 폴백·제품명)은 프로덕션 전 권장.

---

## 1. 서버 준비
- 사양: Basic §3. 리전 미국(us-east 권장 — Shopify·Anthropic 지연 최소). 백업은 미국 내.
- egress: Anthropic·Voyage·Google Fonts·`*.myshopify.com`·`api.klaviyo.com`·`api.yotpo.com`·Gorgias 도메인·GA4·GitHub·Docker Hub·SMTP.

## 2. 도메인·TLS
- 한 오리진 `talk-us.<domain>`. TLS 종단 호스트 nginx/Caddy/ALB.
- 도메인 5키 + **Shopify 외부 재등록**: `SHOPIFY_APP_URL`, Partner 대시보드 앱 URL·리디렉션 URL, **상점별 웹훅 재등록**(Shopify는 웹훅 POST에서 301을 따라가지 않음), App Proxy 경로. 절차: `쇼피파이앱배포플레이북`, `쇼피파이PCD승인및웹훅등록가이드`.
- **결정**: 기존 앱(스테이징용)에 콜백을 추가하면 두 환경이 한 앱을 공유(설치 상점 구분 필요), 프로덕션 앱을 새로 등록하면 PCD 승인을 다시 받습니다. 스테이징은 기존 앱 공유, 프로덕션은 신규 등록을 권장.
- GA4 측정 ID는 빌드 시 인라인(`VITE_GA4_MEASUREMENT_ID`).

## 3. env — Basic self-hosted example 대비 차이
`deploy/profiles/SharpTalk-USA-IVY/.env.SharpTalk-USA-IVY.example` 기준.

| 키 | 값 | 이유 |
|---|---|---|
| `APP_PUBLIC_URL`, `PUBLIC_BASE_URL`, `VITE_API_BASE_URL` | `https://talk-us.<domain>`(/api/v1) | 폴백 금지 |
| `SHOPIFY_API_KEY/SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_SCOPES`, `SHOPIFY_WEBHOOK_SECRET` | 앱 등록값 | 웹훅 검증 없으면 GDPR/CCPA 웹훅 거부 |
| `FULFILLMENT_WEBHOOK_SECRET` | 강한 값 | production 필수 |
| `SHOPIFY_SYNC_INTERVAL_MIN` / `PRODUCT_SYNC_INTERVAL_MIN` | 30 / 360 | 현행 |
| `CONVERSATION_LOG_RETENTION_DAYS` | 처리방침과 일치(초안 **365**) | CCPA 통지와 일치 |
| `AI_DEFAULT_PROVIDER` / `ANTHROPIC_MODEL` | `anthropic` / 표준 모델 | |
| `VOYAGE_API_KEY`, `VOYAGE_MODEL`, `QDRANT_URL` | 필수 | 상품 지식 1,800+ 검색 |
| `VITE_SHOP_DOMAIN` | IVY 상점 도메인 | PWA 사용 시 |
| `VITE_GA4_MEASUREMENT_ID` | IVY GA4 ID | 동의 모드 v2, 동의 전 denied |
| `CAFE24_*` | 비움 | 미사용 |
| `SMTP_*`, `ALERT_EMAIL_FROM` | 미국 발신 도메인 | 영업외 회신·임시 비밀번호 메일 |
| `MFA_ENFORCE_FROM` | 스테이징 비움 | 프로덕션 계정 발급 후 |
| `SEED_ON_BOOT`/`SEED_DEMO_DATA` | 첫 부팅 true/**false** | 시드 테넌트 `ivyusa`·KB는 그대로 활용 |

## 4. 스키마·배포·검증
Basic §4·§7. 프로필 특이점:
- 시드 테넌트 `ivyusa`가 곧 고객사 테넌트입니다(슬러그·도메인 확인 후 사용). 시드 KB(미국 화장품 CS 정책)는 출발점으로 유지하고 실제 224건으로 덮습니다.
- Shopify OAuth 콜백이 새 오리진으로 도는지: 앱 설치 → `/api/v1/auth/shopify/callback` 200 → 웹훅 4/4 등록 확인(`쇼피파이연동점검` 절차).

## 5. 플랫폼 어드민 초기화
| 순서 | 값 |
|---|---|
| AI 엔진 | Anthropic 등록·활성 |
| 테넌트 | 시드 `ivyusa` 사용(이름·도메인 `<shop>.myshopify.com` 정정) 또는 신규, 요금제 **custom**(전 메뉴) |
| 애드온 | 워크플로우: Gorgias 사용 시 `bridge`, 자체 이슈보드면 `native`; **커스텀 CSS 허용**(IVY 브랜드 CSS 사용 시) |
| 관리자 | IVY 운영자 master·director 초대, 상담원 계정(라벨 consult) |

## 6. 테넌트 초기화 (한국 스테이징 `ivyusa`에서 이관)
| 항목 | 방법 |
|---|---|
| 설정 12항목 | 스냅샷 다운로드 → 수동 입력. 타임존 `America/New_York`, 로그인 방식(redirect, Shopify 신형 고객 계정 6자리 코드), 스토어프런트 URL |
| 위젯 | 테마(브랜드 색·로고)·**커스텀 위젯 패키지 가져오기** → [사용함], 임베드 오리진(`<shop>.myshopify.com`·커스텀 도메인) + 시크릿 재발급 → **스토어 테마 스니펫 갱신**(`SHARPTALK_WIDGET_CONFIG`, widgetUrl = 새 오리진) |
| KB | 정책 224건 + 상품 지식 CSV 일괄 다운로드 → 일괄등록, **카탈로그 동기화 재실행**(상품 → 문서), 사용법 가이드(지식 옵션 켬), 재색인 확인 |
| Shopify | OAuth 재설치(새 오리진), 웹훅 4종·필수 웹훅 3종 등록, 주문·고객 동기화 1회 |
| 마케팅·헬프데스크 | Klaviyo·Yotpo·Gorgias 자격증명 재입력 → [연결 테스트]; Gorgias L2 웹훅 URL 재등록 |
| 핸드오프 | 담당자·업무시간(ET)·영업외 메일 |
| 개인정보 | 처리방침 URL(영문), 동의 버전, GA4 ID |
| AI 설정 | 페르소나·응답 규칙 5번("연결을 약속하지 말 것")·시나리오·모더레이션 재입력 |

## 7. 미국 커스터마이징 체크리스트
- [ ] CCPA/CPRA: 처리방침에 "Do Not Sell or Share" 링크 → 위젯/사이트에서 `POST /privacy/opt-out` 경로 안내, 접근·삭제 요청 처리 SLA(45일)
- [ ] Shopify 필수 웹훅 3종이 새 오리진에 등록되고 HMAC 검증 통과(`SHOPIFY_WEBHOOK_SECRET`)
- [ ] 보존 기간 env = 처리방침
- [ ] GA4 동의 모드: 동의 전 `analytics_storage=denied` 실측
- [ ] 임베드 스니펫의 widgetUrl이 새 오리진(한국 폴백 아님) — 테마 코드 검사
- [ ] 위젯 로그인(신형 고객 계정) E2E, 주문 탭에 결제완료 주문 노출
- [ ] Klaviyo·Yotpo 프로브 연결됨, Gorgias L1/L2 왕복(bridge 시)
- [ ] MFA(프로덕션) 대상자 등록률 확인 쿼리(컷오버 §3-1)
- [ ] 매뉴얼 `/manual` en판, 스토어 설치 가이드(`임베드SDK설치가이드`) 최신

## 8. 운영
- 배포·검증·백업·롤백: Basic §7. `MYSQL_CONTAINER=sharptalk_mysql`.
- Shopify: 스코프 변경 시 재설치 필요, 웹훅 실패 로그(감사) 주간 점검, App Proxy 서명 실패율.
- 사고 대응: `INCIDENT-RESPONSE.md` + CCPA(>500명 → CA AG).
- 시크릿: `secrets/SharpTalk-USA-IVY-server.md`.

## 9. 프로덕션 승격
| 항목 | 스테이징 → 프로덕션 |
|---|---|
| 선행 | Shopify 프로덕션 앱 등록·PCD 승인, 실 SMTP, MFA 강제일, UAT 서명(위젯 로그인·주문·인계·KB 답변) |
| 스택 | self-hosted 스택 별도 호스트(8/16/200+), 미국 리전 |
| env | `SEED_DEMO_DATA=false`, `MFA_ENFORCE_FROM`, `EMBED_ORIGIN_ENFORCE` 검토, 실 GA4 |
| 데이터 | §6 절차로 재이관(DB 복사 금지), 카탈로그 재동기화 |
| 외부 | 스토어 테마 스니펫을 프로덕션 오리진으로, 웹훅 재등록, Gorgias/Klaviyo 콜백 |
| 컷오버 | `PRODUCTION-CUTOVER.md` §2 순서·§3 코드로 오지 않는 것·§4 스모크 |

## 10. 체크리스트 (한 장)
- [ ] 호스트·리전·도메인·TLS·Shopify 앱 전략 결정 → 시크릿 파일 생성
- [ ] 프로필 env 복사·시크릿 생성·`--check` 통과
- [ ] 설치 → 스모크(Basic §9) + Shopify OAuth·웹훅
- [ ] 어드민 초기화(§5) → 테넌트 이관(§6) → 스토어 테마 스니펫 갱신
- [ ] 미국 체크리스트(§7)
- [ ] 운영 루틴 캘린더
- [ ] 프로덕션 승격 조건(§9)
