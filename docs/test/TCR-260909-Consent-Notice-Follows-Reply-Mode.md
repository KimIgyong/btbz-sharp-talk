# TCR-260909 — 동의 안내가 대화방 자동응답 설정을 따름

PLN: `docs/plan/PLN-260909-Consent-Notice-Follows-Reply-Mode.md`

## 1. 단위 (`messenger-ingest.service.spec.ts`)

| # | 케이스 | 기대 | 결과 |
|---|---|---|---|
| U1 | 채널 기본 끔, 새 방 첫 인입 | system 메시지 0, `noticeVersion` 갱신 없음 | ✅ |
| U2 | 채널 끔 + 세션 `auto` | 안내 저장 → AI 호출 **순서**, `noticeVersion='2026-07'` 기록 | ✅ |
| U3 | 스레드 `noticeVersion` 현행과 일치 | AI 호출됨, 안내 0 | ✅ |
| U4 | 스레드 `noticeVersion` 구버전 | 안내 1 + 버전 갱신 | ✅ |
| U5 | 수신전용 스레드(`replyEnabled=false`) + 채널 켬 | 안내 0 | ✅ |
| U6 | 상담원 점유(대화 status=agent) | 안내 0, AI 미호출 | ✅ |
| 기존 | `consent_mode=auto` → 안내 없음 / 새 세션 granted+버전 / 끔 → 저장·이관 | 유지 | ✅ |

messenger 도메인 16 스위트 187 통과, `turbo typecheck` 통과.

## 2. 통합 (스테이징, 배포 후)

| # | 시나리오 | 기대 |
|---|---|---|
| I1 | SQL 선적용 → 배포 → 부팅 | `successfully started`, 채널 5 폴링 정상 |
| I2 | 채널 5(끔) 백필: 답장 가능 스레드 37건 `notice_version=<현행>` | 재고지 방지 |
| I3 | 채널 5(끔)에 새 메시지 유입 | 대화에 system 안내 없음, 아웃박스 신규 0 |
| I4 | 방 1개 세션 `auto` 전환 후 인입(합성 불가 시 단위 U2로 대체) | 안내 1 → AI 1 순서 |

## 3. 엣지

- `session.consentVersion`이 NULL인 구 세션 → `effectiveNoticeVersion()` 폴백으로 버전 결정.
- 스레드 `notice_version` NULL(기존 행) = 미발송 취급 → 켬 전환 시 1회 발송(백필로 회피).
- 승인 모드: AI 초안 생성이므로 안내 발송(현행 유지).
