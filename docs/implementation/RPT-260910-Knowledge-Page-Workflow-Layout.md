# RPT-260910 — 지식 페이지 업무 순서 재배치 (Source → Sync → Board → KB-Document)

- 근거: REQ/PLN/TCR-260910-Knowledge-Page-Workflow-Layout
- PR: **#495** (squash → main `1e6fc87`, 2026-09-10) · 브랜치 `session/board-view`
- 승인: 사용자 "승인, 설정 > 기본 위치로 진행"

## 1. 무엇이 바뀌었나

| 영역 | 변경 |
|---|---|
| 프로세스 설명 | 4단계 **소스 → 동기화 → 보드 → 지식베이스문서** + 요청 서술 1문단 + 각주(보드를 거치지 않는 빠른 길 / 카테고리 / 옵션 가이드). 단계 카드 클릭 → 해당 섹션으로 이동(②동기화는 소스 카드) |
| 섹션 순서 | ① 소스 → (옵션) 사용법 가이드 → 카테고리 → **③ 보드 카드** → ④ 지식베이스문서. 상단 보드 배너 제거, 인박스 2종(지식 공백·답변 제안)은 조건부 렌더 그대로 |
| 보드 카드 | 설명 + "검토 대기 N건 · 채택 M건"(기존 목록 endpoint `size=1` total 2회, 신규 API 0) + [보드 열기] [보드에 작성](`?group=` 프리필) |
| 사용법 가이드 게이트 | `tenants.usage_guides_enabled`(기본 0). `GET /tenants/knowledge-settings`(`@RequireMenu('knowledge')`) / `PATCH`(master·director, 감사 `tenant.knowledge_settings_updated`). OFF = 카드·유형 편집 모달·옵션 각주만 미렌더, 데이터·RAG 인용 불변 |
| 설정 UI | 콘솔 **설정 > 기본** StorefrontCard 다음 "지식 옵션" 카드(체크박스 + 설명 + 저장, 성공/실패 토스트) |
| 공통 | `Card`에 `id` prop + `scroll-mt-4`, `StepNo` 배지(원형 숫자 글리프가 UI 폰트에서 아이콘처럼 작게 렌더되어 교체) |
| i18n | en/es/ko/vi/ja/zh `knowledge.guide.*`·`boardCard.*`·`subtitle`·`sourcesHint`, `settings.knowledgeOptions.*`; `boardBanner*` 3키 제거. `i18n:check` complete |

## 2. 파일

- API: `tenant/entity/tenant.entity.ts`(컬럼) · `dto/request/tenant.request.ts`(`UpdateKnowledgeSettingsRequest`) · `dto/response/tenant.response.ts` · `tenant.mapper.ts` · `tenant.service.ts`(`updateKnowledgeSettings`) · `tenant.controller.ts`(GET/PATCH) · `tenant.service.spec.ts`(+2)
- Web: `components/Card.tsx` · `domain/board/board.hooks.ts`(`useBoardStatusCounts`) · `domain/knowledge/KnowledgeGuides.tsx`(ProcessGuide 재작성, `KNOWLEDGE_SECTION`, `StepNo`) · `domain/knowledge/BoardCard.tsx`(신규) · `domain/knowledge/KnowledgePage.tsx`(순서·게이트) · `domain/settings/KnowledgeOptionsCard.tsx`(신규) · `settings.service.ts` · `settings.hooks.ts` · `SettingsBasicPage.tsx` · `i18n/locales/*/{knowledge,settings}.json`
- SQL: `sql/260910-tenant-usage-guides-flag.sql` · `docker/init-sql/01-schema.sql` · `sql/artefacts.tsv`
- 문서: REQ/PLN/TCR/RPT-260910

## 3. 테스트 결과 (TCR-260910)

- jest `tenant.service.spec.ts` **11/11**, `tsc` api/web 통과, `i18n:check` 5언어 complete, `migrations:manifest` 등재
- 엔티티 변경 실부팅: 로컬 `Nest application successfully started` + 컬럼 자동 생성 확인
- API curl: GET 기본 false → PATCH true → 감사 행 `usage_guides:on` → 비불리언 E5003 → 재조회 true; 미인증 E1001
- 콘솔(로컬): ON/OFF 두 상태, 설정 카드 저장 토스트, 단계 클릭 점프(보드 카드 top 16px), 한국어 문안·카운트("검토 대기 4건 · 채택 0건")
- CI: typecheck·test·build pass, CodeRabbit 6건(Major 2: 저장·감사 원자성 — 기존 storefront 등 동일 패턴이라 이번 범위 밖 / SQL 멱등 가드 — 리포 관례(`SHOW COLUMNS` 수동 가드) 유지)

## 4. 배포 상태

| 항목 | 상태 |
|---|---|
| SQL staging | **적용 완료** 2026-09-10 (배포 전 선적용). 결과: ivyusa=1, 나머지 13개 테넌트=0 (가이드 보유 테넌트 0곳 — REQ §1.2와 일치) |
| 코드 staging | main `1e6fc87` 배포 완료. `sharptalk_api_staging` Up (healthy) 신규 컨테이너, 부팅 로그 `successfully started`, `/health` ok, `GET /tenants/knowledge-settings` 미인증 **401**(=배포됨) |
| 스테이징 실확인 | ivyusa master 로그인 → `usageGuidesEnabled:true`; 콘솔 `/knowledge` 새 배치·보드 카드 렌더 확인 |
| production | 미배포(호스트 미정) — 배포 시 SQL 선적용 필수 |

## 5. 잔여·후속

- 플랫폼 어드민에서 플래그 조회/변경 UI 없음(필요 시 [요금제·애드온] 모달에 추가)
- 테넌트 생성 시드가 넣는 기본 usage_types 3종: 플래그 OFF면 보이지 않음 — 생성 중단 여부는 별도 판단
- 사용자 매뉴얼 지식 절(3언어) 캡처 3~4장·섹션 순서 서술이 구식 — `scripts/manual-screenshots.mjs`로 재캡처 별건
- CodeRabbit Major 2건은 리포 전반 패턴 사안으로 기록만(감사 원자성은 dev-kit 후속 후보)
