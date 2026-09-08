# AN-260907 — SharpTalk for Go2Joy 요구사항 사이드 임팩트 분석

- 대상 요구사항: `docs/analysis/REQ-260831-SharpTalk-Go2Joy-Requirements.md` (SHARPTALK-G2J-REQ-1.0.0)
- 분석 기준 코드: `main` e339646 (2026-09-04) 기준 현행 구현
- 선행 문서: `REQ-260825-Go2Joy-ChatAgent-BizModel.md` (호텔 = 1 테넌트 모델 제안), `REQ-260826-Go2Joy-Kotlin-Mobile-SDK.md`, `REQ-260828-Go2Joy-Notion-KB-Analysis.md`
- 목적: PLN 작성 전에, 요구사항을 현행 구현 위에 얹었을 때 **무엇이 깨지고, 무엇을 새로 결정해야 하는지**를 파일 단위로 확정한다. 구현 방안 제안은 최소화한다.

---

## 0. 요약

Go2Joy는 이미 스테이징의 실 테넌트다(임베드 오리진 `*.go2joy.vn`, `hotel-partner` AI 에이전트, Notion KB 동기화, 영상가이드 KB 104건). 따라서 이 요구사항은 "새 프로젝트"가 아니라 **기존 파이프라인을 공유하는 테넌트에 대한 대규모 확장**이며, 공유 파이프라인(`chat.service.ts`, `rag.service.ts`, 세션·테넌트 컨텍스트)을 건드리는 변경은 ivyusa 등 다른 테넌트에 그대로 전파된다.

사이드 임팩트는 세 층으로 나뉜다.

| 층 | 성격 | 대표 항목 |
|---|---|---|
| **구조 결정이 선행되어야 하는 충돌 (상)** | 현행 모델과 요구사항이 정면으로 어긋나 설계 결정 없이는 구현 불가 | FR-011 세션 소유권 전이, FR-009 조직 간 3단 이관, FR-002 의도 기반 에이전트 라우팅, FR-001/112 파트너 권한, FR-101~107 예약·정산 데이터 모델 |
| **확장으로 흡수 가능하나 기존 계약을 만지는 항목 (중)** | 기존 엔티티·JSON·상수·열거형에 필드가 추가되어 소비처 전체를 따라가야 함 | FR-003/010 근거·버전 태깅, FR-007 PII 종류 추가, FR-008 베트남어 감지, FR-113 Hotel Admin 채널 어댑터, NFR-007 감사 필드 |
| **규모(NFR-006, 5,500 테넌트)가 드러내는 기존 결함 (상)** | 요구사항이 새 기능을 요구하지 않는데도 현행 코드가 견디지 못함 | 전 테넌트 직렬 스케줄러, 무페이지 `reindexAll`, 보존 퍼지 풀스캔, 위젯 요청당 추가 SELECT, 대량 프로비저닝 부재 |

가장 먼저 결정해야 할 것은 **테넌트 축**이다(§2.1). 이 결정에 따라 FR-001, 009, 011, 304, 309 다섯 개의 영향 범위가 완전히 달라진다.

---

## 1. 현행 구현 요약 (AS-IS 사실만)

분석에 필요한 사실만 적는다. 근거 파일은 `apps/api/src/` 기준이다.

### 1.1 세션·신원·테넌트
- `Principal`은 `admin | user` 2종뿐이다(`packages/types/src/domain/rbac.types.ts:64`). 위젯 방문자는 principal이 아니라 `session_token`을 든 익명 주체이며 라우트는 `@Public()`이다.
- 테넌트 사용자 권한은 rank(master/director/manager/staff) × label(consult/accounting/operations)이고 **컴파일된 매트릭스**다(`packages/common/src/rbac/permission-matrix.ts`, 가드 `global/guard/authorization.guard.ts:53,65`). `roles_permissions` 테이블은 가드가 읽지 않는다.
- 테넌트보다 좁은 데이터 스코프(지점·매장·프로퍼티)는 없다. 유일한 하위 축은 `sessions.ai_agent_id`(페르소나)다.
- 세션은 `tenant_id`가 유일한 소유 축이며, 생성 시 `shop_domain`으로 테넌트를 확정하고 `ai_agent_id`를 고정한다(`session/session.service.ts:94-144`). **세션·대화의 `tenant_id`를 바꾸는 코드 경로는 없다.** 쓰기 시 `tenant.subscriber.ts:11-20`이 ALS 컨텍스트로 `tenant_id`를 자동 스탬프한다.
- 위젯 세션 토큰은 `localStorage['ivy_session']` 하나이며 shop별로 네임스페이스되지 않는다(`apps/widget/src/lib/api-client.ts:34`). `ensure()`는 기존 토큰을 재개할 때 요청된 `shop_domain`과 기존 `tenantId`가 같은지 확인하지 않는다(`session.service.ts:96-121`).
- 서명 신원연동(`embed/embed.service.ts:75-108`)은 **userId만** HMAC 서명하고 name/email/phone은 비서명이다. 검증 성공 시 `customers.external_customer_id`로 업서트한다.

