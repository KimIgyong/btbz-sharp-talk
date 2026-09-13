# PLN-260913 — 국가별 세팅·배포·커스터마이징 가이드 작성 계획

- 근거: REQ-260913-Locale-Deployment-Guides
- UI 영향: **없음** (문서 4종 + 선택적 템플릿 소수정. 콘솔·위젯·API 동작 변경 없음)

## 0. 핵심 결정 (승인 대상)

| # | 결정 | 근거 |
|---|---|---|
| A | **단일 저장소 = SharpTalk-Basic, 별칭 = 배포 프로필(포크 금지)** | 포크는 마이그레이션·보안 패치가 3갈래로 갈라짐. 국가 요구는 Basic에 env/플래그/테넌트 설정으로 흡수하고 프로필이 켠다. 코드 없이 못 하는 것은 갭 목록으로 관리 |
| B | 별칭 규칙 `SharpTalk-{Basic \| CC \| CC-Customer}` (CC = ISO 3166 대문자: KR·VN·USA) | 요청 예시 그대로. 프로필 디렉터리·시크릿 파일·컨테이너 프로젝트명(`COMPOSE_PROJECT_NAME`)·DB명에 같은 별칭 사용 |
| C | 국가 스테이징은 **self-hosted 스택**(`docker/self-hosted`)을 기준으로 세운다 | 배포 스크립트가 env 검사·마이그레이션 검사·헬스 검증·백업까지 갖춘 유일한 스택. 한국 staging 스택은 공유 호스트 특수성(볼륨 name 고정, 8080)이 많음. production 스택은 widget 부재 등 결함 |
| D | 한 국가 = 한 배포(스테이징 1 + 프로덕션 1), **고객사는 그 안의 테넌트** | 보존 기간·AI 키·규제 고지는 배포 전역이므로 국가 단위로 나누면 규제 요건이 맞아떨어짐. 같은 국가 2번째 고객사는 테넌트 추가로 처리 |
| E | 코드 갭은 문서화만, 구현은 별도 REQ | 이번 요청은 가이드 작성. 단 REQ §5의 템플릿 결함 3건(env example·gitignore·production nginx)은 **P2로 함께 수정**할지 선택 |

## 1. 산출물

| 파일 (`docs/guide/`) | 내용 | 분량 |
|---|---|---|
| `GUIDE-260913-SharpTalk-Basic-Setup.md` | §2.1 | ~350행 |
| `GUIDE-260913-Locale-Customization.md` | §2.2 | ~300행 |
| `GUIDE-260913-SharpTalk-VN-Go2Joy-Staging.md` | §2.3 (VN 프로필) | ~250행 |
| `GUIDE-260913-SharpTalk-USA-IVY-Staging.md` | §2.3 (USA 프로필) | ~250행 |
| `docs/guide/README` 성격의 목차 갱신 | `DEPLOYMENT-STRATEGY.md` §1 환경표에 국가 스테이징 행·새 가이드 링크 추가 | 소폭 |
| (P2 선택) `deploy/profiles/{SharpTalk-VN-Go2Joy,SharpTalk-USA-IVY}/` | `.env.<alias>.example`(self-hosted example + 프로필 diff), `secrets.template.md`, `CHECKLIST.md`, `tenant-snapshot.example.json` | 소폭 |
| (P2 선택) 템플릿 소수정 | staging/production `.env.*.example` 누락 키·`DB_SYNCHRONIZE=false`, `.gitignore`, `docker/production/nginx.conf` `/widget`·`/app`, `nginx.web.conf` `.md` MIME | 코드 5파일 |
| TCR/RPT-260913-Locale-Deployment-Guides | 검증·보고 | |

## 2. 문서 구성

