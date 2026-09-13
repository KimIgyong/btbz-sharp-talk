# RPT-260913 — 커스텀 위젯 만들기 매뉴얼 실행 보고

- 근거: REQ/PLN-260913-Custom-Widget-Manual (승인 "기본안으로 진행" 2026-09-13) · TCR-260913-Custom-Widget-Manual
- PR: **#517** (squash → main `1058a41`, 2026-09-13)

## 1. 산출물
| 파일 | 내용 |
|---|---|
| `apps/web/public/manual/custom-widget.{ko,en,vi}.md` | 원본 ko(약 290행) + en/vi 번역. 0 기본 vs 커스텀 → 1 디자인 파일 → 2 편집기 → 3 미리보기·사용함·기본 복귀 → 4 이력·복제·보관·패키지·스냅샷(되돌리기 3수단 비교표) → 5 정제 CSS(안정 클래스 13종·허용/제거 규칙·[검사]) → 6 플랫폼 관리자 → 7 체크리스트 → 8 FAQ 8건 |
| `custom-widget.{ko,en,vi}.html` | 변환기 산출(기존 템플릿과 동일 레이아웃: pagenav·hero·toc·section·callout·figure·dl.faq) |
| `img/cw-{design-files,library,editor,preview,history,css,snapshot-diff,admin-addon}.{ko,en}.jpg` | 16장, 로컬 콘솔 데모 데이터(vi html은 en 이미지) |
| `index.html` | 카드 05 + STR c5t/c5d/c5a 3언어, 부제 3권→5권 |
| `user-manual.{ko,en,vi}.{md,html}` | §14 위젯 설정 셀 끝 "상세: 커스텀 위젯 만들기 매뉴얼" 링크 |
| `scripts/manual-md2html.mjs` | 매뉴얼 md 서브셋(제목·메타·섹션·h3·표·ul/ol·체크리스트·코드·그림·💡/⚠️ 콜아웃·FAQ) → html. head/style은 `knowledge-ai.{lang}.html`에서 복사, 문서별 문자열은 `DOC_META` |

## 2. 작성 방식
- 코드 기준 사실 대조 11항목(TCR §1). 초안 1건 정정: 같은 파일 재업로드는 버전 증가가 아니라 새 행.
- 캡처는 `ivy_auth` 주입 Playwright(비밀번호 타이핑 없음). 로컬 애드온 ON으로 CSS 화면 캡처 후 OFF 원복.
- html은 수작업 대신 변환기 사용 — 이후 현행화는 md 수정 → `node scripts/manual-md2html.mjs apps/web/public/manual/custom-widget.<lang>.md`.

## 3. 검증
- 정적: 7개 html 태그 균형, 참조 이미지·링크 전부 존재, 마크다운 잔여 0, STR 3언어.
- 렌더(로컬): index 카드 05, ko top/ch2/ch5/ch8, en ch3, vi top/ch4 정상.
- CI "typecheck · test · build" pass.

## 4. 배포 상태
| 항목 | 상태 |
|---|---|
| SQL | 없음 |
| staging | main `1058a41` 배포 2026-09-13: API `successfully started`, web 컨테이너 신규. `/manual/` 200(c5t 4회), `custom-widget.{ko,en,vi}.html` 200, `.md` text/markdown 200, 이미지 image/jpeg 200, ko 9섹션, 통합 매뉴얼 §14 링크 1 |
| production | 미배포(정적 파일이라 web 이미지 재빌드만 필요) |

## 5. 잔여·후속
- en/vi는 AI 번역 초안(index notice 유지) — 원어민 검수 시 md만 고치고 변환기 재실행.
- 기존 4권은 아직 수작업 html — 다음 현행화 때 변환기 적용 여부 검토(템플릿 head 재사용은 이미 호환).
- 스토어프런트 도메인 미설정 테넌트는 미리보기 불가 — 매뉴얼 FAQ에 기재.
