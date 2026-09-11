# RPT-260911 — 로드맵 후속 실행 보고: 어드민 파일 용량 컬럼 · 커스텀 위젯 변경 이력 · dev-kit G절 · 매뉴얼 현행화

- 근거: PLN-260910-Tenant-Asset-Store-Widget-Design 후속(D-11·변경 이력) · RPT-260911-Custom-CSS-P5 §5 · TCR-260911-Followups
- PR: **#515** (squash → main `34130b4`, 2026-09-11) + 후속 소수정(리비전 캐스케이드 삭제, 이 RPT와 같은 PR)
- 승인: 사용자 "진행"(P5 완료 보고의 후속 목록)

## 1. 무엇이 바뀌었나
| 영역 | 변경 |
|---|---|
| 어드민 파일 용량(D-11) | `TenantAssetService.usageByTenant(ids)`(SUM size, 삭제분 제외) → `GET /tenants` 목록에 `assetBytes`(userCount와 `Promise.all`). 콘솔 테넌트 목록 **파일** 열(KB/MB), 6언어 |
| 디자인 변경 이력 | `widget_design_revisions`(tenant_id·design_id·revision_no UNIQUE·name·design_json·note·actor). 디자인이 바뀌는 `PATCH`마다 **변경 전** 상태를 max+1로 스냅샷(이름만 변경은 제외 — 복원이 이름을 되돌리지 않으므로). `GET /widget-designs/:id/revisions`(최신 50) · `POST …/revisions/:rid/restore`(복원 직전 상태도 스냅샷 → 복원 자체가 되돌려짐, 활성이면 `writeLive` 재동기화, 감사 `tenant.widget_design_restored`). 디자인 삭제 시 이력 동반 삭제(FK 없음 → 수동 캐스케이드). 콘솔 [이력] 모달(리비전 번호·요약·시각·[이 버전으로 복원], 라이브 편집 경고) |
| dev-kit | `reference/btbz-dev-kit/05-lessons-learned.md` **G절**: G-1 CSS 허용목록 3축·안정 클래스는 계약, G-2 정적 파일은 API가 유일 작성자일 때만(SQL 토글은 재발행 안 됨), G-3 3스택 인프라 복제 → pre-deploy-check, G-4 `/tenants/:uuid` 하위 경로 포획 |
| 매뉴얼(ko/en/vi md+html) | §14 기본(지식 옵션)·위젯(커스텀 위젯: 사용함·기본 복귀·미리보기·패키지·이력 / 디자인 파일)·기타(설정 스냅샷), §16 요금제·애드온의 **커스텀 위젯 CSS 허용**·목록 **파일** 열, 빠른설정 위젯 절에 커스텀 위젯 단락, 캡처 4장(`settings-custom-widget.{ko,en}`, `settings-snapshots.{ko,en}` — 로컬 콘솔, `ivy_auth` 주입 방식), 현행화 일자 2026-09-11 |
| 미실행 | zip 패키지 포맷(요구 없음 — JSON 유지) · production 배포(호스트 미정) |

## 2. 파일
- API: `sql/260911-widget-design-revisions.sql` · `docker/init-sql/01-schema.sql` · `sql/artefacts.tsv` · `domain/tenant/{entity/widget-design-revision.entity.ts(신규), widget-design.service.ts(+spec), widget-design.controller.ts, tenant.controller.ts, tenant.mapper.ts, tenant.module.ts, dto/response/tenant.response.ts}` · `domain/tenant-asset/tenant-asset.service.ts`
- Web: `domain/admin/{TenantsPage.tsx, admin.service.ts}` · `domain/settings/{WidgetDesignsCard.tsx, settings.service.ts, settings.hooks.ts}` · `i18n/locales/*/{settings,tenants}.json` · `public/manual/{user-manual,quick-setup}.{ko,en,vi}.{md,html}` · `public/manual/img/settings-{custom-widget,snapshots}.{ko,en}.jpg`
- 문서: `reference/btbz-dev-kit/05-lessons-learned.md` · TCR/RPT-260911-Followups

## 3. 테스트 결과 (TCR-260911-Followups)
- jest widget-design.service 6/6(이력 max+1·이름만 변경 무리비전·복원·라이브 재동기화·삭제 캐스케이드), tenant.service 15/15; `tsc` api/web; `i18n:check`; `migrations:manifest` 81파일; 실부팅
- 로컬 curl: 이름만 변경 → 이력 불변 / radius sm→lg → 이력 최상단 sm / 복원 → sm / 없는 리비전 404 / 유효하지 않은 radius는 normalize가 제거해도 이력은 변경 전 값 / 어드민 `GET /tenants` assetBytes 5,532B
- 콘솔: [이력] 모달(리비전 8건·복원 버튼), 어드민 파일 열, 매뉴얼 §14 표·그림 렌더

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL staging | **선적용 완료** 2026-09-11 (`widget_design_revisions` 9컬럼, UNIQUE (design_id, revision_no)) |
| 코드 staging | main `34130b4` 배포 2026-09-11: API healthy·`successfully started`, web/widget/pwa 컨테이너 신규, `/widget-designs/1/revisions` 미인증 401, 매뉴얼 html·신규 이미지 200·현행화 마커 확인 |
| 스테이징 스모크 | 디자인 생성(이력 0) → radius sm→lg(이력 1: sm) → 복원(sm, 감사 1건) → 삭제(테넌트 원상). 삭제 후 남은 고아 리비전 2행은 SQL로 정리 — 코드에는 캐스케이드 삭제 추가 |
| production | 미배포 — SQL 선적용 필수 |

## 5. 잔여·후속
- 리비전 보관 상한 없음(목록은 50건) — 누적 시 정리 배치 후보
- 어드민 목록의 `assetBytes`는 등록부(`tenant_assets`) 합계 — 디스크 실측과 다를 수 있음(고아 파일 진단은 별도)
- 로드맵 PLN-260910 전 항목 종료. production 배포 시 SQL 4종(`260911-tenant-assets`, `-widget-designs`, `-tenant-custom-css-flag`, `-widget-design-revisions`) 선적용 + compose uploads 볼륨·nginx ro 마운트 포함
