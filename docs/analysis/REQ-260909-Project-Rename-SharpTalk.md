# REQ-260909 — 프로젝트명 btbz-SharpTalk 통일: 작업량 산출 + 사이드임팩트

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| 요청 | "shoptalk, talktalk 등으로 혼재된 프로젝트명을 sharptalk으로 통일. 공식 전체명 btbz-SharpTalk. 변경 가능한 부분 확인, 작업량 산출, 사이드임팩트 조사" |
| 유형 | 분석(구현 없음). 이 문서 승인 후 PLN 작성 |
| 조사 범위 | 저장소 추적 파일 전체 + 스테이징 호스트(컨테이너·볼륨·nginx·DB) + GitHub 메타 |

## 0. 한 줄 요약

이름은 **세 가족**이 섞여 있다 — 제품명(ShopTalk/TalkTalk, 문자열 1,315건), 고객사 브랜드(IVY USA/ivyusa, 642건),
기술 접두어(`@ivy/`, `ivy_`, `ivy:`, 827건). "sharptalk 통일"은 제품명 가족만 바꾸면 **표시 문자열·살아있는
문서 수준에서 2~3인일**로 끝나지만, 기술 접두어와 인프라 이름까지 바꾸면 **데이터 볼륨 이전·외부 등록
변경·고객사 설치 스니펫 호환**이 따라와 **총 8~10인일 + 외부 조율**이 된다. 외부 계약(임베드 전역 변수,
postMessage 프로토콜, Shopify 앱 프록시, Android 패키지)은 **바꾸지 않고 별칭으로 유지**를 권고한다.

## 1. AS-IS — 이름의 분포

| 가족 | 대표 문자열 | 파일 | 건수 | 성격 |
|---|---|---|---|---|
| 제품명 | `shoptalk`/`ShopTalk`/`샵톡` | 286 | 1,139 | 표시·문서·외부 계약 혼재 |
| 제품명(구) | `talktalk`/`TalkTalk`/`ivy-talktalk` | 94+21 | 176+34 | 원래 "Naver TalkTalk 스타일"에서 온 초기 명칭 |
| 고객사 | `IVY USA`/`ivyusa` | 98+179 | 187+455 | 초기 고객사(ivyusa.com) 브랜드. 시드 테넌트 슬러그 `ivyusa`는 **실제 테넌트** |
| 기술 접두어 | `@ivy/*` 패키지 스코프 | 257 | 366 | 워크스페이스 8개, import 전역 |
| 기술 접두어 | `ivy_*` (컨테이너·볼륨·DB·localStorage) | 95 | 247 | 영속 데이터에 닿음 |
| 기술 접두어 | `ivy:*` (postMessage 타입·localStorage) | 63 | 214 | 임베드↔위젯↔SDK **와이어 프로토콜** |
| 신규 | `sharptalk` | 3 | 17 | 이미 등장(브랜치명·GitHub 저장소명) |

이미 된 것: GitHub 저장소 `KimIgyong/btbz-sharp-talk`(2026-09-08 개명). 저장소 **설명문은 아직
"IVY USA Chat & Customer Support Widget…"**, 서버 디렉터리는 `/home/shoptalk/ivyusa-shopping-talktalk`.

## 2. 변경 가능 범위 — 5단계 분류

### T1. 표시 문자열 (안전, 코드 의미 없음)

