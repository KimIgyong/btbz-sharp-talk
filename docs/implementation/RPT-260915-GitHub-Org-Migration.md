# RPT-260915 — GitHub 회사 계정(amoeba-group) 소유권 이전 실행 보고

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-15 |
| 근거 | PLN-260915-GitHub-Org-Migration (#530, A안 승인) |
| 성격 | git 원격·GitHub 소유권·운영 문서 — 코드/스키마 무변경 |

## 1. 무엇이 실행되었나 (A안, 계획 대비 변경 1건)

- **S1**: fork 전 브랜치 고유 커밋 0 재확인, 개인 repo 브랜치 4개 SHA 기록(§3 롤백 좌표).
- **S2 (계획 변경)**: fork **삭제 대신 개명 격리** — gh 토큰에 `delete_repo` 스코프가
  없어, 파괴 없이 같은 효과를 내는 rename(`amoeba-group/btbz-sharp-talk-fork-retired`)으로
  이름 자리를 비운 뒤 transfer 실행. 결과 동일, 파괴적 단계는 오히려 0이 됨.
- **transfer**: `KimIgyong/btbz-sharp-talk` → **`amoeba-group/btbz-sharp-talk`** (fork
  아님·정본). PR #1~#529·이슈·브랜치 4개(main/production/KimIgyong-patch-1/작업 브랜치)·
  설정 전부 승계.
- **S3**: 스테이징(`/home/shoptalk/btbz-sharptalk`)·프로덕션(`/home/shoptalk/
  sharptalk-production`) 체크아웃 `remote set-url` + fetch 검증. 로컬 주 체크아웃은
  선행 전환분이 그대로 정본이 됨(무변경). `secrets/staging-server.md`는 선행 갱신 확인.
  메모리(project) 갱신.

## 2. 검증 결과 (S4)

| 항목 | 결과 |
|---|---|
| 설정 승계 | `delete_branch_on_merge=true` · main 보호 규칙(필수 체크 "typecheck · test · build", enforce_admins) 승계 ✅ |
| PR 이력 | 신규 PR이 **#530**으로 발번(이력 연속) ✅ |
| CI·머지 | #530에서 필수 체크 통과 → `--admin` 스쿼시 머지 → head 브랜치 자동 삭제 ✅ |
| 리다이렉트 | 구 URL 2세대 모두 301: `KimIgyong/btbz-sharp-talk/pull/493` → org, **`KimIgyong/ivyusa-shopping-talktalk/pull/337`(9/8 리네임 이전 주소)** → org ✅ — 과거 RPT·메모리 링크 전량 유효 |
| 서버 | 두 체크아웃 fetch 정상 ✅ (배포 무영향 — 코드 변경 없음) |

## 3. 롤백 좌표 (이전 시점 SHA)

`main 1b6af6e` · `production 805b1f5` · `KimIgyong-patch-1 d61904b`.
transfer 롤백은 역방향 transfer(org→개인)로 가능.

## 4. 잔여 (사용자 액션)

1. **격리 fork 삭제**: `amoeba-group/btbz-sharp-talk-fork-retired` (고유 커밋 0) —
   웹 Settings에서 삭제하거나, `gh auth refresh -h github.com -s delete_repo` 후
   `gh repo delete amoeba-group/btbz-sharp-talk-fork-retired`.
2. **CodeRabbit org 설치**(선택): 리뷰 봇이 개인 계정 설치였어서 org에는 없음 —
   필수 체크가 아니라 머지에 지장은 없으나, 원하면 github.com/apps/coderabbitai에서
   amoeba-group에 설치.
3. 구 이름들(`KimIgyong/btbz-sharp-talk` 등)으로 **새 repo를 만들지 말 것** —
   리다이렉트가 끊깁니다.
