# 로컬 커스터마이징 가이드 — 국가·고객사별로 무엇을 어디서 바꾸는가

> 버전 1.0 · 2026-09-13 · 코드 기준(main `48b3e31`) · 근거 REQ/PLN-260913-Locale-Deployment-Guides
> 선행: [SharpTalk-Basic 세팅 가이드](GUIDE-260913-SharpTalk-Basic-Setup.md) · 적용: [VN-Go2Joy](GUIDE-260913-SharpTalk-VN-Go2Joy-Staging.md) · [USA-IVY](GUIDE-260913-SharpTalk-USA-IVY-Staging.md)

---

## 0. 4층 모델

커스터마이징은 **어느 층에서 바꾸느냐**로 주체·반영 시점·이관 방법이 결정됩니다. 항목을 만나면 먼저 층을 찾으세요.

| 층 | 무엇 | 누가 | 반영 | 이관 수단 |
|---|---|---|---|---|
| **L1 배포(env)** | 도메인·키·보존 기간·쿼터·AI 제공자·SMTP·MFA 강제일 | 인프라 담당 | API 컨테이너 재생성(`VITE_*`는 재빌드) | `deploy/profiles/<별칭>/.env.<별칭>.example` |
| **L2 플랫폼 어드민** | 테넌트·요금제·제공 메뉴·애드온(워크플로우·커스텀 CSS)·AI 엔진·관리자 계정 | 플랫폼 관리자(admin@) | 즉시 | 수동(체크리스트) |
| **L3 테넌트 설정** | 타임존·위젯(문구·테마·커스텀·디자인 파일)·임베드·로그인 방식·개인정보 URL/동의 버전·알림 채널·연동 자격증명·핸드오프·KB·AI 설정 | 테넌트 master/director | 즉시(위젯은 다음 로드) | **설정 스냅샷**(13필드+커스텀 위젯) · 커스텀 위젯 패키지 · KB 일괄 내보내기/등록 · 자격증명은 재입력 |
| **L4 코드** | 언어 목록·기본 언어 판정·PII 패턴·시나리오 스크립트·시드 KB·제품명·포맷 | 개발(Basic PR) | 릴리스 | Basic에만 넣고 프로필이 켬(포크 금지) |

---

## 1. 항목별 지도

### 1.1 언어·시간·통화
| 항목 | 층 | 위치 | 비고 |
|---|---|---|---|
| 지원 언어 목록(en·es·ko·vi·ja·zh) | L4 | `packages/types/src/common/language.ts` | 7번째 언어 추가 = 4앱 i18n + `widget_copy` DTO(`first_visit_*`) + 시나리오 스크립트 수정 |
| 고객(위젯) 언어 판정 | L4→L3 | `session.service.ts resolveLanguage`: 명시적 비영어 브라우저 locale → **테넌트 기본 언어**(`tenants.default_language`) → 타임존 유도 → `en` | 기본 언어는 설정 > 기본에서(G1/G2 구현) |
| 콘솔 UI 언어 | 사용자 | 우상단 언어 선택(`ivy_lang`), 초기값 `en` | |
| 위젯 문구(표시 이름·첫 방문·로그인 인사) | L3 | 설정 > 위젯 > 동작, 6개 언어 탭 | 스냅샷 포함 |
| 타임존(테넌트) | L3 | 설정 > 기본 — 선택지 5개(`pickerTimezone`) | `Asia/Ho_Chi_Minh` 포함 |
| 업무시간 타임존(핸드오프) | L3 | `HandoffSection.tsx` 목록 = 언어 레지스트리 존 + 미국 4 + UTC | 호찌민 포함(G3 구현) |
| 통화 | 커머스 | 주문·상품 동기화가 플랫폼 값을 저장, 없으면 `USD` | 테넌트 통화 없음(G4); Haravan은 VND 반환 |
| 숫자·날짜 표기 | L4 | `Intl.NumberFormat(undefined)`·`toLocaleString()` = **브라우저 로케일**, 타임존 인자 없음 | 운영자 브라우저 기준(G5) |
| AI 답변 언어 | L3 | 페르소나·응답 규칙 기본문 "고객 언어로 답하라" | 테넌트별 수정 가능 |

