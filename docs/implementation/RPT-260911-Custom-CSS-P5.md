# RPT-260911 — P5 실행 보고: 정제 CSS 옵션

- 근거: PLN-260910-Tenant-Asset-Store-Widget-Design §2.4 · TCR-260911-Custom-CSS-P5
- PR: **#513** (squash → main `5c30903`, 2026-09-11)
- 승인: 사용자 "다음"(P4 완료 보고의 다음 단계 = P5, 선택 항목)

## 1. 무엇이 바뀌었나
| 영역 | 변경 |
|---|---|
| 정제기 | `apps/api/src/global/util/css-sanitizer.util.ts`(외부 의존성 없음): 선택자 `.st-*`(+후손/자식·hover/focus/active/first/last-child/disabled)만, 속성 허용목록(색·배경색·테두리·모서리·폰트·글자·여백·gap·그림자·outline·폭/높이), 값 문자집합 + `rgb/rgba/hsl/hsla/var(--ivy-*)`. `display/visibility/opacity/position/transform/content`·`url()`·`@import/@media`·중첩·비-st 선택자·statement at-rule은 **드롭 + 사유 배열**. 32KB 상한(초과 잘림 보고) |
| 게이트 | `tenants.custom_css_enabled`(기본 0). 플랫폼 어드민 [요금제·애드온] 모달 체크박스 → `PATCH /tenants/:uuid/custom-css`(AdminOnly, 감사 `tenant.custom_css_changed`, 라이브 파일 재발행). 테넌트는 스스로 켤 수 없음 |
| 저장 | 디자인 `custom_css` → 애드온 ON이면 정제본만 `design.customCss` 저장(드롭 수 warn), OFF면 무시+warn. 드라이런 `POST /tenants/widget-theme/sanitize-css`(master/director) |
| 전달 | `stripCustomCss`(types): 세션 ensure·정적 라이브 파일·미리보기 토큰 — 애드온 OFF면 customCss 제거(나머지 디자인 유지) |
| 위젯 | 안정 클래스 `st-panel st-header st-header-title st-tabs st-tab st-message st-message-user st-message-bot st-composer st-input st-send st-launcher st-quick-reply`; `applyTheme`가 `<style id="ivy-custom-css">` 삽입/갱신/제거 |
| 콘솔 | 어드민 모달 스위치(6언어), 커스텀 위젯 편집기 CSS 텍스트영역(애드온 ON일 때만)+[검사]로 유지 규칙 수·드롭 사유 표시+안정 클래스 안내 |

## 2. 파일
- API: `sql/260911-tenant-custom-css-flag.sql` · `docker/init-sql/01-schema.sql` · `global/util/css-sanitizer.util.ts(+spec)` · `domain/tenant/{entity/tenant.entity.ts, tenant.service.ts(+spec), tenant.controller.ts, tenant.mapper.ts, dto/request, dto/response, widget-live.service.ts, widget-design.service.ts}` · `domain/session/session.service.ts`
- Types: `widget-theme.ts`(customCss·stripCustomCss, +spec)
- Widget: `lib/theme.ts` · `components/widget/{WidgetPanel, Widget, TopTabs, BottomTabs}.tsx` · `components/chat/{MessageBubble, ChatTab, ScenarioMenu}.tsx`
- Web: `domain/admin/{admin.service.ts, admin.hooks.ts, TenantPlanModal.tsx}` · `domain/settings/{WidgetDesignsCard.tsx, settings.service.ts}` · `i18n/locales/*/{tenants,settings}.json`
- 문서: PLN §2.4 · TCR/RPT-260911-Custom-CSS-P5

## 3. 테스트 결과 (TCR-260911-P5)
- jest css-sanitizer 4 · types 23 · tenant.service 15, `tsc` 4패키지, `i18n:check`, 실부팅·컬럼 생성
- curl(로컬): OFF 무시 → 어드민 ON → 드라이런(2 유지, display·body 드롭) → 정제 저장·apply → ensure/정적 동봉 → OFF 제거(감사 on/off/on)
- 위젯(로컬): `#ivy-custom-css`, `.st-header` #111/흰 글자, `.st-send` 색만 변경·display 유지, st-* 6종; 콘솔 편집기 검사 결과·어드민 모달 체크박스
- 설계상 검출: `.st-header{color}`가 제목에 상속되지 않아 `.st-header-title` 클래스 추가

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL staging | **선적용 완료** 2026-09-11 (`custom_css_enabled` tinyint(1) DEFAULT 0) |
| 코드 staging | main `5c30903` 배포 2026-09-11: API·widget 컨테이너 신규, `successfully started`, `/health` ok, sanitize-css 미인증 401 |
| 스테이징 스모크 | 드라이런(1 유지·display/body 드롭) → 애드온 OFF 저장 무시 → SQL로 ON → 정제 저장·apply → 정적 파일·ensure에 customCss 동봉 → SQL로 OFF → ensure 제거 → revert·삭제(데모 테넌트 원상, 플래그 0) |
| production | 미배포 — SQL 선적용 필수 |

## 5. 잔여·후속
- 스테이징 admin@는 MFA라 애드온 토글은 어드민 콘솔(브라우저)에서만 — 스모크는 SQL 토글로 대체. SQL 토글은 라이브 파일을 재발행하지 않으므로(API 쓰기만 발행) 운영에서는 반드시 콘솔/API로 토글
- 안정 클래스 계약을 dev-kit lessons에 등재 후보(리팩터 시 유지)
- 로드맵 P0~P5 완결. 후속 후보: 어드민 용량 컬럼(D-11), 디자인별 변경 이력, zip 포맷, 매뉴얼 재캡처
