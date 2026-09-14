# 프로젝트 진행상황 1차 보고서 — IVYUSA 쇼핑메신저 (Chat & Support Widget)
# Project Progress Report #1 — Phase 1 Development Results

| | |
|---|---|
| **Doc ID** | CHATWIDGET-RPT-PROGRESS-1.0.0 |
| **Date** | 2026-07-23 |
| **보고 기간 (Period Covered)** | Phase 1: 2026-06-01 ~ 2026-07-15 (+ 안정화 07-16~07-23) |
| **Author** | Project Team |
| **Base Documents** | 개발 단계별 범위(Phase-by-Phase Scope) · CHATWIDGET-WBS-1.0.0 · SPEC.md · RPT-ChatWidget-Implementation-20260618 · RPT-Standards-Compliance-Audit-20260619 · RPT-Security-Privacy-Performance-Review-20260718 |
| **Repo / Stack** | `ivy-talktalk` Turborepo (`apps/{api,web,widget}`) — NestJS 11 + TypeORM + MySQL 8 · Redis · RabbitMQ / React 18 + Vite + Tailwind |
| **Staging** | https://shoptalk.amoeba.site — **LIVE** (Shopify 실주문·고객 동기화 검증 완료) |

---

## 1. 요약 (Executive Summary)

Phase 1(2026-06-01 ~ 07-15) 범위인 **① Shopify & ODOO 쇼핑메신저 API 연동 기반 구축,
② 채널 계정 인증 모듈, ③ 기본 메시지 송수신 기능**을 기간 내 개발 완료하고,
스테이징 서버(`shoptalk.amoeba.site`)에 배포하여 실제 Shopify 스토어 연동으로 검증하였다.

- **Phase 1 주요 기능 4항목 중 3.5항목 완료**: Shopify Webhook 연동 ✅ · 회원 정보 연동(Shopify 측 완료 / ODOO 매핑은 커넥터 구조까지) 🟡 · 텍스트 메시지 송수신 ✅(이미지는 잔여) · 메시지 이력 DB 저장 ✅
- **Phase 2 범위 상당수 선(先)구현**: 주문/배송 자동 알림, FAQ 기반 챗봇(RAG), 상담 이력 조회, 관리자 대시보드, 실시간 상담사 연결이 이미 동작 — Phase 2는 ODOO 실연동·고도화 중심으로 진행 가능
- **품질 게이트**: 전 워크스페이스 빌드 그린 · 단위테스트 46개 통과 · 프로덕션 npm 취약점 0건 · 보안/개인정보 감사 및 스프린트 완료(CCPA/GDPR 대응 포함)

(Phase 1 scope — Shopify & ODOO integration foundation, channel authentication, basic
messaging — was delivered on schedule and verified end-to-end on the live staging server
against a real Shopify store. A large part of the Phase 2 scope is already pre-built.)

---

## 2. 전체 개발 단계별 범위 (Phase-by-Phase Scope — 기준 양식)

| Phase | 개발 모듈 (Development Module) | 주요 기능 (Main Features) | 기간 (Period) |
|---|---|---|---|
| **Phase 1** | 1. IVYUSA Shopify & ODOO 쇼핑메신저 API 연동 기반 구축<br>2. 채널 계정 인증 모듈<br>3. 기본 메시지 송수신 기능 (텍스트·이미지·버튼) | - Shopify App 및 ODOO 모듈 Webhook 연동 설정<br>- 회원 정보 연동 (Shopify ↔ ODOO 회원 매핑)<br>- 텍스트/이미지 메시지 송수신 처리<br>- 메시지 이력 DB 저장 | 2026-06-01 ~ 2026-07-15 |
| **Phase 2** | 4. 주문/배송 알림 메시지 연동<br>5. 챗봇 자동응답 시스템 (FAQ 기반)<br>6. 고객 상담 이력 관리 (ODOO 연동)<br>7. 관리자 모니터링 대시보드 | - Shopify 주문 접수/배송 상태 자동 알림<br>- FAQ 기반 자동응답 시나리오 설정 및 관리<br>- ODOO 주문·회원 데이터 연동 상담 이력 조회 UI<br>- 실시간 상담사 연결 및 채팅 모니터링 | 2026-07-16 ~ 2026-08-31 |

---

## 3. Phase 1 개발 결과 (Phase 1 Development Results)

### 3.1 모듈 1 — IVYUSA Shopify & ODOO 쇼핑메신저 API 연동 기반 구축

