# TCR-260911 — 로드맵 후속 4종 (어드민 용량 컬럼 · 디자인 변경 이력 · dev-kit 등재 · 매뉴얼)

- 근거: `docs/plan/PLN-260910-Tenant-Asset-Store-Widget-Design.md` §후속(D-11·변경 이력) · RPT-260911-Custom-CSS-P5 §5
- 환경: 로컬 dev(API dist, 콘솔 :5173), ivyusa(dev@ master) + 플랫폼 어드민(admin@)

## 1. 단위 테스트
| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `WidgetDesignService.update` | 디자인 변경 2회 → 이력 | revision_no 1(원본)·2(1차) 역순, 각 designJson 보존 | PASS |
| U-2 | 〃 | 이름만 변경 | 이력 생성 안 함(복원이 이름을 되돌리지 않으므로 쓸모없는 리비전 방지) | PASS |
| U-3 | `restoreRevision` | 리비전 1 복원 | 현재 상태를 먼저 스냅샷(3) → designJson 복원 → 활성 디자인이면 라이브 재동기화 | PASS |
| 합계 | widget-design.service 6 · tenant.service 15 | | | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` api / web | PASS |
| `i18n:check` | complete (settings·tenants 6언어) |
| `migrations:manifest` | `260911-widget-design-revisions.sql table widget_design_revisions` (81파일) |
| 실부팅 | `successfully started`, `widget_design_revisions` 자동 생성 |
| 매뉴얼 html | 태그 균형(p/tr/td/figure/section) · 참조 이미지 12/12 존재 |

## 3. API (로컬 curl)
| ID | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| I-1 | `GET /widget-designs/:id/revisions` 신규 디자인 | `[]` | PASS |
| I-2 | `PATCH` 이름만 변경 | 이력 건수 불변 | PASS |
| I-3 | `PATCH design.radius sm→lg` | 이력 최상단 `radius: sm`(변경 전) | PASS |
| I-4 | `POST …/revisions/:rid/restore` | 응답 `radius: sm`, 이력에 복원 직전 상태(`lg`) 추가, 감사 `tenant.widget_design_restored` | PASS |
| I-5 | 없는 리비전 id 복원 | 404 (E1004) | PASS |
| I-6 | 어드민 `GET /tenants` | `assetBytes`(ivyusa 5,532 B — 폰트 1KB+스냅샷) + `userCount` 동시 반환 | PASS |
| I-7 | 유효하지 않은 radius(`xl`) | normalizeDesign이 필드 제거, 이력은 변경 전 값 보존 | PASS |

## 4. 콘솔
| ID | 검사 | 결과 |
|---|---|---|
| C-1 | 커스텀 위젯 행 **[이력]** → 모달: 리비전 번호·이름·저장 시각·[복원] | PASS (캡처) |
| C-2 | 어드민 테넌트 목록 **파일** 열: KB/MB 표기 | PASS |
| C-3 | 매뉴얼 `/manual/user-manual.ko.html#ch14` 표·그림 2장 렌더 | PASS |

## 5. 엣지
| 케이스 | 처리 |
|---|---|
| 활성 디자인 복원 | 라이브 파일·테넌트 위젯 테마 즉시 재동기화(콘솔은 라이브 편집 경고 후 진행) |
| 리비전 50건 초과 | 최신 50건만 목록(보관 상한은 DB에 없음 — 필요 시 정리 배치) |
| 다른 테넌트의 리비전 id | `tenant_id`+`design_id` 동시 조건 → 404 |
