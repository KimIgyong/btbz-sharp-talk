# TCR-260911 — 커스텀 위젯 라이브러리 P3 (만들기·사용함·기본 복귀·보관·미리보기)

- 근거: `docs/plan/PLN-260910-Tenant-Asset-Store-Widget-Design.md` D-12′·D-15 (D-13 패키지 zip 이관은 후속)
- 환경: 로컬 dev — API dist, 콘솔 :5173(`VITE_WIDGET_URL=localhost:5175/widget`), 위젯 :5175(로컬 API), ivyusa(dev@, master), P1 자산(폰트·아이콘)

## 1. 단위 테스트 (`widget-design.service.spec.ts`)
| ID | 케이스 | 기대 | 결과 |
|---|---|---|---|
| U-1 | create → apply | 생성은 라이브 무변경(포인터 null·`widget_theme.design` 없음), apply 후 포인터=id·라이브 사본=디자인·brand 유지·감사 `applied` | PASS |
| U-2 | 라이브 디자인 archive/delete, revert | E5086 거부 2건; revert 후 포인터 null·design 제거·런처 enum 유지; 이후 delete 가능 | PASS |
| U-3 | 이름 중복·복제 | E5087; `A (copy)`, `A (copy 2)` | PASS |
| U-4 | 라이브 디자인 편집·미리보기 토큰 | 편집 시 라이브 사본 갱신; 토큰 → 기본⊕디자인 테마; 위조 토큰 null | PASS |
| 합계 | 4/4 (+ tenant.service 13, types 22 회귀) | | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` api / widget / web | PASS |
| `i18n:check` | complete |
| `migrations:manifest` | `260911-widget-designs.sql` table + column 등재 |
| 실부팅(신규 엔티티·컬럼·컨트롤러) | `successfully started`, `widget_designs`·`tenants.active_widget_design_id` 생성 |

## 3. API (curl, 로컬)
| ID | 요청 | 기대 | 결과 |
|---|---|---|---|
| I-1 | POST /widget-designs A(업로드 폰트·아이콘) / B(inter·sm·380×600) | 201, design 정규화(asset ref 포함) | PASS |
| I-2 | 같은 이름 재생성 | E5087 | PASS |
| I-3 | GET 목록 | activeId null, 2건 ready | PASS |
| I-4 | POST :A/apply | active true·appliedAt; `GET widget-theme` 라이브 design=A(panel 440×680, launcherIcon), launcher enum chat 유지; `session/ensure` design 동봉 | PASS |
| I-5 | 라이브 A archive / delete | E5086 / E5086 | PASS |
| I-6 | POST :B/preview-token → `GET /public/widget/preview-theme?token` | B 디자인(radius sm, 380×600); 위조 토큰 403 | PASS |
| I-7 | apply B → duplicate B → archive A → revert | "봄 시즌 (copy)"; A archived; revert 후 design 없음·brand 유지·activeId null | PASS |

## 4. 위젯 (브라우저)
| ID | 검사 | 결과 |
|---|---|---|
| W-1 | `?preview=<B 토큰>` | 토큰 radius 8px·panel 380px·Inter 링크, 패널 실측 380×600 (라이브는 기본) | PASS |
| W-2 | 토큰 없이 재진입 | 디자인 토큰 없음·폰트 링크 없음 = 기본 위젯 | PASS |
| W-3 | 런처 아이콘 | `design.launcherIcon`이 있으면 enum과 무관하게 `<img>`(P2 대비 변경) | 코드 검토 PASS |

## 5. 콘솔
| ID | 검사 | 결과 |
|---|---|---|
| C-1 | "커스텀 위젯" 카드: 현재 상태 배지·목록(요약: 폰트 크기·패널)·[만들기]·행 동작 6종·보관함 토글 | PASS |
| C-2 | [사용함] → 토스트·배지 "사용 중"·[기본 위젯으로 복귀] 노출 | PASS |
| C-3 | [미리보기] → 실제 위젯 iframe(`?shop&preview=`) 모달 | PASS |
| C-4 | 위젯 테마 카드에서 P2 디자인 항목 제거(기본 위젯=색·헤더·로고·런처만) | 코드 검토 PASS |

## 6. 엣지
| 케이스 | 처리 |
|---|---|
| 라이브 디자인 저장 | 콘솔 confirm 경고 후 즉시 반영(서비스가 라이브 사본 동기화) |
| 보관된 디자인 apply | VALIDATION_FAILED |
| 기본 테마가 없는 테넌트에 apply | brand 기본값으로 라이브 사본 생성 |
| 미리보기 토큰 만료(10분) | 403 → 위젯은 라이브 테마 유지 |
| 스토어 도메인 미설정 | 콘솔 미리보기 버튼이 안내 토스트 |