| 영역 | 항목 | 규모 |
|---|---|---|
| 콘솔 i18n | `landing.json`(hero/footer) · `settings.json`("IVY USA TalkTalk" 등 5~6키) · `aiSetting.json` · `auth.json` · `tenants.json`(`ivyusa` 예시) | 6로케일 × 5파일 ≈ 60키 |
| 위젯/PWA/모바일 i18n | 위젯 `appName: 'IVY USA'`, `contact.email help@ivy.com` · PWA `app.title` · 모바일 온보딩 | 6로케일 × 3앱 ≈ 36키 |
| 하드코딩 | `Sidebar.tsx`(3) · `AuthShell.tsx`(2) · `LandingPage.tsx` · `Storefront.tsx`("IVY USA") · `index.html` title 3개 · PWA `manifest.webmanifest` name/short_name · `apple-mobile-web-app-title` | 12곳 |
| 백엔드 문자열 | Swagger 제목 · 근무시간외 메일 제목 `[IVY USA]`(6) · 임시비밀번호 메일 "ShopTalk"(3) · Gorgias 티켓 제목 `[ShopTalk]` · 어댑터 오류문구 · `@ApiOperation` · AI 기본 페르소나 "Ivy … IVY USA"(신규 테넌트 기본값만) | 15곳 |
| 비밀번호 블록리스트 | api/web 양쪽 `ivyusa`,`ivy2026`,`shoptalk`,`talktalk` | **추가만**(`sharptalk`,`btbz`) — 제거하면 기존 사용자 정책 약화 |
| 주석·SQL 헤더·spec 픽스처 | 약 60파일 | 선택(일괄 치환 가능, 의미 없음) |

### T2. 살아있는 문서·도구 (반드시 함께)

| 항목 | 규모 |
|---|---|
| 루트: `CLAUDE.md`(8) `AGENTS.md`(8, CLAUDE 미러) `SPEC.md`(17) `README.md`(14) `CONFIG.md`(12) `CHANGELOG.md`(6) `docs/PROJECT-ARTIFACT-INDEX.md`(4) `README.docx`(수동) | 8파일 |
| `docs/guide/` 32/34파일 — 최다: 모바일SDK(30) 쇼피파이배포(30) 쇼피파이연동 ko/en(25/24) 이커머스자격증명(24) AMA-SSO(19) 임베드SDK(18) **DEPLOYMENT-STRATEGY(17, 구 저장소 URL·서버 경로 stale)** | 32파일 ≈ 330건 |
| 사용자 매뉴얼 정적 사이트 `apps/web/public/manual/` 22/23파일(index `샵톡 사용자설명서`, footer `ShopTalk · shoptalk.amoeba.site`) + **스크린샷 36장 내용에 구 브랜드**(재캡처는 선택) | 22파일 128건 (+캡처 1일) |
| 스킬 `.claude/skills/ivy-talktalk-dev`, `pre-deploy-check`(호스트·컨테이너·DB명 내장) — **`.agents/skills/`에 동일 복제**, `AGENTS.md`는 `.Codex/skills/…` 경로 언급 | 4파일 + 디렉터리명 |
| `scripts/session-worktree.sh` 워크트리 홈 `~/orca/worktrees/ivyusa-talktalk` | 1 |
| GitHub 저장소 설명문, `design/screens/*TalkTalk Main.png` 14장(파일명만) | 메타 |
| **역사 문서 `docs/{analysis,plan,implementation,test,bug-fix,report}` 239/451 파일 — 정책상 불변**(CLAUDE.md §7: 링크·PR 본문이 가리킴) | 0 |

### T3. 내부 식별자 (기계적이지만 넓음, 영속성 없음)

| 항목 | 규모 | 비고 |
|---|---|---|
| 패키지 스코프 `@ivy/{api,web,widget,pwa,mobile,types,common,shoptalk-rn}` → 신규 스코프 | `package.json` 8 + import **257파일 366건** + jest `moduleNameMapper` 6 + Dockerfile `--filter` 11 + 루트 npm 스크립트 3 | sed 일괄 + CI가 누락 검출. 스코프명 결정 필요(§6 D-2) |
| 루트 `package.json` name `ivy-talktalk` | 1 | |
| `packages/shoptalk-rn/` 디렉터리·패키지명 | 1 | |
| CSS 토큰 `--ivy-primary-*` 17개, DOM id `ivy-talktalk-frame`·`ivy-tab-*`, 로그 접두어 `[ivy-widget]` | 위젯 5파일 | 위젯 내부 전용 — 단, iframe id는 embed.js와 동일 배포 단위라 안전 |
| Android 소스 클래스 `ShopTalk{ChatFragment,Config,…}`, 네임스페이스 `site.amoeba.shoptalk`, 산출물 `shoptalk-android-<ver>.aar` | 9 Kotlin + gradle 3 + README | **고객사 앱 소스 수정 유발** → T5 |