### 1.2 AI 응답 파이프라인
- AI 에이전트(`ai_agents`)는 **세션 생성 시 1회 고정**된다(스니펫 `data-agent` 또는 채널 config). 의도 분류(`rag.service.ts:606-643`)는 이커머스 고정 레이블 9종(`order_status, delivery, cancel_refund, product_inquiry, agent_request, smalltalk, out_of_scope, unintelligible, other`)이며 **에이전트 라우팅에 쓰이지 않는다.** 이 레이블은 `messages.intent`에 저장되어 이슈 유형 파생(`issue.service.ts:63`), 질문 통계, 지식 갭 클러스터링이 소비한다.
- 턴 처리 순서(`chat.service.ts:486-937`): 동의 게이트 → 저장 → 언어 동기화 → 상담원 점유 확인 → PII 스크럽 → 의도 분류 → deny-list → 사람 요청 → 비질문 단락 → 주문 인증 게이트 → 답변 재사용 조회 → RAG → 모더레이션 → 저신뢰 인계 → 초안 반환 → 저장·재사용 적재 → 지연 인계.
- 근거: 검색 결과가 비어도 `"(no relevant documents found)"`를 LLM에 보낸다(`rag.service.ts:484`). 신뢰도는 `RAG_MIN_SIMILARITY`(env, 0.5) 미만이면 0.2로 고정되고, `ESCALATION_CONFIDENCE = 0.45`(**하드코딩**, `chat.service.ts:40`) 미만이면 인계한다. 인용은 `messages.retrieval_trace` JSON 하나에 저장된다.
- 답변 재사용(`answer_reuse`)은 RAG **앞에서** 재생되며 저장된 `citations`를 그대로 돌려준다. 주문 질문은 재사용 금지.
- **툴 호출 없음.** 어댑터 계약(`infrastructure/external/ai/ai-adapter.interface.ts`)에 tools 필드가 없고, 외부 데이터는 호출자가 텍스트로 넣는다(`buildOrderContext`, `chat.service.ts:1232-1263`).
- 인계 대상은 테넌트 내부(상담원/오프아워 메일)뿐이다(`handoff-router.service.ts:65-83`). 외부는 테넌트 자신의 Gorgias/Slack/메일이다. 플랫폼 레벨 CS 큐는 없다.
- 언어 감지기는 EN/ES/KO만 반환한다(`global/util/detect-language.util.ts:25-48`). VI/JA/ZH는 레지스트리에는 있으나 감지되지 않으며, 베트남어 성조 문자(`á é í ó ú`)는 스페인어 표지 정규식에 걸려 **VI가 ES로 오판**된다(§3.4).
- 능동 발신: AI가 대화를 시작하는 경로는 없다. 유휴 안내·캠페인·푸시·재입고 알림은 정적 문구 또는 운영자 작성 문구다.

### 1.3 지식베이스
- 문서 = 벡터 1개. **청크 엔티티 없음.** Qdrant는 전 테넌트 단일 컬렉션 `kb_documents`, payload `{tenant_id, category, source, active}`, 인덱스는 `tenant_id/category/active` 3개.
- `kb_documents`에 `version` 없음. `reviewedAt/reviewedBy/reviewIntervalDays/effectiveFrom/supersededBy`는 있으나 `isStale`은 **표시 전용**이고 검색 필터에 영향을 주지 않는다(`rag.service.ts:330-372 baseQuery`는 `active`만 본다).
- `tenant_id IS NULL` 플랫폼 공유 문서는 **읽기 경로만** 준비되어 있고(`rag.service.ts:335`, Qdrant `tenant_id IN [t, 0]`), 쓰기·콘솔·카테고리·리비전·충돌은 전부 NOT NULL 테넌트 전제다.
- 언어별 문서는 별도 행(`external_key` 접미 `-EN/-VI`)이다. `language` 컬럼 없음.
- `reindexAll()`은 테넌트 무스코프·무페이지로 전 문서를 메모리에 올린다(`knowledge.service.ts:762-775`).

### 1.4 외부 연동·채널
- 커머스 연동은 인터페이스 없는 관례(클라이언트/주문 sync/상품 sync/스케줄러 4파일 × 5 provider). 스케줄러는 단일 프로세스 `setInterval`이 테넌트를 **직렬** 순회한다.
- `orders_cache`는 외부 ID 컬럼이 `shopify_order_id`이고 `total` 단일 스칼라, 체크인/아웃·프로퍼티·요금 분해 자리가 없다.
- `integration_status`는 `name` 유니크에 `tenant_id` 없음(전역 1행, FIX-260827에서 credentials 행으로 우회).
- 메신저 채널은 **진짜 포트**가 있다(`messenger/adapter/messenger-adapter.ts:120 MessengerAdapter`). 새 채널은 어댑터 1개 + 레지스트리 등록으로 파이프라인(동의·세션·중복제거·인계·아웃박스)을 그대로 쓴다.
- 이슈 워크플로우의 L1/L2/L3는 Gorgias 커넥터의 **구현 단계** 명칭이고, `ISSUE_TIER`는 `scenario|ai|agent`다. 조직 간 라우팅 체인은 아니다.
- 애드온은 `tenants.workflow_mode` 컬럼 하나뿐이며 범용 애드온 테이블은 없다.

---

## 2. 구조 결정이 선행되어야 하는 충돌 (심각도 상)

### 2.1 테넌트 축 — FR-001 · FR-009 · FR-011 · FR-304 · FR-309 · NFR-006

