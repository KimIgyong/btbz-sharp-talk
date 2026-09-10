# RPT-260910 — 설치 전역명 SHARPTALK_WIDGET_CONFIG 개편 구현 보고

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-10 |
| 근거 | REQ/PLN-260910 (PLN 승인 2026-09-10, 전체 진행) |
| PR / 커밋 | **#493** → main `bccb445` (squash) |
| 성격 | 로더 JS + 콘솔 스니펫 문자열 + 문서 — 스키마 무변경 |

## 1. 무엇이 바뀌었나

- **표준 전역명**: `window.SHARPTALK_WIDGET_CONFIG`. 로더(embed.js)는 신명 우선,
  **구명(`IVY_WIDGET_CONFIG`) 영구 폴백**(실몰 테마 — ivyusa·amoebaorder·go2joy — 는
  재배포 불가). 구명 단독 사용 시 console.info 1회 안내(카운트다운 아님).
- **JS API 별칭**: `window.SharpTalk` = `window.ShopTalk` 동일 객체(큐 포함) — 어느
  이름으로 호출해도 같은 위젯.
- **테넌트별 전역명은 비채택**(REQ §2-B): 테넌트 식별은 내용물(shop)이 담당, 전역명은
  제품당 하나(업계 관례). 테넌트별 디자인 커스텀은 서버 주도 테마가 확장 지점(O2,
  별도 REQ 후보).
- 콘솔 스니펫 생성기 5곳·가이드 8종 신명 통일, embed-test `?legacy=1` 폴백 상시 검증.

## 2. 파일

`apps/widget/public/embed.js` · `embed-test.html` · `apps/api/src/domain/embed/embed-loader.spec.ts`(계약 3건 추가) ·
`apps/web/src/domain/settings/SettingsPage.tsx` · `apps/web/src/domain/ai-settings/AgentsSection.tsx` ·
`docs/guide` 8종 · REQ/PLN/TCR/본 RPT.

## 3. 검증 — TCR-260910

단위 13/13 · 로컬 신/구 부팅 실측 · 스테이징 배포 후 **배포 로더 대상 end-to-end**
(구명/신명 각각 위젯 내부 렌더까지 확인). go2joy.vn 직접 접속은 네트워크상 불가라
동일 구성 합성 페이지로 대체 — 접속 가능 환경에서 실몰 화면 1회 확인 권장.

## 4. 배포 상태

| 환경 | 상태 |
|---|---|
| main | ✅ `bccb445` (PR #493, CI 통과) |
| 스테이징 | ✅ 2026-09-10 — `/home/shoptalk/btbz-sharptalk`에서 `deploy-staging.sh`. 동반 미적용 마이그레이션 없음(pre-deploy-check: `channel_threads.notice_version`은 선행 배포에서 `db_sharptalk`에 적용 완료 확인) |
| 프로덕션 | — (미구축) |

## 5. 남긴 것

1. **O1 브랜드 표기**(REQ): 콘솔/도메인 표기의 SharpTalk 전환은 별도 결정 — 9/9
   리네임 세션(PLN-260909 A/B)이 상당 부분 진행했으므로 전역명은 그 축과 정합.
2. **O2 디자인 토큰 확장**: 진행 결정 시 별도 REQ/PLN.
3. 실몰(go2joy.vn) 화면 최종 확인 1회 — 접속 가능한 네트워크에서.
4. 관찰: 루트 `/embed.js`는 nginx 라우트가 없어 SPA HTML 폴백(로더 아님, 종전과 동일).
   문서·스니펫은 전부 `/widget/embed.js` 기준이라 조치 불요 — 다만 루트 경로를 안내한
   외부 자료가 발견되면 정정할 것.
