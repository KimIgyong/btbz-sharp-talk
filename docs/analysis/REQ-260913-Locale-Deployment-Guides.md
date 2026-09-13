# REQ-260913 — 국가별 스테이징·프로덕션 세팅/배포/커스터마이징 가이드 (SharpTalk-Basic · VN-Go2Joy · USA-IVY)

- 요청(2026-09-13): 한국·미국·베트남 3개국에 별도 스테이징 서버를 두고 로컬라이제이션과 국가별 커스터마이징(개인정보·저장소·테넌트 커스텀 위젯 등)을 거쳐 각 로컬 프로덕션에 배포·운영한다. 현재 소스를 **SharpTalk-Basic**으로 명명하고, 국가/고객사 별칭(**SharpTalk-VN-Go2Joy**, **SharpTalk-USA-IVY**)으로 스테이징을 세팅할 때 필요한 (1) Basic 세팅 가이드(기술 스택·서버 요구 사양), (2) 고객사별 스테이징 세팅·배포·운영 가이드 2종, (3) 로컬별 커스터마이징 방법을 정리한다.
- 산출물 종류: 문서(`docs/guide/`). 코드·스키마 변경은 원칙적으로 없음(단, 조사에서 드러난 템플릿 결함은 §5에 별도 제안).

## 1. AS-IS (코드 기준 2026-09-13, main `48b3e31`)

### 1.1 배포 스택
| 스택 | 용도 | 상태 |
|---|---|---|
| `docker/staging/` | 한국 스테이징(`shoptalk.amoeba.site`, 211.110.140.172, 공유 호스트) | LIVE. api·web·widget·pwa·mysql·redis·rabbitmq·qdrant·nginx(:8080). `DB_SYNCHRONIZE=false`, SQL 수동 선적용 |
| `docker/production/` | 프로덕션 템플릿 | 미배포. **widget·pwa 서비스 없음**, nginx에 `/widget`·`/app` 라우트 없음, `nginx.web.conf`에 `.md` MIME 없음 |
| `docker/self-hosted/` | 고객사 자체 호스팅 패키지 | 가장 완결(`scripts/deploy-self-hosted.sh` — env 필수값 검사·마이그레이션 검사·헬스 검증, 백업/복원 스크립트). `자체호스팅설치가이드`가 문서 |
| `docker/init-sql/01-schema.sql` + `sql/*.sql` + `sql/artefacts.tsv` | 스키마·마이그레이션·매니페스트 | 첫 부팅은 init-sql, 이후는 `scripts/check-migrations.sh`로 미적용 검출 후 사람이 적용 |

### 1.2 문서
| 있음 | 없음 |
|---|---|
| `DEPLOYMENT-STRATEGY.md`(환경·브랜치·승격), `STAGING-DEPLOY.md`(한국 스테이징 런북), `PRODUCTION-CUTOVER.md`(컷오버·코드로 오지 않는 것·MFA), `자체호스팅설치가이드`(사양·설치·백업·불변값), `CONFIG.md`(env·포트), `pre-deploy-check` 스킬(마이그레이션 순서), `REQ-260909-Domain-Switch-Side-Impact`(도메인 전환 체크리스트), 개인정보 런북 3종(INCIDENT-RESPONSE·PROCESSOR-REGISTER·AI-DPIA-GATE) | **"다른 나라에 새 서버를 0에서 세운다"**를 한 흐름으로 묶은 문서, **국가별 커스터마이징 지점의 층별 지도**(env / 플랫폼 어드민 / 테넌트 설정 / 코드), 고객사(Go2Joy·IVY)별 프로필, 기술 스택·사양을 한곳에 정리한 표, 별칭(Basic/VN/USA) 명명 규칙 |

### 1.3 환경 변수 템플릿 결함(새 서버가 반드시 밟는 것)
- `docker/staging/.env.staging.example`: `UPLOAD_DIR`·`QDRANT_URL`·`VOYAGE_API_KEY` 없음, `DB_SYNCHRONIZE=true`로 남아 있음(실제 운영은 false).
- `docker/production/.env.production.example`: `UPLOAD_DIR`(배포 스크립트가 없으면 실패)·`QDRANT_URL`·`VOYAGE_*`·`APP_PUBLIC_URL`·`PUBLIC_BASE_URL`·`FILE_URL_SECRET` 없음.
- `.gitignore`가 `docker/self-hosted/.env.self-hosted`를 제외하지 않음.
- 코드 폴백이 한국 스테이징을 가리킴: `nudge.service.ts`(APP_PUBLIC_URL), `SettingsPage/WidgetDesignsCard/AgentsSection`(VITE_WIDGET_URL — **임베드 스니펫에 복사됨**), `mailer.service.ts`(`noreply@ivyusa.local`), `cafe24-*`, `apps/{pwa,mobile}` config, `shopify.app.toml` 6곳.

