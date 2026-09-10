# PLN-260910 — 지식 페이지 업무 순서 재배치 (Source → Sync → Board → KB-Document)

- 근거: `docs/analysis/REQ-260910-Knowledge-Page-Workflow-Layout.md`
- 범위: 콘솔 `/knowledge` 좌측 컬럼 재배열 + 프로세스 설명 교체 + 보드 카드 + 사용법 가이드 테넌트 플래그
- 브랜치: `session/board-view` → `feature/knowledge-workflow-layout` PR 1건 (스키마 변경 포함 → PR 본문 `## Migration`)

## 0. 설계 결정

| # | 결정 | 내용 |
|---|---|---|
| D-1 | 플래그 | `tenants.usage_guides_enabled TINYINT(1) NOT NULL DEFAULT 0`. 엔티티 `usageGuidesEnabled: boolean`(type 명시). 마이그레이션이 `slug='ivyusa'` **또는 `usage:` 가이드 문서 보유 테넌트**를 1로 세움(REQ D-3) |
| D-2 | API | `GET /tenants/knowledge-settings` → `{usageGuidesEnabled}` — **`@RequireMenu('knowledge')` 전원**(지식 페이지 렌더 조건이므로 staff도 읽어야 함). `PATCH /tenants/knowledge-settings` body `{usage_guides_enabled: boolean}` — `@RequireRank(MASTER, DIRECTOR)` + `AuditService.write('tenant.knowledge_settings_updated')`. 스토어프런트 endpoint 패턴 복제 |
| D-3 | 설정 UI | 콘솔 **설정 > 기본**, StorefrontCard 다음에 `KnowledgeOptionsCard`(체크박스 1개 + 설명 + [저장], 토스트 성공/실패). master/director만 페이지 진입 가능한 기존 게이트 그대로 |
| D-4 | 지식 페이지 게이트 | `useKnowledgeSettings()`가 `usageGuidesEnabled=false`면 사용법 가이드 카드·유형 편집 모달·프로세스 설명의 "(옵션) 가이드" 줄을 **렌더하지 않음**. 로딩 중에는 숨김(깜빡임 방지). 데이터·RAG 인용은 불변 |
| D-5 | 보드 카드 | 배너를 카드로 승격해 카테고리 다음에 배치. 내용: 설명 1줄 + "검토 대기 N · 채택 M" + [보드에 작성](primary, `/knowledge/board/new?group=…`) + [보드 열기]. N/M = 기존 `GET /board/documents?status=published|promoted&size=1`의 `pagination.total` (신규 API 0, 쿼리키에 tenantId) |
| D-6 | 프로세스 설명 | 4단계 `소스 → 동기화 → 보드 → 지식베이스문서` + 상단 서술 1문단(REQ §2.2) + 각주 2줄(보드를 거치지 않는 빠른 길 / 카테고리=분류+에이전트 범위) + 플래그 ON 시 "(옵션) 사용법 가이드" 각주. 단계 카드 클릭 → 해당 섹션으로 `scrollIntoView`(②는 소스 카드) |
| D-7 | 카드 제목 번호 | `① 소스`, `③ 보드`, `④ 지식베이스문서`. 사용법 가이드·카테고리는 번호 없음(설정 성격, REQ D-1). ②동기화는 소스 행 동작이라 카드 없음 |
| D-8 | 인박스 유지 | GapTasksSection(상단)·답변 제안(소스 아래)은 현 위치·조건부 렌더 유지(REQ D-4) |
| D-9 | i18n | `knowledge.guide.*` 문안 교체 + 신규 키(`boardCard*`, `guide.intro`, `guide.noteOptionalGuide`, `stepNo`), `settings.knowledgeOptions.*` — **6개 언어 전부**, `npm run i18n:check` 통과 필수 |

## 1. 백엔드 작업 (apps/api)

