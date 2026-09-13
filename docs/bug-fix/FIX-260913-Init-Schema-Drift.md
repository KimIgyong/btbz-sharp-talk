# FIX-260913 — 프로덕션 첫 부팅 스키마(init-sql)가 스테이징보다 13개 마이그레이션 뒤처짐

- 발견: "production 배포" 착수 전 준비 상태 점검(2026-09-13). `docker/init-sql/01-schema.sql`만으로 만든 임시 MySQL에 `scripts/check-migrations.sh`를 돌리자 **NOT applied 13**(81 테이블 vs 스테이징 90 테이블·948 컬럼).
- 영향: 프로덕션 첫 부팅(`DB_SYNCHRONIZE=false`)에서 13개 마이그레이션의 테이블·컬럼이 없어 해당 기능이 500 — 컷오버 B1(2026-08-13)에서 한 번 해소했던 것과 같은 결함의 재발.

## 근본 원인
init-sql은 "가동 중인 DB에서 재생성"이 규칙(파일 헤더)이지만, 2026-08-20 이후 스키마 PR들이 **손으로 append**(ai_agents·tenant_assets·widget_designs·custom_css·revisions·default_language 등)했고, 같은 기간의 다른 13개 마이그레이션(agent-console·conversation-pin·ai_usage_daily·answer_reuse_agent·channel_threads_notice_version·chat_comments·chat_groups·conversation_briefings·integration_credentials_status·journey_reports·kb_category_agent_scope·kb_category_group·knowledge_taxonomy)은 반영되지 않았다. CI의 `check-migrations --check`는 **매니페스트 신선도**만 검사하고 init-sql과 대조하지 않으므로 드리프트가 보이지 않았다.

## 수정
- `docker/init-sql/01-schema.sql`을 헤더 레시피대로 스테이징 실 DB에서 재생성(`mysqldump --no-data --skip-dump-date --skip-comments --single-transaction --set-gtid-purged=OFF | sed 's/ AUTO_INCREMENT=[0-9]+//'`). 90 테이블·948 컬럼.
- 검증: init-sql만으로 띄운 임시 MySQL(`mysql:8.0`, 동일 charset) → 테이블 90·컬럼 948 = 스테이징, `check-migrations.sh` **OK — every schema migration is present**.

## 예방
- 프로덕션 컷오버·국가 스테이징 오픈 전 필수 게이트로 추가: **"init-sql만으로 만든 임시 DB에 check-migrations = OK"**(Basic 가이드 §4·pre-deploy-check §6). 명령:
  ```bash
  docker run -d --name schemacheck -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=db_sharptalk -v "$PWD/docker/init-sql:/docker-entrypoint-initdb.d:ro" mysql:8.0
  # 기동 후
  MYSQL_CONTAINER=schemacheck MYSQL_ROOT_PASSWORD=x bash scripts/check-migrations.sh && docker rm -f schemacheck
  ```
- 스키마 PR의 `## Migration` 체크리스트에 "init-sql 동기(재생성 또는 append)" 항목은 이미 있으나, **append보다 재생성**을 우선한다(부분 append가 드리프트의 원인).
- 후속 후보: CI에 위 게이트를 잡(job)으로 추가(mysql 서비스 컨테이너, ~1분).
