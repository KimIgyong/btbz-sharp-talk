# PLN-260913 — VN 착수 전 코드 갭 5건 구현 계획

- 근거: REQ-260913-VN-Prerequisite-Gaps · GUIDE-260913-Locale-Customization §4
- UI 영향: **있음** — 콘솔 설정 > 기본(기본 언어 선택 추가), AI 설정 > 상담원 연결(타임존 목록 확장), 위젯 채팅 탭 고지 문구(지역 보간). 와이어프레임 §4.

## 1. 변경 목록

### 1.1 G1/G2 — 테넌트 기본 언어
| 층 | 변경 |
|---|---|
| SQL | `sql/260913-tenant-default-language.sql`: `ALTER TABLE tenants ADD COLUMN default_language VARCHAR(5) NULL AFTER timezone;` + `docker/init-sql/01-schema.sql` 동기 + `npm run migrations:manifest` |
| 엔티티 | `tenant.entity.ts` `defaultLanguage: string \| null` (`type: 'varchar', length: 5, nullable: true`) |
| DTO | `UpdateWidgetSettingsRequest`(타임존과 같은 요청)에 `default_language?: string \| null` — `@IsOptional() @IsIn(SUPPORTED_LANGUAGE_CODES)`; 응답 `defaultLanguage` |
| 서비스 | `tenant.service.updateWidgetSettings`가 저장(감사 target `default_language:xx`); `session.service.resolveLanguage(locale, timezone, defaultLanguage)` — 순서: 명시적 비영어 locale → `defaultLanguage` → 타임존 → en. 호출 4곳 모두 테넌트 전달(`languageForChannel` 포함) |
| 스냅샷 | `settings-snapshot.service.ts` FIELDS에 `defaultLanguage` 추가(diff·restore 자동) |
| 콘솔 | `SettingsPage.tsx` 타임존 행 아래 **기본 언어** Select("타임존 따름" + 6언어 엔도님, β 언어는 β 표기), 저장 payload에 포함, i18n `widgetBehavior.defaultLanguage/defaultLanguageFollow/defaultLanguageHint` 6언어 |
| 테스트 | `session.service.spec`(있으면) 또는 신규: 4가지 순서 케이스; `tenant.service.spec` 저장 1케이스 |

### 1.2 G3 — 핸드오프 타임존 목록
`HandoffSection.tsx`: `TIMEZONES = dedupe([...LANGUAGE_TIMEZONES.map(z => z.zone), 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC'])` 정렬, 현재 저장값이 목록 밖이면 첫 옵션으로 추가. 라벨은 `zone — 언어 라벨`(있을 때). 코드 변경만.

### 1.3 G6 — 베트남 전화 PII
`pii-scrub.util.ts`: `PHONE_VN_MOBILE_RE = /\b0[35789]\d[ .-]?\d{3}[ .-]?\d{4}\b/g`, `PHONE_VN_LANDLINE_RE = /\b02\d[ .-]?\d{4}[ .-]?\d{4}\b/g`, KR 뒤·generic 앞에 적용. 스펙: 양성 `0901234567`·`090 123 4567`·`090-123-4567`·`0356789012`·`028 3822 1234`·`+84 90 123 4567`(intl), 음성 `2026-09-13`·주문 `ORD-0912345678`(문맥 단어)·`1234567890`(선행 0 아님).

### 1.4 G7 — AI 처리 지역 고지
| 층 | 변경 |
|---|---|
| env | `AI_PROCESSING_REGION=US`(self-hosted 템플릿 §2 FEATURES, staging/production 템플릿, VN/USA 프로필, `CONFIG.md`) |
| API | `session.mapper`/`ensure` 응답에 `aiProcessingRegion: string`(ConfigService, 기본 `US`, 대문자 2~3자) |
| types | `SessionEnsureResponse`(위젯이 쓰는 타입)에 필드 |
| 위젯 | `chat.aiDisclosure` 6언어를 `{{region}}` 보간으로, `regions: {US, EU, VN, KR, JP, SG}` 6언어; `ChatTab.tsx`에서 `t('chat.aiDisclosure', { region: t(`regions.${code}`, { defaultValue: code }) })`; 코드는 `useSession` 상태에서 |
| 테스트 | `i18n:check`(키 6언어), 위젯 렌더 확인(로컬) |

### 1.5 G11 — 시드 KB 프로필
`seed.runner.ts`: `const kbProfile = opts.kbProfile ?? process.env.SEED_KB_PROFILE ?? 'us-cosmetics'`; `'none'`이면 기본 5건·CS 정책 블록 모두 건너뜀(로그 1줄). 템플릿·CONFIG·프로필 env(VN=`none`, USA=`us-cosmetics`) 반영. `env:check` 통과 확인.

### 1.6 G10 — 문서
`INCIDENT-RESPONSE.md` §3.5에 행: "PDPD(베트남 정보주체 포함 시) | 인지 후 **72시간 이내** 개인정보보호 당국(A05, 공안부) 통지 — Nghị định 13/2023 Art. 23 (법무 확인) | 국외이전 관련 사고면 이전 영향평가 서류와 연계".
가이드 갱신: `GUIDE-260913-Locale-Customization.md` §4 표의 G1/G2·G3·G6·G7·G11·G10 상태를 "구현(PR #)"로, VN 가이드 §0.1 선행 표 갱신.