**충돌.** 요구사항은 세 Stage에서 서로 다른 소유자를 전제한다. Stage 1·2-A는 Go2Joy가 응답 주체이고, Stage 2-B는 호텔이 응답 주체다. FR-011은 예약 상태에 따라 세션 소유권을 "플랫폼 ↔ 호텔 테넌트"로 전이하라고 하고, FR-009는 L1 호텔 프런트 → L2 Go2Joy CS로 조직 경계를 넘는 이관을 요구한다.

현행 모델에서 이를 담을 수 있는 축은 두 가지뿐이며 둘 다 요구사항을 그대로 수용하지 못한다.

| 선택지 | 현행과의 정합 | 발생하는 사이드 임팩트 |
|---|---|---|
| **(A) 호텔 = 테넌트** (BizModel REQ가 제안한 모델) + Go2Joy = 별도 테넌트 | 데이터 격리·KB·페르소나·운영시간이 테넌트 단위로 "그냥" 된다. FR-304, FR-309는 무료로 얻는다. | ① FR-011 세션 전이 = **테넌트 간 행 이동**. `sessions/conversations/messages.tenant_id` 갱신 + ALS 컨텍스트 재도출 + Qdrant·Redis 세션 캐시 무효화 + 감사. "Never leak cross-tenant"(CLAUDE.md §2) 원칙에 대한 명시적 예외 설계가 필요하다. ② FR-009 L2 = 다른 테넌트로 인계. `handoff-router`는 단일 대상 집합만 반환한다. ③ 5,500 테넌트 프로비저닝·스케줄러·콘솔 목록·`generateUniqueSlug` O(n²)(§4). ④ 위젯 토큰이 shop별로 분리되지 않아 한 앱에서 테넌트를 바꾸면 **이전 테넌트 세션이 재개**된다(`session.service.ts:96-121`). ⑤ Stage 1 파트너는 Go2Joy 테넌트의 *고객*인데 동시에 자기 호텔 테넌트의 *직원*이다. 한 사람이 두 테넌트에 두 신원으로 존재한다. |
| **(B) Go2Joy = 단일 테넌트** + `property_id`(호텔) 하위 축 신설 | 세션 전이·조직 간 이관이 **같은 테넌트 안**의 상태 변경으로 축소된다. 스케줄러·프로비저닝 문제가 사라진다. | ① 하위 축이 없으므로 `sessions, conversations, messages, kb_documents, kb_categories, ai_agents, users, tenant_ai_config(운영시간·인계 대상)`에 `property_id`를 추가하고 **모든 조회에 필터를 붙여야** 한다. 이는 2026-06 `tenant_id` 커버리지 로드맵을 한 번 더 반복하는 규모다. ② 호텔 프런트 직원은 테넌트 사용자이므로 rank×label 매트릭스에 "자기 프로퍼티만"이라는 행 스코프를 추가해야 한다(현재 컴파일된 매트릭스에 그런 차원이 없다). ③ 호텔별 KB·페르소나 격리를 코드로 보장해야 하며 실수 한 번이 5,500 호텔 간 누출이다. ④ 콘솔 전 화면이 프로퍼티 필터를 알아야 한다. |

어느 쪽이든 **FR-011의 "세션 소유권 전이"는 현행에 존재하지 않는 개념**이고, 위젯 측 토큰 네임스페이스 부재(`api-client.ts:34`)는 선택과 무관하게 먼저 고쳐야 하는 현행 결함이다. 이 결함은 지금도 한 브라우저가 두 테넌트 위젯을 열면 재현된다.

### 2.2 파트너 권한 — FR-001 · FR-104~106 · FR-112

`Quản lý`/`Lễ tân`은 Go2Joy Hotel Admin의 역할이지 ShopTalk의 역할이 아니다. Stage 1 파트너는 ShopTalk 입장에서 **위젯 고객**(principal 아님)이므로, 권한과 접근 가능 호텔 스코프는 Go2Joy가 서명해서 넘겨야 한다.

- 현행 서명 신원연동은 `userId`만 서명한다(`embed.service.ts:34-36`). 역할·호텔 스코프를 비서명 필드로 받으면 클라이언트가 위조할 수 있으므로 **서명 페이로드 확장**이 필요하다. 이는 Android SDK(`ShopTalkUser.kt`), RN 패키지, `embed.js`, `useEmbedIdentity.ts`, `embed.service.ts`의 계약을 동시에 바꾼다.
- 위젯 고객에게는 RBAC 가드가 없다. FR-104(취소 사유 안내)·FR-106(노쇼 신고)이 역할별로 달라야 한다면, 그 판정은 가드가 아니라 **프롬프트 컨텍스트 또는 KB 카테고리 `agent_ids` 스코프**로 구현될 수밖에 없다. 즉 "RBAC 차단"(SC-104)이 현행 구조에서는 지식 범위 제한으로 번역된다. 요구사항의 기대(권한 밖 문의 차단)와 구현 수단(모르는 척)이 다르다는 점을 PLN에서 명시해야 한다.
- 관련 현행 결함: `agent-console.controller.ts:71 tenantOf()`는 admin에 대해 `0`을 반환하고 throw하지 않는다.

### 2.3 의도 기반 에이전트 라우팅 — FR-002