### T4. 영속·호환 민감 (마이그레이션 동반)

| 항목 | 위치 | 이름만 바꾸면 |
|---|---|---|
| **명명 볼륨 19개** (dev 4 · staging 5 · production 4 · self-hosted 5), 스테이징 실체 `staging_ivy_mysql_staging_data` 등 5개 | compose 4종 | **데이터 소실**(MySQL·Qdrant 임베딩·업로드) — `docker run -v old:/from -v new:/to cp -a` 이전 + 다운타임 |
| 컨테이너명 19개 (`ivy_*_staging`, `shoptalk_*`) | compose 4종 + `scripts/check-migrations.{sh,mjs}`·`backup/restore/deploy-self-hosted.sh` 기본값 + `pre-deploy-check` 스킬 | 스크립트·스킬·운영 습관 동시 변경 |
| DB명 `db_ivy_talktalk`/`ivy_talktalk`, DB·RabbitMQ 사용자 `ivy` | env 템플릿 3 + TS 기본값 4 + dev compose | `RENAME`/dump-restore + 권한 재발급 + 비밀 로테이션 |
| RabbitMQ 익스체인지 `ivy.events`(durable topic) | `event-bus.service.ts` | 롤링 배포 중 구/신 익스체인지 분리 → **이벤트 유실**, 이중 바인딩 창 필요 |
| 브라우저 localStorage 키 `ivy_session(_token)`·`ivy_auth`·`ivy_consent`·`ivy_attr_*`·`ivy_theme`·`ivy_lang`·`ivy:launcher`·`ivy:reopen`·`ivy.csat.dismissed`·PWA/모바일 5종 | 위젯·콘솔·PWA·모바일 | **전 사용자 로그아웃**, 동의 재요청, 어트리뷰션 초기화, 온보딩 재생 |
| PWA SW 캐시 `shoptalk-shell-v2` | `sw.js` | 안전(버전 범프와 동일) |
| TOTP issuer `ShopTalk` | `mfa.service.ts` | 기등록 인증앱 라벨은 그대로(무해, 불일치만) |
| 시드 계정·주문번호 `IVY-1001` | seed | dev 픽스처 |

### T5. 외부 계약 (제3자·고객사 측 변경 유발)

| 항목 | 누가 바꿔야 하나 | 안 바꾸면 |
|---|---|---|
| 도메인 `shoptalk.amoeba.site` — 호스트 nginx vhost·Let's Encrypt 인증서(9/28 만료)·DNS·`APP_PUBLIC_URL`·앱 3종 API 기본값·고객에게 이미 발송된 조르기 딥링크 | 인프라 담당 | 유지 시 이름과 URL 불일치만 |
| Shopify `shopify.app.toml`: `name="shoptalk"`, `application_url`, OAuth 콜백, GDPR 웹훅 3, **앱 프록시 `subpath="ivy"`(`/apps/ivy`)** | Partner Dashboard 재등록·**설치된 스토어 전부 재승인** | 프록시 경로 유지 시 무영향 |
| Cafe24 OAuth 콜백·콘솔 반환 URL(`shoptalk.amoeba.site`) | Cafe24 개발자센터(redirect_uri 1개 제약) | 도메인 유지 시 무영향 |
| 임베드 스니펫 전역 `window.IVY_WIDGET_CONFIG`·`window.ShopTalk`(큐/API)·`window.__SHOPTALK_CONFIG__`·`embed.js` URL | **고객사 테마 편집** | 별칭 유지 시 무영향 |
| postMessage 프로토콜 `ivy:*` 15종 + 창 이름 `ivy_auth_popup`·`#ivy_ticket`·`ivy_ref/ivy_land` | 임베드·위젯·RN·Android **버전 혼재** 시 상호 단절 | 양쪽 접두어 동시 수용(dual-accept) 1릴리스 이상 |
| 네이티브 브리지 `window.__shoptalkHost`·JS 인터페이스 `ShopTalkAndroid` | 이미 출시된 고객사 앱 | 별칭 유지 |
| Android AAR 좌표·네임스페이스, Expo `com.ivyusa.shoptalk`·scheme `shoptalk` | 고객사 앱 소스·스토어 등록 | 새 앱으로 취급됨(설치 소실·딥링크 단절) |
| Gorgias 웹훅 헤더 `x-shoptalk-token`·티켓 태그 `shoptalk` | 고객사 Gorgias 콘솔 | 전 웹훅 401 / 저장된 뷰 불일치 |
| 서버 SSH 사용자 `shoptalk`, 키 `ivy_staging_ed25519`, 디렉터리 `ivyusa-shopping-talktalk` | 운영 | 문서만 stale |