## 2. 단계
| 단계 | 작업 |
|---|---|
| 1 | SQL·엔티티·DTO·서비스·스냅샷·언어 판정(G1/G2) + 스펙 |
| 2 | 콘솔 기본 언어 UI + 핸드오프 타임존 목록(G3) + i18n 6언어 |
| 3 | PII 정규식(G6) + 스펙 |
| 4 | AI 처리 지역(G7): env·API·types·위젯 i18n·ChatTab |
| 5 | 시드 KB 프로필(G11) + env 템플릿·프로필·CONFIG |
| 6 | 문서(G10·가이드 갱신) → tsc 4패키지·jest·i18n:check·env:check·manifest·실부팅 → 로컬 브라우저 검증(콘솔 저장·위젯 언어/고지) → PR(Migration) → CI → 머지 → 스테이징 SQL 선적용 → 배포 → 스모크(ivyusa 기본 언어 저장/복원·ensure 언어·고지 문구·핸드오프 타임존) → 원상 → RPT |

## 3. 사이드 임팩트
- 언어 판정 순서 변경: `defaultLanguage`가 NULL이면 **현행과 동일**(기존 테넌트 무영향). 값이 있으면 타임존보다 우선 — 영어 브라우저 고객에게 테넌트 기본 언어가 나감(의도).
- `resolveLanguage` 호출 4곳 중 테넌트 없는 경로(`languageForChannel` tenantId null)는 기본 언어 없이 현행 유지.
- 스냅샷 FIELDS 추가 → 이전 스냅샷(필드 없음)은 diff에서 `—`로 표시, 복원 시 미변경(기존 동작).
- 위젯 ensure 응답 필드 추가는 하위 호환(구 위젯은 무시). 고지 문구 키 변경 없음(보간만) → 캐시된 구 번들도 `{{region}}` 없이 렌더 시 문자열 그대로 나올 수 있음 → **위젯 재빌드 배포와 동시**.
- `SEED_KB_PROFILE=none`은 첫 부팅에만 의미(KB 0건 조건). 기존 환경 무영향.
- 핸드오프 타임존 목록 확장은 표시만; 저장 형식 동일.

## 4. 와이어프레임

설정 > 기본 설정(위젯 동작 카드, 타임존 행 아래):
```
┌ 위젯 동작 ─────────────────────────────────────────────────────┐
│ 로그인 방식        [리다이렉트 ▾]                                   │
│ 타임존 기반 기본 언어  [Asia/Ho_Chi_Minh — Tiếng Việt ▾]             │
│   쇼퍼가 언어를 고르지 않았을 때 … 시간대를 선택하세요.                │
│ 기본 언어          [타임존 따름 ▾]   ← 신규                         │
│                    ├ 타임존 따름                                   │
│                    ├ English · Español · 한국어 · Tiếng Việt (β) …  │
│   브라우저가 영어이거나 미지원 언어일 때 위젯이 시작하는 언어입니다.      │
│   비워 두면 타임존으로 정합니다. 고객이 직접 고른 언어가 우선합니다.       │
│ 표시 이름 / 인사말 (6개 언어 탭) …                                  │
│                                                   [저장]          │
└──────────────────────────────────────────────────────────────────┘
```

AI 설정 > 상담원 연결(업무시간 카드):
```
│ 타임존  [Asia/Ho_Chi_Minh — Tiếng Việt ▾]                         │
│         ├ America/Chicago · America/Denver · America/Los_Angeles   │
│         ├ America/New_York — English · Asia/Ho_Chi_Minh — Tiếng Việt │
│         ├ Asia/Seoul — 한국어 · Asia/Shanghai — 中文 · Asia/Tokyo — 日本語 │
│         └ Europe/Madrid — Español · UTC                             │
```

위젯 채팅 탭 하단 고지(문구만):
```
ⓘ This chat is AI-powered. Messages you send are processed by a third-party
  AI service provider in {{region → "the United States" | "Việt Nam" | …}} to generate responses.
```

## 5. 리스크
- 언어 판정은 세션 생성 시 1회 고정 → 설정 변경은 **새 세션부터** 반영(현행과 동일, 힌트에 명시).
- 고지 지역명 번역 6언어 × 6지역 = 36문자열 — 지역명은 고유명사라 오역 위험 낮음.
- PII 정규식 과잉 매칭(10자리 숫자열): 선행 `0[35789]`로 제한, 스펙 음성 케이스로 방어.

## 6. 승인 요청
§1 변경 목록·§4 와이어프레임으로 진행해도 될지 확인 부탁드립니다. 조정 후보: (a) G7 지역 코드를 테넌트 설정으로도 오버라이드 가능하게(범위 확대), (b) 기본 언어 선택을 설정 > 기본이 아닌 개인정보 안내 탭에 둘지.
