# TCR-260911 — P5 정제 CSS 옵션 (허용목록 정제기 · 플랫폼 애드온 · 안정 클래스)

- 근거: `docs/plan/PLN-260910-Tenant-Asset-Store-Widget-Design.md` §2.4
- 환경: 로컬 dev(API dist, 콘솔 :5173, 위젯 :5175 로컬 API), ivyusa(dev@ master) + 플랫폼 어드민(admin@)

## 1. 단위 테스트
| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `sanitizeWidgetCss` | 정상 규칙 3개(복합 선택자·후손·자식·hover·rgba·box-shadow) | 전부 유지·정규화, dropped 0 | PASS |
| U-2 | 〃 | 속성 선택자+url()·`@import`·`display:none`·`position:fixed`·`opacity:0`·`body`·`background-image`·`expression()`·`var(--evil)`·`@media` | 안전한 선언 1개만 유지, 각 사유 보고, 출력에 import/url/@ 없음 | PASS |
| U-3 | 〃 | `var(--ivy-primary-700)` / `var( --x )` / 빈 입력 | 허용 / 드롭 / 빈 결과 | PASS |
| U-4 | 〃 | 32KB 초과 | 잘림 사유 + 부분 유지 | PASS |
| U-5 | `normalizeDesign`·`stripCustomCss` (types) | customCss trim·상한, 애드온 OFF면 전달에서 제거(디자인이 비면 null) | PASS |
| U-6 | `TenantService.updateWidgetTheme` | 애드온 ON: 정제 저장(display 드롭, color 유지) / OFF: 무시 | PASS |
| U-7 | `TenantService.updateCustomCssEnabled` | 플래그 1 + 감사 `tenant.custom_css_changed`(admin) | PASS |
| 합계 | css-sanitizer 4 · types 23 · tenant.service 15 | | | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` types / api / widget / web | PASS |
| `i18n:check` | complete |
| `migrations:manifest` | `260911-tenant-custom-css-flag.sql column tenants custom_css_enabled` |
| 실부팅 | `successfully started`, 컬럼 자동 생성 |

## 3. API / 위젯 (로컬)
| ID | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| I-1 | 애드온 OFF: 디자인에 custom_css 저장 | 응답 design에 customCss 없음, 로그 "add-on off" | PASS |
| I-2 | 어드민 `PATCH /tenants/:uuid/custom-css {enabled:true}` | customCssEnabled true, 감사 `tenant.custom_css_changed` on/off/on | PASS |
| I-3 | `POST /tenants/widget-theme/sanitize-css` 드라이런 | 유지 2규칙(display 제거된 .st-send 포함) + dropped [display, body] | PASS |
| I-4 | 애드온 ON: 디자인 저장 → apply | design.customCss 정제본 저장, `session/ensure`·정적 파일에 동봉 | PASS |
| I-5 | 위젯 `?shop=` | `#ivy-custom-css` 존재, `.st-header` bg rgb(17,17,17)/color 흰색, `.st-send` bg rgb(225,29,72)·display flex(숨김 불가), st-* 6종 존재 | PASS |
| I-6 | 어드민 OFF 전환 | `session/ensure`·정적 파일에서 customCss 제거(radius 등 나머지 유지) | PASS |

## 4. 콘솔
| ID | 검사 | 결과 |
|---|---|---|
| C-1 | 어드민 [요금제·애드온] 모달: "커스텀 위젯 CSS 허용" 체크박스(현재값 반영)·설명 | PASS |
| C-2 | 커스텀 위젯 편집기: 애드온 ON일 때만 CSS 텍스트영역·[검사]·안정 클래스 안내; 검사 결과 "2개 규칙이 유지됩니다" + 드롭 사유 2건 | PASS |

## 5. 엣지
| 케이스 | 처리 |
|---|---|
| 애드온 OFF인데 저장된 CSS가 남은 디자인 | 전달 3경로(세션·정적·미리보기) 모두 `stripCustomCss` |
| 위젯 리팩터로 `.st-*` 제거 | 계약 위반 — dev-kit/메모리에 안정 클래스 목록 기록 |
| 대비 저하 CSS | 허용(테넌트 책임 고지); 숨김/이동은 불가 |