카탈로그는 도메인 에이전트 30여 종(ST-PLT-01~09, ST-S1-01~12, ST-S2A-01~06, ST-S2B-01~08)을 전제하지만, 현행은 **세션당 페르소나 1개 고정**이고 의도는 라우팅에 쓰이지 않는다.

- 진짜 라우터를 넣으면 `chat.service.ts:794`에서 턴마다 `effectiveAgentId`를 재결정해야 한다. 이 id는 재사용 조회·검색 스코프·페르소나 세 곳이 "반드시 일치"하도록 설계되어 있어(`chat.service.ts:794` 주석), 턴 단위 변경은 답변 재사용 캐시 키(`answer_reuse` agent-scope, `:75-82`)와 세션 캐시(`aicfg:persona:*`) 무효화를 동반한다.
- 의도 레이블 집합을 숙박 도메인으로 바꾸면 `issue.service.ts:63 intentToType()`, `DEFAULT_LABEL_BY_TYPE`, `question_stats_daily` 집계, `knowledge-gap.service.ts` 클러스터링이 **전 테넌트에 대해** 바뀐다. 레이블 집합은 테넌트별이 아니라 전역 상수다.
- "복합 의도 분해"는 1턴 1분류 구조(`classifyIntent` 1회 호출)와 맞지 않는다.

대안으로 "페르소나 1개 + 의도별 KB 카테고리 선호(`preferGroup`/`agent_ids`)"로 축소하면 파이프라인 변경 없이 흡수되지만, 이는 카탈로그의 에이전트 분리를 **논리적 분리**로만 구현하는 것이다. 어느 쪽인지는 PLN 결정 사항이다.

### 2.4 예약·정산·요금 데이터 — FR-101~103 · FR-107~109 · FR-306 · §6 연관 시스템

`orders_cache`는 재사용 불가에 가깝다.

| 요구 | 현행 자리 | 결과 |
|---|---|---|
| 체크인/아웃·예약 유형(`Qua đêm`/`Theo ngày`)·객실·인원 | 없음 | 신규 엔티티 |
| 호텔(프로퍼티) 차원 | 없음(축은 `tenant_id`, `customer_id`뿐) | §2.1 결정에 종속 |
| 요금 5분해(기본가·추가·직접할인·Flash Sale·쿠폰) | `total decimal(12,2)` 스칼라 | 신규 엔티티 |
| 정산 주기·미수금·이의 상태·마감 | 없음 | 신규 도메인 |
| 부가상품 주문 → 객실 요금 합산 (FR-306) | `products_cache`는 읽기 전용 표시 캐시 | 신규 도메인 + **최초의 쓰기 연동** |
| 취소·노쇼 상태 | `ORDER_STATUS_INTERNAL`(배송형 어휘) | 매핑 불가, 별도 상태 어휘 |

`orders_cache`를 오버로드하면 주문 매퍼, 위젯 주문탭, `buildOrderContext`, Gorgias 최근주문 노트, 관리자 주문 화면, 통계가 전부 예외 분기를 갖게 된다. 별도 `bookings` 도메인이 충돌이 적다. 재사용 가능한 것은 `parseProviderConfig`, `IntegrationCredential`, 스케줄러 템플릿, 아웃박스뿐이다.

부수 결함: `integration_status`에 `tenant_id`가 없어(`integration-status.entity.ts:6`) 같은 provider를 쓰는 테넌트끼리 상태를 덮어쓴다. Go2Joy 동기화가 여기에 쓰면 5,500 테넌트에서 결함이 증폭된다. `SYNCABLE`은 프런트 하드코딩 Set이고(`IntegrationConfigModal.tsx:17`), `apps/web/src/domain/settings/integration-providers.ts`는 `INTEGRATION_FIELDS`의 수동 사본으로 **이미 드리프트**(webhook_secret 누락)되어 있다.

### 2.5 3단 조직 이관과 Staff Bridge — FR-009 · FR-114 · FR-302 · FR-304 · FR-310

- FR-009의 L1 호텔 → L2 Go2Joy CS → L3 전문조직은 **조직 간 라우팅 체인**이다. 현행은 `handoff-router.route()`가 대상 1집합(상담원 또는 메일)만 돌려주고, 외부 티켓 provider도 1종(Gorgias)이다. 무인 시간대 L1 건너뛰기는 `handoff_config` 운영시간 판정(`handoff-router.service.ts:97-136`)이 있어 재사용 가능하나 "다음 단계로 넘김"은 없다.
- FR-114/FR-310의 왕복(게스트 요청 → 프런트 배정·완료 → 게스트 회신)은 **대화 2개를 티켓으로 잇는** 구조다. `channel_threads`는 외부 스레드 1 ↔ 세션 1 ↔ 대화 1이라 맞지 않고, `external_tickets`의 `(conversation_id, provider)` 유니크가 한 대화에 provider별 티켓 여러 개를 허용하므로 그 자리가 후보다. 호텔 프런트가 다른 테넌트라면(§2.1 A) 이 티켓은 테넌트 경계를 넘는 첫 엔티티가 된다.
- 알림 팬아웃(`agent-alert.service.ts`)은 대화 단위 `(conversation, reason)` 멱등이라 재사용 가능하다.

### 2.6 "대행 금지"와 최초의 쓰기 연동 — FR-005 · FR-006 · FR-102 · FR-306 · A-04

