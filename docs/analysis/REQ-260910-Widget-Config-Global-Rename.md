# REQ-260910 — 위젯 설치 스니펫 전역명 개편 (SHARPTALK_WIDGET_CONFIG) + 테넌트별 디자인 커스텀 방향

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-10 |
| 요청 | 설치 스니펫의 `window.IVY_WIDGET_CONFIG`를 `window.SHARPTALK_WIDGET_CONFIG`로 변경. 또는 `window.{tenant}_WIDGET_CONFIG` 테넌트별 전역 검토. 방향성 = 테넌트별 위젯 디자인 개별 커스텀 |
| 유형 | 요구사항 (REQ→PLN→승인→구현) |
| 배경 | 리포 리네임(btbz-sharp-talk, 9/8)과 함께 브랜드 축이 IVY→SharpTalk으로 이동 중 |

## 1. AS-IS

### 1.1 전역명이 실제로 하는 일

설치 스니펫의 전역은 **같은 페이지의 두 `<script>` 태그 사이에서 설정을 전달하는
우편함**입니다. 테넌트 식별은 전역 *이름*이 아니라 **내용물**(`shop` 도메인 → 서버의
테넌트 해석, `agent` 코드, 임베드 오리진 검증)이 담당합니다.

### 1.2 현재 노출·소비 지점 (전수)

| 지점 | 내용 |
|---|---|
| `apps/widget/public/embed.js` | 유일한 소비자. `window.IVY_WIDGET_CONFIG` 읽기(97행) + 로드 시 자동 부팅(819행). **이미 2번째 설치 경로 존재**: `window.ShopTalk` API(`init()`·큐 `ShopTalk.q`·open/identify 등) — 전역 설정 없이도 구동 가능 |
| 콘솔 스니펫 생성기 | `SettingsPage.tsx`(설치 가이드 4종: Shopify/Cafe24/Odoo/Woo) + `AgentsSection.tsx`(에이전트 진입점 스니펫) |
| 테스트 | `embed-loader.spec.ts` — "IVY_WIDGET_CONFIG must keep working (ivyusa and amoebaorder both run it)" 계약 명시 |
| 문서 | `docs/guide` 8종(쇼피파이 3종·임베드SDK·GA4·테스트계정 등) + `embed-test.html` |
| 비노출 | `/manual` 사이트·모바일 SDK(`?mode=app` 경로 사용)·API 서버 — 전역명 무관 |

### 1.3 제약 — 이미 설치된 실몰 스니펫

**ivyusa·amoebaorder(Cafe24)·go2joy 등 실제 상점 페이지에 구 스니펫이 이미 박혀
있습니다.** 상점 테마는 우리가 재배포할 수 없으므로, 구 전역명이 깨지는 변경은
**전 고객 위젯 동시 소멸**입니다. 어떤 안이든 구명 폴백은 필수입니다.

### 1.4 테넌트별 디자인 커스텀의 현주소

이미 **서버 주도**로 동작합니다: 테넌트 콘솔(위젯 설정 탭)의 브랜드 색(9단 램프+
자동 대비)·헤더·로고·런처(위치/크기/아이콘)·탭 구성·인사말(6언어)이 `session/ensure`
응답으로 위젯에 적용됩니다. 에이전트별 표시명·첫 응답 메시지 오버라이드도 있습니다.
즉 **디자인 커스텀의 전달 축은 스니펫이 아니라 테넌트 설정**이며, 스니펫은 이 값들을
전혀 담지 않습니다.

## 2. 선택지 분석

### A. `SHARPTALK_WIDGET_CONFIG` 고정 전역 + 구명 영구 폴백 — **권장**

- 로더가 `SHARPTALK_WIDGET_CONFIG || IVY_WIDGET_CONFIG` 순으로 읽음. 기존 설치 무중단.
- 업계 관례와 일치(Intercom `intercomSettings`, Channel.io 부트 설정 — **전역명은
  제품당 하나**, 테넌트 구분은 내용물).
- embed.js가 전 테넌트 공용 정적 파일로 남음 → CDN/immutable 캐시·자체 호스팅 패키지
  구조 불변.

### B. `window.{tenant}_WIDGET_CONFIG` — **비권장**

- 이름에 테넌트를 넣어도 **새 정보가 없음**(내용물의 `shop`이 이미 테넌트를 확정).
- 로더가 "어느 전역을 읽을지"를 알 수 없게 됨 → ① window 전수 스캔(타 스크립트와
  충돌·오탐, `*_WIDGET_CONFIG` 우연 일치 시 오동작) 또는 ② 테넌트별 embed.js 생성
  (정적 파일이 동적 산출물이 되어 캐시 무효화·자체 호스팅·버전 관리 전부 복잡해짐).
- 테넌트 슬러그가 JS 식별자 제약(하이픈 불가 등)과 충돌 — `go2joy-vn` 같은 슬러그는
  변환 규칙이 또 필요.
- 이 방식이 유일하게 해결하는 시나리오(한 페이지에 두 테넌트 위젯)는 전역이 아니라
  **기존 `ShopTalk.init()` 호출형 API의 다중 인스턴스 확장**이 올바른 자리이며,
  현재 수요 없음(필요 시 별도 REQ).

### C. 디자인 커스텀 확장 (방향성 응답)

스니펫은 "어느 상점·어느 에이전트인가"만 말하고, **생김새는 전부 테넌트 설정에서**
내려오는 현 구조가 맞습니다 — 커스텀을 깊게 할수록 스니펫이 아니라 **테마 토큰을
넓히는 것**이 확장 지점입니다. 후보(별도 REQ로 분리 권장):
모서리 반경·말풍선 색 분리·폰트·패널 배경/일러스트·런처 배지문구·CSS 변수 노출.
임의 커스텀 CSS 주입은 iframe 내부 스타일 오염·지원 부담·XSS 표면이라 **큐레이션된
토큰 우선, 자유 CSS는 보류**를 권장.

## 3. TO-BE (권장안 A 기준)

1. 표준 전역명 `window.SHARPTALK_WIDGET_CONFIG`. 로더는 신명→구명 순 폴백(영구 유지,
   구명 사용 시 콘솔 1회 deprecation 안내). JS API도 `window.SharpTalk` = `window.ShopTalk`
   별칭 동시 노출(동일 객체).
2. 콘솔 스니펫 생성기 5곳·가이드 문서·embed-test가 신명으로 통일. 문서에 "구명도 계속
   동작" 1줄 명시.
3. `ivy:*` postMessage 프리픽스·`ivy_*` localStorage 키·`ivy_auth_popup` 창명은
   **로더↔위젯 내부 계약**이라 유지(외부 노출 아님 — 바꿔도 사용자 가치 0, 회귀 위험만).

## 4. 미결정 (사용자 확인)

- **O1. 브랜드 표기**: 전역명은 요청대로 `SHARPTALK`으로 하되, 화면 표기 브랜드
  (콘솔 "ShopTalk", 도메인 shoptalk.amoeba.site)의 SharpTalk 전환 여부·시점은 별도
  결정 사항 — 이 REQ 범위 밖으로 둠.
- **O2. 디자인 토큰 확장(§2-C)**: 진행 시 별도 REQ/PLN로 분리.