### 1.2 개인정보·규제
| 항목 | 층 | 위치 | 비고 |
|---|---|---|---|
| 동의 배너 문구 | L4 | 위젯 i18n `consent.*` | 고정 문구 |
| AI 국외이전 고지 | L1 | env `AI_PROCESSING_REGION`(US/EU/VN/KR/JP/SG) → 위젯 `chat.aiDisclosure`에 지역명 보간 | 법적 표현 확정은 법무(G7 구현) |
| 개인정보 처리방침 URL·동의 버전 | L3 | 설정 > 개인정보 안내(master/director) | 버전 올리면 전 고객 재동의. 플랫폼 기본 버전 `2026-07`은 소스 상수(G8) |
| 법적 본문 | 없음 | 제품은 URL만 보관, 본문은 테넌트 사이트 | 국가별 본문은 테넌트 사이트에 |
| 보존 기간 | L1 | `CONVERSATION_LOG_RETENTION_DAYS`·`AI_USAGE_RETENTION_DAYS` | **배포 전역**(G17) → 국가 단위 배포 |
| DSAR·삭제·opt-out | 코드 제공 | `GET /privacy/export`, `POST /privacy/delete`, `POST /privacy/opt-out`, Shopify 필수 웹훅(`customers/data_request`·`customers/redact`·`shop/redact`) | CCPA/GDPR 설계. PDPD는 같은 API로 대응 가능(권리 종류 동일) |
| PII 암호화·블라인드 인덱스 | L1 | `CRED_ENC_KEY` | 환경마다 다른 키 → 자격증명 이관 불가 |
| PII 로그 스크럽 전화 패턴 | L4 | `pii-scrub.util.ts`: 국제·미국·한국·**베트남(이동·유선)**·generic | G6 구현 |
| 메신저 동의 모드 | L3 | 채널별 `notice`/`auto` | 첫 접촉 시 고지 발송 여부 |
| GA4 동의 모드 | L1 | `VITE_GA4_MEASUREMENT_ID`(빌드) | `analytics_storage` 기본 denied |
| 사고 통지 기한 | 문서 | `INCIDENT-RESPONSE.md` §3.5: GDPR 72h·CCPA·PIPA·**PDPD** | G10 구현 |
| 수탁자 대장 | 문서 | `PROCESSOR-REGISTER.md` | 국가 열에 처리국 기재 |

### 1.3 저장소
| 항목 | 층 | 위치 |
|---|---|---|
| 업로드 루트 | L1 | `UPLOAD_DIR=/data/uploads` — 첨부 `{tenantId}/{YYYYMM}/`, 로고 `{tenantId}/branding/`, 테넌트 자산 `tenants/{id}/{design\|settings}/`, 라이브 테마 `widget-live/{shop}.json` |
| 자산 쿼터 | L1 | `TENANT_ASSET_QUOTA_DESIGN_MB=50`, `_SETTINGS_MB=20` |
| 첨부 상한 | L1 | `ATTACHMENT_MAX_IMAGE_MB=10`, `_FILE_MB=20`, `_PER_MESSAGE`, HEIC |
| 객체 저장소(S3) | 없음 | 로컬 볼륨만(G16) → 데이터 상주는 호스트 리전으로 |
| 서명 URL | L1 | `FILE_URL_SECRET`(15분/외부 7일) |

### 1.4 위젯
| 항목 | 층 | 위치 |
|---|---|---|
| 테마(브랜드 색·헤더·로고·런처) | L3 | 설정 > 위젯 > 위젯 테마 — 스냅샷 포함 |
| 커스텀 위젯(폰트·크기·모서리·패널·아이콘·CSS) | L3 | 설정 > 위젯 > 커스텀 위젯 — 스냅샷·**패키지 JSON**으로 이관([매뉴얼 05](../../apps/web/public/manual/custom-widget.ko.md)) |
| 커스텀 CSS 허용 | L2 | 어드민 > 요금제/애드온 |
| 디자인 파일 | L3 | 패키지에 동봉 / 재업로드 |
| 임베드 오리진·시크릿 | L3 | 설정 > 위젯 > 임베드 — 시크릿은 환경마다 **재발급** |
| 위젯 URL 스니펫 | L1 | `VITE_WIDGET_URL`(콘솔 빌드) — 비우면 한국 스테이징 URL이 **고객 테마에 복사됨** |
| 전역 설정명 | 코드 | `SHARPTALK_WIDGET_CONFIG`(구 `IVY_WIDGET_CONFIG` 폴백) |
| 로그인 방식 | L3 | redirect/popup, 스토어프런트 URL |
| 모바일 SDK·PWA | L1 | SDK `widgetUrl`, PWA `VITE_API_BASE_URL`·`VITE_SHOP_DOMAIN`; PWA 매니페스트 이름·색 하드코딩 |