현행 AI는 텍스트 전용이라 FR-005는 **지금 자동으로 만족**된다. 문제는 요구사항이 동시에 쓰기를 요구한다는 점이다: 이의 내용 초안(FR-102), 부가상품 주문 접수·합산(FR-306), 담당자 배정(FR-114), 요청 접수·상태 추적(FR-310).

- 툴 호출을 도입하는 순간 어댑터 계약·게이트웨이(`ai-gateway.service.ts:111-142`)·스텁 폴백·사용량 계측이 모두 바뀐다.
- 모더레이션은 **텍스트**만 게이트한다(`moderation.service.ts:71`). "이 액션은 비가역이므로 금지"를 판정하는 엔티티·정책 계층이 없다. FR-005를 배포 게이트(NFR-009)로 쓰려면 액션 화이트리스트와 그 회귀 테스트가 새로 필요하다.
- 쓰기 없이 "안내·초안·검증까지만"으로 범위를 고정하면 파이프라인 변경이 없다. 이 경계는 A-04(OQ-012)와 같은 결정이며, BizModel REQ §6.2도 "조회만, 돈은 사람"을 권고했다.

---

## 3. 확장으로 흡수 가능하나 기존 계약을 만지는 항목 (심각도 중)

### 3.1 근거 명시·버전 태깅·회수 — FR-003 · FR-010 · FR-203 · NFR-002

- "근거 없으면 답하지 않는다"는 현행과 **정확히 같지 않다.** 검색 0건이어도 LLM은 호출되고 프롬프트 규칙("Answer ONLY from the context")에 의존한다. 신뢰도 0.2 → 인계는 되지만 그 사이에 생성된 문장이 존재한다. 비질문 경로(`answerWithoutKnowledge`)는 인용이 없고, 재사용 경로는 저장된 인용을 재생한다. NFR-002 "인용률 100%"는 이 세 경로를 모두 재정의해야 한다.
- `ESCALATION_CONFIDENCE`(0.45)는 하드코딩이고 `RAG_MIN_SIMILARITY`(0.5)는 env다. 테넌트별 임계는 없다. Go2Joy만 더 보수적으로 잡으려면 `tenant_ai_config`로 옮겨야 하고 이는 전 테넌트 기본값을 건드린다.
- "청크"는 없다. FR-010은 문서 단위 태깅으로 해석하거나 청크 테이블을 도입해야 하는데, 후자는 Qdrant point id = 문서 id 가정(`qdrant.service.ts:81,91,97`, `knowledge.service.ts:661,732`)을 깬다.
- UI 버전 컬럼 추가 시 따라가야 할 소비처: 엔티티 + `sql/` 마이그레이션(`migration_kb_provenance.sql`의 `updated_at = updated_at` 함정), `kb-document-revision.entity.ts` + `kb-revision.service.ts`, `knowledge.request.ts`, `updateDocument()` undefined/null 규약, `knowledge.mapper.ts`, `listDocuments()` select 목록, `bulk-export.service.ts:15`/`bulk-import.service.ts:15-16`(라운드트립 열 동일 원칙, 260903 결정), `board-review.service.ts:73-96 promote()`, `catalog-sync.service.ts:306,356-362`, `knowledge.controller.ts`, 로케일 6종 `knowledge.json`.
- "불일치 시 회수"를 검색에 반영하려면 (a) `active` 플립(이미 Qdrant까지 전파됨, `kb-conflict.service.ts resolve()` 선례) 또는 (b) 새 필터 + Qdrant payload 필드 + **payload 인덱스 + 전량 재색인**. `ensureCollection()`은 컬렉션이 없을 때만 인덱스를 만들므로(`qdrant.service.ts:58-73`) 기존 배포는 조용히 인덱스가 빠진다.
- 회수된 문서를 인용한 `answer_reuse` 행은 자동 무효화되지 않는다(테넌트 단위 일괄 끄기만 있음, `answer-reuse.service.ts:282`).

### 3.2 3계층 지식과 호텔 오버레이 — FR-309 · NFR-006

- `tenant_id IS NULL` 공유 문서는 검색만 되고 **콘솔에서 보이지 않고 편집·리뷰·충돌검토가 안 된다**(`knowledge.service.ts:199,259,296,892`가 전부 `where tenantId`). `kb_categories/kb_document_revisions/kb_conflicts.tenant_id`는 NOT NULL이라 공유 문서는 분류 밖으로 흘러나가고 `agent_ids` 스코프 절을 우회한다(항상 전 에이전트에 노출).
- `doc_group`은 콘텐츠 유형 축(counsel/product/operation)이며 카테고리 유니크 키·검색 보너스·보드 매핑·임포터·콘솔 탭에 박혀 있다. 계층 축으로 오버로드하면 전부 충돌한다. 새 `layer`+`segment` 컬럼이 필요하다.
- 런타임 주입 선례 `extraCandidates`(`rag.service.ts:509-553`)는 턴당 임베딩 호출 2회를 더하며, 단건 임베딩 경로는 429 재시도가 없다(`voyage.adapter.ts:36`). 5,500 테넌트에서 병목은 저장소가 아니라 이 호출이다. 물질화 대안은 카탈로그 동기화 형태를 따르되 행 수가 5,500 × N으로 늘고 `reindexAll()` 무페이지 문제(§4)에 걸린다.
- 호텔별 페르소나·운영시간·이관 대상은 §2.1 결정에 따라 테넌트 컬럼 그대로(A) 또는 신규 프로퍼티 오버라이드(B)다.