### 1.4 로컬라이제이션 지점 (조사 요약)
| 층 | 항목 |
|---|---|
| 배포(env) | 도메인 5키(`VITE_API_BASE_URL`(빌드 시 인라인)·`APP_PUBLIC_URL`·`SHOPIFY_APP_URL`·`CAFE24_*`), AI 키·모델, Voyage/Qdrant, 보존 기간(`CONVERSATION_LOG_RETENTION_DAYS`·`AI_USAGE_RETENTION_DAYS`), 자산 쿼터, SMTP, MFA 강제일, GA4 |
| 플랫폼 어드민 | 테넌트 생성(이름·슬러그·도메인·요금제), 제공 메뉴, 워크플로우 애드온, 커스텀 CSS 애드온, AI 엔진 등록, 관리자 초대 |
| 테넌트 설정 | 타임존(→ 기본 언어 유도), 위젯 문구 6언어, 위젯 테마·커스텀 위젯·디자인 파일, 임베드 오리진·시크릿, 로그인 방식, 개인정보 URL·동의 버전, 알림 채널, 연동 자격증명(암호화 저장), 스토어프런트 — **설정 스냅샷(12필드+커스텀 위젯)으로 이관 가능** |
| 코드(변경 필요 갭) | G1/G2 기본 언어 `en` 고정·`default_language` 컬럼 없음, G3 업무시간 타임존 목록에 `Asia/Ho_Chi_Minh` 없음, G4/G5 통화·날짜 포맷이 브라우저 로케일, G6 베트남 전화 PII 패턴 없음, G7 AI 국외이전 고지 "in the United States" 고정, G8 동의 버전 상수, G10 사고대응 매트릭스에 PDPD 없음, G11 시드 KB·시나리오가 미국 화장품 정책, G14 제품명 하드코딩, G15 발신 메일 폴백, G16 로컬 볼륨만(객체 저장소 없음), G17 보존 기간이 배포 전역, G18 vi/ja/zh 미검수 |

### 1.5 고객사 현황
| | Go2Joy (VN) | IVY (USA) |
|---|---|---|
| 업종 | 시간제 호텔 플랫폼 — 스토어프런트 아님 | 화장품 커머스(Shopify) |
| 연동 | Notion KB, Haravan 자격증명(스테이징 2건), Kotlin 모바일 SDK, AmoebaTalk 허브(Zalo) 후보 | Shopify OAuth·App Proxy·웹훅(ambshop-dev), Klaviyo·Yotpo·Gorgias, GA4 |
| 언어·타임존 | vi/en 병기, `Asia/Ho_Chi_Minh` | en, `America/New_York`·LA |
| 규제 | PDPD(Nghị định 13/2023) — 동의·국외이전 신고 | CCPA/CPRA — opt-out, Shopify 필수 웹훅 |
| 현재 위치 | 한국 스테이징의 테넌트 `go2joy`(starter/base) | 한국 스테이징의 테넌트 `ivyusa`(custom) |