| # | 파일 | 작업 |
|---|---|---|
| B-1 | `sql/260910-tenant-usage-guides-flag.sql` | `ALTER TABLE tenants ADD COLUMN usage_guides_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER workflow_mode;` + `UPDATE tenants SET usage_guides_enabled=1 WHERE slug='ivyusa' OR id IN (SELECT DISTINCT tenant_id FROM kb_documents WHERE external_key LIKE 'usage:%');` · `sql/01-schema.sql` 동기화 · `npm run migrations:manifest` |
| B-2 | `tenant/entity/tenant.entity.ts` | `@Column({ name: 'usage_guides_enabled', type: 'tinyint', width: 1, default: 0, transformer: boolTransformer })` (기존 bool 컬럼 패턴 확인 후 동일 적용) |
| B-3 | `tenant/dto/request/tenant.request.ts` | `UpdateKnowledgeSettingsRequest { @IsBoolean() usage_guides_enabled: boolean }` |
| B-4 | `tenant/tenant.service.ts` · `tenant.mapper.ts` | `getKnowledgeSettings(tenantId)` / `updateKnowledgeSettings(tenantId, dto, actor)` + 감사 · `toKnowledgeSettings()` → `{usageGuidesEnabled}` |
| B-5 | `tenant/tenant.controller.ts` | `@Get('knowledge-settings') @RequireMenu('knowledge')` · `@Patch('knowledge-settings') @RequireRank(MASTER, DIRECTOR)` (Swagger summary 포함) |
| B-6 | `tenant.service.spec.ts` | 저장·감사 호출 단위 테스트 2건 |

## 2. 콘솔 작업 (apps/web)

| # | 파일 | 작업 |
|---|---|---|
| W-1 | `settings/settings.service.ts` · `settings.hooks.ts` | `knowledgeSettings()` / `updateKnowledgeSettings()` + `useKnowledgeSettings`(키 `['knowledge-settings', tenantKey]`) / `useUpdateKnowledgeSettings`(성공 토스트·invalidate) |
| W-2 | `settings/KnowledgeOptionsCard.tsx` (신규) · `SettingsBasicPage.tsx` | 체크박스 "상품 사용법 가이드 사용" + 설명("상품 유형별 사용법을 지식으로 관리 — 쇼핑몰 테넌트용") + [저장] |
| W-3 | `knowledge/KnowledgeGuides.tsx` `ProcessGuide` | 4단계 교체·서술·각주·클릭 스크롤(`onJump(sectionId)`), `optionalGuide` prop |
| W-4 | `knowledge/BoardCard.tsx` (신규) | D-5. `useBoardStatusCounts()`(board.hooks에 추가, 2쿼리) |
| W-5 | `knowledge/KnowledgePage.tsx` | 좌측 컬럼 순서 변경(소스 → [가이드] → 카테고리 → 보드 카드 → 지식베이스문서), 각 카드에 `id`(`sec-sources`/`sec-guides`/`sec-categories`/`sec-board`/`sec-documents`)·번호 제목, 상단 배너 제거, 가이드 카드·`UsageTypeEditor` 조건부 렌더, `sourcesHint` 문안 갱신 |
| W-6 | `i18n/locales/{en,es,ko,vi,ja,zh}/{knowledge,settings}.json` | D-9 |
| W-7 | 매뉴얼 | `docs/manual`/`apps/web/public/manual`의 지식 페이지 절은 **RPT 단계에서 스크린샷 재캡처 대상 목록만 기록**(캡처는 별건, `scripts/manual-screenshots.mjs`) |

## 3. UI 와이어프레임

### 3.1 `/knowledge` (TO-BE, 플래그 ON = ivyusa)