### 2.1 SharpTalk-Basic 세팅 가이드
```
0. SharpTalk-Basic이란 — 별칭 규칙, 프로필 모델(그림), 이 문서가 다루는 것/안 다루는 것
1. 기술 스택 — 모노레포(apps/api·web·widget·pwa·mobile, packages/types·common, sdk/android),
   런타임(Node 20, NestJS 10, TypeORM, MySQL 8.0, Redis 7, RabbitMQ 3.13, Qdrant 1.15.1, nginx), 프론트(React 18·Vite·Tailwind),
   AI(Anthropic·OpenAI 어댑터, Voyage 임베딩, stub), 이미지 태그 고정표
2. 아키텍처 — 컨테이너 토폴로지(그림), 요청 경로(/ /widget /app /api /widget-design/live), 데이터 위치(볼륨 4종), 외부 통신(egress) 목록
3. 서버 요구 사양 — 스테이징(4vCPU/8GB/80GB) vs 프로덕션(8vCPU/16GB/200GB+, DB 백업 오프호스트), 성장 시 분리 순서(MySQL→Qdrant→RabbitMQ),
   OS·Docker 버전, 포트, 도메인·TLS 종단 위치, 시간 동기화(UTC 호스트)
4. 설치 — 저장소 클론 → `.env` 작성(§5) → `gen-secrets` → `deploy-self-hosted.sh --check` → 스키마(init-sql 자동 / 기존 DB는 check-migrations) → 배포 → 검증 5항목
5. 환경 변수 카탈로그 — 필수 / 기능 / 튜닝 3표(조사 결과 전량), 도메인을 담는 5키, 빌드 시 인라인되는 VITE_*, 절대 바꾸면 안 되는 4값
6. 첫 로그인·초기화 — SEED_ON_BOOT 1회, admin/master 비밀번호 변경, MFA 정책, AI 엔진 등록(코드로 오지 않는 것 표 — 컷오버 §3 링크)
7. 운영 — 배포 절차(SQL 선적용 → 코드), 검증(401/404/502 판독), 백업 2종·복원, 업그레이드, 롤백, 로그·모니터링 지점, 보존 스케줄러
8. 보안 기본값 — 시크릿 파일 구조(`secrets/<alias>-server.md` 키만), 포트 노출 정책, CSP/frame-ancestors, 임베드 오리진은 경계 아님
9. 스모크 체크리스트 — 컷오버 §4 10항목 + 위젯·매뉴얼·라이브 파일
10. 알려진 결함·주의 — production 스택 widget 부재, env example 누락 키, 한국 폴백 URL 목록
```

### 2.2 로컬 커스터마이징 가이드
```
0. 4층 모델 — 배포(env) / 플랫폼 어드민 / 테넌트 설정 / 코드 — 각 층의 변경 주체·반영 시점·이관 수단
1. 항목별 지도(표) — 언어·타임존·통화·날짜, 개인정보(동의 버전·URL·보존·DSAR·opt-out·AI 고지), 저장소(볼륨·쿼터·경로), 위젯(테마·커스텀·CSS·임베드·로그인),
   연동(커머스·메신저·헬프데스크·마케팅·AI 엔진), 브랜딩(제품명·메일 발신·PWA), 초기 데이터(KB·시나리오·핸드오프) → 각 행에 층·위치(파일/화면)·이관 방법
2. 국가 프로필 체크리스트 — 새 국가에 들어갈 때 결정할 20항목(규제·데이터 이전 고지·AI 처리 위치·보존·타임존·언어·통화·전화 형식·결제/커머스·메신저·도메인·TLS·백업 위치·연락망)
3. 테넌트 설정 이관 — 설정 스냅샷 내보내기 → 새 환경 테넌트 생성 → 복원, 커스텀 위젯 패키지, 자격증명은 재입력(암호화 키가 다름), KB 일괄 내보내기/등록
4. 코드 변경이 필요한 갭 — G1~G18 표(증상·위치·권장 처리·우선순위 P0/P1/P2·어느 국가에 필요), VN 착수 전 P0 = default_language(G1/G2)·타임존 목록(G3)·전화 패턴(G6)·AI 고지(G7)·시드 KB 분리(G11)
5. 별칭 운영 규칙 — Basic에 머지 → 국가 스테이징 순차 배포 → 프로필 diff 관리, 핫픽스 역방향 금지, 마이그레이션 매니페스트 공유
```