| 세부 항목 | 상태 | 구현 내용 |
|---|---|---|
| Shopify App 등록·연동 | ✅ 완료 | Shopify Dev Dashboard 커스텀 앱 등록(`ambshop-dev` 배포), OAuth 설치 플로우, 만료형 오프라인 토큰 + 자동 갱신, REST→GraphQL 전환, `shopify.app.toml` CLI 배포 체계 (PR #1, #17) |
| Shopify Webhook 연동 설정 | ✅ 완료 | 주문(orders)·배송(fulfillments) 네이티브 웹훅 수신(HMAC 서명 검증) → `orders_cache`/`customers` 반영. GDPR 필수 웹훅 3종(`customers/data_request`, `customers/redact`, `shop/redact`) 포함 |
| Shopify 스토어프런트 연동 | ✅ 완료 | App Proxy 신원 연동(로그인 고객 → 위젯 인증 브리지), 위젯 임베드 3방식(App embed / ScriptTag / theme.liquid) + 관리자 설치 가이드 UI, `embed.js` |
| 주문/고객 데이터 동기화 | ✅ 완료 | 온디맨드 + 스케줄 동기화(`SHOPIFY_SYNC_INTERVAL_MIN`), 증분 동기화 — 스테이징에서 실주문·실고객으로 E2E 검증 |
| ODOO 모듈 연동 기반 | 🟡 구조 완료 | 다중 커머스 프로바이더 연동 구조(cafe24/WooCommerce/**Odoo**/Haravan, PR #4) — 자격증명(AES-256-GCM 암호화)·연동 상태·웹훅 인그레스 구현. **실 ODOO 인스턴스 접속·검증은 자격증명 투입 후 Phase 2 상담이력 연동과 함께 진행** |
| 회원 정보 연동 (Shopify↔ODOO 매핑) | 🟡 부분 완료 | Shopify 고객 → 내부 `customers` 동기화·이메일 기반 매칭(`findOrCreateByEmail`, `email_hash` 블라인드 인덱스) 완료. ODOO 측 회원 매핑은 커넥터 구조까지 — Phase 2 이월 |

### 3.2 모듈 2 — 채널 계정 인증 모듈

| 세부 항목 | 상태 | 구현 내용 |
|---|---|---|
| 고객(위젯) 인증 | ✅ 완료 | Shopify 로그인 고객 자동 인증(App Proxy 서명 검증) · 게스트 주문조회 인증(이메일+주문번호, 레이트리밋) · **게스트 모드 상담**(비로그인 상품문의/일반상담) |
| 세션 관리 | ✅ 완료 | 세션 생성/복원, 동의(consent) 게이트, 언어(en/es/ko) 자동 결정, 테넌트 스코프 세션 |
| 관리자/상담사 인증 | ✅ 완료 | JWT 로그인 + 리프레시 토큰 회전/폐기, 최초 로그인 비밀번호 변경 강제, 임시 비밀번호 발급, bcrypt cost 12 |
| 권한 체계 (RBAC) | ✅ 완료 | 직급(master/director/manager/staff) × 직무 라벨(상담/회계/운영) 매트릭스 + 시스템어드민(super/admin), 전역 인가 가드 |
| 멀티테넌시 격리 | ✅ 완료 | 전 테이블 `tenant_id` + 전역 테넌트 컨텍스트 자동 스탬핑 — 교차 테넌트 접근 차단 검증 |

### 3.3 모듈 3 — 기본 메시지 송수신 기능 (텍스트·이미지·버튼)

| 세부 항목 | 상태 | 구현 내용 |
|---|---|---|
| 텍스트 메시지 송수신 | ✅ 완료 | 고객↔AI↔상담사 텍스트 송수신, 델타 폴링(성능 최적화), 다국어(세션 언어) 응답 |
| 버튼(시나리오) 메시지 | ✅ 완료 | 시나리오 버튼 메뉴(환영/상품문의/주문조회 등, 관리자 편집 가능) + 구조화 카드(주문 패널·배송 스테퍼·멀티채널 연락 카드·제휴 카드) |
| 이미지 메시지 송수신 | ⏳ 잔여 | 채팅 내 이미지 첨부/렌더링 미구현 — **Phase 2 초 이월** (지식베이스 파일 업로드 기반은 구현되어 있어 확장 예정) |
| 메시지 이력 DB 저장 | ✅ 완료 | `conversations`/`messages` 테이블 저장(발신자 유형·상담사 식별·언어·RAG 근거 트레이스 포함), 관리자 상담 이력 조회와 연동 |
| 응답 안전장치 | ✅ 완료 | 모든 AI·상담사 발신 메시지 비우회 모더레이션 게이트(오류 시 차단 fail-safe) 통과 |

### 3.4 Phase 1 기간 중 추가 수행 내역 (계약 범위 외 품질·운영 기반)

- **스테이징 서버 오픈**: `shoptalk.amoeba.site` (TLS/Let's Encrypt, 헬스체크, 셀프 부트스트랩) — 실환경 E2E 검증 체계 확보
- **표준 준수 감사 및 갭 해소**: Amoeba v2 6개 표준 전수 감사 → High/Medium 갭 전량 해소
- **보안·개인정보 스프린트**(07-18~20): 토큰 회전/폐기, SSRF 가드, XSS 수정, **고객 PII 저장 암호화**(이메일/이름/전화 AES-GCM), DSAR/CCPA opt-out/보존기간 자동 파기 — CCPA·GDPR 대응 완비
- **성능 최적화**: FULLTEXT RAG 검색, 델타 폴링, 비동기 디스패치, Redis 캐싱, N+1 제거, 코드 스플리팅
- **프레임워크 최신화**: NestJS 10→11 — 프로덕션 npm 취약점 14건 → **0건**
- **단위테스트 46개** 구축·통과, 다국어(en/es/ko) 하드코딩 0

---

## 4. Phase 2 선(先)반영 현황 (Phase 2 Items Already Pre-Built)

Phase 1 기간 중 아래 Phase 2 범위가 이미 구현되어 스테이징에서 동작 중이다.
Phase 2는 **ODOO 실연동·고도화·검증** 중심으로 진행한다.

| Phase 2 항목 | 현재 상태 | 잔여 작업 (Phase 2) |
|---|---|---|
| 4. 주문/배송 알림 메시지 연동 | 🟢 선구현 — 주문/배송 웹훅 → 알림 파이프라인, 위젯 알림센터(3탭)·수신설정, 배송 스테퍼 | Shopify **PCD(보호 고객 데이터) 승인** 완료 후 실시간 웹훅 최종 등록·실환경 검증 |
| 5. 챗봇 자동응답 시스템 (FAQ 기반) | 🟢 선구현 — FAQ/지식베이스 3모드 + RAG 자동응답(근거 인용), 시나리오 설정·관리 UI(AI Setting), 다중 AI 엔진 라우팅 | 실 AI 엔진(Anthropic) 키 투입·품질 튜닝, FAQ 콘텐츠 확충 |
| 6. 고객 상담 이력 관리 (ODOO 연동) | 🟡 부분 — 상담 이력 조회 UI(검색/열람), 고객·주문 데이터 연계 조회 완료 | **ODOO 주문·회원 데이터 실연동**(자격증명 투입, 회원 매핑 검증) |
| 7. 관리자 모니터링 대시보드 | 🟢 선구현 — KPI 대시보드, 실시간 상담사 연결(배정/수락/종료)·라이브 챗 모니터링, AI 상담 브리핑, 상담 통계 | 운영 피드백 반영 고도화 |

---

## 5. 잔여·이월 항목 (Open / Carried-Over Items)

| # | 항목 | 구분 | 계획 |
|---|---|---|---|
| 1 | 이미지 메시지 송수신 (Phase 1 §3.3) | 이월 | Phase 2 초 구현 |
| 2 | ODOO 실 인스턴스 연동 + Shopify↔ODOO 회원 매핑 검증 | 이월/Phase 2 | 자격증명 확보 즉시 착수 (Phase 2 모듈 6과 통합 진행) |
| 3 | Shopify PCD 승인 신청 + 실시간 웹훅 최종 등록 | 외부 승인 | 작업 가이드 배포 완료 — 파트너 대시보드 절차 진행 (리드타임 고려 최우선) |
| 4 | 오픈 PR 3건 — GA4 전환·UTM 분석(#20) / 위젯 호스팅·도메인 도구(#22) / 앱 등록 매뉴얼(#15) | 진행 중 | 리뷰 후 머지 |
| 5 | E2E/통합 테스트, 프로덕션 환경 확정·배포 | Phase 2 후반 | staging/production Docker·배포 스크립트 준비 완료 상태 |

---

## 6. 일정 평가 및 다음 단계 (Schedule Assessment & Next Steps)

**일정 평가**: Phase 1 계약 범위는 기간 내(6/1~7/15) 완료. 이미지 메시지·ODOO 실연동 2건이
이월되었으나, Phase 2 범위 4개 모듈 중 3개가 선구현되어 있어 **전체 일정(8/31)은 여유 있음**.

**Phase 2 진행 계획 (2026-07-16 ~ 08-31)**:
1. Shopify PCD 승인 절차 착수(외부 리드타임 최우선) → 승인 후 실시간 알림 웹훅 전환
2. ODOO 실연동 — 자격증명 투입, 주문·회원 데이터 연동 및 상담 이력 UI 결합, 회원 매핑 검증
3. 이미지 메시지 송수신 구현 (Phase 1 이월분)
4. FAQ 시나리오·실 AI 엔진 품질 튜닝, GA4 분석(#20) 머지로 전환 측정 개시
5. E2E 테스트 및 프로덕션 배포 준비

---

## 7. 참조 (References)

- 구현 보고서: `docs/implementation/RPT-ChatWidget-Implementation-20260618.md`
- 표준 감사: `docs/report/RPT-Standards-Compliance-Audit-20260619.md`
- 보안·성능 리뷰: `docs/report/RPT-Security-Privacy-Performance-Review-20260718.md`
- 화면·기능 카탈로그: `docs/report/RPT-Pages-and-Features-Catalog-20260721.md`
- Shopify 연동 점검(07-23): `docs/guide/쇼피파이연동점검_Shopify-Integration-Status-20260723.bilingual.md`
- PCD 승인·웹훅 가이드: `docs/guide/쇼피파이PCD승인및웹훅등록가이드_Shopify-PCD-Webhooks.ko.md`
- 전체 산출물 인덱스: `docs/PROJECT-ARTIFACT-INDEX.md` · SPEC: `SPEC.md` §14 · WBS: `design/chat-widget-wbs.md`
