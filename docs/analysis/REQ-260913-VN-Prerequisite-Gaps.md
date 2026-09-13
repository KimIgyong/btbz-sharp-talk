# REQ-260913 — 베트남(VN) 착수 전 코드 갭 5건 구현

- 요청(2026-09-13): "VN 착수 전 코드 갭 5건 구현" — GUIDE-260913-Locale-Customization §4 P0 항목(G1/G2 기본 언어, G3 핸드오프 타임존 목록, G6 베트남 전화 PII, G7 AI 국외이전 고지, G11 시드 KB) + 문서 G10(사고 통지 매트릭스 PDPD 행).
- 산출물: 코드(API·콘솔·위젯·types) + SQL 1건 + env 템플릿 + 문서.

## 1. AS-IS (코드 기준 main `bef44f2`)

| 갭 | 현재 동작 | 정정된 진단 |
|---|---|---|
| **G1/G2 기본 언어** | `session.service.ts resolveLanguage`: 브라우저 locale이 **en이 아닌** 지원 언어면 그것, 아니면 **테넌트 타임존**으로 유도(`Asia/Ho_Chi_Minh → vi`), 없으면 `en`. 위젯은 첫 페인트를 브라우저 언어로 하고 `session/ensure` 응답의 `language`로 바꿈(수동 선택 시 제외) | 조사 문서의 "en-US 브라우저면 타임존이 호찌민이어도 영어"는 **오류** — 영어는 선호 없음으로 취급되어 vi가 나옵니다. 남는 갭: (a) 타임존과 다른 기본 언어를 원할 때(예: VN 테넌트가 en 기본, 타임존이 언어 매핑에 없을 때) **명시적 레버가 없음**, (b) 콘솔 초기 언어는 `en` 고정, (c) `tenants.default_language` 컬럼 없음 → 스냅샷에도 없음 |
| **G3 핸드오프 타임존** | `HandoffSection.tsx` `TIMEZONES` = 미국 4 + `Asia/Seoul` + `UTC` 하드코딩. 서버는 임의 IANA 수용 | `Asia/Ho_Chi_Minh`·`Asia/Tokyo`·`Asia/Shanghai`·`Europe/Madrid` 등 언어 레지스트리의 `pickerTimezone`가 목록에 없음 |
| **G6 베트남 전화 PII** | `pii-scrub.util.ts`: `+CC` 국제형, 미국 괄호/구분자형, 한국 `01x`, generic(구분자 2개 이상, 9~15자리). 스펙 파일 있음 | 베트남 이동전화 `0[35789]x xxx xxxx`(10자리, 공백 1개 또는 무구분)와 유선 `02x xxxx xxxx`(11자리)는 generic(구분자 2개 필요)에도 안 잡힘 → `0901234567`, `090 123 4567`이 로그·감사에 그대로 남음 |
| **G7 AI 국외이전 고지** | 위젯 i18n `chat.aiDisclosure` 6언어에 "in the United States"(vi: "tại Hoa Kỳ") 고정 문자열. `ChatTab.tsx:350`에서 표시 | 처리 지역이 배포·제공자에 따라 다를 수 있는데(EU 리전 등) 문구가 코드에 박혀 있어 PDPD 고지 문구 확정 시 배포별로 못 바꿈 |
| **G11 시드 KB** | `seed.runner.ts`: KB 0건일 때 기본 5건 + 미국 화장품 CS 정책 문서(제목 기준 멱등) 삽입. `SEED_DEMO_DATA`는 주문 데모만 제어 | 새 국가 첫 부팅에 미국 정책 KB가 들어와 삭제해야 함. 시나리오 문구는 이미 테넌트별 편집 가능(기본 대화 설정 화면, PR #462)이라 **범위 밖** |
| **G10 문서** | `INCIDENT-RESPONSE.md` §3.5 통지표: GDPR·CCPA·PIPA·테넌트·외부 처리자 | 베트남 PDPD(Nghị định 13/2023) 행 없음 |

## 2. TO-BE

| 갭 | 목표 |
|---|---|
| G1/G2 | `tenants.default_language`(nullable, 지원 언어 코드). 판정 순서 **명시적 비영어 locale > 테넌트 기본 언어 > 타임존 유도 > en**. 콘솔 설정 > 기본(타임존 행 옆)에 "기본 언어" 선택(타임존 따름/6언어). 설정 스냅샷 필드에 포함. 위젯은 현행대로 ensure 응답 언어를 따름 |
| G3 | 핸드오프 타임존 목록 = 언어 레지스트리 `LANGUAGE_TIMEZONES`(Seoul·New_York·Ho_Chi_Minh·Tokyo·Shanghai·Madrid…) ∪ 미국 4존 ∪ UTC, 중복 제거·정렬. 현재 저장값이 목록에 없으면 그대로 선택지로 노출(값 유실 방지) |
| G6 | `PHONE_VN_MOBILE_RE`(`0[35789]\d[ .-]?\d{3}[ .-]?\d{4}`)·`PHONE_VN_LANDLINE_RE`(`02\d[ .-]?\d{4}[ .-]?\d{4}`) 추가, 카운트는 `phone`. 스펙에 양성 6·음성 3(날짜·주문번호·10자리 상품코드) |
| G7 | 배포 env `AI_PROCESSING_REGION`(기본 `US`) → `session/ensure` 응답 `aiProcessingRegion` → 위젯 `chat.aiDisclosure`를 `{{region}}` 보간, 지역명은 위젯 i18n `regions.{US,EU,VN,KR,JP,SG}` 6언어. 미지 코드는 코드 그대로 표기 |
| G11 | 배포 env `SEED_KB_PROFILE`: `us-cosmetics`(기본, 현행) / `none`(KB 시드 생략). 템플릿·CONFIG 반영 |
| G10 | `INCIDENT-RESPONSE.md` §3.5에 PDPD 행(72시간 내 A05 통지 — 법무 확인 표기) |

## 3. 갭 분석
| # | 갭 | 해소 |
|---|---|---|
| 1 | 기본 언어 레버 없음 | 컬럼 + 판정 순서 + 콘솔 선택 + 스냅샷 |
| 2 | 타임존 목록 하드코딩 | 레지스트리 재사용(언어 추가 시 자동 반영) |
| 3 | VN 전화 미마스킹 | 정규식 2종 + 스펙 |
| 4 | 고지 문구 고정 | 지역 코드 보간 |
| 5 | 시드 KB 무조건 삽입 | 프로필 env |
| 6 | PDPD 통지 미기재 | 문서 행 |

## 4. 사용자 흐름
- 테넌트 master: 설정 > 기본 → 타임존 `Asia/Ho_Chi_Minh` + 기본 언어 `Tiếng Việt`(또는 "타임존 따름") 저장 → 토스트 → 새 위젯 세션이 vi로 시작(브라우저가 ko면 ko).
- 테넌트 master: AI 설정 > 상담원 연결 → 업무시간 타임존에 `Asia/Ho_Chi_Minh` 선택 가능.
- 고객(위젯): 채팅 탭 하단 고지 "…third-party AI service provider in **Viet Nam/United States**…"가 배포 env에 따라 표시.
- 인프라: VN 프로필 env에 `AI_PROCESSING_REGION=US`, `SEED_KB_PROFILE=none` → 첫 부팅 시 KB 0건.

## 5. 제약·전제
- 언어 판정에서 **영어 브라우저는 계속 "선호 없음"**으로 둡니다(현행 의도 유지). 명시적 비영어 브라우저 언어는 테넌트 기본보다 우선(고객 선호 존중).
- `default_language` 값은 `packages/types` 언어 목록으로 검증(DTO `IsIn`).
- `AI_PROCESSING_REGION`은 배포 전역(처리 위치는 제공자·리전에 따르므로 테넌트 단위 아님). 테넌트별 문구 전면 커스텀은 범위 밖.
- 시나리오 스크립트 정책 문구는 기본 대화 설정 화면에서 테넌트별 편집 가능 → 이번 범위 밖.
- 스키마 변경 1건 → PR `## Migration`, 스테이징 SQL 선적용, `docker/init-sql/01-schema.sql`·매니페스트 동기.
