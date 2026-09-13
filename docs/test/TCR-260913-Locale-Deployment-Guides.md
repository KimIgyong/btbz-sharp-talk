# TCR-260913 — 국가별 세팅·배포·커스터마이징 가이드 + 배포 프로필·템플릿 소수정

- 근거: PLN-260913-Locale-Deployment-Guides (승인 "승인, 2" = P1 문서 4종 + P2 프로필·템플릿)
- 환경: 로컬(Docker 있음, 서버 없음 — 국가 호스트 미정이라 실배포 검증은 범위 밖)

## 1. 사실 대조 (문서 ↔ 코드)
| 항목 | 근거 | 결과 |
|---|---|---|
| 스택 구성·이미지 태그(node:20-alpine, mysql:8.0, redis:7-alpine, rabbitmq:3.13-management-alpine, qdrant v1.15.1, nginx:alpine) | 3개 compose + Dockerfile | 일치 |
| self-hosted 배포 스크립트 단계(env 검사 → widget-config 생성 → check-migrations → up → 헬스 검증) | `scripts/deploy-self-hosted.sh` | 일치 |
| env 카탈로그(필수/기능/튜닝) | `docker/self-hosted/.env.self-hosted.example` | 일치 — 가이드에 인용된 키 전부 템플릿 또는 코드에 존재(검사 스크립트, 동적 키 `TENANT_ASSET_QUOTA_*` 포함) |
| 도메인 5키·외부 재등록 | `REQ-260909-Domain-Switch-Side-Impact.md` | 일치 |
| 로컬라이제이션 지점·갭 G1~G18(파일·라인) | 조사(`language.ts`, `session.service.ts`, `HandoffSection.tsx`, `pii-scrub.util.ts`, 위젯 i18n, `seed.runner.ts`, `retention.service.ts`, `mailer.service.ts`) | 일치 |
| 설정 스냅샷 12필드·같은 테넌트 복원만 | `settings-snapshot.service.ts` FIELDS·restore | 일치 |
| 권한 master/director | `@RequireRank` | 일치 |
| Go2Joy·IVY 현황(플랜·연동·KB) | REQ-260825/260831 Go2Joy, RPT 카탈로그·Shopify 문서 | 일치 |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `npm run env:check` | OK (self-hosted 템플릿 = 코드가 읽는 변수 전량) |
| `.gitignore`: `deploy/profiles/*/.env.*` 무시·`*.example` 추적·`docker/self-hosted/.env.self-hosted` 무시 | `git check-ignore -v`로 확인 |
| `docker compose … production … config --services` | redis mysql rabbitmq api web **widget** nginx qdrant |
| `nginx -t` production edge(`/widget` 라우트, resolver)·web(`.md` MIME)·widget | 3/3 successful |
| 가이드 링크·경로·env 키 검사 스크립트(4 가이드 + README + CHECKLIST 2) | 링크 0 결손, 경로 결손 1건 정정(영상 가이드 참조), 위양성 3건(`widget-config.js`는 배포 시 생성 파일, `WARN`/`ERROR`는 로그 레벨) |
| 프로필 env example 키 집합 = self-hosted example 키 집합 | 파생 생성이라 동일(값만 상이) |

## 3. 내용 검토
| 문서 | 확인 |
|---|---|
| Basic | 0 별칭/원칙 → 1 스택 → 2 아키텍처·데이터 위치·egress → 3 사양 → 4 설치 → 5 env → 6 초기화 → 7 운영 → 8 보안 → 9 스모크 → 10 결함. 기존 4문서(자체호스팅·전략·스테이징·컷오버)는 링크 |
| Locale | 0 4층 → 1 지도 6절 → 2 국가 체크리스트 20 → 3 이관 절차 → 4 갭 표(우선순위·국가) → 5 운영 규칙 |
| VN-Go2Joy | 0 요약·선행 P0 → 1~10. 규제 서술은 "법무 확인 필요" 명시, 호스트·도메인 자리표시자 |
| USA-IVY | 동일 골격, Shopify 앱 전략 결정 항목, P0 없음 명시 |

## 4. 엣지·범위 밖
| 케이스 | 처리 |
|---|---|
| 국가 서버 실배포 | 호스트 미정 → 가이드·프로필만. 첫 실배포 때 TCR 갱신 |
| production 스택 widget 추가 | 미배포 스택이라 런타임 무영향; `Dockerfile.widget`은 self-hosted 복제(경로 치환) |
| pwa/`/app` | production 미포함(설계) — Basic §10 기재 |
| 코드 갭 P0 구현 | 별도 REQ |