### 1.5 연동·AI
| 항목 | 층 | 위치 |
|---|---|---|
| 커머스(Shopify·Cafe24·Woo·Odoo·Haravan) | L3(+L1) | 자격증명은 콘솔; Shopify·Cafe24 앱 등록값은 env |
| 메신저(Telegram·Viber·AmoebaTalk 허브·btbz 릴레이·Gmail) | L3(+L1 `MESSENGER_WEBHOOK_BASE_URL`) | 국가별 채널: VN=Zalo(허브), KR=카카오(릴레이) |
| 헬프데스크·마케팅(Gorgias·Klaviyo·Yotpo) | L3 | 워크플로우 `bridge`는 L2 |
| 플랫폼 AI 엔진 | L2 | 어드민 > AI 엔진(제공사·모델·키) |
| 테넌트 AI 엔진 | L3 | 설정 > 기본 > AI 엔진(내 키 = 내 청구) |
| 임베딩·벡터 | L1 | `VOYAGE_*`, `QDRANT_URL` |
| 데이터 이전 | 사실 | 생성·임베딩 호출은 **미국 엔드포인트** — 국가 고지·계약(DPA)·PDPD 국외이전 평가 대상 |

### 1.6 브랜딩·초기 데이터
| 항목 | 층 | 위치 |
|---|---|---|
| 제품명 "SharpTalk/샵톡" | L4 | 사이드바·i18n 문자열·PWA 매니페스트(G14). 위젯 헤더만 L3(표시 이름) |
| 발신 메일 | L1 | `ALERT_EMAIL_FROM`(비우면 `noreply@ivyusa.local`, G15) |
| 시드 테넌트·KB·시나리오 | L1/L3 | `seed.runner.ts`: 테넌트 `ivyusa`; KB는 env `SEED_KB_PROFILE=us-cosmetics\|none`(G11 구현); 시나리오 문구는 기본 대화 설정에서 테넌트별 편집 |
| 응답 규칙 기본 | L4→L3 | `DEFAULT_RULES`는 신규 테넌트에만; 기존 테넌트는 콘솔에서 수정 |
| 매뉴얼 | 정적 | `apps/web/public/manual/*` — 한국 스테이징 URL 98곳(문서 표기) |

---

## 2. 국가 프로필 체크리스트

새 국가에 들어가기 전에 **결정해서 프로필 `CHECKLIST.md`에 기록**할 항목입니다.

| # | 결정 | 층 | 예(VN) | 예(USA) |
|---|---|---|---|---|
| 1 | 적용 규제·통지 기한 | 문서 | PDPD(Nghị định 13/2023) — 동의·국외이전 영향평가·신고, 사고 72h | CCPA/CPRA — opt-out, 통지 §1798.82 |
| 2 | 데이터 상주 리전·백업 위치 | L1 | 베트남 리전, 백업 국내 | 미국 리전 |
| 3 | AI 처리 위치 고지·DPA | 문서/L1 | `AI_PROCESSING_REGION`으로 고지 지역 표시, Anthropic DPA | 동일 |
| 4 | 보존 기간(대화·AI 사용량) | L1 | 처리방침과 일치 | 동일 |
| 5 | 기본 언어·지원 언어 | L3 | 설정 > 기본 > 기본 언어 `vi`, vi/en 병기 | en |
| 6 | 타임존 | L3 | `Asia/Ho_Chi_Minh`(테넌트·핸드오프 모두) | `America/New_York`·`Los_Angeles` |
| 7 | 통화·전화 형식 | 커머스/L4 | VND, `+84`(G6) | USD, 미국 형식 |
| 8 | 커머스 플랫폼 | L3/L1 | Haravan(있으면), Notion KB | Shopify 앱 등록 |
| 9 | 메신저 채널 | L3 | Zalo(AmoebaTalk 허브), Viber | 이메일(Gmail)·Telegram |
| 10 | 헬프데스크·마케팅 | L3 | — | Gorgias·Klaviyo·Yotpo |
| 11 | 도메인·TLS 종단 | L1 | `talk-vn.<domain>` | `talk-us.<domain>` |
| 12 | 위젯 배포 방식 | L3/SDK | 모바일 앱(Kotlin SDK) + 웹 | 스토어프런트 임베드(Shopify 테마) |
| 13 | 요금제·애드온 | L2 | starter/base → 결정 | custom + 커스텀 CSS |
| 14 | 초기 KB 출처 | L3/L1 | 호텔 운영 KB(vi/en), `SEED_KB_PROFILE=none` | 시드 KB(미국 화장품) 유지·보강 |
| 15 | 핸드오프 업무시간·담당자 | L3 | ICT 기준 | ET/PT 기준 |
| 16 | SMTP 발신 도메인 | L1 | 국가 도메인 | 동일 |
| 17 | MFA 강제일(프로덕션) | L1 | 계정 발급 후 | 동일 |
| 18 | 관리자·상담원 계정 명부 | L2 | | |
| 19 | 사고 대응 연락망(현지 법무·DPO) | 문서 | | |
| 20 | 프로덕션 승격 기준(UAT 항목) | 문서 | | |

