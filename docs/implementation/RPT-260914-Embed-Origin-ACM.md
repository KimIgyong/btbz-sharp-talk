# RPT-260914 — ACM 포털(`acm.amoeba.site`) 임베드 오리진 등록 실행 보고

- 근거: 사용자 직접 지시(요구사항, 2026-09-14) — 코드 변경이 없는 **운영 설정 변경**이라 REQ/PLN 단계 없음
- 대상: 스테이징 `shoptalk.amoeba.site` · 테넌트 **12 (tpi)** · `tenants.embed_origins`
- PR: 본 문서(기록만). 코드/스키마 diff 없음

## 1. 확인 결과 — 등록돼 있지 않았다
ACM 포털 랜딩페이지는 SharpTalk 위젯을 `shop: "tpi.co.kr"` 로 띄운다(같은 호스트
211.110.140.172의 `acm-prod-frontend` 컨테이너, 로더 스크립트는 2026-09-14 기준 배포 전).
로더가 `POST /api/v1/session/ensure` 에 `parent_origin` 을 실어 보내므로 부모 오리진
`https://acm.amoeba.site` 가 해당 테넌트의 허용목록에 있어야 한다.

점검 시점 테넌트 12의 `embed_origins` 는 `NULL` 이었다.

⚠️ `NULL` 은 "전부 허용"이 아니라 **`shop_domain`/`storefront_url` 로 해석되는 기본값**이다
(`domain/embed/embed-origin.util.ts` `defaultOrigins`). 즉 실효 목록은 `["https://tpi.co.kr"]`
뿐이었고 `acm.amoeba.site` 는 포함되지 않았다.

| 테넌트 | shop_domain | 저장값 | 실효 허용목록 |
|---|---|---|---|
| 12 tpi (변경 전) | `tpi.co.kr` | NULL | `https://tpi.co.kr` |
| 12 tpi (변경 후) | `tpi.co.kr` | `["https://tpi.co.kr","https://acm.amoeba.site"]` | 좌동 |

## 2. 무엇을 했나
스테이징 `db_sharptalk` 에 직접 적용(`sharptalk_mysql_staging`):

```sql
UPDATE tenants
   SET embed_origins = JSON_ARRAY('https://tpi.co.kr', 'https://acm.amoeba.site')
 WHERE id = 12;   -- 1 row
```

기존 기본값 `https://tpi.co.kr` 를 **함께** 넣었다. 목록을 처음 저장하는 순간 암묵적
기본값이 사라지므로(`embedOrigins?.length ? embedOrigins : defaultOrigins()`), 이걸 빼면
정작 자기 스토어프런트가 차단 대상이 된다.

**콘솔 경로를 쓰지 못한 이유**: `PATCH /api/v1/tenants/embed-origins` 는
`@RequireRank(MASTER, DIRECTOR)` 의 테넌트 본인 전용이고, 시스템 어드민이 남의 테넌트
허용목록을 고치는 라우트는 없다. 테넌트 12의 유일한 사용자 `fremd@naver.com` 은
`invited`(미활성) 상태라 로그인이 불가했다. 그래서 이번 변경은 `audit_logs` 의
`tenant.embed_origins_updated` 가 남지 않는다 — 그 기록이 본 문서다.

## 3. 검증 (스테이징 실서버)
| 요청 `parent_origin` | 응답 | API 로그 |
|---|---|---|
| `https://acm.amoeba.site` | 201 | 경고 없음 = **허용** |
| `https://example.invalid` (대조군) | 201 | `embed origin not allowed (tenant 12, origin https://example.invalid) — observe mode, allowing` |

대조군이 경고를 남기므로 "게이트가 꺼져서 조용한 것"이 아니라 실제로 목록이 적용됐음을 확인.
(검증 과정에서 테넌트 12에 빈 세션 2건(8741·8742)이 생성됐다 — 메시지 없음, 방치)

## 4. 함께 확인된 사항 (이번 범위 밖, 조치 안 함)
1. **관측 모드**: 스테이징에 `EMBED_ORIGIN_ENFORCE` 가 없어 위반 오리진도 경고만 남기고
   통과한다. 즉 이번 등록이 없었어도 위젯은 떴다 — 반대로 **"위젯이 뜬다 ≠ 등록돼 있다"**.
   enforce 를 켜는 시점이 진짜 분기점이다.
2. **apex/www 미스매치 3건** — 최근 1주 로그: `www.gif2box.vn`(12), `www.annehearts.com`(3),
   `www.skyliving.vn`(2). 셋 다 apex만 등록돼 있고 실사이트는 www 다. `https://*.x` 와일드카드는
   apex를 포함하지 않으므로 둘 다 넣어야 한다. enforce 를 켜면 이 세 테넌트 위젯이 죽는다.
   tpi 도 실사이트는 `www.tpi.co.kr` 이라 그쪽에도 붙일 계획이면 추가가 필요하다.
3. **프로덕션 재등록 필요** — 이 값은 코드가 아니라 DB 행이라 신규 프로비저닝
   (PLN-260913-Production-Provisioning-Deploy)에 자동으로 따라가지 않는다.
