# deploy/profiles — 배포 프로필 (PLN-260913)

한 디렉터리 = 한 별칭(`SharpTalk-{CC | CC-Customer}`) = 한 국가 배포(스테이징 + 프로덕션). 코드는 언제나 `main`(SharpTalk-Basic)이고, 여기에는 **값 없는 템플릿과 체크리스트만** 둡니다.

| 파일 | 용도 |
|---|---|
| `.env.<별칭>.example` | `docker/self-hosted/.env.self-hosted.example`에서 파생, 프로필 차이만 반영. 실제 env는 서버의 `docker/self-hosted/.env.self-hosted`(gitignored) |
| `secrets.template.md` | `secrets/<별칭>-server.md`(gitignored)의 구조. 값은 절대 커밋하지 않음 |
| `CHECKLIST.md` | 결정 → 설치 → 어드민 초기화 → 테넌트 이관 → 국가 커스터마이징 → 운영 |
| `tenant-snapshot.example.json` | 테넌트 설정 12항목의 예시(수동 입력 대조용). 실제 스냅샷은 원본 환경에서 다운로드 |

가이드: `docs/guide/GUIDE-260913-SharpTalk-Basic-Setup.md` → `GUIDE-260913-Locale-Customization.md` → 국가 가이드.
새 국가를 추가하려면 디렉터리를 복사하고 별칭·도메인·프로필 값을 바꾼 뒤 국가 가이드를 씁니다.
