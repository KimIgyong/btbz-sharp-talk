# RPT-260911 — 위젯 디자인 프로필 P2 실행 보고

- 근거: PLN-260910-Tenant-Asset-Store-Widget-Design §2.1(P2 세부) · TCR-260911-Widget-Design-Profile-P2
- PR: **#507** (squash → main `f913953`, 2026-09-11)
- 승인: 사용자 "다음"(P1 완료 보고의 다음 단계 = P2)

## 1. 무엇이 바뀌었나
| 영역 | 변경 |
|---|---|
| 계약(types) | `WidgetTheme.design { font{preset, asset?, baseSize}, radius, panel{width,height}, launcherIcon? }`, `LAUNCHER_ICON.custom`, `normalizeDesign`(범위 밖→기본값, 파일 없는 custom→pretendard/chat), `buildThemeVariables`에 `--ivy-font-family / --ivy-root-size / --ivy-radius / --ivy-panel-w / --ivy-panel-h`, `panelFrame()` |
| API | `PATCH /tenants/widget-theme` `design`(snake): 절대 없음=유지 · null=삭제 · 객체=교체. 자산 uuid는 테넌트 소유·kind(font/icon) 검증(`TenantAssetService` 옵셔널 주입, TenantModule ← TenantAssetModule). 스키마 변경 없음 |
| 위젯 | `:root` 토큰 적용 + 업로드 폰트 `@font-face 'IvyTenantFont'`(swap) / Noto Sans KR·Inter는 Google Fonts `<link>`(중복 삽입 없음). `html{font-size: var(--ivy-root-size,16px)}`로 rem 글자·간격 동시 스케일. 패널 `.ivy-panel-desktop`(sm 이상: 폭·높이·모서리 토큰). 런처 custom `<img>`. `ivy:launcher`에 `frame{w,h}` 동봉 |
| 로더 | `applyFrame`: frame을 400~520/560~800으로 클램프해 `OPEN` 계산, 런처 캐시와 함께 shop별 저장 |
| 콘솔 | 위젯 테마 카드: 폰트(프리셋/업로드 폰트+파일 선택)·기본 크기(13~16)·모서리·패널 폭/높이·런처 "업로드한 아이콘"+파일 선택, 미리보기에 폰트·크기·모서리·아이콘 반영. i18n 6언어 |

## 2. 파일
- `packages/types/src/common/widget-theme.ts`(+spec) · `apps/api/src/domain/tenant/{tenant.service.ts(+spec), tenant.module.ts, dto/request/tenant.request.ts}` · `apps/widget/src/{lib/theme.ts, lib/branding.ts, index.css, components/widget/{Widget.tsx, WidgetPanel.tsx}, hooks/useLauncherReport.ts}` · `apps/widget/public/embed.js` · `apps/web/src/domain/settings/{SettingsPage.tsx, settings.service.ts, settings.hooks.ts}` · `apps/web/src/i18n/locales/*/settings.json` · PLN §2.1 · TCR/RPT-260911-Widget-Design-Profile-P2

## 3. 테스트 결과 (TCR-260911-P2)
- jest types 22 · tenant.service 13, `tsc` 4 패키지, `embed.js` 구문, `i18n:check`, 실부팅
- curl(로컬): 저장·kind 불일치 E5003·brand-only 이웃 보존·session/ensure 동봉
- 위젯(로컬 API): 토큰 5종·`@font-face`·런처 `<img>`·패널 440×680/16px 실측 · 콘솔 카드 확인

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL | 없음 |
| staging | main `f913953` 배포 2026-09-11: api/web/widget 컨테이너 신규, `successfully started`, `/health` ok, 배포된 `embed.js`에 `applyFrame` 존재 |
| 스테이징 실검증(ivyusa=ambshop-dev.myshopify.com) | 자산(폰트·아이콘) 업로드 → design 저장 → `session/ensure` 동봉 → 위젯 `?shop=` 페이지: 토큰 5종·`@font-face`·런처 img·패널 **440×680 / 16px** 실측. 로더 frame: §4.1 |
| 검증 후 원복 | ivyusa 스테이징 design 삭제(null)·런처 chat·테스트 자산 2건 삭제 (데모 테넌트 원상 유지) |
| production | 미배포 |

### 4.1 로더 frame 실측
- 스테이징 하네스(`/widget/embed-test.html`)는 shop이 `amoeba-9004`로 고정되어 ivyusa 디자인이 없음 → 샘플 페이지(`/sample/simulation/`)에 같은 오리진으로 `SHARPTALK_WIDGET_CONFIG{shop: ambshop-dev}` + `embed.js`를 주입해 iframe 실측: 닫힘 96×96 → 런처 클릭 후 **`min(480px, 100vw)` × `min(760px, 100vh)`**(패널 440×680 + 40/80) — 로더가 위젯이 보고한 frame을 적용함. **PASS**

## 5. 잔여·후속
- **P3 커스텀 위젯 라이브러리**(만들기·사용함·기본 복귀·보관, `widget_designs` + 활성 포인터) — 다음 승인 단위
- 말풍선 모서리·탭 아이콘은 범위 밖(패널 모서리·런처 아이콘만)
- 위젯 테마 캐시(`ivy_theme:{shop}`)에 design이 포함되므로 첫 페인트도 디자인 반영; 폰트 파일 삭제 시 다음 저장에서 404 거부
- 매뉴얼 설정 > 위젯 절 재캡처 목록에 디자인 항목 추가
