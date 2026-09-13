# SharpTalk-KR-Production — 컷오버 체크리스트

가이드: `docs/guide/PRODUCTION-CUTOVER.md` · `GUIDE-260913-SharpTalk-Basic-Setup.md` · PLN-260913-Production-Provisioning-Deploy

## P0 사용자 (서버 없이 Claude 진행 불가)
- [ ] 호스트 생성: 8 vCPU / 16GB / 200GB SSD, Ubuntu 24.04, 공인 IP, 인바운드 22·80·443
- [ ] DNS: `sharptalk.amoeba.site` A → <IP> (TTL 300), `dig +short sharptalk.amoeba.site`로 확인
- [ ] `secrets/SharpTalk-KR-Production-server.md` 작성(템플릿 `secrets.template.md`): 접속·실 키·certbot 메일
- [ ] 이관 창(1~2시간) 공지: 스테이징 테넌트 설정 동결

## P2 Claude — 서버 접속 후
- [ ] `sudo bash scripts/provision-host.sh --domain sharptalk.amoeba.site --email <ops> --check` → 실행
- [ ] `docker version`·`ufw status`·`nginx -t`·인증서 만료일
- [ ] 배포 사용자로 클론(`main` 검증 SHA) → 프로필 env 복사 → `gen-secrets.sh` → 실 키 이동
- [ ] `deploy-self-hosted.sh --check` 통과 → 배포 → `/api/v1/health` ok · `/`·`/widget/`·`/manual/` 200 · `widget-config.js` 프로덕션 API · `successfully started`
- [ ] `check-migrations.sh` OK(init-sql 완전)
- [ ] `production` 브랜치 생성(검증 SHA) → 서버 체크아웃 전환
- [ ] **사용자**: admin@·dev@ 첫 로그인 비밀번호 변경 → Claude: `SEED_ON_BOOT=false` 재배포

## P3 컷오버
- [ ] **사용자**: 어드민 > AI 엔진 Anthropic 등록·활성(키 입력)
- [ ] 테넌트 ivyusa 정정·go2joy 생성, 요금제·제공 메뉴·애드온
- [ ] 관리자 초대(임시 비밀번호 전달은 사용자)
- [ ] 테넌트 이관: 설정 13항목(타임존·기본 언어 포함) 수동 입력 · 커스텀 위젯 패키지 · KB 라운드트립+재색인 · 핸드오프·AI 설정
- [ ] **사용자**: 연동 자격증명 재입력(Shopify 재설치·Klaviyo·Yotpo·Gorgias·Notion·Haravan) → 연결 테스트
- [ ] Shopify Partner: App URL·콜백에 프로덕션 오리진 추가, 웹훅 4종+필수 3종 재등록
- [ ] 임베드 시크릿 재발급 → 스토어 테마 스니펫·모바일 SDK 갱신
- [ ] 스모크: 컷오버 §4 10항목 + Basic §9
- [ ] 백업 1회(`backup-self-hosted.sh`) → 오프호스트 복사, 복원 리허설 일정
- [ ] `MFA_ENFORCE_FROM` 설정(계정 발급 +14일) → 재배포
- [ ] 문서: CONFIG §6/§7 · DEPLOYMENT-STRATEGY §1/§9 · CUTOVER §0 · secrets 로그 · RPT
