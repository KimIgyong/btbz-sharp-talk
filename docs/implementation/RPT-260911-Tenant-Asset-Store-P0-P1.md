# RPT-260911 — 테넌트 자산 저장소 P0(프로덕션 업로드 볼륨 FIX) · P1(자산 저장소) 실행 보고

- 근거: PLN-260910-Tenant-Asset-Store-Widget-Design(P0·P1) · FIX-260911-Production-Uploads-Volume · TCR-260911-Tenant-Asset-Store-P0-P1
- PR: **#505** (squash → main `8a697b3`, 2026-09-11) · 제안 문서 PR #504 머지
- 승인: 사용자 "승인, P0·P1부터 구현"

## 1. 무엇이 바뀌었나
| 영역 | 변경 |
|---|---|
| P0 프로덕션 볼륨 | `docker/production/docker-compose.production.yml` api에 `sharptalk_uploads_production:/data/uploads`; `deploy-production.sh`에 `UPLOAD_DIR=/data/uploads` 검사(불일치 시 배포 거부); `pre-deploy-check` §5.1(스택 3종 grep + `docker inspect` 마운트) |
| 저장 규약 | `UPLOAD_DIR/tenants/{tenantId}/{area}/{uuid}.{ext}` — 기존 경로(첨부·로고·보드·인제스트)는 무이동 |
| 등록부 | `tenant_assets`(uuid uniq, tenant/area/kind, filename/mime/ext/size/sha256/width/height, storage_path, version, label, created_by, deleted_at) |
| 검증 | kind별 **매직바이트** 판정(파일명·mimetype 무시): font woff2/ttf/otf ≤2MB · icon png/webp ≤256KB·512px · image png/jpg/webp ≤2MB·2000px · doc pdf/png/jpg ≤10MB. 래스터는 sharp 재인코딩(메타 제거). svg/css/js/html 불가. 영역 상한 env `TENANT_ASSET_QUOTA_{AREA}_MB`(design 50, settings 20) |
| API | `GET /tenant-assets?area&kind`(목록+usage) · `POST /tenant-assets`(multipart file+area+kind[+label]) · `DELETE /tenant-assets/:uuid`(soft+unlink) — master/director, 감사 `tenant.asset_uploaded/deleted`. 공개 `GET /public/widget/asset/:uuid?v=`(버전 일치 시 `immutable`, 아니면 60s; 폰트 `Access-Control-Allow-Origin: *`+CORP cross-origin). doc는 서명 URL `GET /tenant-assets/:uuid/file?exp&sig`(15분). 에러 E5081~E5085 |
| 콘솔 | 설정 > 위젯 **"디자인 파일"** 카드(위젯 테마 카드 아래): 종류 탭(폰트·아이콘·이미지·시안)·규칙 문구·용량 게이지·다중 업로드·썸네일/Aa·공개/비공개 뱃지·URL 복사/다운로드·삭제·폰트 라이선스 고지. i18n 6언어 `settings.designAssets.*` |

## 2. 파일
- API: `sql/260911-tenant-assets.sql` · `docker/init-sql/01-schema.sql` · `sql/artefacts.tsv` · `domain/tenant-asset/{entity/tenant-asset.entity.ts, dto/request/tenant-asset.request.ts, tenant-asset.service.ts(+spec), tenant-asset.mapper.ts, tenant-asset.controller.ts, tenant-asset.module.ts}` · `app.module.ts` · `global/constant/error-code.constant.ts`
- Web: `domain/settings/DesignAssetsCard.tsx`(신규) · `SettingsWidgetPage.tsx` · `settings.service.ts` · `settings.hooks.ts` · `i18n/locales/*/settings.json`
- Ops: `docker/production/{docker-compose.production.yml, deploy-production.sh}` · `.claude/skills/pre-deploy-check/SKILL.md`
- 문서: FIX-260911 · TCR-260911 · RPT-260911

## 3. 테스트 결과 (TCR-260911)
- jest `tenant-asset.service.spec.ts` **5/5**(내용 판정·svg 위장 거부·kind/상한/용량·doc 서명·삭제 unlink), `tsc` api/web, `i18n:check` complete, 실부팅 + 테이블 자동 생성
- curl(로컬): 업로드 5종 중 거부 2(E5081 svg, E5083 600px), 목록/usage, 공개 immutable+CORS, no-v는 60s, doc 공개 라우트 404·서명 200·위조 403, 미인증 401, 삭제 soft+unlink+감사
- 콘솔(로컬): 카드·탭·썸네일(공개 라우트 로드) 확인
- **검출·수정한 결함**: `/tenants/assets`가 기존 `GET /tenants/:uuid`(AdminOnly)에 포획되어 E1004 → 프리픽스 `/tenant-assets`로 이동(PLN B-4 경로 정정)
- CI pass. CodeRabbit 지적은 §5 참고

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL staging | **선적용 완료** 2026-09-11 (`tenant_assets` + 인덱스 3종 확인) |
| 코드 staging | main `8a697b3` 배포: API 컨테이너 신규 healthy, `successfully started`, `/health` ok, `GET /tenant-assets` 미인증 **401**, 공개 자산 임의 uuid 404 |
| 스테이징 실검증 | 볼륨 마운트 `/data/uploads` 확인 → ivyusa로 폰트 업로드 → 파일이 `/data/uploads/tenants/1/design/{uuid}.woff2`에 실존 → 공개 URL `immutable`+CORS → 삭제 |
| production | 미배포 — 배포 시 SQL 선적용 + `.env.production`의 `UPLOAD_DIR=/data/uploads`(스크립트가 검사) |

## 5. 잔여·후속
- **P2 디자인 프로필**(폰트 프리셋/업로드·글자 크기·모서리·패널 크기·아이콘 → 위젯 CSS 변수·로더 프레임) — 다음 승인 단위
- P3 커스텀 위젯 라이브러리(만들기·사용함·기본 복귀·보관), P4 정적 라이브 파일+설정 스냅샷, P5 정제 CSS(선택)
- 로고 서비스를 등록부로 수렴(경로 무이동)은 P2에서 검토
- 매뉴얼 설정 > 위젯 절 재캡처 목록에 "디자인 파일" 카드 추가
