# TCR-260913 — VN 착수 전 코드 갭 5건 (기본 언어 · 핸드오프 타임존 · VN 전화 PII · AI 처리 지역 고지 · 시드 KB 프로필 · PDPD 통지)

- 근거: PLN-260913-VN-Prerequisite-Gaps (승인 2026-09-13)
- 환경: 로컬 dev(API dist `AI_PROCESSING_REGION=VN`, 콘솔 :5173, 위젯 :5175 로컬 API), ivyusa(dev@ master)

## 1. 단위 테스트
| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `SessionService` 기본 언어(G1/G2) | 테넌트 `timezone=Asia/Seoul, defaultLanguage=vi`, 브라우저 `en-US` | `VI` (테넌트 기본이 타임존보다 우선) | PASS |
| U-2 | 〃 | 같은 테넌트, 브라우저 `ko-KR` | `KO` (명시적 비영어 선호가 우선) | PASS |
| U-3 | 〃 | `defaultLanguage=null, timezone=Asia/Ho_Chi_Minh` / 둘 다 null | `VI` / `EN` (현행 유지) | PASS |
| U-4 | `findOrCreateForCustomer` 기존 4케이스 | tenantRepo `findOne→null` 픽스처 | 기존 판정 유지(vi/ja/zh/th) | PASS |
| U-5 | `SessionMapper.toResponse` | 응답에 `aiProcessingRegion: 'US'` 기본 | PASS |
| U-6 | `scrubPii` VN 전화(G6) 양성 | `0901234567`·`090 123 4567`·`090-123-4567`·`0356789012`·`028 3822 1234`·`+84 90 123 4567` | `[PHONE]`, counts phone 1 | PASS |
| U-7 | `scrubPii` 음성 | `ref 1234567890`(VN 접두 아님)·`code 0123456789`(01 접두 비KR/VN) + 기존 날짜·zip·SKU | 미마스킹 | PASS |
| 합계 | pii-scrub · session(3 spec) · tenant.service · settings-snapshot | **135 + 3 = 138 passed** | | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` types / api / web / widget | PASS (`packages/types` 재빌드 후 위젯이 `aiProcessingRegion` 인식) |
| `i18n:check` | complete — 콘솔 `widgetBehavior.defaultLanguage/…Follow/…Hint`, 위젯 `regions.{US,EU,VN,KR,JP,SG}` 6언어 |
| `env:check` | OK — `AI_PROCESSING_REGION`·`SEED_KB_PROFILE` 템플릿 등재 |
| `migrations:manifest` | `260913-tenant-default-language.sql column tenants default_language` (82파일) |
| 실부팅 | `successfully started`, 로컬 DB에 SQL 선적용(`default_language varchar(5) NULL`) |

## 3. API (로컬 curl)
| ID | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| I-1 | `GET /tenants/widget-settings` | `defaultLanguage: null` 노출 | PASS |
| I-2 | `POST /session/ensure` locale `en-US`, 테넌트 timezone null·기본 언어 null | `EN`, `aiProcessingRegion: VN`(env) | PASS |
| I-3 | `PATCH /tenants/widget-settings {default_language:'vi'}` | `defaultLanguage: 'vi'`, 감사 target `… · lang:vi` | PASS |
| I-4 | ensure `en-US` / `ko-KR` | `VI` / `KO` | PASS |
| I-5 | `default_language:'xx'` | 400(E1002 검증) | PASS |
| I-6 | 설정 스냅샷 생성 → diff | 항목 `defaultLanguage` 포함(current/snapshot `vi`) | PASS |
| I-7 | `PATCH default_language:''` | null로 복원 | PASS |

## 4. 콘솔·위젯 (로컬 브라우저)
| ID | 검사 | 결과 |
|---|---|---|
| C-1 | 설정 > 위젯 > 위젯 동작: **기본 언어** Select(타임존 따름 · English · Español · 한국어 · Tiếng Việt (β) · 日本語 (β) · 简体中文 (β)), 값 변경 → [저장] → 토스트 "위젯 설정이 저장되었습니다" → API 반영 | PASS |
| C-2 | 설정 > 기본 > 상담원 연결 > 업무시간 타임존 목록: America/Chicago · Denver · Los_Angeles · New_York — English · **Asia/Ho_Chi_Minh — Tiếng Việt** · Asia/Seoul — 한국어 · Asia/Shanghai — 简体中文 · Asia/Tokyo — 日本語 · UTC | PASS |
| W-1 | 위젯(브라우저 en-US, 테넌트 기본 언어 vi): 동의 버튼 "Đồng ý" → 채팅 탭 고지 "…nhà cung cấp dịch vụ AI bên thứ ba **tại Việt Nam**…" (`AI_PROCESSING_REGION=VN`) | PASS |

## 5. 엣지
| 케이스 | 처리 |
|---|---|
| 기존 테넌트(`default_language` NULL) | 판정 순서·결과 현행과 동일(U-3·I-2) |
| 구 위젯 번들 캐시 | 응답 필드 무시, 문구는 재빌드 배포와 동시 반영 |
| 미지 지역 코드 | 코드 문자열 그대로 표시(`defaultValue`) |
| 핸드오프 저장값이 목록 밖 | 첫 옵션으로 유지(값 유실 없음) |
| `SEED_KB_PROFILE=none` | 첫 부팅 KB 0건(코드 게이트, 로컬은 KB 존재라 런타임 미검증 — 스테이징도 KB 존재) |
