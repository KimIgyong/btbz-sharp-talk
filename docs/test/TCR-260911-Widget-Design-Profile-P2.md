# TCR-260911 — 위젯 디자인 프로필 P2 (폰트·글자 크기·모서리·패널 크기·업로드 아이콘)

- 근거: `docs/plan/PLN-260910-Tenant-Asset-Store-Widget-Design.md` §2.1(P2 세부)
- 환경: 로컬 dev — API dist 부팅, 콘솔 vite :5173, 위젯 vite :5175(`VITE_API_BASE_URL=localhost:3000`), ivyusa(dev@, master), P1 자산(폰트 1·아이콘 1)

## 1. 단위 테스트
| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `normalizeWidgetTheme` (types) | custom 폰트인데 파일 없음·baseSize 40·radius xl·panel 9999×10·잘못된 아이콘 uuid·icon custom | 폰트 pretendard/16, panel 480×480, radius 제거, launcher icon → chat | PASS |
| U-2 | 〃 + `buildThemeVariables`·`panelFrame` | custom 폰트 v3·15px·lg·420×700 | `--ivy-font-family` 'IvyTenantFont'…, `--ivy-root-size` 17.14px, `--ivy-radius` 16px, panel 420px, frame 460×780 | PASS |
| U-3 | 〃 | 디자인 없음 | 디자인 토큰 없음, frame 444×680(종전 상수와 동일) | PASS |
| U-4 | `TenantService.updateWidgetTheme` | custom 폰트 uuid(version 2)·base_size 99·panel 100×700 | 자산 ref {uuid, version 2} 저장, 16/360으로 클램프 | PASS |
| U-5 | 〃 | 아이콘 uuid를 폰트로 지정 / brand만 PATCH | E5003 / 저장된 design 유지 | PASS |
| 합계 | types 22 · tenant.service 13 | | | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` types / api / widget / web | PASS |
| `embed.js` 구문(new Function) | PASS |
| `i18n:check` | complete |
| 실부팅(TenantModule ← TenantAssetModule) | `successfully started` |

## 3. API (curl)
| ID | 요청 | 기대 | 결과 |
|---|---|---|---|
| I-1 | PATCH widget-theme design{custom font, 15, lg, 440×680, icon custom+uuid} | 응답 theme.design에 asset {uuid, version 1} 2종, launcher.icon custom | PASS |
| I-2 | font asset_uuid에 icon uuid | E5003 + 로그 `is icon, expected font` | PASS |
| I-3 | brand만 PATCH | design·icon custom 유지(이웃 필드 보존) | PASS |
| I-4 | `POST /session/ensure {shop_domain}` | widgetTheme.design 동봉 | PASS |

## 4. 위젯 (브라우저, localhost:5175 + 로컬 API)
| ID | 검사 | 결과 |
|---|---|---|
| W-1 | `:root` 토큰 | `--ivy-font-family` 'IvyTenantFont'…, `--ivy-root-size` 17.14px, `--ivy-radius` 16px, `--ivy-panel-w/h` 440/680px | PASS |
| W-2 | `@font-face` 태그(`#ivy-font-face`) src=공개 자산 URL, html font-size 17.14px | PASS |
| W-3 | 런처가 업로드 아이콘 `<img>`로 렌더 | PASS |
| W-4 | 패널 열기 → 실측 440×680, border-radius 16px, body font IvyTenantFont | PASS |
| W-5 | 테마 캐시 제거 후 재부팅 → 세션 응답만으로 동일 렌더 | PASS |
| W-6 | 로더 `frame` 계약 | 코드 검토(메시지 동봉·클램프·캐시) + 구문 검사; 로컬 하네스는 스테이징 위젯을 가리켜 실측 불가 → 스테이징 배포 후 샘플 페이지에서 iframe 실측 | 배포 후 |

## 5. 콘솔
| ID | 검사 | 결과 |
|---|---|---|
| C-1 | 위젯 테마 카드: 폰트(프리셋/업로드 폰트 선택)·기본 크기·모서리·패널 폭/높이·런처 "업로드한 아이콘"+파일 선택 | PASS |
| C-2 | 미리보기에 폰트·크기·모서리·아이콘 반영 | PASS |

## 6. 엣지
| 케이스 | 처리 |
|---|---|
| 업로드 폰트 삭제 후 | 세션 응답의 ref는 남지만 공개 라우트 404 → `font-display: swap`으로 폴백 폰트 유지(다음 저장 시 API가 404로 거부) |
| 앱모드/모바일 | `ivy-panel-desktop`은 sm 이상만, 로더 frame은 앱모드 미보고 |
| 구 위젯 캐시에 design 없음 | 토큰 미기록 → 종전 CSS 기본값 |
| 로더 범위 밖 frame | 400~520 / 560~800 클램프 |