---

## 3. 테넌트 설정 이관

한국 스테이징의 테넌트를 새 국가 환경으로 옮기는 순서입니다(코드가 아니라 데이터 이동).

1. **원본 환경**(한국 스테이징, 테넌트 master로 로그인)
   - 설정 > 기타 > **설정 스냅샷** [스냅샷 저장] → [다운로드] (`sharptalk-tenant-settings/1` JSON: 위젯 테마·문구·탭·로그인 방식·알림 채널·임베드 오리진·지식 옵션·타임존·스토어프런트·개인정보 안내 + 커스텀 위젯 라이브러리)
   - 설정 > 위젯 > 커스텀 위젯 각 행 **[내보내기]** (폰트·아이콘 동봉 JSON)
   - 지식 > **일괄 다운로드**(CSV/XLSX, 라운드트립 컬럼) · 카테고리 목록 메모
   - AI 설정 > 페르소나·응답 규칙·시나리오·모더레이션 규칙 텍스트 복사
2. **대상 환경**(플랫폼 관리자)
   - 테넌트 생성(같은 슬러그 권장 — 로그인 URL `/user/{slug}`), 요금제·제공 메뉴·애드온 설정, master 초대
3. **대상 환경**(테넌트 master)
   - 설정 스냅샷은 **같은 테넌트에 저장된 것만 복원**할 수 있습니다 → 다운로드 JSON은 대조용으로 열어 두고 항목을 **수동 입력**(13항목: 타임존·기본 언어 포함). 커스텀 위젯은 **[패키지 가져오기]**로 복원 후 [사용함]
   - 지식: 카테고리 생성 → 일괄등록(CSV/XLSX) → 카탈로그 동기화 → **재색인 확인**(Voyage 키 필수)
   - 연동 자격증명 **재입력**(`CRED_ENC_KEY`가 달라 이관 불가) → [연결 테스트]
   - 임베드 시크릿 **재발급** → 스토어 테마·모바일 SDK 설정 갱신
   - 핸드오프·AI 설정 재입력
4. 검증: Basic 가이드 §9 스모크 + 위젯 언어(브라우저 vi/en)·타임존 표기·개인정보 URL

> 향후 개선 후보: 설정 스냅샷 **파일 반입(import)** 라우트를 추가하면 3단계 수동 입력이 사라집니다(현재는 같은 테넌트 복원만).

---

## 4. 코드 변경이 필요한 갭

구현은 **별도 요구사항**으로 진행합니다. P0 = 해당 국가 스테이징을 열기 전에 반드시, P1 = 프로덕션 전, P2 = 개선.

