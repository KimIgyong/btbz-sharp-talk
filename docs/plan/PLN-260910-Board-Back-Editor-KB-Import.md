# PLN-260910 — 보드 뒤로가기 · 에디터 기본 모드 · 지식베이스문서 보드로 가져오기

- 근거: `docs/analysis/REQ-260910-Board-Back-Editor-KB-Import.md`
- 브랜치 `session/board-import` → PR 1건. **스키마 변경 없음**(기존 컬럼 `promoted_document_id`·`external_key` 재사용) → Migration 섹션 불요

## 0. 설계 결정

| # | 결정 | 내용 |
|---|---|---|
| D-1 | 뒤로가기 | `PageHeader`에 `backTo?: { to: string; label: string }` 추가 → 제목 위 `← {label}` 링크(`Link`). 목록: `{to:'/knowledge', label: t('knowledge:title')}`, 문서: `{to:'/knowledge/board', label: t('board:title')}`. 기존 [목록으로] 버튼은 제거(중복) |
| D-2 | 에디터 | `preview` 상태 = `localStorage['ivy:board:editor-preview'] ?? 'edit'`; `onPreviewChange`가 아니라 MDEditor의 `preview` prop을 제어형으로 두고 툴바 전환은 `commands`의 기본 동작이 내부 상태를 바꾸므로, `previewOptions` 대신 **`preview` 초기값만** 지정(비제어). 기억은 P2로 낮춤 — 요청은 "기본 = 편집"뿐 |
| D-3 | 후보 API | `GET /board/import/kb-candidates?group&search&page&size` → `Paginated<{id,title,category,source,docGroup,updatedAt,linkedBoardDocumentId}>`. 자격(REQ §3)은 QueryBuilder 한 곳: `source_id IS NULL AND source NOT IN ('product_catalog','board') AND (external_key IS NULL OR (external_key NOT LIKE 'usage:%' AND external_key NOT LIKE 'BRD-%'))`, 여기에 `LEFT JOIN board_documents b ON b.promoted_document_id = k.id AND b.tenant_id = k.tenant_id` 로 `linkedBoardDocumentId`. **`BRD-` 키인데 보드 문서가 없는 행**(삭제 후)은 자격 복귀 — `external_key LIKE 'BRD-%'` 제외 조건을 빼고 join 결과로만 판정 |
| D-4 | 가져오기 API | `POST /board/import/kb` body `{ document_ids: number[] }`(1~200, `@ArrayMaxSize`) → 각 문서: 자격 재검증(D-3와 같은 판정 함수) → `BoardService.createFromKb()`: `doc_group=kb.docGroup, category1=kb.category ?? 'imported', title, content, tags:['kb-import'], status:'promoted', promotedDocumentId=kb.id, author=actor` + 리비전 `create` 스냅샷; KB `external_key`가 NULL이면 `BRD-{boardId}` 저장(D-2 REQ). 응답 `{created, skipped, invalid, errors[{id, reason}]}`. 감사 `board.kb_imported`(metadata: ids·counts) |
| D-5 | 재채택 연결 | `BoardReviewService.promote()`: `existing = doc.promotedDocumentId ? kbRepo.findOne({id, tenantId}) : null` → 없으면 기존 `external_key` 조회. 갱신 시 `external_key`가 NULL이면 `BRD-`를 채움(가져온 문서가 재채택 시점에 키를 얻도록) |
| D-6 | KB 상세 역링크 | `KnowledgeService.getDocument()` 상세 응답에 `boardDocumentId`(board_documents.promoted_document_id 역조회, 옵셔널 주입 — 기존 스펙 무깨짐) 추가. `KnowledgePage` 원본 안내는 `boardDocumentId ?? (externalKey BRD- → slice)` 순으로 링크 |
| D-7 | 권한 | 두 라우트 `@RequireCapability(KNOWLEDGE_SOURCE_MANAGE)` (채택·시뮬레이션과 동일 축, 컨트롤러 메뉴 게이트 `knowledge` 위에) |
| D-8 | 에러 코드 | 신규 코드 없음 — 검증 실패는 `VALIDATION_FAILED`, 건별 사유는 응답 `errors`로 |
| D-9 | i18n | `board.kbImport*`(버튼·모달·컬럼·토스트·사유), `board.back*`, `knowledge.boardManaged*` — 6개 언어, `i18n:check` |