### 3.3 PII 종류 추가 — FR-007 · NFR-005 · NFR-007

- AI 이그레스 스크럽(`pii-scrub.util.ts`)에 **도어락 코드·베트남 전화번호 형식** 규칙이 없다. 로그 마스킹(`pii.util.ts`)은 이메일·일반 문자열만이다. `sessions.alias`는 관례로만 보호된다.
- 도어락 코드는 "인증된 세션에서만 노출"이 요구인데, 현행 `identityLevel`은 `guest|verified` 2단이고 채널(위젯/앱/릴레이)에 따른 노출 정책은 없다. 릴레이 채널은 동의를 **자동 부여**한다(`messenger-ingest.service.ts:456`).
- `audit_logs`에 `actor_role`이 없고 `created_at`·`(tenant_id, id)` 인덱스가 없다. NFR-007의 `agent_id + evidence_id`는 `retrieval_trace`에만 있고 감사 테이블에는 없다.
- 보존 창은 env 전역 1개(`CONVERSATION_LOG_RETENTION_DAYS` 365)이며 테넌트별이 아니다. PDPD 보관기간을 Go2Joy만 다르게 둘 수 없다. 국외이전: 스테이징이 한국(Cafe24 호스팅)이다.

### 3.4 언어 — FR-008 · NFR-003 · NFR-008

- 베트남어는 감지되지 않을 뿐 아니라 **스페인어로 오판된다.** 감지기(`detect-language.util.ts:25-27`)는 `[ñ¿¡áéíóúü]`를 스페인어 표지로 보는데 베트남어 성조 문자 `á é í ó ú`가 여기에 걸린다. 세션이 locale로 VI로 시작했더라도 `language_locked`가 아니면(`setLanguage` 명시 선택만 잠금, `session.service.ts:510`) 베트남어 2턴 연속 후 `syncSessionLanguage`(`chat.service.ts:1050-1073`)가 세션을 ES로 바꾸고, 이후 RAG 프롬프트는 `Reply in language code: ES`가 된다. 성조 문자가 없는 짧은 베트남어 문장은 EN으로 판정된다. Go2Joy 앱이 브리지 `ivy:command/locale`로 언어를 잠그는 경로에서는 회피되지만, URL `locale` 파라미터만 쓰는 진입점(웹 임베드, Android `launchUrl()`)은 노출된다. 이는 Go2Joy 테넌트에서 **지금 재현 가능한 결함**이며 FR-008 이전에 FIX 대상이다. 감지기 확장은 전 테넌트 공통이다.
- `classifyIntent()`는 언어 힌트를 받지 않는다(`rag.service.ts:610-633`). 베트남어 의도 분류 정확도는 검증된 바 없다.
- NFR-008 모노스페이스 렌더링은 코드에서 검증하지 않았다. 콘솔·위젯의 `font-mono` 사용 구간 목록화가 PLN 항목이다.

### 3.5 Hotel Admin 채팅 채널 — FR-113 · FR-114 · A-01

이 항목은 저장소에서 **가장 잘 맞는 자리**가 있다. `MessengerAdapter` 포트를 구현하면 동의·세션·중복제거·인계·아웃박스가 그대로 붙는다. 터치 파일은 7군데다: `enum.types.ts`(`MESSENGER_PROVIDER`, `MESSENGER_FIELDS`, 필요 시 `DIRECT_MESSENGER_PROVIDERS`), 새 어댑터 + spec, `adapter.registry.ts`, `messenger.module.ts`, `ChannelBadge.tsx`(`CHANNEL_FILTERS`, `TONE`) + `channel.*` i18n, 설정 카드 UI. 웹훅형이면 컨트롤러 변경 없음.

단, A-01(API·웹훅 접근)이 부정되면 이 채널 자체가 없고 Stage 1은 앱 인앱챗(위젯 `?mode=app`)으로만 가능하다. 주의: 폴링형이면 `messenger-sync.service.ts:64`가 매 틱 전 채널을 로드하므로 §4의 규모 문제에 합류한다.

### 3.6 능동 발신 — FR-103 · FR-109 · FR-110

- AI가 대화를 시작하는 경로가 없다. 정산 마감 알림은 (a) 마감 계산 스케줄러 신설 + (b) 발신 채널 선택이 필요하다. 캠페인(`campaign.service.ts`)은 고객 대상·운영자 작성·`NotificationService` 선호도 게이트를 타므로, 파트너가 Go2Joy 테넌트의 *고객*으로 모델링되면 재사용 가능하다. Hotel Admin 채널로 보내려면 아웃박스는 **기존 대화 스레드**에만 쓰므로 스레드 없는 첫 발신 경로가 새로 필요하다.
- REQ는 게스트 아웃바운드를 범위 밖(OQ-009)으로 두었지만 FR-103/109/110은 파트너 아웃바운드다. 수신동의 정책은 파트너에게도 필요하다(캠페인은 `isMarketingCategory` 파생으로 트랜잭셔널/마케팅을 가른다).

### 3.7 자연어 → 검색 파라미터 — FR-201 · FR-202 · FR-206

