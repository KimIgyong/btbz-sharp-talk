# REQ-260909 — 인프라 이름 변경(C단계) 사이드임팩트 검토

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| 요청 | "남은 단계 — 인프라 이름 변경 시 사이드임팩트 검토" |
| 상위 | REQ-260909-Project-Rename-SharpTalk §2 T4 · PLN-260909(1차 A+B 완료, RPT-260909) |
| 조사 | 스테이징 호스트 실측(볼륨 크기·DB 객체·RabbitMQ 상태·compose 라벨·호스트 nginx·cron/systemd) + compose/env/스크립트 정적 분석 |

## 0. 한 줄 요약

인프라 이름은 **보이는 것보다 훨씬 싸게** 바꿀 수 있다. 서비스 간 통신은 compose **서비스명**(`mysql`·`redis`·`rabbitmq`·`qdrant`)으로 이뤄져
컨테이너명 변경은 연결에 무영향이고, 볼륨은 **복사 없이 물리 이름을 고정**(`name:`)한 채 논리 키만 바꿀 수 있으며, DB는 **FK·뷰·트리거·루틴이
0**이라 `RENAME TABLE` 87회로 즉시 스키마 이전이 되고, RabbitMQ 익스체인지 `ivy.events`는 **바인딩된 큐가 0**(구독자는 전부 인프로세스)이라 이름을
바꿔도 잃을 메시지가 없다. 위험은 두 곳뿐 — **볼륨 이름을 물리적으로 바꿀 때의 데이터 소실**과 **RabbitMQ 사용자 변경이 기존 볼륨에는
적용되지 않는 점**. 권고안대로 하면 다운타임 **약 5분**, 작업 **1.0인일**(REQ 초기 산출 2.0에서 하향).

## 1. 실측 (스테이징, 2026-09-09)

| 항목 | 값 | 함의 |
|---|---|---|
| 서비스 간 호스트 | `DB_HOST=mysql` `REDIS_HOST=redis` `amqp://…@rabbitmq` `QDRANT_URL=http://qdrant:6333` | **서비스명** 기반 → `container_name` 변경 무영향 |
| compose 프로젝트 | `staging` (= `docker/staging` 디렉터리명), working_dir `/home/shoptalk/ivyusa-shopping-talktalk/docker/staging` | 저장소 디렉터리를 바꿔도 프로젝트명은 `staging` 그대로 → 기존 컨테이너·볼륨 매칭 유지 |
| 볼륨 | `staging_ivy_mysql_staging_data` **1.79GB** · qdrant **437MB** · uploads **49MB** · rabbitmq 359kB · redis 9kB | 복사 시 총 2.3GB(수 분). 복사 없이 `name:` 고정 가능 |
| MySQL `db_ivy_talktalk` | 테이블 **87**, 뷰 0, 트리거 0, 루틴 0, 이벤트 0, **FK 0**, 데이터 95MB; 사용자 `ivy@%` = `ALL ON db\_ivy\_talktalk.*` | `RENAME TABLE a.t TO b.t`가 메타데이터 연산으로 즉시 완료. 새 스키마에 GRANT 필요 |
| DB명 참조 | `.env.staging` `DB_NAME`, compose `MYSQL_DATABASE`(초기화 시에만 사용), TypeORM 기본값 3파일, SQL 파일엔 **DB명 없음**(`USE`·`CREATE DATABASE` 0건) | 코드 기본값·env·문서만 |
| RabbitMQ | 사용자 `ivy`(administrator) 1명, 익스체인지 `ivy.events`(topic, durable), **큐 0, 바인딩 0** | `subscribe()`는 인프로세스 전용 → 익스체인지는 발행만(관측용). 이름 변경 시 유실 0. `RABBITMQ_DEFAULT_USER`는 **빈 볼륨에서만** 적용 |
| Redis 키 접두어 | `ksr:` `auth:` `menuacc:` — 브랜드 없음 | 무영향 |
| Qdrant 컬렉션 | `kb_documents`, `reuse_questions` — 브랜드 없음 | 무영향 |
| 절대 경로·cron·systemd | compose/env/스크립트에 `/home/shoptalk/…` 참조 0, crontab 0, systemd 유닛 0 | 서버 디렉터리 개명은 runbook·메모리·시크릿만 |
| 호스트 nginx | `shoptalk.amoeba.site` → `127.0.0.1:8080` | 컨테이너명 무관 |
| 스크립트 기본값 | `check-migrations.{sh,mjs}`(`shoptalk_mysql`, 예시 `ivy_mysql_staging`), `backup/restore/deploy-self-hosted.sh`(`shoptalk_mysql`/`shoptalk_api`), `pre-deploy-check` 스킬(`ivy_mysql_staging` ×4, `ivy_api_staging` ×2, `db_ivy_talktalk`, 사용자 `ivy`) | 같은 PR에서 갱신 |
| 프로덕션·self-hosted | 배포 인스턴스 없음(프로덕션 미배포, self-hosted는 리허설만) | 이름 변경 **무비용** — 단 설치 가이드의 볼륨 표·`git clone <repo> shoptalk` 갱신 |
| 개발 compose | `ivy_mysql_data` 등 4볼륨, DB `db_ivy_talktalk`, 사용자 `ivy/ivy_dev_pw` | 개발자 로컬 데이터 소실(재시드 가능) — 공지 필요 |

