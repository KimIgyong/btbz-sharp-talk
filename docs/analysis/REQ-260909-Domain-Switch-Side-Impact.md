# REQ-260909 — 도메인 전환(C'단계) 사이드임팩트 검토

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| 요청 | "남은 단계 — 도메인 전환(C') 사이드임팩트 검토" |
| 상위 | REQ-260909-Project-Rename-SharpTalk §2 T5 · RPT-260909-Infra-Rename(C 완료) |
| 조사 | DNS/TLS 실측, 호스트 nginx vhost, 스테이징 `.env.staging` URL 키, DB 외부 연동 건수, nginx 7일 접근 로그, 코드의 도메인 기본값 |

## 0. 한 줄 요약

새 도메인 두 곳은 **아직 서비스 상태가 아니다** — `sharptalk.amoeba.site`는 DNS 레코드 자체가 없고, `sharptalk.btbz.ai`는 DNS만 호스트를
가리켜 호스트 nginx의 **기본 vhost(ACM, 인증서 `acm.amoeba.site`)** 가 응답한다. 전환의 본체는 ① vhost+인증서(인프라) ② env 5키 +
프런트 재빌드(`VITE_API_BASE_URL`은 빌드 시 인라인) ③ 외부 재등록(Shopify 앱 설정·상점별 웹훅, Cafe24 redirect_uri, AMA 파트너 URL)
④ **구 도메인 영구 301**(고객사 테마의 임베드 스니펫·7일 서명 첨부 링크·메일 링크·PWA 설치본이 구 호스트를 가리킴). **추가형**(새 도메인
먼저 붙이고 구 도메인 유지)으로 하면 다운타임 0, 작업 **1.0인일 + 외부 승인 대기**.

## 1. 실측

| 항목 | 값 | 함의 |
|---|---|---|
| DNS | `shoptalk.amoeba.site` → 211.110.140.172 · `sharptalk.btbz.ai` → 211.110.140.172 · **`sharptalk.amoeba.site` → 없음** | amoeba.site는 DNS 소유자가 A 레코드 추가 필요 |
| TLS/vhost | `sharptalk.btbz.ai`: 443 응답하나 인증서 `CN=acm.amoeba.site`, 본문 `ACM v1.0a`(기본 vhost) → 브라우저 경고 + 엉뚱한 앱 | vhost·certbot 필요. 호스트 nginx는 공유(acm·btbz.ai·modora·pmm-dev·messenger…) — 기존 vhost 손대지 말 것 |
| 구 vhost | `shoptalk.amoeba.site` → `127.0.0.1:8080`, certbot 관리(만료 9/28 자동갱신) | 새 vhost는 같은 upstream 복제 |
| `.env.staging` URL 키 | `VITE_API_BASE_URL` `SHOPIFY_APP_URL` `APP_PUBLIC_URL` `CAFE24_REDIRECT_URI` `CAFE24_CONSOLE_RETURN_URL` = 구 도메인. `CORS_ORIGINS` 미설정, `NODE_ENV=staging` → **CORS 전체 허용** | 새 도메인 콘솔이 구 API를 호출하는 과도기에도 CORS 차단 없음 |
| 빌드 인라인 | `VITE_API_BASE_URL`은 web·pwa 이미지 빌드 시 고정(위젯은 자기 origin 기준 런타임 해석) | env 변경 = 이미지 재빌드 배포 |
| 코드 기본값 | `cafe24-oauth.service.ts`·`cafe24-customer-auth.service.ts`(콜백), `nudge.service.ts`(`APP_PUBLIC_URL` 폴백), `pwa/mobile config.ts`(API), `SettingsPage.tsx`·`AgentsSection.tsx`(`VITE_WIDGET_URL` 폴백 = 스니펫 생성기), `shopify.app.toml` 6곳 | env가 있으면 기본값은 안 쓰이나, 스니펫 생성기 기본값은 **고객사에 복사되는 URL** |
| 외부 연동(스테이징) | Shopify 자격증명 1(ambshop-dev, 웹훅 4종 등록됨) · Cafe24 2 · Odoo 2 · Haravan 2(동기화형) · Notion 1 · 텔레그램/Gmail 활성 0 · 조르기 링크 0 | Shopify 앱 URL·웹훅 주소, Cafe24 redirect_uri(테넌트별 앱 → 2곳) 재등록; Odoo/Haravan/Notion은 토큰 기반 무영향 |
| 외부로 나간 링크 | 첨부 서명 URL(외부 7일) 최근 7일 **1,439건**(릴레이 고객에게 전달됨), 비밀번호 재설정·초대 메일(`APP_PUBLIC_URL`), 매뉴얼·문서 98건 | 구 호스트가 최소 7일, 실제로는 영구히 301 응답해야 함 |
| 위젯 로딩 출처(7일 로그) | `annehearts.com` | 고객사 테마에 `widgetUrl: https://shoptalk.amoeba.site/widget` 스니펫이 박혀 있음 → 구 호스트가 `/widget/` 을 계속 서빙(또는 301) |
| 임베드 원점 허용목록 | 테넌트 2곳 설정 — **고객사 origin**이라 무영향 | — |
| PWA | scope `/app/` (origin 종속) | 설치본은 구 origin에 묶임 → 새 도메인은 "새 앱"; 구 도메인 유지 시 계속 동작 |
| 쿠키 | 없음(Bearer·localStorage) | 도메인 전환 시 **로그인 상태 전부 초기화**(localStorage는 origin별) |
| AMA SSO | `AMA_SSO_TOKEN_URL`은 ama 쪽 URL; ama 파트너앱에 **우리 콘솔 URL** 등록(iframe) | ama 측 설정 변경 필요 |
| 상담 앱(Android/RN) | 고객사 앱이 API·위젯 URL을 자체 설정(go2joy 실기기 테스트는 구 스테이징 URL) | 고객사 측 재설정 또는 301 의존 |