### T6. 바꾸지 않는 것

- 시드 테넌트 슬러그 `ivyusa`(로그인 URL `/user/ivyusa`, AMA SSO 파트너 설정, 비밀번호 재설정 링크) — 실제 고객사.
- `kb-policy-{en,ko}.json`(22건) — IVY USA 정책 **내용**(ivyusa.com 등), 브랜드가 아님.
- 역사 문서 239파일, 과거 PR 본문·링크.
- 필수 상태검사명 `typecheck · test · build`, CI 워크플로우(브랜드 문자열 없음).

## 3. 사이드임팩트 요약 (심각도순)

| # | 영향 | 발생 조건 | 완화 |
|---|---|---|---|
| S-1 | 스테이징 DB·임베딩·업로드 소실 | 볼륨명 변경 | 볼륨 복사 이전 + 백업 + 다운타임 창(30~60분) |
| S-2 | 고객사 스토어 위젯 전면 중단 | `IVY_WIDGET_CONFIG`/`ShopTalk`/`embed.js`/`/apps/ivy` 변경 | **변경 금지 또는 영구 별칭** |
| S-3 | 임베드↔위젯↔앱 버전 혼재 시 로그인·리오픈·Cafe24 티켓 단절 | `ivy:*` 프로토콜 변경 | dual-accept, 또는 변경 보류 |
| S-4 | 전 사용자 세션 로그아웃·동의 재요청·어트리뷰션 초기화 | localStorage 키 변경 | 키 마이그레이션 코드(구키→신키 1회 복사) 또는 보류 |
| S-5 | Shopify 설치 스토어 재승인·Cafe24 콜백 재등록 | 도메인/앱 프록시 변경 | 도메인 유지 + 301, 프록시 유지 |
| S-6 | 이벤트 유실 | `ivy.events` 익스체인지 변경 | 이중 바인딩 후 전환 |
| S-7 | 스킬·스크립트·운영 메모리(컨테이너명 내장) 전부 stale | 컨테이너명 변경 | 같은 PR에서 스킬 2트리·스크립트 기본값·CLAUDE.md 동시 갱신 |
| S-8 | 고객사 Android/Gorgias 측 수정 | SDK 좌표·헤더명 변경 | 별칭 유지, 다음 메이저에서 정리 |
| S-9 | 매뉴얼 스크린샷 36장 구 브랜드 노출 | 표시명 변경 후 | 재캡처(1일) 또는 "화면 갱신 예정" 각주 |

## 4. 작업량 산출 (인일, 검증·배포 포함)

