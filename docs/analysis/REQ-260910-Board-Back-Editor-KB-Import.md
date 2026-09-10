# REQ-260910 — 보드 뒤로가기 · 에디터 기본 모드 · 지식베이스문서 보드로 가져오기

- 대상: 콘솔 `/knowledge/board`(목록), `/knowledge/board/:id|new`(작성·편집), API `domain/board`, `knowledge/board-review.service`
- 요청일: 2026-09-10 · 요청 원문: "Open board, Write on board 2화면에서 뒤로가기 버튼 없음 / Write on board 작성화면은
  에디터모드가 기본(현재 화면분할) / 현재 지식베이스문서에 등록된 내용 가져오기 — 직접 입력·임포트한 KB 문서를
  보드에서 수정관리"
- 관련: REQ/PLN-260829-Smart-Knowledge-Board(B1~B4) · PLN-260910-Knowledge-Page-Workflow-Layout(보드 카드 도입)

## 1. AS-IS

### 1.1 뒤로가기
| 화면 | 현재 | 문제 |
|---|---|---|
| 보드 목록 `/knowledge/board` | `PageHeader` 제목만. 지식 페이지로 돌아가는 요소 없음 (사이드바 '지식' 메뉴뿐) | 지식 페이지 보드 카드 → [보드 열기]로 들어온 뒤 복귀 동선 없음 |
| 보드 문서 `/knowledge/board/:id` | 카드 우측 액션 끝에 [목록으로] 버튼(상태 뱃지·채택·보류·히스토리·삭제 뒤) | 작성('new') 화면은 [목록으로]만 있으나 우측 끝 보조 버튼이라 뒤로가기로 인지되지 않음 |
`PageHeader`(`components/PageHeader.tsx`)는 `title/subtitle/action`만 받고 뒤로가기 슬롯이 없다.

### 1.2 에디터 기본 모드
`BoardDocumentPage.tsx:271` — `<MDEditor value onChange height={420} />`. `@uiw/react-md-editor`의 `preview` 기본값은
`'live'`(좌 편집·우 미리보기 분할). 툴바에 edit/live/preview 전환 버튼은 있으나 초기값이 분할이라 좁은 폭에서 본문이 절반.

### 1.3 KB 문서 → 보드
- 방향은 **보드 → KB(채택)** 뿐. `promote()`는 `external_key='BRD-{boardId}'` 업서트, 보드 문서는 `promoted_document_id`로 KB 행을 가리킨다.
- 이미 KB에 있는 문서(직접 추가·CSV/XLSX 일괄 임포트·지식 공백 승인)는 보드에 없어 보드의 리비전·코멘트·시뮬레이션·재채택 루프를 쓸 수 없고, KB 화면에서만 편집된다.
- 스테이징 KB 출처 분포(2026-09-10): `knowledge_store`(직접·임포트·상품CSV·가이드), `product_catalog`(카탈로그 동기화), `knowledge_gap`(공백 제안 승인), `board`(채택). Drive/Notion 동기화 문서는 `source_id`가 채워진다.
- KB 행의 소유권 신호: `source_id`(동기화 소스가 덮어씀), `external_key`(`usage:{type}` 가이드, 카탈로그 handle, `BRD-`), `source`.

## 2. TO-BE

| # | 요구 | 해석 |
|---|---|---|
| R1 | 두 화면에 뒤로가기 | `PageHeader`에 `backTo`(경로) 슬롯 추가 → 제목 위 "← 지식"/"← 보드" 링크. 목록 → `/knowledge`, 문서 → `/knowledge/board`(작성 중이면 confirm 없이 이동 — 임시저장은 버튼으로 명시) |
| R2 | 에디터 기본 = 편집 | `preview="edit"` 초기값, 툴바 전환 유지. 마지막 선택을 localStorage에 기억(`ivy:board:editor-preview`) |
| R3 | KB 문서 가져오기 | 보드 목록 [KB에서 가져오기] 모달: **가져올 수 있는** KB 문서(§3 규칙)를 그룹·검색으로 찾아 다중 선택 → 보드 문서 생성. 생성된 보드 문서는 그 KB 행과 **연결**(`promoted_document_id`)되어 보드 수정 → "개정 미반영" → [재채택]이 **같은 KB 행을 갱신**(중복 생성 없음). KB 상세에는 "보드에서 관리 중" 링크 |

## 3. 가져오기 자격 규칙 (동기화 소유 문서 보호)

