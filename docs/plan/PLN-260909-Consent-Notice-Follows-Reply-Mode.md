# PLN-260909 — 동의 안내를 첫 AI 처리 직전으로 이동 (자동응답 설정 준수)

REQ: `docs/analysis/REQ-260909-Consent-Notice-Follows-Reply-Mode.md`

**UI 영향 없음** — 백엔드 인제스트 파이프라인 + 스키마 1컬럼. 콘솔·위젯 화면 변경 없음.

## 설계 결정

| # | 결정 | 이유 |
|---|---|---|
| D-1 | 안내 발송 시점 = **AUTO/APPROVE 분기 진입 직전** | 안내의 취지(AI 처리 전 고지)와 일치. 끔 방·상담원 점유·수신전용에서는 자연히 발송되지 않음 |
| D-2 | 동의 상태(`consent_state`)는 건드리지 않음 | `pending`으로 두면 상담원 답장·시나리오까지 fail-closed로 막힘(REQ §1.3) |
| D-3 | 발송 기억 = `channel_threads.notice_version VARCHAR(32) NULL` | 대화가 아닌 **스레드(방)** 단위 1회. 버전을 저장해 안내 문구 버전이 바뀌면 재고지. 메시지 본문 검색으로 판별하는 무스키마안은 언어·문구 변경에 깨져 기각 |
| D-4 | 안내는 AI 답변보다 **먼저** 저장 | 아웃박스가 메시지 id 순으로 발송하므로 순서가 보장됨(현행과 동일) |

## 단계

### Stage 1 — 스키마
- `sql/2026-09-09_channel_threads_notice_version.sql`:
  `ALTER TABLE channel_threads ADD COLUMN notice_version VARCHAR(32) NULL AFTER reply_enabled;`
- `channel-thread.entity.ts`에 `noticeVersion: string | null`(명시 `type: 'varchar'`, 부팅 검증).
- 롤백: `ALTER TABLE channel_threads DROP COLUMN notice_version;` (코드 롤백과 동반)

### Stage 2 — 인제스트 (`messenger-ingest.service.ts`)
1. `resolveConversation()`에서 안내 저장 블록 제거.
2. `ingestOne()`: `mode` 판정 후, `mode !== OFF`이면 `ensureNotice(channel, thread, session, conversation)` 호출 →
   - `channel.consentMode !== 'notice'` 또는 `thread.replyEnabled !== 1` → 아무 것도 안 함
   - `thread.noticeVersion === session.consentVersion`(현행 버전) → 아무 것도 안 함
   - 그 외 → system 메시지 저장(현행 문구·언어), `threadRepo.update({noticeVersion})`
3. 기존 스레드(컬럼 NULL)는 "안내 미발송"으로 취급 → 켬으로 바뀌는 첫 순간 1회 발송. 이미 안내를 받은
   방은 한 번 더 받게 되는 셈이지만, 백필로 `notice_version`을 채우면 회피 가능(§측면 영향 S-3).

### Stage 3 — 테스트 (TCR-260909)
- 단위(`messenger-ingest.service.spec.ts`): 재정의 3건 + 신규 5건
  - 채널 끔 → 안내 없음 / 세션 켬(채널 끔) → 안내+AI / 채널 켬 → 안내+AI(순서: 안내가 먼저)
  - 이미 `notice_version` 일치 스레드 → 안내 없음 / 버전 불일치 → 재발송
  - 수신전용 스레드 + 켬 → 안내 없음 / 상담원 점유 → 안내 없음 / `consent_mode=auto` → 없음
- 통합(스테이징): 채널 5(끔)에 새 방 유입 → 아웃박스 0건; 방 1개를 `켬`으로 전환 후 인입 → 안내 1 + AI 1 순서 확인

### Stage 4 — 배포·문서
- 스테이징: SQL 선적용 → 배포 → 부팅 확인 → Stage 3 통합 → RPT-260909.

## 측면 영향

| # | 영향 | 판단 |
|---|---|---|
| S-1 | `consent_mode=notice` + 채널 켬 방 | 동작 동일(안내 → AI). 무영향 |
| S-2 | 끔 방에서 상담원 답장 | 동의는 세션 생성 시 granted 그대로 → 계속 가능. 무영향 |
| S-3 | 기존 스레드(안내 이미 받은 방)가 켬으로 전환될 때 재고지 1회 | 스테이징 채널 5는 37방 전부 오늘 안내 받음 → 배포 시 `UPDATE channel_threads SET notice_version=<현행> WHERE channel_id=5 AND reply_enabled=1` 백필 1회로 회피(RPT에 기록) |
| S-4 | 승인 모드(approve) | AI가 초안을 만들므로 안내 유지. 초안이 발송되지 않으면 고객은 안내만 받음 — 현행과 동일 |
| S-5 | 위젯·이메일 채널 | 위젯은 배너, 이메일(gmail)은 `consent_mode` 채널 설정에 따르며 동일 규칙 적용 |
| S-6 | 통계·CJM | system 메시지 1건 감소 외 없음 |

## 승인 요청

- D-1~D-4, 특히 **D-2(동의 상태 불변, 안내는 AI 처리 고지)** 정책 확인
- S-3 백필 실행 여부