- 구조화 추출(지역·유형·기간·가격대)은 현행 `classifyIntent` JSON 모드의 확장으로 가능하나, 결과를 **검색 API 호출**로 바꾸는 것은 §2.6의 툴 호출 문제와 같다. 텍스트 전용을 유지하면 "해석 결과 확인"까지만 되고 검색은 앱이 수행한다.
- 정렬·대안 제시는 Go2Joy 검색 API 응답을 컨텍스트로 넣는 형태라 `buildOrderContext` 병렬 함수(`buildSearchContext`)와 `ORDER_CONTEXT_CONFIDENCE` 유사 하한이 필요하다. 주문 인증 게이트(`chat.service.ts:755`)와 재사용 억제(`:796`)는 `needsOrderData`에만 반응하므로 예약·검색 질문에는 **발화하지 않는다.**

---

## 4. 규모(NFR-006, 5,500 테넌트)가 드러내는 현행 결함

요구사항이 새 기능을 요구하지 않는데도 (A) 모델을 택하면 다음이 깨진다. (B) 모델이면 대부분 해당 없음.

| 위치 | 현행 동작 | 5,500에서 |
|---|---|---|
| `product/product-sync.service.ts:130,154` | `tenantRepo.find()` 전 테넌트 메모리 적재 후 직렬 동기화, 부팅 시 `initialSyncAll` | 1틱이 끝나지 않음, 부팅 지연 |
| `order/scheduled-*-sync.service.ts` ×5 | provider별 테넌트 직렬 `for`, `setInterval` | 동일 |
| `messenger/messenger-sync.service.ts:64` | 매 15초 전 활성 채널 로드, 채널당 200 스레드 커서 | 폴링형 채널이 있으면 붕괴 |
| `knowledge.service.ts:762-775 reindexAll()` | 테넌트 무스코프·무페이지 `find()` | OOM |
| `privacy/retention.service.ts:110-145` | 전역 퍼지, `sessions … NOT IN (SELECT session_id FROM conversations)` 풀스캔 | 퍼지 틱 장시간 락 |
| `tenant-context.interceptor.ts:51-55` | 위젯 요청마다 `SELECT tenant_id FROM sessions` 비캐시 | 최다 경로에서 DB 1회 추가 |
| `tenant-context.interceptor.ts:69-73`, `session.service.ts:251`, `auth.service.ts:177` | "테넌트가 정확히 1개일 때만 기본값" | 이미 2개에서 막힘. 슬러그 없는 로그인은 id 1로 바인딩 |
| `tenant.service.ts:302-317 generateUniqueSlug()` | 충돌마다 쿼리 1회 | 흔한 호텔명 대량 생성 시 O(n²) |
| `tenant.service.ts:774`, `cafe24-token.service.ts:32` | 테넌트별 무제한 인메모리 Map | 메모리 누적 |
| `knowledge-gap.service.ts:75` | 전 테넌트 통계를 JS Map으로 집계 | 메모리·지연 |
| `audit.service.ts:88-90` | `ORDER BY id DESC` + skip/take, `created_at` 인덱스 없음 | 깊은 페이지 느림 |
| 프로비저닝 | `POST /tenants` 단건 + Shopify OAuth 업서트뿐. 기본 AI 에이전트·KB 카테고리·위젯 설정은 전부 **지연 생성** | 대량 생성 API 없음. `CATEGORY_ORIGIN.SEED`는 선언만 있고 사용처 0 |
| 콘솔 | `TenantsPage.tsx` 목록, 테넌트별 메뉴 모달 | 5,500행 목록·개별 설정 운영 불가 |

이 표의 항목들은 FR 번호가 없다. PLN에서 "NFR-006 선행 작업"으로 별도 스테이지를 두어야 한다.

---

## 5. 기존 테넌트 회귀 위험 (공유 파이프라인 변경 시)

Go2Joy를 위해 아래를 바꾸면 ivyusa 등 **모든 테넌트**가 영향을 받는다. PLN의 각 항목은 "테넌트 게이트 여부"를 명시해야 한다.

1. **의도 레이블 집합**(§2.3) — 전역 상수. 소비처 4곳.
2. **`messages.retrieval_trace` JSON** — 이미 citations·scenario·chips·answeredFrom·reuseId·relayedFrom·handoff reason이 한 컬럼에 섞여 있다. evidence_id·agent_id·ui_version을 더 넣으면 `chat.mapper.ts:23,42`, `question-stats.service.ts:211,228`, `issue.service.ts:326`, `ai-coach.service.ts:126`을 깨지 않아야 한다.
3. **신뢰도 임계·근거 0건 처리**(§3.1) — 전 테넌트 인계율이 바뀐다. 8/13 저신뢰 잡담 인계 튜닝(REQ-260813)이 되돌아갈 수 있다.
4. **`handleUserMessage` 단계 순서** — 새 게이트(예약 인증, 귀책 분류, 액션 화이트리스트)를 어디에 끼우느냐에 따라 deny-list answer-first(`:761-766`), 초안 모드 조기 반환(`:890-905`, 이후 부수효과 미발화), `reply: null` 5개 분기(`:572,632,678,847,871`)와 상호작용한다.
5. **언어 감지기 확장** — VI 추가 시 KO/EN 2턴 연속 규칙과의 오판 상호작용. NFR-003 오판율 ≤1%는 회귀 테스트 없이는 보장 불가.
6. **PII 스크럽 규칙 추가** — 보수적 설계(가격·날짜·우편번호 비마스킹)를 유지해야 주문 답변이 깨지지 않는다.
7. **서명 신원 페이로드 확장**(§2.2) — 기존 Android SDK·RN·embed.js 호환성. `hash`만 검증하는 현행 호출자는 그대로 동작해야 한다.
8. **`tenant_id IS NULL` KB 쓰기 경로 신설**(§3.2) — 콘솔 조회가 전부 `where tenantId`라 공유 문서가 "보이지 않는 답변 근거"가 된다. 이는 memory의 "invisible fallback trap"과 같은 유형이다.
9. **Qdrant payload 인덱스 추가** — 기존 컬렉션에 인덱스가 생기지 않으므로 스테이징·프로덕션 재색인 런북이 필요하다. 스테이징은 `DB_SYNCHRONIZE=false`라 SQL 선적용도 함께다.

