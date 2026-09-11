# TCR-260911 — 테넌트 자산 저장소 P0(프로덕션 업로드 볼륨) · P1(자산 저장소)

- 근거: `docs/plan/PLN-260910-Tenant-Asset-Store-Widget-Design.md` P0·P1, `docs/bug-fix/FIX-260911-Production-Uploads-Volume.md`
- 환경: 로컬 dev(API dist 부팅 + vite, `DB_SYNCHRONIZE=true`), 테넌트 ivyusa(dev@, master)

## 1. 단위 테스트 (jest, `apps/api/src/domain/tenant-asset`)

| ID | 케이스 | 기대 | 결과 |
|---|---|---|---|
| U-1 | woff2 업로드 | `tenants/1/design/{uuid}.woff2` 저장, mime `font/woff2`, 공개 URL `/public/widget/asset/{uuid}?v=1`, 감사 `tenant.asset_uploaded` | PASS |
| U-2 | `.woff2` 이름의 svg 본문 | E5081(내용 판정) | PASS |
| U-3 | area=settings 업로드 / 2MB 초과 폰트 | E5085 / E5082 | PASS |
| U-4 | 상한(env `TENANT_ASSET_QUOTA_DESIGN_MB`) 초과 | E5084 | PASS |
| U-5 | doc(pdf) 서명 URL·공개 라우트 거부(E5002)·삭제 시 soft+unlink+감사 | 전부 | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` api / web | PASS |
| `i18n:check` | es/ko/vi/ja/zh complete |
| `migrations:manifest` | `260911-tenant-assets.sql table tenant_assets` 등재 |
| 실부팅(신규 엔티티·모듈) | `successfully started`, `tenant_assets` 테이블 자동 생성(`uk_tenant_assets_uuid` 확인) |
| `bash -n deploy-production.sh` | PASS |

## 3. 통합 시나리오 (API, curl · 로컬)
| ID | 요청 | 기대 | 결과 |
|---|---|---|---|
| I-1 | POST font(woff2, label) | 201 public url `?v=1` | PASS |
| I-2 | POST font ← svg 본문 | E5081 | PASS |
| I-3 | POST icon 64×64 png | width/height 64, sharp 재인코딩 | PASS |
| I-4 | POST icon 600×600 png | E5083 | PASS |
| I-5 | POST doc pdf | public=false, 서명 URL | PASS |
| I-6 | GET list | usage.used 581 / quota 50MB, 3건 | PASS |
| I-7 | GET public font `?v=1` | 200 `immutable`, `Access-Control-Allow-Origin: *`, `CORP: cross-origin`, `font/woff2` | PASS |
| I-8 | GET public font(no v) | `max-age=60` | PASS |
| I-9 | GET public route로 doc uuid | 404 | PASS |
| I-10 | GET doc 서명 URL / 위조 sig | 200 pdf inline / 403 | PASS |
| I-11 | GET list 미인증 | 401 | PASS |
| I-12 | DELETE doc | deleted, 파일 unlink, 행 soft, 감사 `tenant.asset_deleted` | PASS |
| I-13 | 라우트 충돌 | `/tenants/assets`는 `/tenants/:uuid`(AdminOnly)에 잡혀 E1004 → `/tenant-assets`로 이동 후 정상 | 결함 검출·수정 |

## 4. 콘솔 (브라우저)
| ID | 시나리오 | 결과 |
|---|---|---|
| C-1 | 설정 > 위젯 "디자인 파일" 카드: 용량 게이지·[파일 추가]·종류 탭·규칙 문구 | PASS |
| C-2 | 폰트 탭: BrandSans(라벨)·공개 뱃지·[URL 복사]·[삭제]·라이선스 고지 | PASS |
| C-3 | 아이콘 탭: 썸네일이 공개 라우트에서 로드(`naturalWidth>0`) | PASS |

## 5. 엣지
| 케이스 | 처리 |
|---|---|
| sharp 미설치 | 래스터 kind 거부(E5081), 폰트/pdf는 통과 |
| UPLOAD_DIR 밖 경로 | `resolveInRoot` 가드(ATTACHMENT_STORAGE_FAILED) |
| 파일 없는 행(볼륨 리셋) | 공개 라우트 스트림 에러 → 404 |
| 프로덕션 볼륨(P0) | compose 볼륨 + 배포 스크립트 `UPLOAD_DIR` 검사, `pre-deploy-check` §5.1 항목 |
