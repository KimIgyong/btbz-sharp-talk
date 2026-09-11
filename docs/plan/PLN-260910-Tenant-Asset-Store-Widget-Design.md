# PLN-260910 — 테넌트 자산 저장소 + 위젯 디자인 프로필 (최적안)

- 근거: `docs/analysis/REQ-260910-Tenant-Asset-Store-Widget-Design.md`
- 상태: **P0·P1 승인·완료(PR #505, RPT-260911)**. P2 이후는 단계별 승인 후 PR.

## 0. 대안 비교와 선택

| 안 | 내용 | 장점 | 단점/리스크 | 판정 |
|---|---|---|---|---|
| A. **자산 저장소 + 디자인 프로필(토큰)** | 테넌트 루트 규약·등록부 테이블·범용 자산 API + `widget_theme`를 폰트·크기·아이콘 토큰으로 확장 + 설정 스냅샷 | 단일 위젯 빌드·보안 경계 유지, 로고 모델의 자연 확장, 테넌트 단위 백업·삭제 가능, 단계 분리 가능 | 스키마 1테이블, 로더/위젯 프레임 합의 필요 | **채택** |
| B. 토큰만 확장(파일 없음) | 폰트 프리셋·크기·모서리만 JSON에 추가 | 가장 빠름(1~2일) | "파일 저장·관리"·"테넌트 폴더" 요구 미충족, 커스텀 폰트·아이콘 불가 | A의 P2로 흡수 |
| C. 테넌트별 테마 번들(CSS/JS/템플릿 업로드) | 파일로 디자인을 통째로 교체 | 무한 자유도 | iframe이 API 오리진과 동일 → 토큰·API 접근 벡터, 위젯 업데이트마다 테넌트 CSS 깨짐(지원 비용), svg 금지 결정과 모순 | **기각** |
| C′. 정제 CSS(허용목록) 옵션 | 토큰으로 부족한 테넌트에 한해 속성 허용목록 CSS 1파일(≤32KB) — `url()`·`@import`·`position:fixed`·`content`·선택자 외부 참조 금지, 서버 파서(css-tree)로 정규화 후 저장 | 자유도 보강, 배포 무관 | 위젯 업데이트 시 클래스 변경으로 깨질 수 있음(안정 클래스 `st-*` 계약 필요), 유출 벡터 차단을 파서가 책임 | **P4 옵션**(기본 OFF, 테넌트 플래그) |
| D. 테넌트별 위젯 빌드 분리 | 테넌트마다 SPA 빌드·배포 | 완전 분리 | 빌드·보안패치·회귀가 테넌트 수만큼, SDK/앱모드/릴레이 계약 분기 | **기각**(REQ §2.1 c) |

**2차 요구("백엔드·배포와 분리")는 A안에 흡수**: 디자인=테넌트 데이터+자산, 적용=데이터 전환, 코드 배포 불필요. 정적 라이브 파일(D-14)로 서빙까지 API에서 분리.
**3차 요구("커스텀 위젯 만들기·사용함·복귀·보관")로 라이브 판정 모델 교체**: 선형 버전(구 D-12) → **커스텀 위젯 라이브러리 + 활성 포인터**(D-12′, REQ §2.2 비교 ②).

## 1. 설계 결정

| # | 결정 | 내용 |
|---|---|---|
| D-1 | 테넌트 루트 규약 | `UPLOAD_DIR/tenants/{tenantId}/{area}/{uuid}.{ext}`, `area ∈ {design, settings}`(확장 가능: `branding`은 후속 수렴). **기존 경로 이동 없음**(REQ SI-2) |
| D-2 | 등록부 | 신규 테이블 `tenant_assets`(id bigint, uuid char36 uniq, tenant_id, area, kind[font/icon/image/doc/settings_snapshot], filename, mime, ext, size, sha256, width/height nullable, storage_path, version int, label varchar, created_by, created_at, deleted_at) + `(tenant_id, area)` 인덱스. 삭제=soft(파일은 참조 0일 때 unlink — 보드 첨부의 참조 카운트 자세) |
| D-3 | 검증 | kind별: font=woff2/ttf/otf ≤2MB(매직바이트), icon=png/webp ≤256KB·≤512px(sharp 재인코딩·정사각 권장), image=png/jpg/webp ≤2MB·≤2000px, doc=pdf/png/jpg ≤10MB(참고용·미적용), settings_snapshot=서버 생성 JSON만. **svg·css·js·html 거부**. 테넌트 상한 design 50MB / settings 20MB(E5081~E5085 신규 블록) |
| D-4 | 서빙 | 공개 자산(font/icon/image): `GET /tenants/widget-branding/asset/{uuid}?v={version}` `@Public`, `v` 일치 시 `immutable`, 폰트는 `Access-Control-Allow-Origin: *` + `Cross-Origin-Resource-Policy: cross-origin`(iframe 오리진≠호스트 스토어 오리진 대비). 비공개(doc/snapshot): 서명 URL 15분(첨부 `signFileUrl` 재사용) |
| D-5 | 디자인 프로필 | `widget_theme` JSON 확장(스키마 변경 없음): `font{ preset: 'pretendard'\|'noto-sans-kr'\|'inter'\|'system'\|'custom', assetId?, baseSize: 13~16 }`, `radius: 'sm'\|'md'\|'lg'`, `panel{ width: 360~480, height: 560~760 }`, `icons{ launcher?: assetId, tabs?: {[tab]: assetId} }`. 정규화는 범위 밖 값을 **기본값으로 낙하**(색과 달리 테마 전체를 버리지 않음 — 로고/런처 자세) |
| D-6 | 위젯 적용 | `buildThemeVariables`에 `--ivy-font-family`·`--ivy-font-size-base`·`--ivy-radius`·`--ivy-panel-w/h` 추가; 커스텀 폰트는 위젯이 `@font-face`(`font-display: swap`)를 동적 삽입. 런처/탭 아이콘은 `<img>`로 교체(마스크 없음, 원본 색 그대로) |
| D-7 | 로더 프레임 합의 | 위젯 → 로더 `ivy:launcher` 메시지에 `frame:{w,h}` 동봉, 로더는 `OPEN = {w:min(frame.w+40,100vw), h:min(frame.h,100vh)}`로 계산·shop별 캐시(런처와 같은 키 묶음). 앱모드(`?mode=app`) 무시 |
| D-8 | 설정 스냅샷 | `POST /tenants/settings/snapshots` → 화이트리스트 필드(widget_theme·widget_copy·widget_tabs·widget_tab_position·notification_channels·embed_origins·usage_guides_enabled·timezone·widget_login_mode) + 자산 매니페스트(uuid·sha256)를 JSON으로 `settings/`에 저장(등록부 kind=settings_snapshot, label). `GET …/snapshots`, `GET …/snapshots/:id/download`(서명), `POST …/snapshots/:id/restore` = 미리보기(diff) 후 적용, 감사 `tenant.settings_restored`. **자격증명·시크릿 제외** |
| D-9 | 권한·감사 | 업로드/삭제/스냅샷: `@RequireRank(MASTER, DIRECTOR)`; 목록: 동일; 공개 자산: `@Public`. 모든 변경 `AuditService.write` |
| D-10 | 콘솔 | 설정 > 위젯: [디자인 파일] 카드(신규) + 위젯 테마 카드 확장(폰트·크기·모서리·패널·아이콘) + 미리보기 반영. 설정 > 기타: [설정 스냅샷] 카드(신규). i18n 6언어 |
| D-11 | 어드민(선택, P3) | 테넌트 목록에 자산 용량 컬럼·상한 조정(요금제 축) |
| D-12′ | **커스텀 위젯 라이브러리(3차, 구 D-12 대체)** | 신규 테이블 `widget_designs`(id, tenant_id, name varchar64, design_json[폰트·글자크기·모서리·패널·아이콘·(P5)정제CSS], asset_manifest json, status active/ready/archived, note, created_by, updated_by, applied_at, created_at, updated_at; `(tenant_id, name)` uniq) + `tenants.active_widget_design_id bigint NULL`(NULL=**기본 위젯**). 세션/정적 파일의 테마 = `normalize(basicTheme ⊕ activeDesign.design_json)`(커스텀은 기본 위에 덮는 초과분, REQ SI-17). [사용함]=포인터 전환+감사 `tenant.widget_design_applied`, [기본 위젯으로 복귀]=NULL+감사, [복제]=새 행, [보관]=archived(활성이면 거부 E508x), [복원]=ready, [삭제]=soft(활성 거부). 적용 중 디자인 저장 시 즉시 반영 → 저장 전 경고 + "복제 후 편집" 권장 |
| D-13 | **디자인 패키지 이관(2차)** | `GET /tenants/widget-designs/:id/export`(zip: design.json + assets/…) / `POST /tenants/widget-designs/import`(zip → 자산 등록 + 새 디자인(ready) 생성, 미리보기 후 [사용함]). 다른 테넌트·환경으로 복제 가능. 스냅샷(D-8)과 분리: 스냅샷은 설정 전체, 패키지는 위젯 디자인만 |
| D-14 | **정적 라이브 파일(2차, 선택 b)** | [사용함]/[복귀]/기본 테마 저장 시 API가 `tenants/{id}/widget/live/design.json`(정규화 결과+자산 URL)을 기록. nginx `location /widget-design/{slug}/live.json` → 볼륨 직접 서빙(`no-cache`), 자산은 버전 URL immutable. 로더가 `?shop`으로 먼저 읽어 첫 페인트 → API 부팅·세션 왕복과 무관. 세션 응답 `widgetTheme`는 동일 값(단일 쓰기 경로) |
| D-15 | **미리보기(2차)** | 콘솔 미리보기 iframe에 `?preview=<token>`로 **선택한 디자인(미적용 포함)** 주입(서명 토큰 10분, master/director 발급) — 고객에게는 노출되지 않음 |

## 2. 단계

| 단계 | 범위 | 산출 | 완료 기준 |
|---|---|---|---|
| **P1 자산 저장소** | D-1~D-4, D-9, 콘솔 [디자인 파일] 카드, SQL `tenant_assets` | API `tenant-asset` 모듈(서비스·컨트롤러·매퍼·spec), 콘솔 카드, 마이그레이션 | 업로드→목록→공개 URL immutable→삭제 왕복, 상한·거부 코드, 실부팅 |
| **P2 디자인 프로필** | D-5~D-7, 테마 카드 확장·미리보기, 위젯·로더 | types 정규화·spec, 위젯 CSS 변수/`@font-face`/아이콘, 로더 `frame` 계약 테스트 | 프리셋·커스텀 폰트·크기·패널 크기가 스테이징 실제 스토어 임베드에서 반영, 구 캐시 호환 |
| **P3 커스텀 위젯 라이브러리·이관(3차)** | D-12′·D-13·D-15, SQL `widget_designs` + `tenants.active_widget_design_id`, 콘솔 [커스텀 위젯] 카드(만들기·미리보기·사용함·복귀·복제·보관·복원·삭제), 패키지 zip | API `widget-design` 모듈·spec, 콘솔 카드 | 만들기→미리보기→[사용함]→고객 위젯 반영(배포 없음)→[기본 복귀]→다른 디자인 [사용함] 왕복, 활성 삭제/보관 거부, zip 내보내기→다른 테넌트 가져오기 |
| **P4 정적 라이브 파일 + 설정 스냅샷** | D-14(nginx 위치·로더 선읽기)·D-8, (선택) 어드민 용량 | nginx conf·로더 계약 테스트, snapshots API·카드 | API 중지 상태에서도 위젯 첫 페인트가 테넌트 디자인, 스냅샷 왕복 |
| **P5 정제 CSS 옵션(선택)** | C′ — 플래그·파서·안정 클래스 계약 | sanitizer spec(유출 벡터 케이스), 카드 | 금지 구문 전부 거부, 허용 CSS만 적용 |

예상 규모: P0 0.5일 · P1 2일 · P2 2~3일 · P3 2일 · P4 1.5일 · P5 2일(선택). 각 단계 착수 시 세부 PLN 보강·승인, TCR/RPT 동반.

## 2.1 P2 세부 (착수 시 보강, 2026-09-11)

| # | 항목 | 내용 |
|---|---|---|
| P2-1 | 계약 | `WidgetTheme.design?: { font{preset: pretendard\|noto-sans-kr\|inter\|system\|custom, asset?{uuid,version}, baseSize 13~16}, radius sm\|md\|lg, panel{width 360~480, height 480~720}, launcherIcon?{uuid,version} }` + `LAUNCHER_ICON.custom`. 정규화는 범위 밖 값을 기본값으로 낙하, 파일 없는 custom은 pretendard/chat으로 낙하 |
| P2-2 | 토큰 | `--ivy-font-family`, `--ivy-root-size`(=16×baseSize/14 → rem 글자·간격 동시 스케일), `--ivy-radius`(패널 모서리), `--ivy-panel-w/h`(데스크톱 패널). 위젯 `index.css`가 폴백값으로 종전 값을 유지 |
| P2-3 | 폰트 소스 | custom → `@font-face 'IvyTenantFont'`(공개 자산 URL, `font-display: swap`) 동적 삽입; noto-sans-kr/inter → Google Fonts `<link>`; system → 시스템 스택. 재적용 시 태그 중복 없음 |
| P2-4 | 로더 계약 | `ivy:launcher` 메시지에 `frame{w,h}`(패널+40/+80) 동봉 → 로더가 `OPEN` 계산·shop별 캐시. 로더도 400~520 / 560~800으로 클램프 |
| P2-5 | API | `PATCH /tenants/widget-theme` `design`(snake) — 절대 없음=유지, null=삭제, 객체=교체. 자산 uuid는 테넌트 소유·kind(font/icon) 검증(`TenantAssetService`, 옵셔널 주입) |
| P2-6 | 콘솔 | 위젯 테마 카드에 폰트(프리셋/업로드)·기본 크기·모서리·패널 폭/높이·런처 "업로드한 아이콘" 추가, 미리보기에 폰트·크기·모서리·아이콘 반영 |
| P2-7 | 범위 밖 | 말풍선 모서리(패널 모서리만), 탭 아이콘, 에디터 모드 기억 |

## 2.2 P3 세부 (착수 시 보강, 2026-09-11)

| # | 항목 | 내용 |
|---|---|---|
| P3-1 | 데이터 | `widget_designs`(tenant_id, name uniq, design_json, status ready/archived, note, applied_at …) + `tenants.active_widget_design_id`(NULL=기본 위젯). 라이브 = 포인터 + `widget_theme.design` 사본(세션/위젯/정적 파일 계약 무변경) |
| P3-2 | 기본 위젯 | 위젯 테마 카드 = 색·헤더·로고·런처만(P2에서 카드에 넣었던 폰트·크기·모서리·패널·아이콘 항목은 커스텀 위젯 편집기로 이동). 복귀 = 포인터 null + design 제거 → 브랜드색·로고·런처 enum 유지 |
| P3-3 | API | `/widget-designs` GET·POST·PATCH :id·POST :id/apply·POST revert·POST :id/duplicate·:id/archive·:id/restore·:id/preview-token·DELETE :id (master/director, 감사). 라이브 디자인 archive/delete = **E5086**, 이름 중복 = **E5087**. 공개 `GET /public/widget/preview-theme?token=` |
| P3-4 | 미리보기 | 토큰 = `tenant.design.exp.HMAC`(10분, `signFileUrl` 재사용). 위젯이 `?preview=` 를 보면 세션 테마 위에 덮어 그림(캐시 안 함). 콘솔 [미리보기]는 실제 위젯 iframe |
| P3-5 | 런처 아이콘 | `design.launcherIcon`이 있으면 launcher enum과 무관하게 이미지 — 복귀 시 enum 아이콘으로 자연 복원 |
| P3-6 | 보류 | D-13 패키지 zip 내보내기/가져오기 — zip 라이브러리 미도입, P4로 이월 |

## 3. 백엔드 작업 (P1 기준, P2/P3는 단계 착수 시 상세화)

| # | 파일 | 작업 |
|---|---|---|
| B-1 | `sql/2609xx-tenant-assets.sql` + `docker/init-sql/01-schema.sql` + manifest | D-2 테이블 (P3에서 `widget_design_versions` 추가) |
| B-2 | `domain/tenant-asset/entity/tenant-asset.entity.ts` | 엔티티(nullable 컬럼 `type` 명시) |
| B-3 | `domain/tenant-asset/tenant-asset.service.ts` | 저장 루트 `tenants/{id}/{area}`, kind별 검증(sharp·매직바이트), 상한 집계, soft delete+참조 카운트 unlink |
| B-4 | `domain/tenant-asset/tenant-asset.controller.ts` | `GET/POST /tenant-assets?area=`, `DELETE /tenant-assets/:uuid`(`/tenants/:uuid` 라우트 포획 회피 — RPT-260911), 공개 `GET /public/widget/asset/:uuid` |
| B-5 | `global/constant/error-code.constant.ts` | E5081~E5085(형식·크기·픽셀·상한·kind) |
| B-6 | `tenant.module.ts`/`app.module.ts` | 모듈 등록 |
| B-7 | spec | 검증 6케이스·상한·immutable 헤더·참조 카운트 |

## 4. 콘솔 작업 (P1)

| # | 파일 | 작업 |
|---|---|---|
| W-1 | `settings/DesignAssetsCard.tsx`(신규) · `SettingsWidgetPage.tsx` | 업로드(드래그·다중)·kind 탭·목록(썸네일/폰트 미리보기 텍스트)·용량 게이지·삭제·URL 복사 |
| W-2 | `settings/settings.service.ts`·`hooks` | assets/list/upload/remove |
| W-3 | i18n 6언어 | `settings.designAssets.*` |

## 5. UI 와이어프레임

### 5.1 설정 > 위젯 — 디자인 파일 (P1)
```
┌ 디자인 파일 ─────────────────────────── 12.4 / 50 MB ▓▓░░░░░░ ┐
│ [폰트] [아이콘] [이미지] [시안·가이드]              [파일 추가 ▲] │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Aa  BrandSans-Regular.woff2   폰트  212 KB  v3  9/10  [URL][🗑] │ │
│ │ 🖼  launcher-heart.png         아이콘 24 KB  v1  9/10  [URL][🗑] │ │
│ │ 📄  IVY-Widget-Guide.pdf      시안  3.1 MB  v1  9/9   [↓][🗑]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ · 폰트 woff2/ttf/otf ≤2MB · 아이콘 png/webp ≤256KB ≤512px · svg/css/js 불가 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 설정 > 위젯 — 위젯 테마 카드 확장 (P2)
```
┌ 위젯 테마 ─────────────────────────────────────────────────────┐
│ 브랜드색 [#2B7FFF]  헤더 (●흰색 ○브랜드)  로고 [업로드]   (기존)   │
│ 런처   위치 (○왼쪽 ●오른쪽) 크기 (○sm ●md ○lg)                   │
│        아이콘 (○chat ○question ○headset ○로고 ●업로드: launcher-heart.png ▾) │
│ 폰트   (●프리셋 Pretendard ▾ ○업로드 BrandSans ▾)  기본 크기 [14 ▾]px │
│ 모서리 (○sm ●md ○lg)                                              │
│ 패널   폭 [404 ▾] px (360~480)   높이 [680 ▾] px (560~760)         │
│ ┌ 미리보기 ───────────────────┐  ※ 모바일·앱모드는 화면 크기를 따릅니다 │
│ │ (브랜드색·폰트·크기·아이콘 반영) │                                     │
│ └─────────────────────────────┘                          [저장]    │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2′ 설정 > 위젯 — 커스텀 위젯 (P3)
```
┌ 커스텀 위젯 ──────────────────────── 현재: ● 커스텀 "블랙프라이데이" 사용 중  [기본 위젯으로 복귀] ┐
│ [＋ 커스텀 위젯 만들기]  [패키지 가져오기]                                                   │
│ 이름              | 폰트/크기      | 패널     | 아이콘 | 수정   | 상태   | 동작                       │
│ 블랙프라이데이     | BrandSans 14  | 420×700 | ♥      | 9/10  | 사용 중 | [편집▲경고][복제][미리보기][내보내기] │
│ 봄 시즌           | Pretendard 15 | 404×680 | chat   | 9/8   | 보관됨 | [사용함][복제][미리보기][보관][삭제]  │
│ 기본 확장(폰트만)  | Noto Sans KR  | 기본     | 기본   | 9/1   | 보관함 | [복원][삭제]                     │
│ · 사용함이 없으면 '위젯 테마' 카드의 기본 위젯이 노출됩니다. 사용 중인 디자인은 보관·삭제할 수 없습니다   │
└──────────────────────────────────────────────────────────────────────────────────────────┘

[커스텀 위젯 만들기 / 편집]  (모달 또는 하위 화면)
┌ 이름 [블랙프라이데이_______]                                                              ┐
│ 폰트 (●프리셋 Pretendard ▾ ○업로드 BrandSans ▾)  기본 크기 [14 ▾]px  모서리 (○sm ●md ○lg)    │
│ 패널 폭 [420 ▾] 높이 [700 ▾]   런처 아이콘 (○기본 ●업로드 launcher-heart.png ▾)  탭 아이콘 …  │
│ (P5) 정제 CSS [텍스트 영역 — 허용 속성만, url/@import 불가]                                   │
│ ┌ 미리보기(실제 위젯 iframe, 이 디자인 주입) ┐                                                 │
│ └────────────────────────────────────────┘      [취소]  [저장(보관함)]  [저장 후 사용함]        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 설정 > 기타 — 설정 스냅샷 (P4)
```
┌ 설정 스냅샷 ───────────────────────────── [지금 내보내기] ┐
│ 이름 | 생성일 | 크기 | 항목 | 동작                            │
│ 2026-09-10 배포 전 | 9/10 11:20 | 8 KB | 테마·문구·탭·알림·오리진 | [↓][복원] │
│ 복원 → 변경 항목 diff 미리보기 모달 → [적용]                    │
│ · 연동 자격증명·임베드 시크릿은 포함되지 않습니다                   │
└──────────────────────────────────────────────────────────┘
```

## 6. 측면 영향 (REQ §4 대응 요약)
| 항목 | 대응 |
|---|---|
| 볼륨(SI-1) | **P0(선행, 별건 FIX)**: production compose에 API uploads 볼륨·`UPLOAD_DIR` 추가 — 실측상 현재 누락. `pre-deploy-check` 항목 추가 |
| 기존 경로(SI-2) | 무이동. 로고 서비스는 P2에서 등록부 참조로 수렴 검토(경로 유지) |
| 캐시 스큐(SI-3) | optional 필드+기본값, 정규화 미지 필드 무시(기존) |
| 프레임(SI-4) | D-7 메시지 계약 + 로더 계약 테스트 |
| 보안(SI-5) | svg/css/js 거부, 폰트만 CORS, sharp 재인코딩, `@Public`은 공개 kind만 |
| 첫 페인트(SI-6) | `font-display: swap`, 테마 캐시에 폰트 URL 포함 |
| 프라이버시(SI-8) | 스냅샷 화이트리스트, 시크릿 제외 spec |
| 적용·복구(SI-13/16/17) | 활성 포인터 전환·기본 복귀 1클릭·감사, 활성 디자인 보관/삭제 거부, 기본 위젯=위젯 테마 카드(회귀 없음), 미적용 디자인 미리보기 토큰 |
| 정적 서빙(SI-14/15) | 쓰기 경로는 API 하나, 라이브 파일 no-cache·자산 immutable, 로더 선읽기 후 세션 값과 동일 |

## 7. 리스크
- **테넌트 상한과 볼륨 총량**: 상한은 코드에 두되 값은 env(`TENANT_ASSET_QUOTA_MB`)로 — 요금제 연동은 P3 어드민에서.
- **커스텀 폰트 라이선스**: 업로드한 폰트의 웹 배포 권리는 테넌트 책임 — 업로드 UI에 고지 문구.
- **아이콘 마스킹 불가**: 업로드 아이콘은 브랜드색 마스크가 적용되지 않으므로(원본 색), 미리보기에서 확인하도록 안내.
- **로더 프레임 상한**: 480×760 초과는 모바일 클리핑·스토어 UI 가림 → 범위를 강제(요청값이 아니라 정규화값 적용).

## 8. 범위 밖 (기록)
- 자유 CSS/JS·테마 번들(기각 C안), 테넌트별 위젯 별도 빌드/배포, 이미지 CDN, 기존 첨부·보드·인제스트 경로 이관,
  Figma 연동 자동 토큰 추출.