---

## 6. 요구사항 문서 자체의 정합성 문제 (구현 전 정정 대상)

REQ 저장 시 확인한 사항이다. PLN 착수 전 REQ v1.0.1로 정정하는 것이 맞다.

- §1.3 "근거 없는 FR은 두지 않는다"와 어긋나는 FR: 012, 013, 115, 204, 207, 302, 304, 307.
- P0인데 MVP(SP1) 밖: FR-106, FR-114. 근거 없는 FR-115는 MVP 안.
- 추적표와 근거 열 불일치: SC-303↔FR-111(근거 "콘솔 관찰"), SC-305↔FR-006(근거 SC-302만).
- OQ-001/004/009/011/012/013 참조되나 Open Questions 절 없음. BLOCKER 2건이 걸려 있다.
- 참조 산출물(`SHARPTALK-G2J-AGENTCAT-1.2.0`, `sharptalk-g2j-func-definition.md`) 저장소 부재.
- FR-013(음성 어댑터)은 현행 어댑터 계층이 텍스트 완결형이라 "입출력 어댑터만 교체"가 성립하려면 §2.6의 액션 계층과 함께 설계되어야 한다.

---

## 7. PLN 전 결정 목록

| # | 결정 | 좌우되는 FR | 비고 |
|---|---|---|---|
| D1 | 테넌트 축: (A) 호텔=테넌트 / (B) Go2Joy 단일 테넌트 + property 축 / (C) Stage별 혼합 | 001, 009, 011, 304, 309, NFR-006 | BizModel REQ는 (A). (A)면 §4 전부 선행 |
| D2 | AI 쓰기 범위: 텍스트 전용 유지 vs 툴 호출 도입 | 005, 006, 102, 114, 201, 306, 310, 013 | A-04/OQ-012와 동일. 텍스트 전용이면 FR-306·310은 "접수 문구 + 티켓"으로 축소 |
| D3 | 에이전트 분리 수준: 실제 라우팅 vs 페르소나 1 + 지식 스코프 | 002, 카탈로그 전체 | 실제 라우팅이면 의도 레이블 전역 변경 |
| D4 | 근거 정책: 0건 시 LLM 미호출로 강화할지, 테넌트별 임계를 둘지 | 003, 010, 203, NFR-002 | 전 테넌트 인계율 영향 |
| D5 | KB 버전 단위: 문서 vs 청크 | 010 | 청크면 Qdrant id 가정 파기 |
| D6 | 공유 지식 계층: `tenant_id NULL` 쓰기 경로 신설 vs 테넌트별 복제 | 309, 3계층 | 신설이면 콘솔 가시성 필수 |
| D7 | 파트너 역할·호텔 스코프 전달: 서명 페이로드 확장 여부 | 001, 104~106, 112 | SDK 3종 계약 변경 |
| D8 | Stage 1 채널: Hotel Admin API(A-01) vs 앱 위젯 | 113, 114, 103 | A-01 부정 시 능동 발신 경로 재설계 |
| D9 | 예약·정산 저장 모델: 신규 `bookings`/`settlements` 도메인 (권고) vs `orders_cache` 오버로드 | 101~109, 301, 306, 307 | 오버로드 비권고 |
| D10 | NFR-009 가드레일 회귀를 배포 게이트로 쓸 테스트 인프라 | NFR-009, 성공지표 "0건" | 현재 e2e HTTP 테스트·CI 게이트 부재(CLAUDE.md §6) |

---

## 8. 결론

- 요구사항 45개 중 **현행 구조로 "그냥 되는" 것은 없다.** 가장 가까운 것은 FR-113(채널 어댑터)·FR-309(A 모델일 때 테넌트 설정)·FR-008(응답 언어 지정)이다.
- 구조 결정 D1·D2·D3이 없으면 PLN을 쓸 수 없다. 특히 D1은 §4의 선행 작업 유무를 결정하므로 일정에 가장 큰 변수다.
- 요구사항이 요구하지 않는데도 고쳐야 하는 현행 결함이 다섯 가지 확인되었다: 위젯 세션 토큰 무네임스페이스, `integration_status` 무테넌트, `integration-providers.ts` 드리프트, `ESCALATION_CONFIDENCE` 하드코딩, **베트남어→스페인어 오판**. 이 중 세션 토큰과 베트남어 오판은 Go2Joy 테넌트에서 지금 재현되는 결함이라 요구사항 착수와 무관하게 FIX 대상이다.
