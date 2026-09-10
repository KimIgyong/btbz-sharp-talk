# TCR-260910 — SHARPTALK_WIDGET_CONFIG 전역명 개편 검증

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-10 |
| 근거 | REQ/PLN-260910 · PR #493 (main `bccb445`) |

## 1. 단위 (embed-loader.spec — 13/13 통과)

| # | 계약 | 결과 |
|---|---|---|
| T1 | 구명 단독 설치가 계속 부팅 (`SHARPTALK || IVY` 부팅 조건) | ✅ |
| T2 | 읽기 우선순위: 신명 우선, 구명 폴백 (`var cfg = …` 리터럴) | ✅ |
| T3 | `window.SharpTalk === window.ShopTalk` 단일 객체 별칭 | ✅ |
| T4~13 | 기존 SDK 계약 10건(파싱·메서드·큐·오리진·sandbox 등) 무회귀 | ✅ |

## 2. 로컬 실측 (Playwright · embed-test 하니스)

| 케이스 | 결과 |
|---|---|
| 신명 스니펫 | iframe 마운트 ✅ · deprecation 로그 0 ✅ · `SharpTalk.init` 존재 ✅ |
| 구명 스니펫 (`?legacy=1`) | iframe 마운트 ✅ · deprecation 로그 정확히 1회 ✅ |

## 3. 스테이징 실측 (배포 `bccb445`, 2026-09-10)

- 부팅 로그 `successfully started` 1 · api/web/widget 컨테이너 신선(Up 초 단위) ✅
- `https://shoptalk.amoeba.site/widget/embed.js` 에 `SHARPTALK_WIDGET_CONFIG` 10회 —
  신버전 서빙 확인(Cache-Control no-cache 경로) ✅
- **배포 로더 대상 end-to-end**: go2joy의 실제 스니펫 구성(shop=go2joy.vn,
  agent=landing-guest)을 구명/신명 각각으로 로드 →
  두 경우 모두 iframe 마운트 + **위젯 앱 내부 렌더링**(iframe 내 DOM 노드 확인),
  구명 케이스만 안내 로그 1회 ✅
- 콘솔 설치 가이드(테넌트 설정 → 위젯 설정 탭)가 신명 스니펫 표시 — web 재빌드에 포함 ✅

## 4. 편차·관찰

- **go2joy.vn 원페이지 직접 접속은 이 네트워크에서 불가**(타임아웃 — 지역/봇 차단
  추정). 계약 검증은 배포 로더 + 동일 구성 합성 페이지로 대체(§3) — 로더 계약상 등가.
  실몰 화면 최종 확인은 접속 가능한 환경에서 1회 권장.
- 루트 `https://shoptalk.amoeba.site/embed.js`는 **원래부터 로더가 아님** — nginx에
  라우트가 없어 SPA index.html 폴백(text/html)이 200으로 응답. 실설치 경로는 전부
  `/widget/embed.js`라 회귀 아님. 문서·스니펫도 모두 `/widget/embed.js`만 안내함.
