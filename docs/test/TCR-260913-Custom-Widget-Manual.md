# TCR-260913 — 커스텀 위젯 만들기 매뉴얼

- 근거: PLN-260913-Custom-Widget-Manual (승인 2026-09-13 "기본안으로 진행")
- 환경: 로컬 dev(API dist, 콘솔 :5173, 위젯 :5175), ivyusa 데모(dev@ master) + 로컬 admin@; 캡처는 `ivy_auth` 주입 Playwright(비밀번호 타이핑 없음)

## 1. 사실 대조 (문서 ↔ 코드)
| 항목 | 코드 근거 | 결과 |
|---|---|---|
| 폰트 프리셋 5종·크기 13~16·모서리 8/12/16·패널 360~480×480~720(기본 404×600) | `packages/types/src/common/widget-theme.ts` FONT_PRESET·DESIGN_LIMITS·RADIUS_PX | 일치 |
| 디자인 파일 규격(폰트 2MB·아이콘 256KB/512px·이미지 2MB/2000px·시안 10MB 비공개), svg/css/js 거부, 내용 검사, E5081~E5085 | `tenant-asset.service.ts` KIND_SPECS·에러 코드 | 일치 |
| 영역 상한 50MB | `TENANT_ASSET_QUOTA_DESIGN_MB` 기본값 | 일치 |
| 재업로드는 새 행(버전 증가 아님) | store()가 항상 `version: 1` | **문서 수정**(초안의 "v2, v3" 표현 삭제) |
| 미리보기 토큰 10분·스토어 도메인 선행 | `PREVIEW_TTL_SEC`, `previewNoShop` 문구 | 일치 |
| 이력: 디자인 변경만 리비전, 최신 50, 복원 시 현재도 스냅샷, 삭제 시 캐스케이드 | `widget-design.service.ts` update/revisions/restoreRevision/remove | 일치 |
| 복제 "(copy)/(copy 2)", 중복 이름 E5087, 사용 중 보관·삭제 E5086 | duplicate/assertNameFree/assertNotActive | 일치 |
| 패키지 JSON `sharptalk-widget-design`, 12MB, 자산 재검증, "(2)" 충돌, 가져온 디자인은 ready(미적용) | importPackage | 일치 |
| 스냅샷 12필드+라이브러리, 자격증명 제외 | `settings-snapshot.service.ts` FIELDS | 일치 |
| CSS 안정 클래스 13종·허용 속성·값·32KB·드롭 대상 | `css-sanitizer.util.ts` | 일치 |
| 권한 master/director | `@RequireRank` widget-designs·tenant-assets·settings-snapshots | 일치 |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| html 태그 균형(p/tr/td/th/figure/section/strong/table/ul/ol/li/dl/dt/dd/pre/code/div/h2/h3/a/article) — custom-widget ko/en/vi · index · user-manual 3언어 | 전부 균형 |
| 참조 이미지·링크 존재(`img/cw-*` 16장, custom-widget.*.html/md) | 전부 존재 |
| 마크다운 잔여(`**`) | 없음 |
| index.html STR c5t/c5d/c5a 3언어 | 각 언어 존재(4회 등장 = 카드 1 + STR 3) |
| 변환기 `scripts/manual-md2html.mjs` | ko/en/vi 각 9 섹션·8 그림·8 표·9 콜아웃·FAQ 8 |

## 3. 렌더 확인 (로컬 vite `/manual/…`)
| 화면 | 결과 |
|---|---|
| `index.html` 카드 05 (ko) | 표시, 부제 "5권" |
| `custom-widget.ko.html` top·ch2·ch5·ch8 | pagenav·hero·목차·개념도(pre)·표·그림·콜아웃·FAQ dl 정상 |
| `custom-widget.en.html` ch3 · `custom-widget.vi.html` top·ch4 | 정상(vi는 en 이미지) |
| `user-manual.ko.html` §14 위젯 설정 셀 링크 | 존재 |

## 4. 캡처 (16장)
cw-design-files · cw-library · cw-editor · cw-preview · cw-history · cw-css · cw-snapshot-diff · cw-admin-addon × ko/en. 로컬 데모 데이터만 노출(ivyusa, dev@amoeba.group), 실제 고객 데이터 없음. 로컬 애드온 ON은 캡처 후 원복.

## 5. 엣지
| 케이스 | 처리 |
|---|---|
| 기능 라벨 변경 | 문서 머리에 "코드 기준 2026-09-13"; 재생성은 md 수정 → 변환기 재실행 |
| STR 키 누락 언어 | 검사 스크립트가 3언어 c5* 존재를 확인 |
| en/vi 번역 품질 | index notice(AI 번역 초안) 기존 문구 유지 |
