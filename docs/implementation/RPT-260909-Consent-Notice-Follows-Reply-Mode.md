# RPT-260909 — 동의 안내가 대화방 자동응답 설정을 따름 (구현 보고)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| REQ / PLN / TCR | REQ-260909 · PLN-260909 (승인, 백필 포함) · TCR-260909 |
| PR / 커밋 | #479 → main `a836334` (squash), CI 통과(매니페스트 재생성 커밋 포함) |
| 배포 | 스테이징 2026-09-08 23:32 UTC, `ivy_api_staging` healthy, `successfully started` |
| 마이그레이션 | `sql/migration_channel_threads_notice_version.sql` — **staging 선적용 완료(23:21 UTC)** · production 미적용(미배포) |
| 백필 | `UPDATE channel_threads SET notice_version='2026-07' WHERE channel_id=5 AND reply_enabled=1 AND notice_version IS NULL` → 37행 (수신전용 15행은 NULL 유지) |

## 변경 파일

| 파일 | 변경 |
|---|---|
| `apps/api/src/domain/messenger/messenger-ingest.service.ts` | 안내 생성을 `resolveConversation`에서 제거, `ensureNotice()` 신설 — 유효 자동응답이 OFF가 아닐 때(AUTO/APPROVE) AI 처리 직전 스레드당 1회. `consent_mode=auto`·수신전용·현행 버전 기고지 스레드는 건너뜀 |
| `apps/api/src/domain/messenger/entity/channel-thread.entity.ts` | `noticeVersion` (`notice_version VARCHAR(32) NULL`, 명시 type) |
| `sql/migration_channel_threads_notice_version.sql` · `sql/artefacts.tsv` | 컬럼 추가 + 매니페스트 |
| `apps/api/src/domain/messenger/messenger-ingest.service.spec.ts` | +6 (끔 무발송 / 세션 auto 시 안내→AI 순서 / 기고지 스킵 / 버전 변경 재고지 / 수신전용 / 상담원 점유) |

동의 상태(`consent_state`)는 변경 없음 — PLN D-2(안내 전 보류 시 상담원 답장까지 fail-closed).

## 테스트 결과

- 단위: messenger 도메인 16 스위트 **187 통과**, `turbo typecheck` 통과 (TCR §1 U1~U6 ✅)
- 통합(스테이징):
  - I1 부팅 ✅ (엔티티 변경 후 실부팅 확인), 채널 5 폴링 `connected` 유지
  - I2 백필 ✅ 37행
  - I3 배포 후 4분 관찰: 채널 5 신규 스레드 0·신규 아웃박스 0·`ingest failed` 0 — **자연 유입이 없어 미검증**, 단위 U1이 동일 경로를 덮음. 다음 유입 시 대화에 system 안내가 없음을 확인할 것
  - I4 켬 전환 후 안내→AI 순서: 단위 U2로 대체

## 운영 참고

- 기존 방(안내 이미 받음)은 백필로 재고지 없음. 다른 테넌트/채널의 기존 스레드는 `notice_version` NULL이라 **켬으로 처음 전환되는 순간 안내 1회**가 나간다(의도: 그 방은 AI 처리를 처음 받는 것).
- 안내 문구 버전(`consent_notice_version`)을 올리면 켬 상태 방 전부에 다음 인입 시 재고지된다.
- 9/8 콜드스타트에서 이미 발송된 37건은 회수 불가.
