# RPT-260911 — P4 실행 보고: 정적 라이브 파일 · 설정 스냅샷 · 디자인 패키지 이관

- 근거: PLN-260910-Tenant-Asset-Store-Widget-Design §2.3 · TCR-260911-Widget-Design-P4
- PR: **#511** (squash → main `63e54d3`, 2026-09-11)
- 승인: 사용자 "다음"(P3 완료 보고의 다음 단계 = P4)

## 1. 무엇이 바뀌었나
| 영역 | 변경 |
|---|---|
| 정적 라이브 파일(D-14) | `WidgetLiveService`: 라이브 테마가 바뀌는 모든 쓰기(테마 카드·로고·디자인 apply/revert/라이브 편집·스냅샷 복원) 뒤 `UPLOAD_DIR/widget-live/{shop}.json`(정규화 결과+updatedAt, write-then-rename). nginx 3스택(staging/self-hosted/production)이 uploads 볼륨을 **읽기 전용** 마운트하고 `/widget-design/live/{shop}.json`을 no-cache·CORS로 서빙. 위젯은 캐시 페인트 직후 같은 오리진에서 no-store로 읽어 적용·캐시 갱신(실패 무시). 키는 호스트명 문자만 |
| 설정 스냅샷(D-8) | `SettingsSnapshotService`: 화이트리스트 12필드 + 커스텀 위젯 라이브러리(이름·상태·디자인·활성) → `tenants/{id}/settings/settings-{stamp}.json`(`tenant_assets` kind settings_snapshot, 서명 URL). `/settings-snapshots` GET·POST·`:uuid/diff`·`:uuid/restore`·DELETE(master/director, 감사 `tenant.settings_restored`). 자격증명·시크릿 구조적 제외 |
| 디자인 패키지(D-13) | **zip 대신 JSON**(`sharptalk-widget-design/1`, 폰트·아이콘 base64 동봉). `GET /widget-designs/:id/export`(attachment) / `POST /widget-designs/import`(multipart ≤12MB) — 자산은 업로드와 같은 내용 검증으로 재생성, 이름 충돌 `(n)` |
| 자산 저장소 | `TenantAssetService.storeGenerated`(서버 생성 파일, settings 영역)·`readBuffer` |
| 콘솔 | 설정 > 기타 **"설정 스냅샷"** 카드(라벨·저장·목록·다운로드·복원 diff 모달·삭제·시크릿 미포함 안내), 커스텀 위젯 카드 **[패키지 가져오기]**·행 **[내보내기]**. i18n 6언어 |
| 스키마 | 변경 없음 (인프라: nginx 볼륨 마운트 + location) |

## 2. 파일
- API: `domain/tenant/{widget-live.service.ts(+spec), settings-snapshot.service.ts(+spec), settings-snapshot.controller.ts, widget-design.service.ts(+spec), widget-design.controller.ts, tenant.service.ts, tenant.module.ts}` · `domain/tenant-asset/tenant-asset.service.ts`
- Widget: `lib/theme.ts`(fetchStaticLiveTheme) · `main.tsx`
- Infra: `docker/{staging,self-hosted,production}/nginx.conf` + 각 compose nginx 볼륨
- Web: `domain/settings/{SettingsSnapshotsCard.tsx(신규), SettingsEtcPage.tsx, WidgetDesignsCard.tsx, settings.service.ts, settings.hooks.ts}` · `i18n/locales/*/settings.json`
- 문서: PLN §2.3 · TCR/RPT-260911-Widget-Design-P4

## 3. 테스트 결과 (TCR-260911-P4)
- jest 14/14(라이브 파일 키·정규화, 스냅샷 시크릿 제외·diff·restore, 패키지 왕복), `tsc` api/widget/web, `i18n:check`, `nginx -t`, 실부팅
- curl(로컬): 스냅샷 생성→diff(timezone 변경 검출)→복원(활성 디자인·라이브 파일 갱신)→서명 다운로드 200→삭제; 디자인 apply 시 `.uploads/widget-live/ivyusa.myshopify.com.json` 생성; 패키지 export attachment→import "(2)"
- 콘솔: 스냅샷 저장 토스트·목록·복원 diff 모달(12필드·디자인 요약)

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL | 없음 |
| staging | main `63e54d3` 배포 2026-09-11: API healthy·`successfully started`, nginx 컨테이너 재생성, `docker inspect` 마운트 `/data/uploads` RW=false(읽기 전용) 확인 |
| 정적 라이브 파일 실측 | ivyusa(ambshop-dev.myshopify.com)에 디자인 apply → `GET https://shoptalk.amoeba.site/widget-design/live/ambshop-dev.myshopify.com.json` **200** `application/json`·`Cache-Control: no-cache`·CORS *, theme.design.panel 380×600·updatedAt; revert 후 파일의 design 없음·brand 유지; 없는 shop 404 |
| 스냅샷 스모크 | 스냅샷 생성 → diff(변경 0·디자인 1 active) → 삭제; 테스트 디자인 삭제로 데모 테넌트 원상 |
| production | 미배포 — compose nginx 볼륨 마운트 포함 |

## 5. 잔여·후속
- P5(선택): 정제 CSS(허용목록 파서·안정 클래스 계약)
- 어드민 용량 컬럼(D-11)·디자인별 변경 이력·zip 아카이브 포맷(요구 시)
- 매뉴얼 설정 > 기타 절에 스냅샷 카드, 설정 > 위젯 절에 패키지 버튼 재캡처
