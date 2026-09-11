# FIX-260911 — production compose에 API 업로드 볼륨 누락 (재배포 시 로고·첨부 유실)

- 발견: REQ-260910-Tenant-Asset-Store-Widget-Design 조사 중 실측(2026-09-10). PLN P0으로 승인.
- 영향: `docker/production/docker-compose.production.yml`의 `api` 서비스에 `volumes:`가 없어 `UPLOAD_DIR`(채팅 첨부·위젯 로고·
  보드 첨부·AI 인제스트 원본)이 컨테이너 파일시스템에 쓰인다. 이미지는 배포마다 재빌드되므로 **다음 배포에서 파일이 사라진다**.
  오류 없이 사라지는 유형(compose 주석과 동일). production은 아직 미배포 상태라 실피해 0.

## 근본 원인
- 스테이징(`docker/staging`)과 자체호스팅 패키지(`docker/self-hosted`, PR #325)에는 볼륨·`UPLOAD_DIR` 검사가 추가됐지만,
  레거시 production 스택은 같은 수정이 반영되지 않았다(세 스택이 같은 내용을 따로 들고 있음).

## 수정 (최소 변경)
- `docker/production/docker-compose.production.yml`: `api.volumes: sharptalk_uploads_production:/data/uploads` + 최상위 `volumes`에 선언.
- `docker/production/deploy-production.sh`: 자체호스팅 스크립트와 동일한 `UPLOAD_DIR=/data/uploads` 검사 — 불일치 시 배포 거부.
- `.env.production`은 `UPLOAD_DIR=/data/uploads`여야 한다(가이드 `자체호스팅설치가이드` §6과 동일).

## 검증
- `bash -n deploy-production.sh` 통과. production 실배포는 호스트 미정 — 배포 시 `docker inspect sharptalk_api_production --format '{{json .Mounts}}'`로 마운트 확인.

## 예방 패턴
- **동일 관심사가 스택마다 복제되어 있으면 한 곳만 고쳐진다.** 볼륨·env 검사처럼 "없으면 조용히 잃는" 항목은 `pre-deploy-check`
  스킬에 체크 항목으로 두고, 스택 3종(staging/self-hosted/production)을 대상으로 한 번에 grep한다.
- 새 파일 저장 기능(P1 테넌트 자산)은 이 볼륨 위에서만 동작한다 — 스키마 마이그레이션처럼 "볼륨 마운트"도 배포 전 확인 대상.