## 1. 백엔드 작업 (apps/api)

| # | 파일 | 작업 |
|---|---|---|
| B-1 | `board/dto/request/board.request.ts` | `KbImportRequest { @IsArray() @ArrayNotEmpty() @ArrayMaxSize(200) @IsInt({each}) document_ids }`, `KbCandidatesQuery { group?, search?, page?, size? }` |
| B-2 | `board/board-kb-import.service.ts` (신규) | `candidates(tenantId, q)` / `import(tenantId, ids, actor)` — 자격 판정 함수 `eligibility()` 공유, KB repo·Board repo 주입, 감사 |
| B-3 | `board/board.service.ts` | `createFromKb(tenantId, kb, actor)` (create와 같은 스냅샷 경로, status 강제 promoted) |
| B-4 | `board/board.controller.ts` | `GET import/kb-candidates`, `POST import/kb` — 기존 `import`(FAQ) 옆, `documents/:id`보다 앞 |
| B-5 | `board/board.mapper.ts` | `toKbCandidate()` |
| B-6 | `knowledge/board-review.service.ts` | D-5 |
| B-7 | `knowledge/knowledge.service.ts`·`mapper` | D-6 `boardDocumentId` |
| B-8 | `board/board.module.ts` | KbDocument repo 등록(이미 board-review에서 쓰는 방식 확인) |
| B-9 | spec | `board-kb-import.service.spec.ts`(자격 6케이스·중복 스킵·키 부여), `board-review.service.spec.ts`(promotedDocumentId 우선) |

## 2. 콘솔 작업 (apps/web)

| # | 파일 | 작업 |
|---|---|---|
| W-1 | `components/PageHeader.tsx` | `backTo` 슬롯 |
| W-2 | `board/BoardListPage.tsx` | `backTo` + [KB에서 가져오기] 버튼 + `KbImportModal` |
| W-3 | `board/KbImportModal.tsx` (신규) | 그룹 탭·검색·페이지·체크박스(연결된 행은 비활성 + "보드에 있음" 링크)·[가져오기 N건]·결과 토스트 |
| W-4 | `board/BoardDocumentPage.tsx` | `backTo`, [목록으로] 제거, `preview="edit"` |
| W-5 | `board/board.service.ts`·`board.hooks.ts` | `kbCandidates()`, `importFromKb()` + `useKbCandidates`, `useImportFromKb`(성공 시 목록·카운트 invalidate + 토스트) |
| W-6 | `knowledge/KnowledgePage.tsx`·`knowledge.service.ts` | 상세 `boardDocumentId` 사용, 안내 문구 "보드에서 관리 중" |
| W-7 | i18n 6언어 | D-9 |

## 3. UI 와이어프레임

### 3.1 보드 목록 (뒤로가기 + 가져오기)
```
← 지식
Smart Knowledge Board
모든 지식은 보드에서 시작합니다 — …
┌ 문서 ───────────── [@나 0] [KB에서 가져오기] [FAQ 임포트] [새 문서] ┐
│ (기존 목록)                                                          │
```

