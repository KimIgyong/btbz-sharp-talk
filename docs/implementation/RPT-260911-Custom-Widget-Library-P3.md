# RPT-260911 — 커스텀 위젯 라이브러리 P3 실행 보고

- 근거: PLN-260910-Tenant-Asset-Store-Widget-Design §2.2(P3 세부, D-12′·D-15) · TCR-260911-Custom-Widget-Library-P3
- PR: **#509** (squash → main `74112c2`, 2026-09-11)
- 승인: 사용자 "다음"(P2 완료 보고의 다음 단계 = P3)

## 1. 무엇이 바뀌었나
| 영역 | 변경 |
|---|---|
| 데이터 | `widget_designs`(테넌트별 이름 uniq, design_json, ready/archived, note, applied_at) + `tenants.active_widget_design_id`(NULL=기본 위젯). **라이브 = 포인터 + `widget_theme.design` 사본** → session/ensure·위젯·테마 캐시·정적 파일 계약 무변경 |
| 기본 위젯 | 위젯 테마 카드 = 색·헤더·로고·런처만. P2에서 카드에 넣었던 폰트·크기·모서리·패널·아이콘은 **커스텀 위젯 편집기로 이동**. [기본 위젯으로 복귀] = 포인터 null + design 제거(브랜드색·로고·런처 enum 유지) |
| API | `/widget-designs` GET·POST·PATCH :id·POST :id/apply·POST revert·POST :id/duplicate·:id/archive·:id/restore·:id/preview-token·DELETE :id — master/director, 감사 6종. 사용 중 디자인 archive/delete **E5086**, 이름 중복 **E5087**. 공개 `GET /public/widget/preview-theme?token=`(10분 HMAC, `signFileUrl` 재사용) |
| 위젯 | `?preview=<token>`이면 세션 테마 위에 미리보기 테마를 덮어 그림(캐시 안 함, 실패 시 라이브 유지). `design.launcherIcon`이 있으면 런처 enum과 무관하게 이미지(복귀 시 enum 아이콘 자연 복원) |
| 콘솔 | 설정 > 위젯 **"커스텀 위젯"** 카드: 현재 상태 배지(기본/커스텀 "이름" 사용 중)·[기본 위젯으로 복귀]·[커스텀 위젯 만들기]·목록(요약·사용 중/보관 배지)·행 동작(사용함·미리보기·편집·복제·보관/복원·삭제)·보관함 토글·편집기 모달(이름·폰트·크기·모서리·패널·아이콘·메모·간이 미리보기·[보관함에 저장]/[저장 후 사용함]·라이브 편집 경고)·실제 위젯 미리보기 iframe 모달. i18n 6언어 |
| 보류 | D-13 패키지 zip 내보내기/가져오기 — zip 라이브러리 미도입, P4로 이월 |

## 2. 파일
- API: `sql/260911-widget-designs.sql` · `docker/init-sql/01-schema.sql` · `sql/artefacts.tsv` · `domain/tenant/{entity/widget-design.entity.ts, entity/tenant.entity.ts, widget-design.service.ts(+spec), widget-design.controller.ts, widget-branding.controller.ts, tenant.service.ts(resolveDesign public), tenant.mapper.ts, tenant.module.ts, dto/request/tenant.request.ts}` · `global/constant/error-code.constant.ts`
- Widget: `hooks/useSession.ts`(preview) · `components/widget/Widget.tsx`
- Web: `domain/settings/WidgetDesignsCard.tsx`(신규) · `SettingsWidgetPage.tsx` · `SettingsPage.tsx`(테마 카드 환원) · `settings.service.ts` · `settings.hooks.ts` · `i18n/locales/*/settings.json`
- 문서: PLN §2.2 · TCR/RPT-260911-Custom-Widget-Library-P3

## 3. 테스트 결과 (TCR-260911-P3)
- jest widget-design 4/4 (+tenant.service 13, types 22), `tsc` api/widget/web, `i18n:check`, 실부팅·스키마 동기화
- curl(로컬) 7 시나리오: 생성·중복 E5087·apply→라이브 사본/ensure·라이브 가드 E5086·토큰/위조 403·복제·보관·revert
- 위젯: `?preview=` 미적용 디자인 380×600/8px 실측, 토큰 없이 기본; 콘솔: 카드·[사용함] 토스트/배지/복귀 버튼·[미리보기] iframe

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL staging | **선적용 완료** 2026-09-11 (`widget_designs`·`tenants.active_widget_design_id` 확인) |
| 코드 staging | main `74112c2` 배포: API 컨테이너 신규 healthy, `successfully started`, `/health` ok, `/widget-designs` 미인증 401, 위조 preview 토큰 403 |
| 스테이징 스모크 | ivyusa: 생성(id 1) → apply active true, `session/ensure` design.panel 380×600 동봉 → revert 후 design 없음·brand 유지 → 삭제 — **PASS**(데모 테넌트 원상) |
| production | 미배포 — SQL 선적용 필수 |

## 5. 잔여·후속
- **P4**: 정적 라이브 파일(D-14) + 설정 스냅샷(D-8) + 패키지 zip 이관(D-13, 라이브러리 도입 필요)
- P5(선택): 정제 CSS
- 디자인별 변경 이력(③ 혼합안)은 요구 시 후속; 현재는 복제로 대체
- 매뉴얼 설정 > 위젯 절 재캡처: 커스텀 위젯 카드·편집기·미리보기
