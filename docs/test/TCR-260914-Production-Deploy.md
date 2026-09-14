# TCR-260914 — production 첫 배포 (스테이징 호스트 두 번째 스택)

- 근거: PLN-260913-Production-Provisioning-Deploy(승인 기본안) + 2026-09-14 결정 변경(사용자: 신규 호스트 대신 스테이징 호스트 두 번째 스택, 스테이징 키 재사용, Anthropic은 나중에)
- 대상: `https://sharptalk.amoeba.site` → 호스트 nginx(LE) → `127.0.0.1:8081` → `docker/self-hosted` 스택(`/home/shoptalk/sharptalk-production`, 컨테이너 `sharptalk_*`, MySQL `127.0.0.1:3318`), 코드 main `58182e3` = 브랜치 `production`

## 1. 사전 게이트
| 검사 | 결과 |
|---|---|
| init-sql만으로 만든 임시 DB에 `check-migrations.sh` | OK (FIX-260913, 90 테이블·948 컬럼) |
| `deploy-self-hosted.sh --check` (env 필수값·UPLOAD_DIR·widget-config·미적용 SQL) | 통과 ("configuration looks complete", 첫 설치) |
| `provision-host.sh --check` (root) | DNS `sharptalk.amoeba.site → 211.110.140.172` ok, 나머지 TODO 예상대로 |
| 포트 충돌 | 8081·3318 미사용 확인 후 프로필에 지정(3306·8080은 기존 서비스) |
| 시크릿 | `gen-secrets.sh` 9키 적용(길이만 확인: DB 32·JWT 64·CRED_ENC_KEY 44), `RABBITMQ_URL`=비밀번호 일치, Voyage·SMTP·Shopify는 `.env.staging`에서 이름 기준 복사(값 미출력), `FULFILLMENT_WEBHOOK_SECRET` 생성, `AI_DEFAULT_PROVIDER=stub` |

## 2. 부트스트랩(root)
| 항목 | 결과 |
|---|---|
| nginx vhost `/etc/nginx/sites-enabled/sharptalk.amoeba.site` → 127.0.0.1:8081 | `nginx -t` successful |
| certbot `--nginx -d sharptalk.amoeba.site --no-redirect` | 발급 성공, 만료 2026-12-13, certbot.timer active |
| 공유 호스트 보호 | `--skip firewall,upgrades,docker,user` — UFW·apt 정책·Docker·사용자 무변경 |
| **결함** | 스크립트의 time 단계가 호스트 타임존을 KST→UTC로 변경 → 즉시 `Asia/Seoul` 복구(journal 확인). 스크립트에 `--skip time,packages` 추가(PR #528) |

## 3. 배포·부팅
| 항목 | 결과 |
|---|---|
| `deploy-self-hosted.sh` | 3 이미지 빌드, 8 컨테이너 Up(api·mysql healthy), "Deployed." |
| API 로그 | DB 재시도 3회 후 `Seed complete (tenant=ivyusa, admin@/dev@)` → `SEED_ON_BOOT: seed applied` → `successfully started` |
| 스키마 | 테이블 90, `check-migrations.sh` OK, 테넌트 `ivyusa`(custom), admin 1 |
| `SEED_ON_BOOT=false` → API 재생성 | healthy, 시드 로그 0건(재시드 없음), 부팅 1회 |
| 코드 확인 | `session/ensure` 응답 `aiProcessingRegion: US`(#521 반영), 위젯 번들에 `regions` 포함 |

## 4. 라우트
| URL | 결과 |
|---|---|
| `http://127.0.0.1:8081/{api/v1/health, /, widget/, manual/, widget/widget-config.js}` | 200 ×5, widget-config `apiBase=https://sharptalk.amoeba.site/api/v1` |
| `https://sharptalk.amoeba.site/{api/v1/health, /, widget/, manual/, manual/custom-widget.ko.html}` | 200 ×5, TLS 검증 0(정상), HSTS 헤더 |
| 스테이징 `https://shoptalk.amoeba.site/api/v1/health` | 무영향(동일 호스트 별도 스택) |

## 5. 운영 준비
| 항목 | 결과 |
|---|---|
| `production` 브랜치 | `58182e3` 생성·푸시, 서버 체크아웃 전환 |
| 첫 백업 `backup-self-hosted.sh ~/backups/sharptalk-production/20260914` | `db.sql.gz` 611KB · `uploads.tar.gz` · manifest — "OK — both archives written" (오프호스트 복사는 사용자 결정) |
| 시크릿 | `secrets/SharpTalk-KR-Production-server.md`(gitignored, 600) — 서버에서 생성 후 scp, 서버 사본 삭제 |

## 6. 미실행(사용자 몫 또는 후속)
| 항목 | 이유 |
|---|---|
| admin@·dev@ 첫 로그인 비밀번호 변경 | 브라우저 비밀번호 입력은 Claude 금지 |
| 어드민 > AI 엔진 Anthropic 등록(키 입력) | 키 입력은 사용자. 현재 `stub` |
| 테넌트 이관(ivyusa 설정·KB, go2joy 생성), 연동 자격증명 재입력, Shopify 콜백·웹훅 재등록, 임베드 시크릿 재발급 | P3 컷오버(CHECKLIST) |
| `MFA_ENFORCE_FROM` | 계정 발급 후 +14일에 설정·재배포 |
| 백업 오프호스트 복사·복원 리허설 | 저장소 결정 필요 |
