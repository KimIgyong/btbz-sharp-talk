# PLN-260909 — 프로젝트명 btbz-SharpTalk 통일, 1차(A 표시명·문서 + B 내부 식별자)

REQ: `docs/analysis/REQ-260909-Project-Rename-SharpTalk.md` — 결정 반영:
D-1 영문 `SharpTalk` · 전체 `btbz-SharpTalk` · **한국어 `샵톡`(유지)** · 슬러그 `sharptalk` /
D-2 `@sharptalk/*` / D-3 기술 접두어(`ivy_`·`ivy:`·`--ivy-*`·DOM id) 제외 / D-4 도메인 `shoptalk.amoeba.site` 유지
(`sharptalk.amoeba.site`·`sharptalk.btbz.ai`는 설정만 완료, 2026-09-09 현재 응답 없음 → C'에서 전환) /
D-5 스크린샷 재캡처 제외 / **D-6 미답 → 권고안(IVY USA 문자열을 제품명으로 대체) 적용 가정, 승인 시 확정**.

**UI 영향**: 레이아웃·동작 변경 없음, 문자열 치환만. 변경되는 화면 3곳:

```
┌ 콘솔 사이드바 ─────────┐   ┌ 로그인 셸 ───────────────┐   ┌ 위젯 헤더(기본 제목) ─────┐
│ ● SharpTalk          │   │      SharpTalk            │   │ SharpTalk           [—][×]│
│   (was: ShopTalk)    │   │  Console sign-in          │   │ (was: IVY USA)             │
│ 대시보드 / 라이브챗 … │   │  (was: ShopTalk)          │   │ 테넌트 widget_copy 설정 시 │
└──────────────────────┘   └───────────────────────────┘   │ 그 값이 우선 — 변경 없음    │
                                                            └────────────────────────────┘
브라우저 탭: "SharpTalk Console" · 위젯 "SharpTalk" · PWA "SharpTalk"(manifest name "btbz-SharpTalk")
```

## 이름 매핑 (치환 사전)

| 현재 | 새 값 | 적용 범위 |
|---|---|---|
| `ShopTalk` / `Shop Talk` / `shopTalk` | `SharpTalk` | 표시 문자열·문서 |
| `IVY USA Chat & Support Widget`, `IVY USA Chat & Customer Support Widget`, `IVY TalkTalk`, `IVY USA — Shopping TalkTalk` | `btbz-SharpTalk` (설명문에는 "btbz-SharpTalk — chat & support widget") | 제목·헤더 주석·README·Swagger |
| `IVY USA TalkTalk`(Cafe24/Shopify 설정 안내) | `SharpTalk` | i18n settings.json 6로케일 |
| `[IVY USA]`(근무시간외 메일 제목) · `[ShopTalk]`(Gorgias 제목·임시비번 메일) | `[SharpTalk]` | 백엔드 문자열 |
| 위젯 `appName: 'IVY USA'` | `'SharpTalk'` (D-6) | 위젯 i18n 6로케일 — 테넌트 `widget_copy` 설정이 있으면 무영향 |
| 위젯 `contact.email: help@ivy.com` | **유지**(플레이스홀더, 실제 주소 미정) | — |
| AI 기본 페르소나 "Ivy … IVY USA" | "SharpTalk 어시스턴트" 중립 문안 (D-6, 신규 테넌트 기본값에만 영향) | `ai-config.service.ts` |
| TOTP issuer `ShopTalk` | `SharpTalk` (신규 등록분만 라벨 변경, 검증 무관) | `mfa.service.ts` |
| `샵톡` | **유지** | 한국어 매뉴얼·i18n |
| `@ivy/{api,web,widget,pwa,mobile,types,common}` | `@sharptalk/*` | package.json 8 · import 257파일 · jest mapper 6 · Dockerfile `--filter` 11 · 루트 npm 스크립트 3 · 문서 |
| `@ivy/shoptalk-rn`, `packages/shoptalk-rn/` | `@sharptalk/react-native`, `packages/sharptalk-rn/` (private, 미배포) | 디렉터리·package.json·README |
| 루트 `"name": "ivy-talktalk"` | `"btbz-sharptalk"` | package.json |
| 스킬 `ivy-talktalk-dev` | `sharptalk-dev` (`.claude/skills` + `.agents/skills` 둘 다, `AGENTS.md`의 `.Codex/skills/…` 경로는 존재하지 않는 경로 → `.agents/skills/…`로 정정) | 4파일 + 디렉터리 2 |
| 워크트리 홈 `~/orca/worktrees/ivyusa-talktalk` | `~/orca/worktrees/btbz-sharptalk` (기존 워크트리는 `SESSION_WORKTREE_HOME`로 계속 접근 가능, S-4) | `scripts/session-worktree.sh` |
| env 템플릿 예시 도메인 `ivy-talktalk.example.com` | `sharptalk.example.com` | `.env.*.example`(라이브 env 아님) |
| 비밀번호 블록리스트 | `sharptalk`, `btbz` **추가**(기존 항목 유지) | api·web 2파일 |
| GitHub 저장소 설명문 | "btbz-SharpTalk — multi-tenant chat & support widget (NestJS + React)" | `gh repo edit` |

**바꾸지 않음(D-3·REQ T4~T6)**: `ivy_*` 컨테이너·볼륨·DB명·사용자, localStorage 키, `ivy:*` 프로토콜, `--ivy-*` CSS 토큰,
`ivy-talktalk-frame` iframe id, `[ivy-widget]` 로그 접두어, `IVY_WIDGET_CONFIG`/`window.ShopTalk`/`__SHOPTALK_CONFIG__`/`embed.js`,
`/apps/ivy`, Android 네임스페이스·클래스·AAR명, Expo 번들 id, Gorgias 헤더·태그, 시드 슬러그 `ivyusa`, `kb-policy-*.json`,
`ivy.events`, 도메인·콜백 URL, 역사 문서 239파일, `design/screens` 파일명, CHANGELOG 과거 항목.

## 단계

### Stage A-1 — 앱 표시 문자열 (0.5일)
- 콘솔 i18n 6로케일: `landing.json` `settings.json` `aiSetting.json` `auth.json` `tenants.json`(`ivyusa` 예시 → `sharptalk`)
- 위젯·PWA·모바일 i18n 6로케일 × 3 (`appName`, `app.title`, 온보딩)
- 하드코딩: `Sidebar.tsx` `AuthShell.tsx` `LandingPage.tsx` `Storefront.tsx` · `index.html` 3 · `manifest.webmanifest` · `apple-mobile-web-app-title` · `webview-test.html`/`embed-test.html` 제목 · `MfaSettings.tsx` 다운로드 파일명 `sharptalk-mfa-recovery-codes.txt`
- 백엔드: Swagger 제목 · 메일 제목 3종 · Gorgias 제목 · 어댑터 오류문구 · `@ApiOperation` · AI 기본 페르소나 · TOTP issuer
- 블록리스트 추가 2파일
- `npm run i18n:check`

### Stage A-2 — 살아있는 문서 (1.0일)
- 루트 8: `CLAUDE.md` `AGENTS.md` `SPEC.md` `README.md` `CONFIG.md` `docs/PROJECT-ARTIFACT-INDEX.md` + `CHANGELOG.md`에 개명 항목 **추가**(과거 항목 불변) + `README.docx`는 재생성 대신 "README.md 참조" 각주로 대체 여부 확인
- `docs/guide/` 32파일: 제품명 치환 + **사실 정정** (`DEPLOYMENT-STRATEGY.md`의 저장소 URL `btbz-sharp-talk`, 서버 경로는 현행 그대로 `ivyusa-shopping-talktalk` 유지 명시)
- 매뉴얼 사이트 `apps/web/public/manual/` 22파일: en/vi의 `ShopTalk`→`SharpTalk`, ko `샵톡` 유지, footer 도메인 유지; 스크린샷 각주 "화면 이미지의 구 명칭은 순차 갱신"
- 스킬 2트리 리네임 + 본문(`pre-deploy-check`의 컨테이너·DB명은 사실이므로 유지)
- docker 헤더 주석 20파일, env 템플릿 예시 도메인
- 스테이징 `docker cp`로 매뉴얼 즉시 반영은 배포에 포함되므로 불필요

### Stage B — 내부 식별자 (1.0일)
1. `packages/shoptalk-rn` → `packages/sharptalk-rn` (git mv)
2. package.json 8개 name/deps → `@sharptalk/*`; 루트 name
3. `git grep -l "@ivy/"` 257파일 일괄 치환(`sed`), jest mapper, Dockerfile 11, 루트 npm 스크립트
4. `rm -rf node_modules/@ivy && npm install`(워크스페이스 링크 재생성) → `turbo typecheck/build/test` 전체
5. `scripts/session-worktree.sh` 홈 경로

### Stage C — 검증·배포·문서 (0.5일)
- 로컬: `npm run i18n:check` · `npm run typecheck` · `npm run build` · api/web/widget 단위 테스트
- PR 1(A) → CI → 머지 → 스테이징 배포(api·web·widget·pwa 재빌드) → 확인: 탭 제목 3종, 사이드바, Swagger `/api/v1/docs` 제목, `/manual/` en 페이지, 임베드 스니펫이 여전히 `IVY_WIDGET_CONFIG`(불변) 인지
- PR 2(B) → CI → 머지 → 스테이징 배포 → **부팅 확인**(Dockerfile 필터 변경) → 위젯/PWA 정상
- `gh repo edit --description`
- RPT-260909-Project-Rename + CLAUDE.md/메모리 갱신

## 측면 영향

| # | 영향 | 판단 |
|---|---|---|
| S-1 | 위젯 기본 제목 `IVY USA`→`SharpTalk`: `widget_copy`를 설정하지 않은 테넌트의 고객 화면 제목이 바뀜 | 의도(D-6). 스테이징 테넌트별 설정 여부 배포 전 조회해 RPT에 기록 |
| S-2 | `@ivy/*` 치환 중 누락 | CI typecheck/build가 검출; Dockerfile 필터 누락은 **부팅 실패**로만 드러남 → 배포 후 부팅 로그 필수 |
| S-3 | 다른 세션의 열린 워크트리가 `@ivy/*` 상태 — B 머지 후 `npm install` 필요 | 메모리 기록(라이브챗 스크롤 메모의 같은 함정) |
| S-4 | 워크트리 홈 변경으로 기존 `~/orca/worktrees/ivyusa-talktalk/*`가 `list`에서 사라짐 | 스크립트에 구 경로도 함께 나열(폴백) 또는 디렉터리 이동 안내 |
| S-5 | `AGENTS.md`가 존재하지 않는 `.Codex/skills` 경로 참조 중 | 이번에 `.agents/skills`로 정정 |
| S-6 | 메일 제목 `[SharpTalk]`: 고객 메일함 필터에 `[IVY USA]`가 걸려 있었다면 불일치 | 고지 불필요(스테이징) |
| S-7 | CHANGELOG·역사 문서·PR 본문의 구 명칭 잔존 | 정책상 유지, README에 "구 명칭 ShopTalk/IVY TalkTalk = 동일 제품" 한 줄 |
| S-8 | 새 도메인 2종 미응답 | 1차 무관; C'에서 vhost·TLS·`APP_PUBLIC_URL`·콜백 재등록과 함께 |

## 롤백
PR 단위 revert. B는 `npm install` 재실행 동반. 데이터·외부 등록 변경이 없으므로 롤백 비용은 재배포 1회.

## 승인 요청
- 매핑 사전(특히 D-6 가정: 위젯 기본 제목·메일 제목·AI 기본 페르소나의 `IVY USA` → `SharpTalk`)
- RN 패키지명 `@sharptalk/react-native`, 스킬명 `sharptalk-dev`, 워크트리 홈 `btbz-sharptalk`
- 총 3.0인일, PR 2건(A, B) 분리 진행
