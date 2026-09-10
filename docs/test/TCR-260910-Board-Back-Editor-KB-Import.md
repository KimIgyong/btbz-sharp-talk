# TCR-260910 — 보드 뒤로가기 · 에디터 기본 모드 · 지식베이스문서 보드로 가져오기

- 근거: `docs/plan/PLN-260910-Board-Back-Editor-KB-Import.md`
- 환경: 로컬 dev(API dist 부팅 + vite), 테넌트 ivyusa(dev@, master), KB 직접 문서 12건

## 1. 단위 테스트 (jest, `apps/api`)

| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `BoardKbImportService.reasonFor` | `source_id` 있음 / catalog / board 출처 / `usage:` 키 | 각각 `synced_source`·`catalog`·`board_origin`·`usage_guide` | PASS |
| U-2 | 〃 | 직접·knowledge_gap·타 외부키 | null(자격 있음) | PASS |
| U-3 | `import()` | 2건(키 없음/있음) + 중복 id | created 2, 키 없는 행만 `BRD-{boardId}` 부여, 감사 `board.kb_imported` | PASS |
| U-4 | `import()` | 이미 연결 1 + catalog 1 + 없는 id | skipped 1, invalid 2(`catalog`,`not_found`), 생성 0 | PASS |
| U-5 | `BoardReviewService.promote` | `promotedDocumentId`만 있고 키 없는 KB 행 | id 링크로 같은 행 갱신 + `BRD-` 키 백필, 행 수 1 | PASS |
| U-6 | 기존 board/board-review 스펙 | 회귀 | 6 suites 39 tests | PASS |

## 2. 정적 검사

| ID | 검사 | 결과 |
|---|---|---|
| S-1 | `tsc --noEmit` api / web | PASS |
| S-2 | `npm run i18n:check` | es/ko/vi/ja/zh complete |
| S-3 | 모듈 주입 변경(BoardKbImportService·knowledge.controller ← BoardReviewService) 후 실부팅 | `Nest application successfully started` |

## 3. 통합 시나리오 (API, curl · 로컬)

| ID | 요청 | 기대 | 결과 |
|---|---|---|---|
| I-1 | `GET /board/import/kb-candidates?group=counsel` | 직접 문서 12건, `linkedBoardDocumentId` null | PASS (total 12) |
| I-2 | `POST /board/import/kb {document_ids:[1,2,999999]}` | created 2 · invalid 1(`not_found`) | PASS |
| I-3 | 같은 ids 재요청 | created 0 · skipped 2 | PASS |
| I-4 | 후보 재조회 | 1·2행 `linkedBoardDocumentId`=7·8 | PASS |
| I-5 | `GET /knowledge/documents/1` | `externalKey='BRD-7'`, `boardDocumentId='7'`, source 불변(`knowledge_store`) | PASS |
| I-6 | `GET /board/documents/7` | status promoted, promotedDocumentId 1, tags `kb-import`, revisionBehind false | PASS |
| I-7 | 보드 문서 본문 수정 → 상세 | revisionBehind **true** | PASS |
| I-8 | `POST /board/documents/7/promote` | KB 1행 content 갱신·embedded, `BRD-7` 행 수 **1**(중복 없음) | PASS |
| I-9 | 감사 | `board.kb_imported` 행 기록 | PASS |

## 4. 콘솔 시나리오 (브라우저, localhost:5173)

| ID | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| C-1 | `/knowledge/board` | 제목 위 "← 지식" 링크 → `/knowledge` | PASS |
| C-2 | 〃 [KB에서 가져오기] | 모달: 그룹 탭·검색·체크·연결된 행 비활성+"보드에 있음 ↗" | PASS |
| C-3 | 모달에서 1건 선택 → [보드로 가져오기 (1)] | 토스트 "보드로 가져옴 1건 · 건너뜀 0건", 목록에 'KB 채택됨' 등장 | PASS |
| C-4 | `/knowledge/board/:id` | "← Smart Knowledge Board" 링크, [목록으로] 버튼 없음 | PASS |
| C-5 | 〃 에디터 | 초기 편집 모드(분할 아님), 툴바로 분할/미리보기 전환 가능 | PASS |
| C-6 | `/knowledge` KB 상세(가져온 문서) | "보드에서 관리됩니다 … [보드에서 열기]" → 보드 문서 | PASS |

## 5. 엣지 케이스

| ID | 케이스 | 처리 | 결과 |
|---|---|---|---|
| E-1 | 카탈로그/Drive·Notion/usage 문서 | 후보 쿼리에서 제외(서버 판정), 직접 POST 시 `errors[].reason` | U-1·U-4 |
| E-2 | 보드 문서 삭제 후 같은 KB 문서 재가져오기 | 판정은 `promoted_document_id` 역조회 → 자격 복귀(키 `BRD-`는 남지만 제외 조건 아님) | 코드 검토 PASS(D-3) |
| E-3 | 외부키가 이미 있는 KB 행 | 키 유지, 연결만; 재채택은 id 링크 우선 | U-3·U-5 |
| E-4 | 200건 초과 요청 | `@ArrayMaxSize(200)` → E5003 | 코드 검토 PASS |
| E-5 | staff 계정 | 후보·가져오기 `KNOWLEDGE_SOURCE_MANAGE` 게이트(채택과 동일) | 코드 검토 PASS |
