# PLN-260915 — GitHub 연동 정보 회사 계정(amoeba-group) 이전 계획

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-15 |
| 요청 | 개인 계정(KimIgyong) 관리 소스를 회사 계정(amoeba-group)으로 이전(fork 생성됨) — 프로젝트의 GitHub 연동 정보 변경 계획 수립 |
| UI/스키마 영향 | 없음 — git 원격·GitHub 설정·운영 문서만 |

## 1. AS-IS (2026-09-15 실측)

| 항목 | 상태 |
|---|---|
| 회사 repo | `amoeba-group/btbz-sharp-talk` — **fork** (parent=KimIgyong, 9/7 생성). main은 부모와 동일(ahead 0/behind 0). `staging` 브랜치 1개 존재하나 고유 커밋 0(부모 main 2커밋 전 포인터). **production·KimIgyong-patch-1 브랜치 없음** |
| 개인 repo | `KimIgyong/btbz-sharp-talk` — 살아 있음(9/14 push). **PR #1~#529 전체 이력·이슈가 여기에만 존재** |
| fork 설정 승계 | ❌ 안 됨: `delete_branch_on_merge=false`, main **브랜치 보호 없음**(필수 체크 "typecheck · test · build" 미설정), CodeRabbit 미설치. Actions는 enabled |
| 권한 | 사용자 = amoeba-group **org admin** (이전·설정 권한 충분) |
| 로컬 주 체크아웃 | origin = **amoeba-group** (이미 전환됨) |
| 스테이징 서버 | `/home/shoptalk/btbz-sharptalk` (main) → **KimIgyong** |
| 프로덕션 서버 | `/home/shoptalk/sharptalk-production` (production 브랜치) → **KimIgyong** |
| 코드 내 하드코딩 | 없음(커밋 대상 파일 기준). `secrets/staging-server.md`는 이미 amoeba-group URL |
| 문서·추적성 | RPT/FIX/메모리·커밋 메시지의 PR 링크 수백 개가 `github.com/KimIgyong/...` — **fork는 리다이렉트를 만들지 않음** |

## 2. 핵심 판단 — fork 유지 vs 소유권 이전(transfer)

fork는 "코드 사본"만 옮깁니다. 이 프로젝트의 자산은 코드 외에 **PR 529개의 추적성
(REQ→PLN→RPT가 전부 PR 번호·링크로 연결)** 과 저장소 설정입니다.

| | A. **Transfer (권장)** | B. fork 유지 |
|---|---|---|
| PR·이슈 이력 | ✅ 전부 승계 | ❌ 개인 repo에 잔류 (개인 repo 삭제 시 소실) |
| 구 URL 리다이렉트 | ✅ 자동 (기존 문서·메모리 링크 계속 유효) | ❌ 없음 |
| 설정(보호 규칙·delete_branch_on_merge) | ✅ 승계 | ❌ 전부 수동 재구성 |
| `gh` CLI 함정 | 없음 | fork에서 `gh pr create`가 **부모 repo로 PR을 만듦** — repo마다 `gh repo set-default` 필요, 실수 표면 상존 |
| 개인 계정 정리 | 자연 소멸(이전 후 개인 소유 아님) | 개인 repo를 영구 보존해야 링크 유지 |
| 파괴적 단계 | fork 삭제 1회 (고유 커밋 0 확인됨) | 없음 (대신 지속 관리 부담) |

**권장: A.** 현 fork는 고유 커밋이 없어(전 브랜치 대조 완료) 삭제 비용이 0이고,
transfer는 개인→조직 이전을 GitHub이 공식 지원(org admin 권한 보유). B를 택할 이유는
"개인 repo를 반드시 남겨야 한다"는 정책이 있을 때뿐입니다.

## 3. 실행 계획 (A안 기준)

### S1 — 사전 안전 확인 (읽기 전용)
- [ ] fork 전 브랜치 고유 커밋 0 재확인(§1 실측 재실행) · 진행 중 세션 워크트리 없음
- [ ] 개인 repo 브랜치 3개(main·production·KimIgyong-patch-1) 최신 SHA 기록(롤백 좌표)

### S2 — fork 삭제 + 소유권 이전 (⚠️ 파괴적 — 사용자 최종 확인 후)
1. `gh repo delete amoeba-group/btbz-sharp-talk` (org admin)
   — 같은 이름 자리 확보. fork를 먼저 지워야 이전 시 이름 충돌이 없습니다.
2. `gh api repos/KimIgyong/btbz-sharp-talk/transfer -f new_owner=amoeba-group`
   — PR·이슈·설정·브랜치 보호·별표·watch 전부 승계, **구 URL 자동 리다이렉트 개시**.
3. 이전 직후 확인: `amoeba-group/btbz-sharp-talk`에 PR #529까지 보이는지,
   production·KimIgyong-patch-1 브랜치 존재, `delete_branch_on_merge=true`,
   main 보호 규칙(필수 체크 typecheck · test · build) 승계 여부 — 미승계 항목은 재설정.

### S3 — 접점 갱신 (리다이렉트가 있어도 명시 갱신이 원칙)
| 접점 | 작업 |
|---|---|
| 로컬 주 체크아웃 | 이미 amoeba-group URL — transfer 후 그대로 실체가 되므로 무변경, `git fetch`로 검증만 |
| 스테이징 서버 `/home/shoptalk/btbz-sharptalk` | `git remote set-url origin https://github.com/amoeba-group/btbz-sharp-talk.git` |
| 프로덕션 서버 `/home/shoptalk/sharptalk-production` | 동일 set-url (production 브랜치 추적 유지) |
| `gh` CLI | org repo 인식 확인(`gh repo view`), 다음 PR에서 `--admin` 스쿼시 머지 동작 확인 |
| CodeRabbit | org에 앱 설치/승인 (org admin) — 리뷰 자동화 복구 |
| 문서 | `secrets/staging-server.md` 완료됨 · CLAUDE.md/AGENTS.md는 repo URL 무언급(확인) · 메모리 `project-*` 갱신 |

### S4 — 검증 (배포 무영향 확인)
- [ ] 테스트 PR 1건: CI 필수 체크 동작 + `--admin` 머지 + head 브랜치 자동 삭제
- [ ] 스테이징·프로덕션 서버 `git fetch/pull` 정상
- [ ] 구 URL 리다이렉트 표본: 과거 RPT의 PR 링크 2~3개 열어 확인
- [ ] RPT-260915 작성(본 계획의 실행 결과·롤백 좌표 포함)

### 롤백
transfer는 되돌리려면 역방향 transfer(org→개인)로 가능. fork 삭제는 비가역이나
고유 커밋 0이므로 상실물 없음(S1에서 SHA 기록으로 증빙).

## 4. B안(fork 유지) 선택 시 최소 작업
fork를 부모와 동기화(production·patch-1 브랜치 push) → 브랜치 보호·delete_branch_on_merge·
CodeRabbit 수동 구성 → 모든 체크아웃 remote를 fork로 → **개인 repo는 아카이브 처리하되
영구 보존**(링크 유지) → `gh repo set-default`를 모든 체크아웃에서 실행(부모로 PR이
생기는 함정 차단). — 권장하지 않음(§2).

## 승인 요청
A안(fork 삭제 + transfer) 진행 여부를 확정해 주세요. S2가 파괴적 단계이므로
승인 전에는 실행하지 않습니다.