| # | 갭 | 위치 | 권장 처리 | 우선 | 국가 |
|---|---|---|---|---|---|
| G1/G2 | 기본 언어 `en` 고정, `tenants.default_language` 없음 → 브라우저가 en-US면 타임존이 호찌민이어도 영어 | `session.service.ts:557-564`, `apps/web/src/i18n/i18n.ts` | **구현됨(PLN-260913-VN-Prerequisite-Gaps)** — `tenants.default_language` + 설정 > 기본 "기본 언어", 판정 순서 명시적 비영어 > 테넌트 기본 > 타임존 > en | **P0** | VN |
| G3 | 핸드오프 타임존 목록에 `Asia/Ho_Chi_Minh` 없음 | `HandoffSection.tsx:15-22` | **구현됨** — 목록을 언어 레지스트리에서 생성(호찌민·도쿄·상하이·마드리드 포함), 저장값 보존 | **P0** | VN |
| G6 | 베트남 전화 PII 스크럽 패턴 없음 | `pii-scrub.util.ts:62-74` | **구현됨** — VN 이동전화·유선 정규식 + 스펙 |0)(3\|5\|7\|8\|9)\d{8}`) 추가 + 테스트 | **P0** | VN |
| G7 | AI 국외이전 고지 "in the United States" 고정 | 위젯 i18n `chat.aiDisclosure` ×6 | **구현됨** — env `AI_PROCESSING_REGION` → ensure `aiProcessingRegion` → 위젯 고지 `{{region}}` 보간(6언어×6지역) | **P0** | VN(고지 의무), 전체 |
| G11 | 시드 KB·시나리오가 미국 화장품 정책 | `seed.runner.ts:193-203`, `scenario-scripts.ts:52-56` | **구현됨** — env `SEED_KB_PROFILE=us-cosmetics|none`(시나리오 문구는 기본 대화 설정에서 테넌트별 편집) | **P0**(VN은 삭제로 우회 가능) | VN |
| G10 | 사고 통지 매트릭스에 PDPD 없음 | `INCIDENT-RESPONSE.md` §4 | **구현됨** — INCIDENT-RESPONSE §3.5 PDPD 행 | P0(문서) | VN |
| G14 | 제품명 하드코딩(사이드바·i18n·PWA) | `Sidebar.tsx`, `locales/*/…`, `manifest.webmanifest` | `VITE_PRODUCT_NAME` + i18n 보간 | P1 | 화이트라벨 시 |
| G15 | `ALERT_EMAIL_FROM` 폴백 `noreply@ivyusa.local` | `mailer.service.ts:52` | 폴백 제거·부팅 검사 | P1 | 전체 |
| G4/G5 | 테넌트 통화 없음·브라우저 로케일 포맷 | 동기화 서비스·콘솔 ~35곳 | `tenants.currency`·`Intl` 로케일/타임존 인자 통일 | P1 | VN(VND 표기) |
| G8 | `CONSENT_NOTICE_VERSION` 상수 | `session.service.ts:40` | env 또는 플랫폼 설정 | P2 | |
| G9 | 개인정보 본문 미보관(URL만) | — | 설계대로(테넌트 사이트) | — | |
| G12 | `widget_copy` DTO 언어 열거 | `tenant.service.ts:1042`, DTO | `Record<Lang,…>` 일반화 | P2 | 7번째 언어 |
| G13 | 테넌트 생성 폼에 타임존·언어·개인정보 URL 없음 | `TenantsPage.tsx` | 생성 폼 확장 | P2 | |
| G16 | 로컬 볼륨만 | 전 `UPLOAD_DIR` 소비자 | S3 호환 어댑터(선택) | P2 | |
| G17 | 보존 기간 배포 전역 | `retention.service.ts` | 테넌트별 오버라이드 | P2(국가 단위 배포로 우회) | |
| G18 | vi/ja/zh 미검수(β) | `language.ts reviewed:false` | 원어민 검수 후 플래그 | P1 | VN |
| — | 한국 스테이징 폴백 URL(`APP_PUBLIC_URL`·`VITE_WIDGET_URL`·Cafe24·pwa/mobile·`shopify.app.toml`) | 여러 곳 | env 필수화·폴백 제거 | P1 | 전체 |

---

## 5. 별칭 운영 규칙

1. **흐름**: Basic `main` 머지 → 한국 스테이징(현행) → 국가 스테이징 순차 배포 → 국가 프로덕션. 국가 스테이징은 `main` 최신을 따르되 **배포 시점은 국가 운영자가 결정**(SQL 선적용 포함).
2. **프로필 diff만 관리**: `deploy/profiles/<별칭>/`에는 example env(값 없음)·체크리스트·시크릿 템플릿·테넌트 스냅샷 예시만. 실제 env·시크릿은 서버와 `secrets/`에만.
3. **핫픽스 역방향 금지**: 국가 서버에서 코드를 고치지 않습니다. Basic PR → 배포.
4. **마이그레이션 매니페스트 공유**: 모든 국가가 같은 `sql/artefacts.tsv`를 보므로, 국가 서버에서 `check-migrations.sh`가 미적용을 알려 줍니다.
5. **국가 전용 요구는 플래그**: env 또는 테넌트 설정으로 켜고 끄며, 기본값은 현행(한국 스테이징) 동작을 유지합니다.
6. **문서**: 국가 가이드는 `docs/guide/GUIDE-<날짜>-SharpTalk-<별칭>-Staging.md`, 프로덕션 승격 시 같은 파일에 §9를 채웁니다. 시크릿은 `secrets/<별칭>-server.md`.