### 2.3 고객사 스테이징 가이드(공통 골격, 프로필 값만 다름)
```
0. 프로필 요약표 — 별칭·국가·고객사·규제·언어·타임존·통화·연동·현재 위치(한국 스테이징 테넌트) → 결정 필요 항목(호스트·도메인·클라우드·TLS)
1. 서버 준비 — 사양(§Basic 3), 리전(데이터 상주), 방화벽·egress
2. 도메인·TLS — 후보 명명, TLS 종단, 도메인 5키, 외부 재등록(USA: Shopify 앱 URL·웹훅 / VN: Haravan 웹훅·AmoebaTalk)
3. env — Basic self-hosted example 대비 **차이만** 표(보존 기간·타임존 힌트·AI 모델·SMTP·GA4·MFA 강제일·쿼터)
4. 스키마·배포·검증 — Basic §4·§7 링크 + 프로필 특이점
5. 플랫폼 어드민 초기화 — 테넌트 생성값, 요금제·애드온(VN: starter/base→growth? 결정, USA: custom·CSS 애드온), 제공 메뉴, AI 엔진, 관리자 초대
6. 테넌트 초기화 — 한국 스테이징에서 설정 스냅샷·커스텀 위젯 패키지·KB 내보내기 → 복원, 자격증명 재입력, 핸드오프(타임존·업무시간), 개인정보 URL·동의 버전
7. 국가 커스터마이징 — VN: PDPD 동의·국외이전 고지·보존·전화·언어 vi 기본(코드 갭 P0 선행), 호텔 KB, Notion·Haravan·Zalo, 모바일 SDK 도메인
                       USA: CCPA opt-out·Shopify 필수 웹훅·GA4 동의 모드·Klaviyo/Yotpo/Gorgias·시드 KB 그대로
8. 운영 — 배포 루틴, 백업·복원, 마이그레이션, 롤백, 모니터링, 사고 대응 연락망(INCIDENT-RESPONSE + 국가 통지 기한: VN PDPD 72h 추가 필요)
9. 프로덕션 승격 — 스테이징→프로덕션 차이(포트·restart·MFA·SEED_DEMO_DATA=false·DB 백업), 컷오버 순서(PRODUCTION-CUTOVER 링크)
10. 체크리스트(한 장)
```

## 3. 단계
| 단계 | 작업 | 산출 |
|---|---|---|
| P1-a | Basic 세팅 가이드 작성(조사 결과 반영, 기존 4문서 링크) | GUIDE-Basic |
| P1-b | 로컬 커스터마이징 가이드 작성(4층 지도·갭 표) | GUIDE-Locale |
| P1-c | VN-Go2Joy·USA-IVY 스테이징 가이드 작성 | GUIDE ×2 |
| P1-d | DEPLOYMENT-STRATEGY §1 환경표·링크 갱신, 검증(링크·경로·env 키명 실존 대조 스크립트) → PR → CI → 머지 → RPT | TCR/RPT |
| P2(선택) | 프로필 골격 `deploy/profiles/*` + 템플릿 소수정 5파일(`npm run env:check` 통과 확인) | PR 별도 |

## 4. 사이드 임팩트
- P1은 문서만 → 런타임 무영향. `docs/guide/` 파일 추가와 `DEPLOYMENT-STRATEGY.md` 소폭 수정.
- P2 템플릿 수정은 `npm run env:check`(CI)가 example 완전성을 검사하므로 키 추가가 CI에 걸릴 수 있음 → 실행 후 반영. production nginx 수정은 미배포 스택이라 무영향, self-hosted 무변경.
- 시크릿·실 호스트 값은 문서에 넣지 않음(자리표시자).

## 5. 리스크
- 호스트·도메인 미정 → 가이드는 결정 항목 표로 남기고 값이 정해지면 프로필 파일만 채우는 구조.
- 코드 갭 P0(기본 언어·타임존·전화·AI 고지·시드 KB)을 구현하지 않으면 VN 스테이징은 영어 기본·미국 화장품 KB로 뜬다 → 가이드에 "VN 착수 전 선행 요구사항"으로 명시하고 별도 REQ를 권고.
- 기존 문서와의 중복 → Basic 가이드는 "새 서버 0→운영"의 단일 흐름만 담고 세부는 링크.

## 6. 승인 요청
결정 A~E와 산출물 4종 구성으로 진행해도 될지 확인 부탁드립니다. 선택지:
- (1) **P1만**(문서 4종) — 기본안
- (2) P1 + P2(프로필 골격 + 템플릿 결함 5파일 소수정)
- (3) 결정 C 변경: self-hosted 대신 한국 staging 스택을 복제 기준으로
