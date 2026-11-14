Functions 새 운영 후보 — 배포 전 검토 (2026-11-13 UTC)

현재 상태
- 로컬 구현·격리 검사만 실행. 유료 리소스 생성, API 활성화, IAM/Rules/운영 데이터 변경, Git/Pages 게시는 실행하지 않았다.
- 프로젝트 hero-defense-3d-independent / DB (default) / 신규 경로 hd3d_live_server/state/{hd3d_table}/{rowId}.
- 기존 root 데이터, direct 후보 경로 hd3d_live, 기존 Sites/PC/Git main/Pages/stag를 보존한다. 이관·삭제·백업은 재개하지 않는다.
- 브라우저 apiUrl은 빈 값, functionsActivation=pending-deployment. 서버는 HD3D_LIVE_ENABLED=true 전까지 비활성이다. 추측한 URL로 활성화하지 않는다.

보안과 기능
- Functions 전용 handler는 server/economy.mjs를 사용한다. 일반 저장으로 영혼석·재료·장비·상자·도감·해금·연구를 덮어쓸 수 없다.
- 일반 저장은 표시 설정 및 서버가 단계별 소유권·가격·상한을 계산한 영구 강화 묶음만 받는다. 성장 캐시는 클라이언트 값으로 덮어쓰지 않는다.
- 일반/도전 귀환은 소유한 완료 run과 연결하며 서버가 재화·아이템 추첨·첫 클리어·별 보상을 계산한다. 지급과 영수증을 같은 트랜잭션으로 저장한다.
- 장비/제작/재연마/연구/교환/우편/던전 구매는 전용 서버 처리와 영수증으로 실행한다. 중복 요청 및 응답 유실 후 재시도에서 다시 지급/차감되지 않는다.
- 정상 추첨 확률/가격/하드 보상 내용은 유지한다. Functions 로그인 계정의 일반 보스 장비는 서버 정산 시 결정되어 현장에서 클라이언트가 추측한 등급을 먼저 알리는 효과는 표시하지 않는다. 기존 결과·상자 UI가 실제 지급 결과를 표시한다. 게스트/기존 Worker는 그대로다.
- 서버는 전투 전체를 재현하지 않는다. 시간/웨이브/처치 상한 안의 허위 전투·별 신고는 여전히 가능하다. 임의 잔액 덮어쓰기 및 추첨 결과 지정 차단과 완전한 전투 치트 방지는 구분한다.

배포 계획 — 미실행
1. 기존 거부를 우회하지 않는 정상 권한으로 Functions API, Run, Build, Artifact Registry, Auth, Firestore 및 기존 gameApi 상태를 확인한다. API 활성화/IAM 변경은 자동 수행하지 않는다.
2. 기존 후보 runtime 계정 runtime-fixture@hero-defense-3d-independent.iam.gserviceaccount.com의 실제 존재·datastore 권한과 deployer actAs를 확인한다. 새 키는 만들지 않는다.
3. 검수한 cloud-functions 소스만 배포한다. Node22 / asia-northeast3 / 256MiB / 1CPU / concurrency8 / min0 / max3 / timeout180초. firebase.json은 Functions 전용이며 Rules/Hosting을 배포하지 않는다. 런타임58모듈을 game-manifest.json과 대조한다.
4. 비활성 revision/URL/구성/소스를 확인한다. 운영 UID를 정상 확인한 뒤 승인된 관리자 owner@example.invalid의 create-only 관리자 계획을 적용한다. 이메일 자동 승격은 없다. 직접 Rules용 카탈로그/activation 문서는 필요 없다.
5. 승인된 새 경로 시험에서 로그인·소유권·보상·재시도·실 Firestore 저장을 확인한 후 서버/정적 클라이언트를 활성화한다. 새 Git 저장소 hero-defense-3d-live 게시와 URL은 별도 확인한다. 기존 저장소/stag는 교체하지 않는다.
6. 롤백은 새 정적 버전과 endpoint 비활성화다. 새 영수증/저장을 보존하고, 기존 Worker로 저장을 보내거나 데이터를 삭제하지 않는다.

공식 가격 근거와 계산 한계
- Blaze 필요. min0는 cold start를 허용하고 max3은 월 요금 상한이 아니다. 공개 HTTP 함수의 앱 인증 실패 요청도 실행 비용을 만들 수 있다.
- Cloud Run 요청 기반 무료 크레딧: 월200만 요청, CPU180,000vCPU초, 메모리360,000GiB초. us-central1 기본가격 기준 금액 크레딧으로 결제계정의 다른 사용량과 공유한다. 서울은 Tier2여서 같은 무료 시간을 보장하지 않는다.
- 공식 가격 페이지에서 Seoul (asia-northeast3)를 선택해 확인한 요청 기반 단가: 요청100만 회당 $0.40, CPU초당 $0.0000336, GiB초당 $0.0000035. 무료 크레딧은 CPU $4.32/메모리 $0.90/요청 $0.80에 해당한다. 예: 1CPU/256MiB, 월100만 요청, 단독실행0.2초/요청이면 CPU200,000초/메모리50,000GiB초이며 무료 크레딧이 모두 남아 있을 때 서울 계산은 약 $2.40. DB·네트워크·빌드·세금은 제외하고 실제 응답 시간 측정도 아니다. 동시 처리와 초기화/과금 시간에 따라 달라지며 배포 직전 남은 크레딧을 확인한다.
- Firestore Standard 무료 대상 DB 한 곳: 하루 읽기50,000/쓰기20,000/삭제20,000, 저장1GiB, 송신10GiB/월. 기존 게임과 공유하고 일일 할당량은 태평양 시간으로 초기화된다. 공식 페이지의 Seoul (asia-northeast3) 초과 단가: 10만 문서당 읽기$0.038/쓰기$0.115/삭제$0.013. 무료량 소진 뒤 읽기10만+쓰기10만 예시는 $0.153. 인덱스·송신·저장은 별도이며 HTTP 호출을 청구 문서 읽기 횟수로 부르지 않는다.
- Cloud Build 기본 e2-standard-2: 월2,500분 프로모션 무료(변경 가능), 이후 $0.006/분. 무료분 소진 후10분 빌드는 $0.06. 실제 Functions 빌드 머신/시간은 미확인이다.
- Artifact Registry: 결제계정 합계0.5GiB까지 무료, 이후 약 $0.10/GiB·월($0.000136986/GiB·시간). 총1GiB 한 달 보관은 약 $0.05 초과 저장료 예시. 이미지 누적·소스 버킷·로그·송신도 비용 요인이다. 보관정책은 변경하지 않았다.
- 현재 사용량/서비스/IAM/운영 지연은 미조회다. 과거 읽기8,743은 현재 잔여량이 아니다. 신규 리소스나 예상하지 못한 과금 작업을 시작하지 않았다.

공식 출처 — 2026-11-13 확인
https://firebase.google.com/docs/functions/get-started
https://cloud.google.com/run/pricing
https://cloud.google.com/firestore/pricing
https://cloud.google.com/build/pricing
https://cloud.google.com/artifact-registry/pricing
