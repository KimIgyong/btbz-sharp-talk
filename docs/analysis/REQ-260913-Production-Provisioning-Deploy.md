# REQ-260913 — production 서버 신규 프로비저닝 후 배포

- 요청(2026-09-13): "production 서버 신규 프로비저닝 후 배포"
- 산출물: 호스트 부트스트랩 스크립트 + production 프로필 + 배포·컷오버 실행 + RPT. 코드(앱) 변경 없음, 스키마 변경 없음(init-sql 재생성은 FIX-260913으로 완료).

## 1. AS-IS
| 항목 | 상태 |
|---|---|
| 프로덕션 호스트 | 없음. 이 작업 환경에는 클라우드 프로비저닝 자격증명(aws/gcloud/hcloud 등)이 **없음** → 서버 생성은 사용자가 제공자 콘솔에서 수행 |
| 도메인 | `shoptalk.amoeba.site`=스테이징(211.110.140.172). `sharptalk.amoeba.site`는 **DNS 레코드 없음**(REQ-260909 실측), `sharptalk.btbz.ai`는 스테이징 IP를 가리킴 |
| 스택 | `docker/production`(restart always, 포트 미노출, init-sql 마운트, widget 서비스 — #519에서 추가)와 `docker/self-hosted`(env 검사·마이그레이션 검사·헬스 검증·백업/복원 스크립트·widget-config) 두 벌. **검사·백업 도구는 self-hosted에만** 있음 |
| 첫 부팅 스키마 | `docker/init-sql/01-schema.sql` 90 테이블·948 컬럼 = 스테이징, 임시 DB 검사 OK(FIX-260913) |
| env | `.env.production` 없음. 템플릿은 #519·#521에서 보강(UPLOAD_DIR·QDRANT·VOYAGE·APP_PUBLIC_URL·AI_PROCESSING_REGION·SEED_KB_PROFILE) |
| 실 자격증명 | Anthropic·Voyage 키는 스테이징 env에 존재(서버에만). Shopify 앱은 스테이징 도메인에 등록. SMTP는 스테이징 설정 확인 필요 |
| 데이터 | 스테이징 테넌트 ivyusa(데모 포함)·go2joy 등 — 프로덕션에 올릴 테넌트·이관 범위 미정 |
| 런북 | `PRODUCTION-CUTOVER.md`(①~⑧ 순서, 코드로 오지 않는 것, MFA, 스모크 10항목), `GUIDE-260913-SharpTalk-Basic-Setup.md`(0→운영), `pre-deploy-check` §6 게이트 |

## 2. TO-BE
1. **사용자**: 제공자 콘솔에서 호스트 생성(사양 §5), DNS A 레코드, SSH 접속 정보를 `secrets/production-server.md`(gitignored)에 기록.
2. **부트스트랩(스크립트)**: `scripts/provision-host.sh` — Ubuntu 22.04/24.04에 Docker Engine+Compose v2, 배포 사용자·디렉터리, UFW(22/80/443), UTC·NTP, 호스트 nginx+certbot(TLS 종단 → 127.0.0.1:8080), unattended-upgrades. 멱등, `--check`로 검증만.
3. **프로필**: `deploy/profiles/SharpTalk-KR-Production/`(env example·secrets 템플릿·CHECKLIST) — 한국 스테이징 테넌트의 프로덕션이므로 KR 별칭.
4. **배포**: self-hosted 스택으로 설치(`deploy-self-hosted.sh --check` → 배포 → 헬스 검증), 첫 부팅 시드 → `SEED_ON_BOOT=false`.
5. **컷오버**: 플랫폼 AI 엔진·테넌트·관리자·핸드오프·KB·연동·임베드 시크릿(코드로 오지 않는 것) → 스모크 10항목 → 백업 1회 → RPT.
6. **문서**: `DEPLOYMENT-STRATEGY.md` §1·§9 프로덕션 행, `CONFIG.md` §7, `PRODUCTION-CUTOVER.md` §0 갱신, `secrets/production-server.md` 구조.

## 3. 갭 분석
| # | 갭 | 해소 |
|---|---|---|
| 1 | 프로비저닝 자격증명 없음 | 사용자 수행 + 사양·체크리스트 제공. 접속 정보 수령 후 나머지 전부 자동 |
| 2 | 호스트 OS 준비 절차가 문서에 흩어짐(자체호스팅 §1 표만) | `provision-host.sh` 멱등 스크립트 + `--check` |
| 3 | production 스택에 검사·백업 도구 없음 | self-hosted 스택 채택(결정 C와 일치). `docker/production`은 템플릿으로 유지 |
| 4 | 실 자격증명 전달 경로 | 사용자가 `secrets/production-server.md`에 기록 → 서버 env로만 이동(채팅·문서·PR 금지) |
| 5 | 이관 테넌트 범위 미정 | 결정 항목(§5). 기본안: ivyusa(데모 제외) + go2joy |

## 4. 사용자 흐름
```
[사용자] 서버 생성·DNS A 레코드·SSH 정보 기록 ─┐
                                              ▼
[Claude] provision-host.sh --check → 실행(Docker·UFW·nginx·certbot) → 클론 → 프로필 env + gen-secrets + 실 키 이동
         → deploy-self-hosted.sh --check → 배포 → 헬스·/widget/·/manual 200 → 시드 → SEED_ON_BOOT=false 재배포
         → 어드민 초기화 → 테넌트 이관 → 스모크 10항목 → 백업 1회 → 문서·RPT
```

## 5. 제약·결정 요청
| # | 결정 | 기본안(권장) |
|---|---|---|
| D1 | 제공자·리전·사양 | 국내 리전(현 스테이징과 동일 사업자 가능), **8 vCPU / 16GB / 200GB SSD**, Ubuntu 24.04 LTS, 공인 IP 1, 인바운드 22·80·443 |
| D2 | 도메인·TLS | **`sharptalk.amoeba.site`**(미사용 도메인, DNS 소유자가 A 레코드 추가) + 호스트 nginx·Let's Encrypt. 대안 `sharptalk.btbz.ai`(현재 스테이징 IP → 변경 필요) |
| D3 | 스택 | **self-hosted**(`docker/self-hosted`, 검사·백업 도구 완비) |
| D4 | 이관 테넌트 | **ivyusa(데모 주문 제외) + go2joy**, 설정 스냅샷·커스텀 위젯 패키지·KB 라운드트립, 자격증명 재입력 |
| D5 | Shopify | 스테이징 앱에 프로덕션 콜백 URL 추가(빠름) — 프로덕션 앱 신규 등록은 PCD 재승인 필요 |
| D6 | 정책값 | `CONVERSATION_LOG_RETENTION_DAYS=365`, `SEED_DEMO_DATA=false`, `SEED_KB_PROFILE=us-cosmetics`(ivyusa), `AI_PROCESSING_REGION=US`, `MFA_ENFORCE_FROM`=계정 발급 후 +14일 |
| D7 | `production` 브랜치 | 컷오버 ④대로 생성(검증된 main SHA 승격), 이후 배포는 production 브랜치에서 |
- 실 키(Anthropic·Voyage·SMTP·Shopify)는 사용자가 `secrets/production-server.md`에 기록. 없으면 `AI_DEFAULT_PROVIDER=stub`로 먼저 띄우고 키 반영 후 재배포.
- 호스트 root(sudo) 권한이 부트스트랩에 필요(Docker 설치·nginx·certbot). 배포 사용자는 별도(`sharptalk`).
