# RPT-260914 — production 첫 배포 실행 보고 (sharptalk.amoeba.site)

- 근거: REQ/PLN-260913-Production-Provisioning-Deploy · TCR-260914-Production-Deploy · FIX-260913-Init-Schema-Drift
- PR: #523(init-sql 재생성) · #524(부트스트랩 스크립트·프로필) · #527(공유 호스트 지원) · #528(LIVE 기록·`--skip time,packages`)
- 결정 변경(2026-09-14, 사용자): 신규 호스트 미확보·DNS가 스테이징 IP를 가리킴 → **스테이징 호스트에 두 번째 스택**, 스테이징 키 재사용, Anthropic 키는 나중에

## 1. 결과
| 항목 | 값 |
|---|---|
| 공개 URL | `https://sharptalk.amoeba.site` (콘솔 `/`, 위젯 `/widget/`, API `/api/v1`, 매뉴얼 `/manual/`) |
| 호스트 | 211.110.140.172(스테이징과 공유), 호스트 nginx vhost → `127.0.0.1:8081`, Let's Encrypt(만료 2026-12-13, 자동 갱신) |
| 스택 | `docker/self-hosted`(`RESTART_POLICY=always`), 디렉터리 `/home/shoptalk/sharptalk-production`, 컨테이너 `sharptalk_{api,web,widget,mysql,redis,rabbitmq,qdrant,nginx}`, MySQL `127.0.0.1:3318` |
| 코드 | main `58182e3` = 브랜치 **`production`**(신설) |
| 스키마 | init-sql 첫 부팅 90 테이블, `check-migrations` OK |
| 시드 | 테넌트 `ivyusa`(custom), `admin@`·`dev@`(첫 로그인 변경 강제), 데모 없음, KB `us-cosmetics`; `SEED_ON_BOOT=false`로 전환 완료 |
| env | 서버 `docker/self-hosted/.env.self-hosted`(프로필 `SharpTalk-KR-Production` + gen-secrets + 스테이징 Voyage·SMTP·Shopify 재사용), `AI_DEFAULT_PROVIDER=stub`, `AI_PROCESSING_REGION=US`, 보존 365 |
| 시크릿 | `secrets/SharpTalk-KR-Production-server.md`(gitignored) |
| 백업 | `~/backups/sharptalk-production/20260914/{db.sql.gz, uploads.tar.gz, manifest.txt}` |

## 2. 과정에서 잡은 것
- **FIX-260913**: init-sql이 13개 마이그레이션 뒤처짐 → 실 DB 재생성, 신규 DB 게이트(`pre-deploy-check` §6).
- **공유 호스트 타임존**: `provision-host.sh`의 time 단계가 KST→UTC 변경 → 즉시 복구, `--skip time,packages` 추가. 공유 호스트에서는 항상 `--skip firewall,upgrades,docker,user,time,packages`.
- 세션 워크트리가 다른 세션 정리로 사라져 편집이 유실될 뻔함 → `session-worktree.sh new`로 재생성 후 재적용(커밋 전 확인 규칙 유효).

## 3. 남은 컷오버 (P3 — `deploy/profiles/SharpTalk-KR-Production/CHECKLIST.md`)
| 순서 | 담당 | 항목 |
|---|---|---|
| 1 | 사용자 | `https://sharptalk.amoeba.site/admin/login`·`/user/ivyusa` 첫 로그인 → 비밀번호 변경(시드 비밀번호는 secrets 파일) |
| 2 | 사용자 | 어드민 > AI 엔진에 Anthropic 등록·활성 → Claude: env `AI_DEFAULT_PROVIDER=anthropic` 전환·재배포 |
| 3 | Claude | 테넌트 ivyusa 설정 이관(스냅샷 대조 13항목·커스텀 위젯 패키지·KB 라운드트립·핸드오프·AI 설정), go2joy 생성·이관 |
| 4 | 사용자 | 연동 자격증명 재입력(Shopify 재설치·Klaviyo·Yotpo·Gorgias·Notion·Haravan) → 연결 테스트; Shopify Partner에 프로덕션 콜백·웹훅 등록 |
| 5 | Claude | 임베드 시크릿 재발급 안내, 스모크(컷오버 §4), `MFA_ENFORCE_FROM` 설정(계정 발급 +14일), 백업 오프호스트 경로 확정 |

## 4. 운영 루틴
```bash
ssh -i secrets/ssh/ivy_staging_ed25519 shoptalk@211.110.140.172
cd ~/sharptalk-production && git pull --ff-only origin production
MYSQL_CONTAINER=sharptalk_mysql bash scripts/check-migrations.sh      # SQL 먼저
bash scripts/deploy-self-hosted.sh                                     # 빌드·기동·검증
bash scripts/backup-self-hosted.sh ~/backups/sharptalk-production/$(date -u +%Y%m%d)
```
승격: main 검증 후 `git push origin main:production`.

## 5. 잔여·후속
- 전용 호스트 확보 시 D1 원안으로 이전(백업 2종 복원 + DNS 전환, 다운타임 수 분).
- 프로덕션 nginx vhost는 HTTP→HTTPS 리다이렉트를 하지 않음(`--no-redirect`) — 스테이징 vhost처럼 80 블록에 301 추가 검토(공유 호스트라 수동).
- `ALERT_EMAIL_TO` 비어 있음(스테이징도 비어 있음) — 알림 수신 주소 결정.