```
지식                                                  소스·보드·지식베이스문서를 관리하세요
┌ 지식이 만들어지는 과정 ──────────────────────────────────────────────── [접기 ˄] ┐
│ 샵톡 AI 에이전트는 지식베이스문서에 정의된 내용을 기준으로 답변합니다. 노션·드라이브·  │
│ 문서로 보관하던 기존 자산(정책·가이드·매뉴얼)을 소스로 가져와 보드에 1차 가공하고,     │
│ 검토·시뮬레이션을 거쳐 에이전트가 참조하는 지식베이스문서로 만듭니다.                │
│ ┌─① 소스────────┐ ┌─② 동기화──────┐ ┌─③ 보드────────┐ ┌─④ 지식베이스문서─┐        │
│ │ Drive·Notion   │ │ 소스 행의      │ │ 1차 가공·검토  │ │ 답변의 유일한    │        │
│ │ 기존 자산 연결  │ │ [동기화]로 수집 │ │ 시뮬레이션→채택│ │ 근거             │        │
│ └────────────────┘ └────────────────┘ └────────────────┘ └──────────────────┘        │
│  (각 단계 클릭 → 아래 해당 섹션으로 이동)                                            │
│ · 빠른 길: 지식베이스문서 직접 추가·카탈로그 동기화·상품 CSV는 보드를 거치지 않습니다  │
│ · 카테고리는 분류이자, 범위를 좁히면 어느 에이전트가 인용할 수 있는지를 정합니다      │
│ · (옵션) 상품 유형별 사용법 가이드는 설정 > 기본에서 켜면 아래에 나타납니다  ← ON일 때만│
└──────────────────────────────────────────────────────────────────────────────────────┘
[지식 공백 제안 N]  (있을 때만)

┌ ① 소스 ───────────────────────────────── [소스 추가] ┐  ┌ KB 질의 패널 (sticky) ┐
│ 힌트: 외부 문서를 최신으로 유지하는 통로 — [동기화]     │  │ (변경 없음)            │
│ 전까지 지식이 되지 않습니다. 한 번만 가져올 문서는     │  └────────────────────────┘
│ 보드에 바로 작성이 더 빠릅니다.                        │
│ ┌ 소스 목록 (동기화 / 이력 / 삭제) ────────────────┐ │
│ └──────────────────────────────────────────────────┘ │
│ [Google Drive 자격증명] [Notion 자격증명]              │
└────────────────────────────────────────────────────────┘
[답변 제안 N] (있을 때만)

┌ 사용법 가이드 (옵션) ─────────────────── [유형 추가] ┐   ← usage_guides_enabled=1 일 때만
│ 힌트: 사용법은 유형에 붙는 지식 …                     │
│ 유형 | 상품 수 | 상태 | [작성/편집] [↑][↓]             │
└────────────────────────────────────────────────────────┘

┌ 카테고리 ─────────────────────────────── [카테고리 추가] ┐
│ (CategoryManagerCard, 변경 없음)                          │
└──────────────────────────────────────────────────────────┘

┌ ③ 보드 — Smart Knowledge Board ─────────────────────────────┐
│ 소스에서 가져온 자산과 새 지식은 보드에 먼저 작성·게시하고,   │
│ 시뮬레이션으로 확인한 뒤 지식베이스문서로 채택합니다.          │
│ 검토 대기 2건 · 채택 1건            [보드에 작성] [보드 열기] │
└──────────────────────────────────────────────────────────────┘

┌ ④ 지식베이스문서 ──── [카탈로그 동기화] [상품 CSV] [일괄] [추가] ┐
│ (목록·필터·상세 — 변경 없음, 출처 뱃지 [보드] 유지)               │
└──────────────────────────────────────────────────────────────────┘
```

플래그 OFF(그 외 테넌트): "사용법 가이드" 카드와 각주 3번째 줄이 통째로 빠지고 나머지 동일.

### 3.2 설정 > 기본 — 지식 옵션 카드 (신규)

