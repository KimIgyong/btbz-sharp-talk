# TCR-260910 — 지식 페이지 업무 순서 재배치

- 근거: `docs/plan/PLN-260910-Knowledge-Page-Workflow-Layout.md`
- 환경: 로컬 dev(API dist 부팅 + vite, MySQL `DB_SYNCHRONIZE=true`), 테넌트 ivyusa(dev@, master)

## 1. 단위 테스트 (jest, `apps/api`)

| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `TenantService.updateKnowledgeSettings` | `usage_guides_enabled: true` | 컬럼 1 저장 + 감사 `tenant.knowledge_settings_updated` / `usage_guides:on` | PASS |
| U-2 | 〃 | `false` (기존 1) | 컬럼 0 저장 + 감사 target `usage_guides:off` | PASS |
| U-3 | 기존 `tenant.service.spec.ts` 9건 | 회귀 | 전부 통과 | PASS (11/11) |

## 2. 정적 검사

| ID | 검사 | 결과 |
|---|---|---|
| S-1 | `tsc --noEmit` (apps/api) | PASS |
| S-2 | `tsc --noEmit` (apps/web) | PASS (fragment 누락·`pagination.total`→`total` 2건 수정 후) |
| S-3 | `npm run i18n:check` | es/ko/vi/ja/zh complete |
| S-4 | `npm run migrations:manifest` | `260910-tenant-usage-guides-flag.sql column tenants usage_guides_enabled` 등재 |
| S-5 | 엔티티 변경 후 실부팅 | `Nest application successfully started`, `SHOW COLUMNS FROM tenants LIKE 'usage_guides_enabled'` → tinyint(1) NOT NULL DEFAULT 0 |

## 3. 통합 시나리오 (API, curl)

| ID | 요청 | 기대 | 결과 |
|---|---|---|---|
| I-1 | `GET /tenants/knowledge-settings` (master) | `{usageGuidesEnabled:false}` (기본) | PASS |
| I-2 | `PATCH … {usage_guides_enabled:true}` | `{usageGuidesEnabled:true}` + 감사 행 `usage_guides:on` | PASS (audit_logs 최신 행 확인) |
| I-3 | `PATCH … {usage_guides_enabled:"yes"}` | E5003 Validation failed (`must be a boolean value`) | PASS |
| I-4 | `GET` 재조회 | `true` 유지 | PASS |
| I-5 | `GET /board/documents?status=published&size=1` | `total` 제공 (보드 카드 카운트 재료) | PASS |
| I-6 | 미인증 GET/PATCH | E1001 | PASS |

## 4. 콘솔 시나리오 (브라우저, localhost:5173)

| ID | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| C-1 | `/knowledge` 최초 진입(플래그 ON) | 프로세스 설명 4단계 소스→동기화→보드→지식베이스문서 + 서술 + 각주 3줄(옵션 가이드 포함) | PASS |
| C-2 | 좌측 컬럼 순서 | ① 소스 → 사용법 가이드 → 카테고리 → ③ 보드 카드 → ④ 지식베이스문서, 상단 배너 제거 | PASS |
| C-3 | 단계 카드 클릭(③ 보드) | 보드 카드가 뷰포트 상단으로 스크롤 | PASS (smooth→instant 교체 후; smooth는 자동화 환경에서 무동작) |
| C-4 | 설정 > 기본 "지식 옵션" 카드 | 체크박스+설명, 체크 해제 → [저장] → 토스트 "Knowledge options saved" | PASS |
| C-5 | 플래그 OFF 후 `/knowledge` | 사용법 가이드 카드·유형 편집 모달·옵션 각주 미렌더(`#sec-guides` 없음), 나머지 동일 | PASS |
| C-6 | 플래그 ON 복귀 | 가이드 카드 재표시 | PASS |
| C-7 | 한국어 UI | 4단계·서술·보드 카드 문안 한국어, 카운트 "검토 대기 N건 · 채택 M건" | PASS |
| C-8 | 보드 카드 [보드에 작성] | `/knowledge/board/new?group=counsel` 프리필 진입 | PASS (기존 계약) |

## 5. 엣지 케이스

| ID | 케이스 | 처리 | 결과 |
|---|---|---|---|
| E-1 | 플래그 로딩 중 | 가이드 섹션 숨김 유지(깜빡임 없음) — `data?.usageGuidesEnabled === true` 만 렌더 | 코드 검토 PASS |
| E-2 | 보드 카운트 조회 실패 | 숫자 줄만 미표시, [보드 열기]/[보드에 작성] 유지 | 코드 검토 PASS (`counts.data &&`) |
| E-3 | staff 계정이 `/knowledge` 진입 | GET은 `@RequireMenu('knowledge')` — rank 게이트 아님 → 페이지 정상 | 코드 검토 PASS (로컬 staff 계정은 invited 상태라 로그인 불가, 스테이징 RPT에서 재확인) |
| E-4 | 마이그레이션 백필 | ivyusa 또는 `usage:` 가이드 보유 테넌트만 1 | SQL 검토 PASS, 스테이징 적용 시 실측 |
| E-5 | 프로세스 설명 접힘 상태 | 한 줄 토글 유지, 펼치면 새 문안 | PASS |