## 2. 항목별 사이드임팩트

### 2.1 컨테이너명 `ivy_*_staging` → `sharptalk_*_staging`
- **영향**: `container_name` 변경은 compose가 컨테이너를 **재생성** → 서비스 재시작(수십 초). 연결은 서비스명 기반이라 무영향.
- **깨지는 곳**: 운영자 습관·`docker exec ivy_mysql_staging …` 명령이 박힌 스킬·runbook·메모리·`check-migrations.sh` 예시. 배포 로그 파일명 무관.
- **완화**: 같은 PR에서 스킬 2종·CLAUDE.md §6·DEPLOYMENT-STRATEGY·secrets 메모 갱신, 메모리 `staging-server` 갱신.

### 2.2 볼륨 — 3안
| 안 | 방법 | 데이터 | 다운타임 | 결과 이름 |
|---|---|---|---|---|
| **V-1 권고** | compose 볼륨 키를 `sharptalk_*`로 바꾸고 `name: staging_ivy_*`로 **물리 이름 고정** | 이동 없음 | 재생성 수십 초 | `docker volume ls`엔 구명 잔존(내부만) |
| V-2 | 스택 정지 → `docker run --rm -v old:/from -v new:/to alpine cp -a` 5볼륨 → compose up | 2.3GB 복사(~3~5분) | **5~10분** | 완전 개명 |
| V-3 | 유지 | — | 0 | 구명 |
- **위험**: V-2에서 새 볼륨 키만 바꾸고 복사를 빠뜨리면 **빈 MySQL이 초기화**되어 `MYSQL_DATABASE`로 빈 스키마가 생김 — 부팅은 성공하고 데이터만 없는 최악의 형태. 반드시 복사 → 마운트 검증(`ls /var/lib/mysql`) 순.
- V-1 후 여유 있을 때 V-2로 넘어가면 된다(둘 다 가역).

### 2.3 DB명 `db_ivy_talktalk` → `db_sharptalk`, 사용자 `ivy` → `sharptalk`
- **방법**: 백업 → `CREATE DATABASE db_sharptalk …utf8mb4_unicode_ci` → 87회 `RENAME TABLE`(스크립트 생성, 트랜잭션 불가지만 각각 원자적·즉시) → `CREATE USER sharptalk@'%'` + `GRANT ALL ON db_sharptalk.*` → `.env.staging` `DB_NAME/DB_USER/DB_PASSWORD` → api 재기동 → 검증 후 `DROP DATABASE db_ivy_talktalk`(빈 껍데기)·`DROP USER ivy`.
- **영향**: api 재기동 사이 API 502 **1~2분**. TypeORM 기본값(`typeorm.config.ts`·`data-source.ts`·`backfill-relay-subchannel.ts`)과 `docker-compose.dev.yml`·`.env.development`·env 템플릿 3종·`gen-secrets.sh`·`pre-deploy-check`도 함께.
- **함정**: ① `MYSQL_DATABASE`/`MYSQL_USER` env는 **초기화 시에만** 읽힘 — 바꿔도 기존 볼륨엔 아무 일도 안 일어난다(수동 SQL 필수). ② 과거 백업 `/home/shoptalk/backup-*.sql`은 스키마 없는 테이블 덤프라 복원 시 `USE db_sharptalk`로 넣으면 됨. ③ Cafe24/Shopify 등 **외부 등록과 무관**(DB 내부). ④ 비밀번호 로테이션은 선택 — 같은 비밀번호로 새 사용자 생성 가능.

