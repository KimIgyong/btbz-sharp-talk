# TCR-260911 — P4: 정적 라이브 파일 · 설정 스냅샷 · 디자인 패키지 이관

- 근거: `docs/plan/PLN-260910-Tenant-Asset-Store-Widget-Design.md` §2.3
- 환경: 로컬 dev(API dist, 콘솔 :5173, 위젯 :5175 로컬 API), ivyusa(dev@, master); 스테이징은 배포 후 nginx 정적 서빙 실측

## 1. 단위 테스트
| ID | 대상 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| U-1 | `WidgetLiveService` | 대소문자 섞인 shop·범위 밖 디자인 | 소문자 파일명, 정규화된 테마(panel 480×600)·updatedAt | PASS |
| U-2 | 〃 | `../etc/passwd`·`a/b`·null 키, 쓸 수 없는 경로 | 키 null, publish는 throw 없이 종료 | PASS |
| U-3 | `SettingsSnapshotService.create` | 시크릿 필드가 있는 테넌트 | JSON에 `SECRET`/`TOKEN` 없음, 12필드+디자인 목록(active 표시), area settings/kind settings_snapshot | PASS |
| U-4 | `diff`·`restore` | 스냅샷 후 timezone 변경·디자인 삭제·활성 해제 | diff가 timezone만 changed·디자인 create 표시; restore 후 timezone 복원·디자인 재생성·활성 복원·live publish·감사 | PASS |
| U-5 | `WidgetDesignService.exportPackage/importPackage` | 커스텀 폰트 디자인 | 패키지에 base64 폰트; import가 `assets.store`(내용 검증)로 재생성·이름 `(2)`·ref 교체; 잘못된 포맷 E5003 | PASS |
| U-6 | apply → live publish | | `live.publish(tenant)` 호출 | PASS |
| 합계 | tenant 3 spec + tenant-asset 1 spec = 14 tests | | | PASS |

## 2. 정적 검사
| 검사 | 결과 |
|---|---|
| `tsc` api / widget / web | PASS |
| `i18n:check` | complete |
| nginx.conf(staging) `nginx -t` (docker nginx:alpine) | successful; self-hosted/production 동일 location 삽입 |
| 실부팅 | `successfully started` |

## 3. API (curl, 로컬)
| ID | 요청 | 기대 | 결과 |
|---|---|---|---|
| I-1 | POST /settings-snapshots {label} | kind settings_snapshot, area settings, public=false, 서명 URL | PASS |
| I-2 | 드리프트(timezone 변경·디자인 apply) → GET :uuid/diff | fields changed=[timezone], designs 목록(update/active) | PASS |
| I-3 | 디자인 apply 후 볼륨 | `.uploads/widget-live/ivyusa.myshopify.com.json` 생성, theme.design.panel 반영 | PASS |
| I-4 | POST :uuid/restore | timezone 스냅샷 값으로, 활성 디자인 스냅샷대로, 라이브 파일 갱신 | PASS |
| I-5 | GET /widget-designs/:id/export | `Content-Disposition: attachment; filename*=…sharptalk-widget.json`, format/name/assets | PASS |
| I-6 | POST /widget-designs/import (multipart) | 새 디자인 "봄 시즌 (2)" | PASS |
| I-7 | 서명 다운로드 URL | 200 | PASS |
| I-8 | DELETE 스냅샷 | deleted | PASS |

## 4. 콘솔
| ID | 검사 | 결과 |
|---|---|---|
| C-1 | 설정 > 기타 "설정 스냅샷" 카드: 라벨 입력·[스냅샷 저장]·목록(라벨·시각·크기)·[다운로드]·[복원…]·[삭제]·시크릿 미포함 안내 | PASS(저장 토스트·행 생성) |
| C-2 | [복원…] → diff 모달(12필드 현재/스냅샷·변경 행 강조·디자인 요약 "생성 0 · 갱신 4 · 복원 후 사용함: 봄 시즌") | PASS |
| C-3 | 커스텀 위젯 카드 [패키지 가져오기]/행 [내보내기] | 코드 검토 PASS(API I-5·I-6 실측) |

## 5. 스테이징 (배포 후)
| ID | 검사 | 결과 |
|---|---|---|
| S-1 | nginx가 uploads 볼륨 ro 마운트, `GET /widget-design/live/{shop}.json` → 200 json, `Cache-Control: no-cache`, 없는 shop 404 | 배포 후 |
| S-2 | 위젯 페이지에서 정적 파일 fetch 발생·적용(캐시 제거 후 첫 페인트) | 배포 후 |

## 6. 엣지
| 케이스 | 처리 |
|---|---|
| 정적 파일 쓰기 실패(볼륨 없음) | warn 로그, 저장은 성공(파일은 가속기일 뿐) |
| 스냅샷 파일 손상/포맷 불일치 | E5003 |
| 패키지 자산이 내용 검증 실패 | 업로드와 동일 E5081~ |
| 스냅샷 상한(settings 20MB) | E5084 |
