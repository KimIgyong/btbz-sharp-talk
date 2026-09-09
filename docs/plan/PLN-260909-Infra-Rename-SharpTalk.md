# PLN-260909 — 인프라 이름 변경(C단계) 실행 계획

REQ: `docs/analysis/REQ-260909-Infra-Rename-Side-Impact.md` — 결정(2026-09-09, 권고안 전부 수용): V-1 볼륨 물리명 고정·무이동 ·
DB `db_sharptalk`/사용자 `sharptalk` · 익스체인지 `sharptalk.events` · 컨테이너 `sharptalk_<svc>_staging` · 서버 디렉터리 `/home/shoptalk/btbz-sharptalk` ·
SSH 사용자 `shoptalk` 유지 · 개발 로컬 볼륨은 재시드 · 창구 즉시.

**UI 영향 없음** (인프라·설정·코드 기본값·문서).

## 변경 (PR C)
| 영역 | 내용 |
|---|---|
| `docker/staging/docker-compose.staging.yml` | `container_name` 9개 `sharptalk_*_staging`; 볼륨 키 `sharptalk_*` + `name: staging_ivy_*` **물리명 고정** |
| `docker/production/*`, `docker/self-hosted/*`, `docker/docker-compose.dev.yml` | 배포 인스턴스 없음 → 컨테이너·볼륨·프로젝트명(`name: sharptalk`)·nginx upstream 전부 새 이름 |
| env 템플릿 4종 (`.env.{staging,production,self-hosted}.example`, `.env.development`) | `DB_USER=sharptalk` `DB_NAME=db_sharptalk` `RABBITMQ_USER=sharptalk` `amqp://sharptalk:…`, dev 비밀번호 `sharptalk_dev_pw` |
| 코드 기본값 | `typeorm.config.ts` `data-source.ts` `backfill-relay-subchannel.ts` `migrate-data-uri-attachments.ts`(`db_sharptalk`/`sharptalk`), `event-bus.service.ts` 익스체인지 `sharptalk.events` |
| 스크립트 | `check-migrations.{sh,mjs}` `backup/restore/deploy-self-hosted.sh` 기본 컨테이너명, `gen-secrets.sh`; **신규 `scripts/rename-db-schema.sh`**(정보스키마 기반 RENAME TABLE + 사용자·GRANT, 뷰/트리거/FK 있으면 중단) |
| 스킬·문서 | `pre-deploy-check`(컨테이너·DB·사용자), CONFIG/SPEC, DEPLOYMENT-STRATEGY(서버 경로·볼륨 주석), STAGING-DEPLOY, 자체호스팅 설치 가이드(볼륨 표·clone 디렉터리), Shopify PCD 가이드 |

## 스테이징 창구 (REQ §3 순서)
1. 전체 `mysqldump` 백업 → `/home/shoptalk/backup-pre-rename-<ts>.sql.gz`
2. `compose down`(볼륨 유지) → `mv ivyusa-shopping-talktalk btbz-sharptalk` → `git pull`(PR C 머지본)
3. `.env.staging`: `DB_USER/DB_NAME/RABBITMQ_USER/RABBITMQ_URL` 갱신(비밀번호 유지)
4. `docker volume rm staging_ivy_rabbitmq_staging_data`(큐 0 재확인 후) — 새 기본 사용자 적용
5. mysql만 기동 → `scripts/rename-db-schema.sh` → 검증(`db_sharptalk.tenants` 건수)
6. `deploy-staging.sh` → 부팅 로그·`/health`·라이브챗·릴레이 채널 5 `connected`·`docker volume ls` 불변 확인
7. 24h 후 `DROP DATABASE db_ivy_talktalk`·`DROP USER ivy`·`ivy.events` 삭제 (RPT에 예약 기록)

## 측면 영향
REQ §2 그대로. 추가: `secrets/staging-server.md`(로컬)·메모리 `staging-server`의 경로·컨테이너명 갱신. 롤백 = 구 compose/env 복원 + `rename-db-schema.sh` 역방향.