### 2.4 RabbitMQ 사용자 `ivy` → `sharptalk`, 익스체인지 `ivy.events` → `sharptalk.events`
- **익스체인지**: 큐·바인딩 0 → 코드 상수 1줄 변경으로 끝. 구 익스체인지는 durable로 남지만 무해(삭제 1회).
- **사용자**: `RABBITMQ_DEFAULT_USER`는 빈 볼륨에서만 적용 → (a) `rabbitmqctl add_user sharptalk … && set_user_tags administrator && set_permissions` 후 env 변경, 또는 (b) 볼륨 359kB·큐 0이므로 **볼륨 삭제 후 재생성**이 더 단순. api는 RabbitMQ 불가 시 인프로세스 폴백이라 순서 실수도 서비스 중단으로 번지지 않음(경고 로그만).

### 2.5 서버 디렉터리 `/home/shoptalk/ivyusa-shopping-talktalk` → `/home/shoptalk/btbz-sharptalk`, SSH 사용자
- `mv` 1회. compose 프로젝트명(`staging`)은 디렉터리 basename이라 **불변** → 실행 중 컨테이너·볼륨 그대로 인식. 절대 경로 참조 0.
- **깨지는 곳**: runbook(`DEPLOYMENT-STRATEGY.md`)·`secrets/staging-server.md`·메모리 `staging-server`·이 세션들이 쓰는 `ssh … cd /home/shoptalk/ivyusa-shopping-talktalk`.
- **SSH 사용자 `shoptalk`**: 리눅스 계정 개명은 홈 이동·authorized_keys·docker 그룹·기존 세션 영향 → **유지 권고**(가치 대비 위험).

### 2.6 프로덕션·self-hosted·개발 compose
- 배포 인스턴스 없음 → 파일만 개명(`ivy_*_production`, `shoptalk_*`, `name: shoptalk`, DB `ivy_talktalk`, `upstream ivy_api/ivy_web`). 설치 가이드 볼륨 표·`git clone <repo> shoptalk`·백업/복원 스크립트 기본값 동시 갱신.
- 개발 compose: 개발자 로컬 볼륨 `ivy_*` 데이터 소실 → 재시드(`db:seed`)로 복구 가능. 공지 1줄.

### 2.7 무영향 확인
Redis 키·Qdrant 컬렉션·업로드 경로(`/data/uploads` 컨테이너 내부)·호스트 nginx·TLS·도메인·Shopify/Cafe24 등록·임베드 계약·CI 필수검사명.

## 3. 권고 실행 순서 (스테이징, 1회 창구 ≈ 5분 중단)

1. 사전: `mysqldump` 전체 백업 + `docker volume ls` 기록; PR 준비(compose 개명 + `name:` 고정, env 템플릿, 코드 기본값·익스체인지 상수, 스크립트·스킬·문서).
2. `docker compose … down`(볼륨 유지) → 서버 디렉터리 `mv` → `git pull`.
3. MySQL만 기동 → DB 이전 SQL(CREATE DATABASE·RENAME TABLE×87·사용자·GRANT) → 검증(`SELECT COUNT(*) FROM db_sharptalk.tenants`).
4. RabbitMQ 볼륨 삭제(큐 0 확인 후) 또는 `add_user`.
5. `.env.staging` 갱신 → `deploy-staging.sh` → 부팅 로그·`/health`·라이브챗 1건·릴레이 폴링 `connected` 확인.
6. 24시간 후 `DROP DATABASE db_ivy_talktalk`·`DROP USER ivy`·구 익스체인지 삭제. (V-2 볼륨 복사는 원하면 별도 창구.)

**롤백**: 구 compose 파일·env 보관, 볼륨 불변(V-1), DB는 `RENAME TABLE` 역방향 87회 — 전 단계 가역.

## 4. 작업량 재산출

| 항목 | 인일 |
|---|---|
| compose 4종·env 템플릿 3·코드 기본값·익스체인지·스크립트·스킬·문서·메모리 | 0.5 |
| 스테이징 창구(백업·이전·검증) + RPT | 0.5 |
| (선택) V-2 볼륨 물리 복사 | +0.25 |
| **합계** | **1.0** (REQ 초기 2.0 → 실측 후 하향) |

## 5. 결정 요청
- V-1(물리 볼륨명 고정, 무이동) 채택 여부 — 권고
- DB명 `db_sharptalk`, 사용자 `sharptalk`, 익스체인지 `sharptalk.events`, 컨테이너 `sharptalk_<svc>_staging`, 서버 디렉터리 `btbz-sharptalk`
- SSH 사용자 `shoptalk` 유지 — 권고
- 창구 시각(스테이징 5분 중단)
