# RPT-260909 — 인프라 이름 변경(C단계) 구현·실행 보고

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| REQ / PLN | REQ-260909-Infra-Rename-Side-Impact(#487) · PLN-260909-Infra-Rename-SharpTalk (권고안 전부 수용) |
| PR | #488 → main `9a225db` (compose 4종·env 템플릿·코드 기본값·스크립트·스킬·문서 + `scripts/rename-db-schema.sh`) |
| 스테이징 창구 | 2026-09-09 14:06:55 → 14:09:02 UTC, **중단 약 2분** (계획 5분) |
| 마이그레이션 | 스키마 변경 없음. DB 이름 이전은 `rename-db-schema.sh`(RENAME TABLE ×87) |
| 백업 | `/home/shoptalk/backup-pre-rename-20260909-230558.sql.gz` (87테이블, 9.7MB) · `/home/shoptalk/env.staging.bak-20260909-*` |

## 새 이름 (스테이징 실적용)
| 대상 | 이전 | 이후 |
|---|---|---|
| 서버 디렉터리 | `/home/shoptalk/ivyusa-shopping-talktalk` | `/home/shoptalk/btbz-sharptalk` |
| 컨테이너 9개 | `ivy_<svc>_staging` | `sharptalk_<svc>_staging` |
| 물리 볼륨 5개 | `staging_ivy_*` | **불변**(compose 논리 키 `sharptalk_*` + `name:` 고정, 데이터 무이동) |
| MySQL DB / 사용자 | `db_ivy_talktalk` / `ivy` | `db_sharptalk` / `sharptalk`(비밀번호 동일) |
| RabbitMQ 사용자 / 익스체인지 | `ivy` / `ivy.events` | `sharptalk` / `sharptalk.events`(볼륨 재생성, 큐 0) |
| compose 프로젝트 | `staging` | `staging`(디렉터리명 기준, 불변) |
| SSH 사용자·키·도메인·포트 | — | 불변 |

프로덕션·self-hosted·dev compose는 파일만 새 이름(배포 인스턴스 없음). 개발자 로컬 `ivy_*` 볼륨은 새 이름으로 재생성되므로 `npm run db:up && npm run db:seed`로 재시드.

## 실행 기록
1. `down`(볼륨 유지, 10개 제거) → `mv` → `git pull`(9a225db) → `.env.staging` `DB_USER/DB_NAME/RABBITMQ_USER/RABBITMQ_URL`
2. `docker volume rm staging_ivy_rabbitmq_staging_data`
3. mysql만 기동(healthy) → `rename-db-schema.sh`: "moved 87 tables: db_ivy_talktalk now 0, db_sharptalk now 87" → `sharptalk` 사용자로 `tenants` 14건 확인
4. `deploy-staging.sh` → 9컨테이너 새 이름, api healthy, `successfully started`
5. **1회 보정**: 새 RabbitMQ 볼륨 초기화가 API 부팅보다 늦어 API가 인프로세스 버스로 폴백(`RabbitMQ unavailable`) → `docker restart sharptalk_api_staging` 후 정상 연결, 익스체인지 `sharptalk.events` 생성 확인

## 검증
| 항목 | 결과 |
|---|---|
| HTTP | `/` `/widget/` `/app/` `/api/v1/health` 모두 200 |
| DB | `db_sharptalk` 87테이블 · `db_ivy_talktalk` 0테이블(빈 껍데기) · 사용자 `ivy`·`sharptalk` 공존 |
| 볼륨 | `docker volume ls` = `staging_ivy_{mysql,qdrant,redis,rabbitmq,uploads}` 그대로 |
| 릴레이 폴링 | 채널 5 `connected`, `last_sync_at` 14:10:23 갱신(15초 주기 재개) |
| RabbitMQ | 사용자 `sharptalk`(administrator), 익스체인지 `sharptalk.events` topic |
| compose 라벨 | project `staging`, working_dir `/home/shoptalk/btbz-sharptalk/docker/staging` |

## 예약된 후속 (24h 후, 2026-09-10 14:00 UTC 이후)
```
docker exec sharptalk_mysql_staging sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE db_ivy_talktalk; DROP USER \"ivy\"@\"%\";"'
```
(구 익스체인지 `ivy.events`는 볼륨 재생성으로 이미 없음.) 물리 볼륨명 `staging_ivy_*` → `staging_sharptalk_*` 복사 이전(V-2)은 선택 — 원하면 별도 창구(2.3GB, ~5분).

## 교훈
- **빈 볼륨 초기화와 API 부팅의 경합**: 볼륨을 재생성한 서비스(RabbitMQ)는 첫 기동이 느려 `depends_on`만으로는 순서가 보장되지 않는다. 폴백이 있는 컴포넌트라 서비스 영향은 없었지만, 볼륨 재생성 창구에서는 해당 서비스를 먼저 띄우고 API를 올릴 것.
- `MYSQL_DATABASE`·`RABBITMQ_DEFAULT_USER`는 빈 볼륨에서만 적용된다 — env만 바꾸는 개명은 "아무 일도 안 일어난 성공"이 된다. DB는 SQL, RabbitMQ는 볼륨 재생성/`add_user`가 실제 작업이다.
- FK·뷰·트리거 0인 스키마는 `RENAME TABLE`로 초 단위 이전이 되고 역방향도 같다 — dump/restore보다 먼저 검토할 것(`rename-db-schema.sh`가 사전 조건을 검사).
