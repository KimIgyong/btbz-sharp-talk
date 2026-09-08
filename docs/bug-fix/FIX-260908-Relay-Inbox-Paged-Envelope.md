# FIX-260908 — btbz 릴레이 가져오기 실패 "object is not iterable"

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-08 |
| 발견 경위 | 스테이징 `/settings/messengers`(테넌트 amoebaorder, 채널 5) — 이메일 로그인 연결 테스트는 성공, "지금 가져오기"와 15초 폴링이 모두 `object is not iterable (cannot read property Symbol(Symbol.iterator))`로 실패 |
| 근본 원인 | 릴레이(`messenger.amoeba.site`, 9/8 14:52 재배포)가 `GET /api/inbox/conversations/:id/messages` 응답을 `data: [...]`에서 **페이지 객체 `data: { items, hasMore }`**(before/after 커서)로 바꿨는데, 어댑터 레거시 pull이 `for (const msg of messages?.data ?? [])`로 배열을 전제 — 객체를 순회해 TypeError. 대화 목록(`/conversations`)은 여전히 배열이라 연결 테스트(`data.length`)는 통과했고 pull만 죽음 |
| 부수 결함 | 같은 릴레이 배포에서 사진 메시지의 `body`가 목록에서 제거됨(`body_type='photo'` + `body=null`, 바이트는 `GET /api/inbox/messages/:id/photo`) → 기존 data URI 분리(FIX-260817)가 빈 턴으로 보고 **사진을 조용히 건너뜀** |
| 수정 | `apps/api/src/domain/messenger/adapter/btbz-relay.adapter.ts` — ① `inboxRows()`: 배열/`{items,hasMore}` 양쪽 수용, 그 외는 빈 페이지(대화·메시지·커맨드·test 4곳 적용) ② 커서 있는 스레드는 `after=<cursor>`로 삽입순 전진 페이징(최대 20페이지, 무진전 페이지 중단), 커서 없는 새 스레드는 기본 최신 페이지만(과거로 안 내려감) ③ 본문 없는 `photo` 턴은 `fileId` 참조로 넘기고 `downloadAttachment`가 `/photo`에서 바이트를 받아 기존 첨부 파이프라인에 태움 |
| 검증 | 단위 `btbz-relay.adapter.spec.ts` +8(페이지 봉투·after 전진·무커서 비하강·사진 다운로드·빈 텍스트 스킵·inboxRows 3), messenger 15 스위트 180 통과, `turbo typecheck` 통과; 스테이징 배포 후 채널 5 `status=connected`·`last_error=NULL`·스레드 유입 확인(§검증 기록) |

## 재현 경로

1. 릴레이 컨테이너(`ksr-staging-relay-api-1`) 9/8 14:52 기동 — 신규 라우트(`/destinations`, `/pin`, `/messages/:id/photo`)와 함께 `listMessages`가 `{ items, hasMore }` 반환으로 변경.
2. API 컨테이너 안에서 채널 5 자격증명을 복호화해 직접 호출:
   `/api/inbox/conversations` → `data: [ … ]` (배열 유지), `/conversations/5016/messages?limit=3` → `data: { items: [ … ], hasMore: false }`.
3. `MessengerSyncService.syncChannel` → `BtbzRelayAdapter.pull` → `for … of messages.data` TypeError → `markError` → 콘솔 "가져오기 실패".

## 예방 패턴

**외부 응답의 컬렉션은 "배열이거나 아니거나"가 아니라 봉투 판독기 한 곳을 거친다.**
`for…of`가 봉투에 직접 닿아 있으면 상대 서버의 페이지네이션 도입 하나가 우리 쪽 영구
폴링 실패가 된다. 판독기(`inboxRows`)는 알던 형태 전부를 읽고 모르는 형태는 빈 페이지로
돌려서, 형태 변경이 "0건"으로 드러나되 채널을 `error`로 못 박지 않는다.

**연결 테스트가 통과한다고 가져오기가 산다는 뜻이 아니다.** 테스트는 목록 1개 엔드포인트만
치고 pull은 3개를 친다 — 릴레이 계약 변경 점검은 pull 경로 전체(대화·메시지·커맨드)로.
같은 계약 변경이 사진을 소리 없이 떨어뜨린 것도 "예외 없음 ≠ 정상"의 예([[invisible-fallback-trap]] 동족).

**릴레이 계약이 바뀌면 이 레포의 릴레이 어댑터를 같은 날 맞춘다.** 릴레이 레포
(`~/Desktop/Site/btbz-messenger`)의 `listMessages`/`ok()` 변경 PR에는 소비자
(ShopTalk `btbz-relay.adapter.ts`) 체크 항목을 둔다 — 스테이징 릴레이는 origin 미푸시 코드로
구동되므로 로컬 레포 대조만으로는 못 잡고, 배포된 컨테이너의 `dist/`를 봐야 했다.

## 검증 기록

(배포 후 갱신)
