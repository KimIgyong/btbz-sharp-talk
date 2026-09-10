# RPT-260910 — 보드 뒤로가기 · 에디터 기본 모드 · 지식베이스문서 보드로 가져오기

- 근거: REQ/PLN/TCR-260910-Board-Back-Editor-KB-Import
- PR: **#498** (squash → main `5b0f915`, 2026-09-10) + 리뷰 반영 **#499** (후보 연결 조회 2차 질의화·건별 실패 계속, 이 RPT 동봉)
- 승인: 사용자 "구현"

## 1. 무엇이 바뀌었나

| 영역 | 변경 |
|---|---|
| 뒤로가기 | 공통 `PageHeader`에 `backTo` 슬롯(← 라벨 링크). 보드 목록 "← 지식"(`/knowledge`), 보드 문서 "← Smart Knowledge Board"(`/knowledge/board`). 문서 화면의 [목록으로] 버튼 제거(중복) |
| 에디터 | `MDEditor preview="edit"` 초기값 — 편집 영역 전체 폭. 툴바 분할/미리보기 전환 유지(비제어) |
| KB → 보드 | `GET /board/import/kb-candidates`(group/search/page) · `POST /board/import/kb {document_ids[]≤200}` — `KNOWLEDGE_SOURCE_MANAGE`. 자격은 서버 한 곳: `source_id IS NULL`·`source ∉ {product_catalog, board}`·`external_key NOT LIKE 'usage:%'`. 가져온 보드 문서 = `promoted` + `promoted_document_id` + 태그 `kb-import` + 리비전 1; KB `external_key`가 NULL이면 `BRD-{boardId}` 부여. 이미 연결된 행은 skip. 감사 `board.kb_imported` |
| 재채택 | `promote()`가 `promoted_document_id`로 KB 행을 먼저 찾고 없을 때만 `BRD-` 키 — 가져온 문서의 보드 수정 → "개정 미반영" → [재채택]이 **같은 KB 행 갱신**(중복 0). 갱신 시 키가 없으면 백필 |
| KB 상세 | `boardDocumentId`(board_documents 역조회) + 안내 "보드에서 관리됩니다 — 보드에서 열기"(BRD- 키는 폴백) |
| 콘솔 | `KbImportModal`(그룹 탭·검색·페이지·다중 선택·연결 행 비활성+"보드에 있음 ↗"·토스트) |
| i18n | 6개 언어 `board.kbImport*`, `knowledge.boardOriginNote/Open` 문안 갱신, `board.backToList` 제거 |
| 스키마 | 변경 없음 |

## 2. 파일
- API: `board/dto/request/board.request.ts`(+2 DTO) · `board/board-kb-import.service.ts`(신규, +spec) · `board/board.service.ts`(`createFromKb`) · `board/board.controller.ts`(라우트 2) · `board/board.module.ts` · `knowledge/board-review.service.ts`(promote 링크 우선·`boardDocumentIdFor`, +spec) · `knowledge/knowledge.controller.ts`(상세 `boardDocumentId`)
- Web: `components/PageHeader.tsx` · `domain/board/{KbImportModal.tsx(신규), BoardListPage.tsx, BoardDocumentPage.tsx, board.service.ts, board.hooks.ts}` · `domain/knowledge/{KnowledgePage.tsx, knowledge.service.ts}` · `i18n/locales/*/{board,knowledge}.json`
- 문서: REQ/PLN/TCR/RPT-260910-Board-Back-Editor-KB-Import

## 3. 테스트 결과 (TCR-260910)
- jest board 도메인 + board-review: **6 suites 39 tests**(신규 7: 자격 6케이스·연결 skip·키 부여·id 링크 재채택), `tsc` api/web, `i18n:check` complete, 모듈 주입 변경 후 실부팅 확인
- API(로컬): 후보 12 → 가져오기 2(+없는 id invalid) → 재요청 skip 2 → KB `BRD-7`·`boardDocumentId` → 보드 수정 revisionBehind true → 재채택 KB 1행 갱신·`BRD-7` 행 수 1
- 콘솔(로컬): 뒤로가기 2화면, 모달 1건 가져오기 토스트, 에디터 `w-md-editor-show-edit`·미리보기 패널 없음·[목록으로] 없음, KB 상세 안내+[보드에서 열기]
- CI pass. CodeRabbit Major 2건 → #499 반영: 조인 정렬 어긋남(비유니크 링크)·건별 실패 시 루프 중단. "건별 트랜잭션"은 FAQ 임포트와 같은 이유(부분 성공 유지)로 미채택 기록

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL | 없음 |
| staging | main `5b0f915`(#498) 배포 완료 2026-09-10: API 컨테이너 신규 healthy, `successfully started`, `/health` ok, `GET /board/import/kb-candidates` 미인증 **401**. ivyusa 후보 실측 counsel 233 · product 144 · operation 0 (카탈로그 1,8xx건 제외됨) |
| staging (#499) | 머지 후 재배포 — 아래 갱신 |
| production | 미배포 |

## 5. 잔여·후속
- KB 상세에서 단건 "보드로 가져오기" 버튼, 에디터 모드 기억(P2), 읽기 전용 보드 뷰(이전 요청분 미착수)
- 가져오기 대상에 상품 CSV 임포트 문서(`knowledge_store`, product 그룹)가 포함됨 — 요청 범위("임포트한 문서")와 일치하나, 상품 CSV 재임포트가 보드 수정을 덮을 수 있으므로 상품 문서를 보드에서 관리하기로 했다면 CSV 재임포트는 중단해야 함(운영 안내)