### 3.2 KB에서 가져오기 모달
```
┌─ 지식베이스문서를 보드로 가져오기 ───────────────────────────── ✕ ─┐
│ 직접 추가·임포트한 문서만 대상입니다. 카탈로그·Drive/Notion 동기화·  │
│ 사용법 가이드 문서는 동기화가 소유하므로 목록에 없습니다.            │
│ [CounselInfo] [ProductInfo] [OperationInfo]   [검색 ________]      │
│ ☐ | 제목                         | 카테고리 | 출처   | 수정일 | 보드 │
│ ☑ | CS Policy — Refunds          | policy   | 직접   | 9/9    |      │
│ ☑ | CS Policy — Final Sale       | policy   | 직접   | 9/9    |      │
│ ▢ | 하이드라 세럼 FAQ (연결됨)     | faq      | 공백승인| 9/8   | 보드에 있음 ↗ │
│ ‹ 1 2 3 ›                                       선택 2건            │
│                                   [닫기]  [보드로 가져오기 (2)]     │
└─────────────────────────────────────────────────────────────────────┘
완료 토스트: "보드로 가져옴 2건 · 건너뜀 0건"
```

### 3.3 보드 문서 (뒤로가기 + 편집 기본)
```
← 보드
CS Policy — Refunds
마크다운으로 작성하고, 게시 후 KB 채택 여부를 검토합니다
┌ 문서 편집 ── [KB 채택됨] [개정 미반영] [재채택] [게시로 복귀] [히스토리] [삭제] ┐
│ 그룹 | 1차 분류 | 2차 분류 | 작성팀                                          │
│ 제목 [______________________________]   태그 #kb-import                     │
│ ┌ 툴바 B I … | ▣ 편집 | ◫ 분할 | ▤ 미리보기 ─────────────────────────────┐ │
│ │ (편집 영역 전체 폭 — 기본)                                             │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ 첨부 · 코멘트 · 링크 (기존)                     [임시 저장] [게시]          │
```

### 3.4 KB 상세 안내 (기존 문구 확장)
```
ⓘ 이 문서는 보드에서 관리됩니다 — 수정은 보드에서 하고 [재채택]하세요.  [보드에서 열기]
```

## 4. 실행 순서
1. B-1~B-9 + jest → 실부팅(엔티티 변경 없음이나 모듈 주입 변경 → 부팅 확인)
2. W-1~W-7 → typecheck·i18n:check
3. 로컬: 12건 KB(직접) 중 2건 가져오기 → 보드 수정 → 재채택 → KB 행 갱신·중복 0 확인 / 카탈로그·usage 문서 미노출 / 삭제 후 재가져오기 자격 복귀
4. TCR → PR → 스테이징 배포(SQL 없음) → go2joy·ivyusa 확인 → RPT

## 5. 측면 영향
| 영역 | 영향 | 대응 |
|---|---|---|
| `promote()` 조회 순서 | 기존 보드 문서(`promoted_document_id` 이미 채움)는 같은 행을 찾으므로 동작 동일 | spec 회귀 |
| KB 출처 뱃지 | 가져온 문서의 `source` 불변("직접" 유지) — "보드" 뱃지는 채택 생성분만 | 문서화 |
| RAG | 가져오기는 KB 행을 건드리지 않음(키만) → 재임베딩 없음. 재채택 시 기존 경로 | — |
| 보드 목록 상태 필터 | 가져온 문서가 'KB 채택됨'으로 다수 등장 | 의도(사실) |
| PageHeader | 기존 모든 페이지 무영향(옵셔널) | — |

## 6. 리스크
- **KB `external_key` 유니크 제약**: `(tenant, doc_group, external_key)` 유니크가 있으면 `BRD-{id}` 부여는 안전(보드 id 유일). NULL 다중 허용 확인.
- **200건 가져오기 시 리비전 스냅샷 200회**: 트랜잭션 없이 순차 — 실패 건은 `errors`로 보고, 앞선 성공은 유지(FAQ 임포트와 같은 자세).
- **에디터 `preview` prop**: 비제어 초기값이라 툴바 전환은 자유. 제어형으로 두면 툴바 버튼이 무력화되므로 금지.

## 7. 범위 밖 (기록)
- 에디터 모드 기억(P2), 가져오기 시 카테고리 재매핑 UI, KB 상세에서의 단건 "보드로 가져오기" 버튼(후속 후보), 읽기 전용 보드 뷰(이전 요청분·미착수).