| 단계 | 내용 | 산출 | 위험 |
|---|---|---|---|
| **A. 표시명 + 살아있는 문서** | T1 전부 + T2(매뉴얼 텍스트 포함, 스크린샷 제외) + GitHub 설명문 + `i18n:check` + 스테이징 확인 | **2.0** (+스크린샷 재캡처 1.0) | 낮음 |
| **B. 내부 식별자** | T3 패키지 스코프·루트명·RN 디렉터리·스킬 디렉터리·워크트리 홈·CSS 토큰/DOM id·Dockerfile 필터. Android 소스명은 제외 | **1.0** | 낮음~중(CI가 검출) |
| **C. 인프라 이름** | T4 컨테이너·볼륨(이전)·DB명/사용자·RabbitMQ 사용자/익스체인지·nginx upstream·스크립트 기본값·서버 디렉터리·SSH 키명 + 문서 | **2.0** + 다운타임 창 | **높음**(S-1, S-6) |
| **C'. 도메인** | `sharptalk.amoeba.site` 신설·인증서·301·`APP_PUBLIC_URL`·앱 기본값·Shopify/Cafe24 콜백 재등록 | 1.0 + 외부 승인 대기 | 중(S-5) |
| **D. 외부 계약** | 임베드 전역·프로토콜·localStorage·SDK 좌표·Gorgias — 별칭+dual-accept+키 마이그레이션 구현 | 3.0 + 고객사 조율 | **높음**(S-2~4, S-8) |
| 합계 | A+B 권장 1차 | **3.0** | |
| | A+B+C(+C') | 5.0~6.0 | |
| | 전부 | 8.0~9.0 + 외부 조율 | |

## 5. 권고

1. **1차(A+B)만 진행** — "사용자가 보는 이름"과 "개발자가 부르는 이름"을 SharpTalk으로 맞추면 혼재 문제의
   체감 대부분이 해소된다. 영속·외부 계약은 건드리지 않아 위험이 없다.
2. **C는 별도 창구**로 — 스테이징 다운타임을 잡고 볼륨 이전 리허설 후 실행. 프로덕션 미배포 상태인 지금이
   컨테이너·볼륨·DB명을 바꾸기에 가장 싼 시점이지만, 스테이징만 이전하면 된다.
3. **D는 하지 않는다**(별칭 영구 유지). `IVY_WIDGET_CONFIG`·`window.ShopTalk`·`ivy:*`·`/apps/ivy`는 고객사가
   설치한 계약이며, 새 이름(`SHARPTALK_WIDGET_CONFIG` 등)을 **추가**하고 구 이름을 별칭으로 남기는 정도만
   1차에 포함 가능(+0.5인일).

## 6. 결정 요청

| # | 결정 | 권고 |
|---|---|---|
| D-1 | 표시명 표기: 영문 `SharpTalk`, 전체명 `btbz-SharpTalk`, 한국어 `샤프톡`(현 매뉴얼의 `샵톡` 대체), 소문자 슬러그 `sharptalk` | 그대로 |
| D-2 | 패키지 스코프: `@sharptalk/*` vs `@btbz/*` | `@sharptalk/*` (다른 btbz 저장소와 충돌 회피) |
| D-3 | 기술 접두어 `ivy_`/`ivy:`(볼륨·localStorage·프로토콜)를 이번 범위에 포함할지 | **제외**(C·D로 분리) |
| D-4 | 도메인 `shoptalk.amoeba.site` 유지 여부 | 1차 유지, C'에서 결정 |
| D-5 | 매뉴얼 스크린샷 재캡처 포함 여부 | 1차 제외, 각주 처리 |
| D-6 | 고객사 브랜드 `IVY USA` 문자열(위젯 기본 제목·메일 제목 등)을 제품명으로 바꿀지, 테넌트 설정값으로 옮길지 | 제품명(SharpTalk)으로 대체 — 테넌트별 브랜딩은 이미 `widget_copy`·테마로 제공 |

승인되면 PLN-260909-Project-Rename(단계 A+B, UI 영향 = 표시 문자열만이라 와이어프레임 불필요)을 작성한다.
