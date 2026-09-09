# RPT-260909 — 매뉴얼 스크린샷 34장 SharpTalk 명칭으로 재캡처

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| 요청 | "매뉴얼 스크린샷 36장 재캡처 진행해줘" (실제 34장 — `img/` 파일 수) |
| 상위 | REQ-260909-Project-Rename §2 T2(D-5 1차 제외분) · 선례 REQ/PLN/RPT-260824-Manual-Screenshots, RPT-260904-User-Manual-Refresh |
| PR | #491 → main `a68675f` (이미지 34장 + 임시 비밀번호 접두어 `Ivy`→`Tmp` + 매뉴얼 예시 3언어) |
| 배포 | 스테이징 `deploy-staging.sh`, web 재빌드, 표본 3장 200·바이트 일치 |
| 스크립트 | `scripts/manual-screenshots.mjs` (Playwright, 이 PR로 저장 — 다음 재캡처는 아래 절차) |

## 결과
- 34장 전부 재캡처: ko·en 2세트 × 16화면 + 위젯 ko 전용 2장(동의 배너·시나리오 메뉴). 뷰포트 1566×785, JPEG q80, 합계 2.5MB(이전 2.6MB). 파일명 동일 → html figure 무수정.
- 화면 안 브랜드: 사이드바 `SharpTalk`, 어드민 `SharpTalk · 플랫폼 관리자/Platform Admin`, 데모 스토어 헤더 `SharpTalk`, 위젯 헤더는 테넌트명(`ivyusa`).
- `knowledge-qa.*`는 QA 카드 요소 캡처(400×1082/1282), 나머지는 전체 뷰포트.

## 캡처 절차 (재현)
1. `npm run db:up && npm run db:seed` (시드: 테넌트 ivyusa, dev@/admin@ `amb2026!@`, KB 12건. **대화 데이터 없음**)
2. `apps/widget/.env` 없으면 `.env.example` 복사(8/24 함정 동일). API `nest start`(포트 3000), web `vite --port 5173`, 위젯 `vite --port 5175`(5174는 다른 프로젝트가 점유)
3. 지식 참조가 붙은 답변을 얻으려면 **Voyage 키로 `kb:reindex`**(API 프로세스에도 같은 env) — 키 없이는 Qdrant 컬렉션이 비어 검색 0건 → 스텁이 인계로 떨어져 답변 캡처가 안 됨. Qdrant를 내리면 MySQL 전문검색 폴백이 되지만 한국어 질문은 매칭이 약함
4. `node scripts/manual-screenshots.mjs widget,tenant-en,prep,admin,tenant-ko` — 단계: 위젯 채팅으로 대화 5건 생성(캡처 겸) → 테넌트 en(강제 비번변경 모달 캡처) → prep(데모 사용자 초대·보드 문서 3건·통계 집계 API `POST /analytics/questions/aggregate?date=`) → 어드민 ko/en → 테넌트 ko
5. 결과 `out/*.jpg`를 `apps/web/public/manual/img/`에 덮어쓰기 → 눈으로 검수 → PR

## 함정 (이번에 밟은 것)
- **로그인 API 경로는 `/auth/user/login`·`/auth/admin/login`**(`/auth/login` 아님) → 토큰 실패로 데모 사용자 초대가 안 됐고, 어드민 임시 비밀번호 발급이 **dev@ 본인 계정**에 떨어져 이후 테넌트 로그인이 전부 실패(캡처는 랜딩 페이지가 찍힘). 발급 대상은 반드시 데모 사용자(`manual-demo@example.com`)로 고정.
- 위젯 채팅이 만든 **이관 알림 모달**이 콘솔 모든 페이지에 뜬다 → 페이지마다 `닫기/Close` 자동 처리(강제 비번·모달 캡처는 예외).
- `상담원 연결` 섹션은 `/ai-setting`에는 이동 안내만 남고 실체는 **`/settings/basic`**; 설치 코드는 `/settings/widget`의 `임베드 · SDK`. 같은 텍스트가 여러 요소에 있어 `getByRole('heading')`로 한정.
- 통계 화면은 `question_stats_daily` 집계 테이블만 읽음 → 당일 데이터는 집계 API를 직접 호출해야 표시.
- 콘솔 스크롤은 window가 아니라 내부 컨테이너 — 헤딩 정렬은 스크롤 부모를 찾아 `scrollBy`.
- 지식 화면 가이드 접기: localStorage `ivy:knowledge:guide-collapsed=1`.
- 로컬 한정 변경(복원 불필요): dev@/admin@ 비밀번호 `SharpTalk#2026x`, 데모 사용자 1, 보드 문서 3, 대화 20여 건.

## 브랜드 잔재 수정
임시 비밀번호 생성 접두어 `Ivy…!` → `Tmp…!`(`password-policy.util.ts`, 정책 3종 충족, spec 24 통과) — 캡처된 모달에서 발견. 매뉴얼 quick-setup 예시(`IvyXXXXXXXXX!`) ko/en/vi md·html + GUIDE 동반 갱신.