```
┌ 지식 옵션 ───────────────────────────────────────────────┐
│ [✓] 상품 사용법 가이드 사용                                │
│     상품 유형별 사용법을 지식으로 관리합니다. 쇼핑몰 테넌트에 │
│     유용하며, 켜면 지식 페이지에 "사용법 가이드" 섹션이      │
│     나타납니다. 꺼도 작성된 가이드와 답변 인용은 유지됩니다. │
│                                               [저장]        │
└──────────────────────────────────────────────────────────┘
저장 → 토스트 "지식 옵션이 저장되었습니다" / 실패 시 수동 닫기 에러 토스트
```

### 3.3 프로세스 설명 접힘 상태

```
˅ 지식이 만들어지는 과정        (변경 없음 — 한 줄 토글)
```

## 4. 단계별 실행 순서

1. B-1~B-6 백엔드 + 실부팅 확인(`Nest application successfully started`, 엔티티 변경)
2. W-1~W-2 설정 카드 → 로컬에서 ON/OFF 저장 확인
3. W-3~W-6 지식 페이지 → 플래그 ON/OFF 두 상태 스크린 확인, `npm run i18n:check`, `npm run typecheck`
4. TCR 작성 → 단위/통합/엣지 실행
5. PR(`## Migration` 섹션: SQL 경로·env별 체크·롤백 `ALTER TABLE tenants DROP COLUMN usage_guides_enabled`)
6. 스테이징: **SQL 선적용 → 배포 → `pre-deploy-check`** → ivyusa(ON)·go2joy(OFF) 두 테넌트로 실화면 확인 → RPT

## 5. 측면 영향

| 영역 | 영향 | 대응 |
|---|---|---|
| RAG 인용 | 없음 — 가이드 문서·`usage:` 키·인용 로직 불변 | D-4 |
| 위젯/API 계약 | 없음 (콘솔 전용 endpoint 추가만) | — |
| 사용자 매뉴얼(3언어) | 지식 페이지 절의 캡처 3~4장·섹션 순서 서술이 구식이 됨 | W-7: RPT에 재캡처 목록 기록, 별건 처리 |
| 테넌트 생성 시드 | 신규 테넌트 기본 OFF → 시드가 넣는 기본 유형 3종은 보이지 않음(데이터는 생성됨) | 의도된 동작. 시드에서 유형 생성을 중단할지는 후속 판단(범위 밖) |
| 플랫폼 어드민 | 플래그를 어드민 화면에서 보거나 바꾸는 UI 없음 | 범위 밖 — 필요 시 [요금제·애드온] 모달에 표시 추가(후속) |
| localStorage 접힘 키 | 유지 | — |
| 매직 위치 링크 | `/knowledge/board/new?group=` 프리필 기존 계약 재사용 | — |

## 6. 리스크

- **엔티티 boolean 컬럼 매핑**: tinyint ↔ boolean transformer가 리포에 이미 있는지 확인 후 동일 적용
  (없으면 `type: 'tinyint'` + 서비스에서 `Boolean()`). 엔티티 변경 후 실부팅 확인 필수(dev-kit A-1).
- **staff 계정의 GET 권한**: PATCH와 같은 rank 게이트를 걸면 staff에게 지식 페이지가 가이드 없이 뜨는 게
  아니라 401/403 토스트가 뜬다 — GET은 반드시 메뉴 게이트만(D-2).
- **보드 카운트 2쿼리**: 목록 endpoint를 size=1로 두 번 호출 — 부담 미미. 실패 시 숫자 줄만 숨기고 버튼은
  유지(카운트 실패가 보드 진입을 막지 않게).
- **i18n 누락 = 조용한 영어 폴백**: 6언어 키를 한 커밋에 넣고 `i18n:check`로 게이트.

## 7. 범위 밖 (기록)

- 플랫폼 어드민에서의 플래그 조회/변경, 테넌트 시드의 기본 usage_types 3종 생성 중단 여부,
  매뉴얼 스크린샷 재캡처 실행, 프로세스 설명 접힘 상태의 서버 저장.
