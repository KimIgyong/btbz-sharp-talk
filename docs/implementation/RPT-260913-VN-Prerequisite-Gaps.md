# RPT-260913 — VN 착수 전 코드 갭 5건 실행 보고

- 근거: REQ/PLN-260913-VN-Prerequisite-Gaps (승인 2026-09-13) · TCR-260913-VN-Prerequisite-Gaps
- PR: **#521** (squash → main `6b4dbc0`, 2026-09-13)

## 1. 무엇이 바뀌었나
| 갭 | 변경 |
|---|---|
| G1/G2 기본 언어 | `tenants.default_language`(varchar(5) NULL, SQL `260913-tenant-default-language.sql`). 판정 `SessionService.resolveLanguage`: **명시적 비영어 locale > 테넌트 기본 언어 > 타임존 유도 > EN**(NULL이면 현행과 동일). `createForCustomer`도 테넌트를 읽어 같은 순서. 콘솔 설정 > 위젯 > 위젯 동작에 **기본 언어** Select(타임존 따름/6언어, β 표기), 저장 payload·i18n 6언어, 스냅샷 FIELDS 13번째 항목, 감사 target `lang:xx`, DTO `IsIn(LANGUAGE_CODES ∪ '')` |
| G3 핸드오프 타임존 | 목록 = `LANGUAGE_TIMEZONES`(Seoul·New_York·Ho_Chi_Minh·Tokyo·Shanghai) ∪ 미국 3존 ∪ UTC(정렬·라벨 병기), 저장값이 목록 밖이면 첫 옵션으로 보존 |
| G6 VN 전화 PII | `PHONE_VN_MOBILE_RE`(`0[35789]x xxx xxxx`)·`PHONE_VN_LANDLINE_RE`(`02x xxxx xxxx`), KR 뒤·generic 앞 적용 |
| G7 AI 처리 지역 고지 | env `AI_PROCESSING_REGION`(기본 US, 부팅 시 1회) → `PrivacyNoticeInfo.aiProcessingRegion` → `session/ensure` 응답(`SessionResponse` 타입) → 위젯 store → `chat.aiDisclosure` `{{region}}` 보간, `regions` US/EU/VN/KR/JP/SG × 6언어 |
| G11 시드 KB | env `SEED_KB_PROFILE=us-cosmetics\|none` — none이면 기본 5건·CS 정책 문서 모두 생략(로그 1줄). 시나리오 문구는 기존 테넌트별 편집 화면 유지 |
| G10 문서 | `INCIDENT-RESPONSE.md` §3.5 PDPD 행(72h, A05, 법무 확인 표기) |
| 템플릿·가이드 | self-hosted/staging/production example + 프로필(VN `SEED_KB_PROFILE=none`) + `CONFIG.md`; Locale 가이드 §1/§2/§4 상태 갱신, VN 가이드 §0.1/§3/§6 |

**조사 정정**: 기존 판정이 이미 영어 브라우저를 "선호 없음"으로 보고 타임존을 따르므로(호찌민이면 en-US도 vi), G1/G2는 "명시적 레버 부재"로 범위를 줄였다.

## 2. 파일
- API: `sql/260913-tenant-default-language.sql` · `docker/init-sql/01-schema.sql` · `sql/artefacts.tsv` · `domain/tenant/{entity/tenant.entity.ts, dto/request/tenant.request.ts, dto/response/tenant.response.ts, tenant.service.ts, tenant.mapper.ts, settings-snapshot.service.ts}` · `domain/session/{session.service.ts(+spec), session.mapper.ts(+spec)}` · `global/util/pii-scrub.util.ts(+spec)` · `database/seed.runner.ts`
- Types: `packages/types/src/api/widget.types.ts`
- Widget: `store/widgetStore.ts` · `hooks/useSession.ts` · `components/chat/ChatTab.tsx` · `i18n/locales/{en,es,ko,vi,ja,zh}.ts`
- Web: `domain/settings/{SettingsPage.tsx, settings.service.ts, settings.hooks.ts}` · `domain/ai-settings/HandoffSection.tsx` · `i18n/locales/*/settings.json`
- Env/문서: `docker/{self-hosted,staging,production}/.env.*.example` · `deploy/profiles/*/.env.*.example` · `CONFIG.md` · `docs/guide/{INCIDENT-RESPONSE, GUIDE-260913-Locale-Customization, GUIDE-260913-SharpTalk-VN-Go2Joy-Staging}.md`

## 3. 테스트 결과 (TCR-260913)
- jest 전체 **1871/1871**(187 suites) — 기본 언어 3케이스·기존 4케이스 픽스처·mapper/privacyNotice 기대값·PII VN 양성 6·음성 2. CI 1차 실패(privacyNotice 기대값 누락) → 수정 후 통과
- tsc 4패키지, i18n:check, env:check, migrations:manifest(82), 실부팅
- curl(로컬): 저장·400·판정(en-US→VI, ko-KR→KO)·스냅샷 diff·감사; 브라우저: 콘솔 Select+토스트, 핸드오프 목록 호찌민, 위젯(en-US) vi 동의 버튼·고지 "tại Việt Nam"(`AI_PROCESSING_REGION=VN`)

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL staging | **선적용 완료** 2026-09-13(`default_language varchar(5) NULL`) |
| 코드 staging | main `6b4dbc0` 배포 2026-09-13: API·widget 컨테이너 신규, `successfully started` |
| 스테이징 스모크 | ivyusa: 기본 언어 null→ensure en-US `EN`·`aiProcessingRegion US` → PATCH vi → en-US `VI`, ko-KR `KO` → `xx` 400 → 복원 null; 위젯 번들에 `regions` 포함(“Việt Nam” 문자열) |
| staging `.env.staging` | `AI_PROCESSING_REGION`·`SEED_KB_PROFILE` 미설정(기본 US·us-cosmetics = 현행 동작) |
| production | 미배포 — SQL 선적용 필수 |

## 5. 잔여·후속
- G7 고지의 **법적 문구**(PDPD 요구 표현)는 현지 법무 확정 후 위젯 i18n `chat.aiDisclosure`·`regions` 수정.
- vi/ja/zh 번역 검수(G18), 통화·날짜 포맷(G4/G5), 한국 스테이징 폴백 URL 제거(P1)는 별도.
- VN 스테이징 오픈 시 프로필 env: `SEED_KB_PROFILE=none`, `AI_PROCESSING_REGION=US`(실제 처리 지역), 테넌트 설정에서 기본 언어 `vi`.
