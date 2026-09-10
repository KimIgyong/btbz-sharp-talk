# PLN-260910 — SHARPTALK_WIDGET_CONFIG 전역명 개편 구현 계획

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-10 |
| 근거 | REQ-260910-Widget-Config-Global-Rename (권장안 A: 고정 전역 + 구명 영구 폴백) |
| UI 영향 | **화면 구조 변경 없음** — 기존 설치 가이드/에이전트 카드 안의 스니펫 문자열만 교체 (ASCII 와이어프레임 해당 없음) |
| 스키마 영향 | 없음 (Migration 섹션 불요) |

## 단계

### S1 — 로더(embed.js) 이중 수용
- `var cfg = window.SHARPTALK_WIDGET_CONFIG || window.IVY_WIDGET_CONFIG || {};`
- 부팅 조건도 두 전역 모두 인정. 구명만 있을 때 `console.info` 1회 deprecation 안내
  (동작은 영구 보장 — 실몰 ivyusa·amoebaorder·go2joy 스니펫 무중단).
- API 별칭: `window.SharpTalk = window.ShopTalk`(동일 객체, 큐 포함). 파일 머리주석 갱신.
- `embed-loader.spec.ts`: 기존 "IVY_WIDGET_CONFIG must keep working" 계약 **유지** +
  신명 계약 추가(신명 단독/구명 단독/둘 다일 때 신명 우선).

### S2 — 콘솔 스니펫 생성기 교체
- `SettingsPage.tsx` 설치 가이드 4종(Shopify/Cafe24/Odoo/Woo) + `AgentsSection.tsx`
  에이전트 진입점 스니펫 → `SHARPTALK_WIDGET_CONFIG`로 통일.
- `apps/widget/public/embed-test.html` 신명으로 갱신(폴백 확인용 구명 케이스 1개 병기).

### S3 — 문서 갱신
- `docs/guide` 8종(쇼피파이 3종·임베드SDK·GA4·테스트계정 등)의 스니펫 예시를 신명으로,
  각 1줄 "기존 `IVY_WIDGET_CONFIG` 설치도 계속 동작합니다" 병기.
- 기존 배포된 상점에는 **재설치 불필요**임을 임베드SDK 가이드에 명시.

### S4 — 검증·배포
- 단위: embed-loader.spec(신·구·우선순위 3케이스). 수동: 로컬 위젯에서 신명 스니펫,
  구명 스니펫 각각 부팅 확인.
- 스테이징 배포(widget·web 재빌드) 후: ① 신명 데모 페이지 부팅 ② **기존 go2joy/
  amoebaorder 실몰 위젯이 그대로 뜨는지**(구명 폴백 실증) ③ 콘솔 설치 가이드가 신명
  스니펫을 보여주는지. TCR/RPT 작성.

## 측면 영향

- embed.js는 정적 파일이라 캐시된 구버전 로더 + 신명 스니펫 조합이 잠시 존재 가능
  (신명을 못 읽음). embed.js에 Cache-Control이 없다는 기존 관찰([[one-shot-flag]] 메모)
  → 배포 직후 콘솔 스니펫 안내가 앞서갈 수 있으므로 **S1(로더)을 먼저 배포하고 S2
  (스니펫 생성기)를 같은 배포에 포함**하면 순서 문제 없음(같은 스택 동시 재빌드).
- 자체 호스팅 패키지는 같은 embed.js를 쓰므로 추가 작업 없음.
- `ivy:*` 내부 프로토콜·localStorage 키는 불변 — 위젯/SDK 회귀 없음.

## 범위 밖 (별도 결정)

- 테넌트별 전역명(REQ §2-B에서 비권장 사유 상술) · 디자인 토큰 확장(REQ §2-C, O2) ·
  브랜드 표기 전환(O1).

## 승인 요청

권장안 A + S1~S4 진행 승인을 요청합니다.