## 2. 항목별 사이드임팩트 (심각도순)

| # | 영향 | 조건 | 완화 |
|---|---|---|---|
| S-1 | 고객사 스토어 위젯 중단 | 구 도메인을 내리거나 `/widget/`를 301 없이 닫음 | **구 도메인 영구 유지 + 301** (스니펫은 고객사 테마 안이라 회수 불가) |
| S-2 | Cafe24 OAuth 실패(콘솔 연결·위젯 회원 로그인) | env `CAFE24_REDIRECT_URI` 변경 ≠ Cafe24 개발자센터 redirect_uri(앱당 1개) | 두 테넌트 앱 각각 개발자센터에서 먼저 바꾼 뒤 env 배포 — 순서 어긋나면 그 사이 로그인 불가(기존 토큰·갱신은 무영향) |
| S-3 | Shopify 웹훅 유실 | `SHOPIFY_APP_URL` 변경 후 상점별 웹훅 주소 미갱신 | `shopify app deploy`(Partner 설정) + 콘솔 "웹훅 등록" 재실행(ambshop-dev 1곳) — 구 도메인 301이 웹훅 POST에는 통하지 않을 수 있음(Shopify는 307/308 아닌 301 재시도 안 함) → **재등록 필수** |
| S-4 | 릴레이 고객에게 이미 보낸 첨부 링크 1,439건 만료 전 깨짐 | 구 도메인 즉시 종료 | 301(서명은 uuid·variant·exp만 서명, 호스트 무관 → 새 호스트에서도 유효) |
| S-5 | 전 사용자 로그아웃·위젯 세션 초기화·동의 재요청 | 새 origin | 1회성, 공지 |
| S-6 | 새 도메인 콘솔이 구 API 호출(빌드 인라인) | vhost만 먼저 붙이고 재빌드 전 | 과도기 허용(CORS 전체 허용) — 최종은 재빌드 |
| S-7 | 메일·매뉴얼·문서·스킬·메모리·시크릿의 구 URL | — | 문서 34파일 98건 치환 + 301로 안전망 |
| S-8 | 호스트 nginx 공유 | certbot이 다른 vhost 건드릴 위험 | `certbot --nginx -d <new>`만, `--redirect` 옵션 금지(구 vhost는 수동 301) |
| S-9 | 두 도메인 병행 | OAuth 콜백은 호스트 1개만 등록 가능(Cafe24) | **주 도메인 1개** 확정, 나머지는 301 |

## 3. 권고 실행 순서 (추가형, 다운타임 0)

1. **결정**: 주 도메인 1개(§5). DNS 소유자가 `sharptalk.amoeba.site` A 레코드 추가(원하면).
2. 호스트 nginx: 새 vhost(구 vhost 복제, `proxy_pass 127.0.0.1:8080`) + `certbot --nginx -d <primary> [-d <alias>]` → `https://<primary>/api/v1/health` 200, 인증서 CN 확인. 이 시점에 새 도메인으로 앱이 뜬다(API는 아직 구 도메인, S-6).
3. 외부 선등록: Cafe24 개발자센터 redirect_uri(테넌트 2곳) → 새 도메인, `shopify.app.toml` 갱신 + `shopify app deploy`, ama 파트너앱 콘솔 URL.
4. PR C': env 템플릿·코드 기본값 6곳·`shopify.app.toml`·스니펫 생성기 기본값·문서 34파일·스킬·CLAUDE.md §6·CHANGELOG 항목.
5. `.env.staging` 5키 → `deploy-staging.sh`(web/pwa 재빌드, api 재기동 ≈2분 502) → 콘솔 로그인·Cafe24 연결 테스트·Shopify 웹훅 재등록·위젯(annehearts) 확인.
6. 구 vhost를 **301 → 주 도메인**(경로·쿼리 보존)으로 교체, certbot 갱신 유지. 별칭 도메인도 301.
7. secrets·메모리·매뉴얼 footer 갱신, RPT.

**롤백**: env 5키 복원 + 재배포, 외부 등록 원복. 구 vhost는 301 대신 원래 proxy로 되돌리면 즉시 복구.

## 4. 작업량

| 항목 | 인일 |
|---|---|
| PR C'(env 템플릿·기본값·toml·문서 34파일·스킬) | 0.4 |
| 인프라(vhost·certbot·301) + 배포·검증 | 0.3 |
| 외부 재등록(Cafe24 ×2·Shopify 앱 deploy+웹훅·ama) | 0.3 + 승인 대기 |
| **합계** | **1.0** + 외부 대기 |

## 5. 결정 요청
- **주 도메인**: `sharptalk.btbz.ai`(DNS 이미 존재, 회사 브랜드) vs `sharptalk.amoeba.site`(DNS 신설 필요). 권고 `sharptalk.btbz.ai` 주, `sharptalk.amoeba.site`는 별칭 301(또는 생략).
- 구 도메인 `shoptalk.amoeba.site` **영구 301 유지**(권고) vs 기한부.
- Cafe24 개발자센터·Shopify Partner·ama 파트너앱 접근 권한(사용자 직접 vs 자격 위임).
- 실행 시각(외부 선등록 → env 배포 순서를 같은 창구에서).
