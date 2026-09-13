# PLN-260913 — production 서버 신규 프로비저닝 후 배포 계획

- 근거: REQ-260913-Production-Provisioning-Deploy · `PRODUCTION-CUTOVER.md` · `GUIDE-260913-SharpTalk-Basic-Setup.md`
- UI 영향: **없음** (인프라·스크립트·문서·운영 실행)

## 0. 결정 (REQ §5 기본안으로 진행 시)
D1 8vCPU/16GB/200GB Ubuntu 24.04 국내 리전 · D2 `sharptalk.amoeba.site` + 호스트 nginx/LE · D3 self-hosted 스택 · D4 ivyusa(데모 제외)+go2joy · D5 스테이징 Shopify 앱에 콜백 추가 · D6 정책값 · D7 production 브랜치.

## 1. 단계

### P0 — 사용자 (서버 없이 Claude가 진행 불가)
| # | 작업 | 산출 |
|---|---|---|
| U1 | 제공자 콘솔에서 호스트 생성(D1), 공인 IP 확보 | IP |
| U2 | DNS: `sharptalk.amoeba.site` A → IP (TTL 300) | 전파 확인 `dig` |
| U3 | `secrets/production-server.md` 작성(템플릿 `deploy/profiles/SharpTalk-KR-Production/secrets.template.md`): IP·SSH 사용자(root 또는 sudo)·키 경로(`secrets/ssh/`), 실 키(Anthropic·Voyage·SMTP·Shopify) | 파일(gitignored) |

### P1 — Claude, 서버 없이 먼저 (승인 직후 착수)
| # | 작업 | 산출 |
|---|---|---|
| C1 | `scripts/provision-host.sh` — 멱등: apt 갱신, Docker Engine+Compose v2 공식 저장소, 배포 사용자 `sharptalk`(docker 그룹), `/home/sharptalk/sharptalk` 디렉터리, UFW(22 제한 IP 옵션·80·443), `timedatectl set-timezone UTC`+chrony, unattended-upgrades, 호스트 nginx vhost(`<domain>` → `127.0.0.1:8080`, `client_max_body_size 25m`, WS 업그레이드) + certbot(`--nginx -d <domain>`, `--redirect` 금지 규칙 유지), `--check`(검증만) | 스크립트 + `bash -n`·shellcheck |
| C2 | `deploy/profiles/SharpTalk-KR-Production/`: `.env.SharpTalk-KR-Production.example`(self-hosted 파생, D6 값), `secrets.template.md`, `CHECKLIST.md` | 프로필 |
| C3 | `docker/self-hosted` 프로덕션 조정 검토: `restart: always`는 compose에 `${RESTART_POLICY:-unless-stopped}`로 환경화(기본 유지) | 소수정 |
| C4 | `docs/guide/PRODUCTION-CUTOVER.md` §0·§2에 "self-hosted 스택·provision-host.sh" 반영, `DEPLOYMENT-STRATEGY.md` §1 프로덕션 열 | 문서 |
| C5 | PR → CI → 머지 | |

### P2 — Claude, 서버 접속 후
| # | 작업 | 검증 |
|---|---|---|
| S1 | `provision-host.sh --check` → 실행(루트) → `docker version`·`ufw status`·`nginx -t`·인증서 CN | |
| S2 | `sharptalk` 사용자로 클론(`main` 검증 SHA) → 프로필 env 복사 → `gen-secrets.sh` → 실 키를 secrets 파일에서 env로 이동(값은 화면·로그·문서에 남기지 않음) | `deploy-self-hosted.sh --check` 통과 |
| S3 | 첫 배포(`SEED_ON_BOOT=true`, `SEED_DEMO_DATA=false`, `SEED_KB_PROFILE=us-cosmetics`) | `/api/v1/health` ok · `/`·`/widget/`·`/manual/` 200 · `widget-config.js`가 프로덕션 API · `successfully started` · 컨테이너 나이 |
| S4 | `SEED_ON_BOOT=false` → API 재생성. admin@·dev@ 비밀번호 변경(첫 로그인 강제) — **사용자가 브라우저에서 수행**(비밀번호 입력은 Claude 금지) | |
| S5 | 스키마 게이트: `check-migrations.sh` OK(init-sql 완전) | |
| S6 | `production` 브랜치 생성·푸시(검증 SHA), 서버 체크아웃을 production으로 | |

### P3 — 컷오버 (코드로 오지 않는 것)
| # | 작업 |
|---|---|
| T1 | 어드민: Anthropic 엔진 등록·활성(키는 콘솔 입력 — **사용자**), 테넌트 ivyusa 정정·go2joy 생성, 요금제·제공 메뉴·애드온, 관리자 초대(임시 비밀번호 전달은 사용자) |
| T2 | 테넌트 이관(로컬 가이드 §3): 스냅샷 대조 수동 입력(타임존·기본 언어 포함), 커스텀 위젯 패키지, KB 라운드트립+재색인, 연동 자격증명 재입력(**사용자**: Shopify 재설치·Klaviyo·Yotpo·Gorgias·Notion·Haravan 토큰), 임베드 시크릿 재발급, 핸드오프·AI 설정 |
| T3 | Shopify: 스테이징 앱에 `https://sharptalk.amoeba.site` 콜백·App URL 추가, 웹훅 4종+필수 3종 재등록(플레이북) |
| T4 | 스모크(컷오버 §4 10항목 + Basic §9), 백업 1회(`backup-self-hosted.sh` → 오프호스트 복사 경로는 사용자 지정), MFA 강제일 env 설정·재배포 |
| T5 | 문서: CONFIG §6/§7·DEPLOYMENT-STRATEGY §9·CUTOVER §0, `secrets/production-server.md` 로그, RPT-260913-Production-Deploy, 메모리 |

## 2. 사이드 임팩트
- 스테이징 무영향(별도 호스트). Shopify 앱에 콜백을 추가해도 스테이징 설치는 유지(D5).
- `docker/self-hosted/docker-compose.self-hosted.yml`의 restart 정책 환경화(C3)는 기본값 유지라 기존 자체호스팅 고객 무영향.
- `production` 브랜치 생성(D7)은 CI 트리거 대상(이미 `production` push 시 실행).
- 실 키 취급: Claude는 secrets 파일→서버 env 복사만 수행(브라우저 입력 금지). 어드민 콘솔의 AI 엔진 키·연동 자격증명 입력은 사용자.

## 3. 리스크
- DNS 전파 전 certbot 실패 → `--check`가 `dig` 결과를 먼저 확인.
- 서버 빌드 메모리(turbo 3앱) — 16GB면 여유. 8GB 이하면 스왑 4GB 추가(스크립트 옵션).
- 이관 중 스테이징에서 변경되는 데이터 — 이관 창(1~2시간) 공지 후 동결.
- 데모 데이터 유입 방지: `SEED_DEMO_DATA=false` + ivyusa 데모 주문은 이관하지 않음.

## 4. 승인 요청
REQ §5 결정 D1~D7 기본안과 위 단계로 진행해도 될지 확인 부탁드립니다. 승인 즉시 P1(스크립트·프로필·문서)을 진행하고, **U1~U3(서버·DNS·secrets 파일)** 이 준비되면 P2·P3를 이어서 실행합니다. 조정 후보: (a) D2 도메인을 `sharptalk.btbz.ai`로, (b) D4 이관 범위를 ivyusa만으로.