## 2. TO-BE
1. **명명·저장소 모델 확정**: 단일 저장소 = SharpTalk-Basic(`main`). 국가/고객사 별칭은 **포크가 아니라 배포 프로필**(env + 시크릿 + 테넌트 설정 스냅샷 + 초기 데이터)로 표현한다. 국가 요구가 코드를 바꿔야 하면 Basic에 설정/플래그로 넣고 프로필이 켠다. 별칭 규칙 `SharpTalk-{Basic | CC | CC-Customer}`.
2. **Basic 세팅 가이드**: 기술 스택, 아키텍처, 스테이징/프로덕션 서버 요구 사양, 포트·외부 통신(egress) 목록, env 카탈로그(필수/기능/튜닝), 시크릿·불변값, 스키마 정책, 설치→검증→백업→업그레이드→롤백, 스모크 체크리스트.
3. **로컬 커스터마이징 가이드**: 4층 지도(어느 항목을 어디서 바꾸는가), 국가 프로필 체크리스트(언어·타임존·통화·규제·데이터 이전·저장소·위젯·연동·초기 데이터), 코드 갭 G1~G18의 우선순위·권장 처리, 테넌트 설정 스냅샷으로 프로필 이관하는 절차.
4. **고객사 스테이징 가이드 2종**(VN-Go2Joy, USA-IVY): 프로필 요약표 → 서버 준비 → 도메인/TLS → env(Basic 대비 차이만) → 스키마 → 배포 → 검증 → 플랫폼 어드민·테넌트 초기화(코드로 오지 않는 것) → 국가 커스터마이징 → 운영(배포·백업·마이그레이션·롤백·모니터링) → 프로덕션 승격 → 사고 대응.
5. (선택) 저장소에 **프로필 골격** `deploy/profiles/<alias>/`(env example·시크릿 템플릿·체크리스트)와 §1.3 템플릿 결함 수정.

## 3. 갭 분석
| # | 갭 | 해소 |
|---|---|---|
| D1 | 새 호스트 절차가 4개 문서(자체호스팅·전략·스테이징·컷오버)에 흩어져 있고 한국 호스트 전제 | Basic 가이드가 단일 진입점, 기존 문서는 참조로 연결 |
| D2 | 서버 사양이 자체호스팅 가이드의 최소치(4vCPU/8GB/50GB) 한 줄뿐 | 스테이징/프로덕션·규모별 표 + egress·백업 저장소 |
| D3 | env 필수/선택 구분이 self-hosted 템플릿에만 있고 staging/production 템플릿은 결함 | 카탈로그 표 + 템플릿 수정 제안(§5) |
| D4 | 커스터마이징 지점이 어느 층인지 지도가 없음 | 4층 표 + 국가 체크리스트 |
| D5 | 베트남 전용 요건(PDPD·타임존·전화·통화·KB)이 코드 갭으로 남아 있음 | 갭 목록·우선순위·권장 처리를 가이드에 명시(구현은 별도 요구사항) |
| D6 | 고객사별 초기 데이터(AI 엔진·KB·핸드오프·동의 URL)가 컷오버 문서에 IVY 기준으로만 | 프로필별 "코드로 오지 않는 것" 표 |
| D7 | 프로덕션 스택에 widget/pwa·`/widget` 라우트·`.md` MIME이 없음 | 가이드에 경고 + 수정 제안(§5) |

## 4. 사용자 흐름 (가이드를 읽는 순서)
```
[Basic 세팅 가이드] ── 스택·사양·env·설치·검증·백업 (모든 국가 공통)
        │
[로컬 커스터마이징 가이드] ── 무엇을 어느 층에서 바꾸나, 국가 체크리스트, 코드 갭
        │
[SharpTalk-VN-Go2Joy 가이드] / [SharpTalk-USA-IVY 가이드] ── 프로필 차이만: env diff·규제·연동·초기 데이터·운영
        │
기존 런북(컷오버·사고대응·수탁자 대장·pre-deploy-check)으로 링크
```

## 5. 제약·전제·결정 요청
- 문서는 한국어 원본(`docs/guide/`), 파일명은 `GUIDE-260913-*.md`(기존 GUIDE 규칙). 영어판은 범위 밖(요청 시 별도).
- VN·USA 스테이징 **호스트·도메인·클라우드는 미정** → 가이드는 값 대신 자리표시자(`<VN_HOST>`, `talk-vn.<domain>`)와 결정 항목 표로 쓴다.
- 코드 갭(G1~G18)은 **가이드에 기록만** 하고 구현은 별도 요구사항으로 분리한다. 단, 다음 3건은 새 서버가 즉시 밟는 결함이라 이번 PR에 소수정으로 포함할지 결정 필요: (a) staging/production env example에 누락 키 추가·`DB_SYNCHRONIZE=false`, (b) `.gitignore`에 `docker/self-hosted/.env.self-hosted`, (c) production nginx `/widget`·`/app` 라우트와 `.md` MIME. compose에 widget/pwa 서비스 추가는 영향이 커서 제안만 한다.
- 시크릿 값은 어떤 문서에도 쓰지 않는다(`secrets/<alias>-server.md` 구조만 정의).
