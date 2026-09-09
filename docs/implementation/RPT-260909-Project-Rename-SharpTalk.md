# RPT-260909 — 프로젝트명 btbz-SharpTalk 통일 1차(A+B) 구현 보고

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-09 |
| REQ / PLN | REQ-260909(#482) · PLN-260909(#483, 승인 D-1~D-6) |
| PR A | #484 → main `ae7967b` — 표시 문자열·살아있는 문서·스킬명 (164파일) |
| PR B | #485 → main `6ca7db9` — 패키지 스코프·루트명·RN 패키지·Dockerfile 필터 (230파일) |
| 스테이징 배포 | A 12:52 UTC · B 13:11 UTC, api/web/widget/pwa 재빌드, `Nest application successfully started` 확인 |
| 마이그레이션 | 없음 |
| GitHub | 저장소 설명문 → "btbz-SharpTalk — multi-tenant chat & customer support widget …" |

## 표기 (D-1)
영문 **SharpTalk** · 전체명 **btbz-SharpTalk** · 한국어 **샵톡**(유지) · 슬러그 `sharptalk` · 패키지 스코프 `@sharptalk/*`

## 변경 내역

### A. 표시 문자열 · 문서
| 영역 | 내용 |
|---|---|
| 콘솔 i18n 6로케일 | `landing`(hero/footer) `settings`(Cafe24/Shopify/Odoo 안내, "IVY USA TalkTalk"→"SharpTalk") `aiSetting` `auth` `tenants`(슬러그 예시 `sharptalk`) |
| 위젯·PWA·모바일 i18n | 위젯 기본 제목 `appName` `IVY USA`→`SharpTalk`(D-6) · PWA `app.title`·설치 안내 · 모바일 온보딩 |
| 하드코딩 | `<title>` 3종(`SharpTalk Console`/`SharpTalk`/`SharpTalk`), PWA manifest·`apple-mobile-web-app-title`·SW 알림 기본 제목, 사이드바·로그인 셸·랜딩·메뉴 폴백, Storefront 탭, MFA 복구코드 파일명 |
| 백엔드 문자열 | Swagger `btbz-SharpTalk API`, 근무시간외 메일 제목 `[SharpTalk]`(6언어), 임시비번 메일, Gorgias 티켓 제목(태그 `shoptalk`는 유지), 어댑터 오류문구, TOTP issuer `SharpTalk`(신규 등록분만), AI 기본 페르소나에서 "Ivy/IVY USA" 제거 |
| 블록리스트 | api·web에 `sharptalk`, `btbz` 추가(기존 항목 유지) |
| 문서 | `CLAUDE.md` `SPEC.md` `README.md`(구 명칭=동일 제품 각주) `CONFIG.md` `CHANGELOG.md`(개명 항목 추가, 과거 항목 불변) `docs/PROJECT-ARTIFACT-INDEX.md`, `docs/guide` 32파일(DEPLOYMENT-STRATEGY의 stale 저장소 URL → `btbz-sharp-talk` 정정), 매뉴얼 사이트 22파일(en/vi `SharpTalk`, ko `샵톡` 유지, footer 도메인 유지) |
| 스킬·인프라 주석 | `.claude/skills/ivy-talktalk-dev` → `sharptalk-dev`, docker/env 헤더 20파일, 예시 도메인 `sharptalk.example.com` |

### B. 내부 식별자
`@ivy/{api,web,widget,pwa,mobile,types,common}` → `@sharptalk/*`(import 199파일·jest mapper·Dockerfile `--filter` 11·루트 npm 스크립트·package-lock 재생성) ·
`@ivy/shoptalk-rn`+`packages/shoptalk-rn` → `@sharptalk/react-native`+`packages/sharptalk-rn` · 루트 `name: btbz-sharptalk` ·
`scripts/session-worktree.sh` 홈 `~/orca/worktrees/btbz-sharptalk`(구 경로 비어 있어 무영향)

### 불변 (D-3, REQ T4~T6)
`ivy_`/`ivy:` 접두어(컨테이너·볼륨·DB·localStorage·postMessage), `ivy-talktalk-frame`, `--ivy-*`, `IVY_WIDGET_CONFIG`·`window.ShopTalk`·`__SHOPTALK_CONFIG__`·`embed.js`,
`/apps/ivy`, Android·Expo 식별자, `x-shoptalk-token`·태그, 도메인, 시드 슬러그 `ivyusa`, `kb-policy-*.json`, 역사 문서 239파일, `design/screens` 파일명.

## 검증
| 항목 | 결과 |
|---|---|
| 정적 | `npm run i18n:check` 6로케일 complete · `turbo typecheck` 9/9 · API jest **1825 통과**(A) / messenger·auth 256(B) · 위젯 24 통과 |
| 스테이징 A | `/`→`SharpTalk Console`, `/widget/`·`/app/`→`SharpTalk`, `/manual/`→`샵톡 사용자설명서`, en 매뉴얼 `SharpTalk Integrated User Manual`, Swagger `btbz-SharpTalk API`, manifest `SharpTalk` |
| 스테이징 B | Dockerfile 필터 `@sharptalk/*`로 4개 이미지 재빌드, api healthy·`successfully started`, `/api/v1/health` ok, `/`·`/widget/`·`/app/` 200 |
| 임베드 계약 | `embed.js` 무변경(diff 0), `window.ShopTalk`·`x-shoptalk-token`·`__SHOPTALK_CONFIG__` 참조 10곳 그대로 |

## 측면 영향 실측
- **S-1 위젯 기본 제목**: 스테이징 테넌트 14곳 중 `widget_copy.displayName`을 설정한 곳은 1곳(hrv-tata)뿐 → 나머지 13곳의 위젯 헤더가 `IVY USA`→`SharpTalk`으로 바뀜(D-6 의도). 테넌트별 이름을 원하면 설정 → 위젯 문구에서 지정.
- **S-3 다른 워크트리**: B 머지 이후 `node_modules/@ivy` 링크가 깨짐 → `rm -rf node_modules/@ivy && npm install`.
- **AGENTS.md·`.agents/skills/`**: 저장소 비추적 로컬 파일(다른 도구 생성)로 확인 — PLN의 "두 트리 리네임" 항목은 해당 없음, 미수정.

## 함정 (예방 패턴)
1. 일괄 치환 정규식은 API 식별자(`window.ShopTalk`, `ShopTalk.q`, `ShopTalkAndroid`)를 보호하되 **문장 끝 마침표·CJK 조사에 붙은 표시명**은 치환해야 한다. 첫 패스가 `ShopTalk.`·`ShopTalk은`을 건너뛰어 2차 패스가 필요했다.
2. `git ls-files`는 한글 파일명을 8진 이스케이프로 출력 → 스크립트가 `docs/guide` 한글 파일 8개를 통째로 건너뛰었다. `-c core.quotepath=false` 필수.
3. `otpauth://totp/ShopTalk:` 라벨은 `/` 뒤라 보호 규칙에 걸려 spec 2건이 실패 — 테스트가 검출.

## 남은 단계 (별도 PLN)
C 인프라 이름(볼륨 이전·DB명·`ivy.events`, 다운타임) · C' 도메인 전환(`sharptalk.amoeba.site`/`sharptalk.btbz.ai` — 9/9 현재 미응답, vhost·TLS·`APP_PUBLIC_URL`·Shopify/Cafe24 콜백) · D 외부 계약(영구 별칭 권고) · 매뉴얼 스크린샷 36장 재캡처.