| 조건 | 판정 | 이유 |
|---|---|---|
| `source_id IS NOT NULL` | 제외 | Drive/Notion 동기화가 다음 실행에서 제목·본문을 덮어씀 — 보드 수정이 소리 없이 사라진다 |
| `source='product_catalog'` | 제외 | 카탈로그 동기화 소유(REQ-260829 D-4 예외 경로) |
| `external_key LIKE 'usage:%'` | 제외 | 사용법 가이드 UI가 키로 소유 |
| `source='board'` 또는 `external_key LIKE 'BRD-%'` | 제외(이미 보드 문서) | 목록에 "보드에 있음" 표시 |
| 이미 어떤 보드 문서의 `promoted_document_id`가 가리킴 | 제외(연결됨) | 중복 가져오기 방지 — 목록에 링크 표시 |
| 그 외 (`knowledge_store`·`knowledge_gap` 등, 직접/임포트) | **가능** | 요청 범위 |

## 4. 갭 분석

| 갭 | AS-IS | TO-BE | 변경 |
|---|---|---|---|
| G1 뒤로가기 | 없음 | PageHeader `backTo` | 프런트 공통 컴포넌트 + 2화면 |
| G2 에디터 모드 | live | edit + 기억 | 프런트 1줄 + localStorage |
| G3 후보 조회 | 없음 | `GET /board/import/kb-candidates`(자격 규칙 서버 판정, `linkedBoardDocumentId` 동반) | API 신규 |
| G4 가져오기 | 없음 | `POST /board/import/kb` `{document_ids[]}` → 보드 문서(status **promoted**, `promoted_document_id`=KB id, 태그 `kb-import`), KB `external_key`가 NULL이면 `BRD-{boardId}` 부여, 감사 | API 신규 |
| G5 재채택 연결 | `external_key` 로만 KB 탐색 | **`promoted_document_id` 우선**, 없으면 `external_key` | `promote()` 1분기 |
| G6 KB 상세 역링크 | `external_key BRD-`만 | + 보드 문서 역조회(`boardDocumentId`) | KB 상세 mapper/service + 화면 |

## 5. 제약·결정

- **D-1 가져온 문서의 초기 상태 = `promoted`**: 본문이 이미 KB에 살아 있으므로 "게시 대기"가 아니라 "채택됨"이 사실. 보드에서 수정하면 내용 비교로 "개정 미반영"이 켜지고 [재채택]이 KB 행을 제자리 갱신·재임베딩(B2 P4-1/P4-3 그대로).
- **D-2 KB 원본은 이동이 아니라 연결**: 가져와도 KB 행은 그대로(출처 뱃지 유지). `external_key`는 NULL일 때만 `BRD-`로 채운다 — 값이 있는 키는 다른 소유자의 것이므로 건드리지 않고 `promoted_document_id` 연결만으로 충분.
- **D-3 재채택 시 카테고리**: 가져온 보드 문서의 `category1`=KB `category`. 재채택 카테고리 매핑(2차‖1차)이 원래 카테고리를 유지하므로 KB 분류가 바뀌지 않는다.
- **D-4 보드 문서 삭제 ≠ KB 삭제**(기존 B2 P4-2 원칙 동일). 삭제 시 KB 행의 `BRD-` 키는 남는다(재가져오기 시 `BRD-` 키 문서는 "보드에 있음"으로 잡히므로 → 키가 가리키는 보드 문서가 없으면 **자격 있음으로 복귀**: 판정은 `promoted_document_id` 역조회 기준).
- **D-5 가져오기 상한** 1회 200건(체크 선택), 본문은 KB `content` 원문(마크다운/평문 모두 MD 에디터가 수용).
- **D-6 권한**: 후보 조회·가져오기 = `KNOWLEDGE_SOURCE_MANAGE`(채택과 같은 축; KB 목록 API와 동일).

## 6. 사용자 플로우 (TO-BE)

```
지식 → [③ 보드] 보드 열기
  → 보드 목록 "← 지식"                       (R1)
  → [KB에서 가져오기] → 모달: 그룹 탭·검색·체크 → [가져오기 N건]
      → 토스트 "가져옴 N · 건너뜀 M(이미 보드)" → 목록에 'KB 채택됨' 상태로 등장
  → 문서 열기 "← 보드"                        (R1)  에디터 = 편집 모드            (R2)
  → 수정 → 게시 상태 그대로 'promoted'+'개정 미반영' → [재채택] → KB 갱신(같은 행)
KB 상세: "이 문서는 보드에서 관리 중 — 보드에서 열기"
```
