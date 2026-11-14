# Git 인계 — 직접 저장 연결 준비

사용자 확정: 하드는 **저장 방식만** 노멀과 같게 한다. 수량·확률·첫 클리어 보장·목표 상자와 추가 상자는 그대로다. 21차 구현을 유지했다.

## 확인된 Git 대상

2026-11-10 GitHub connector 읽기 결과:
- `https://github.com/hyunjk11/hero-defense-3d.git` (public).
- 기본 `main`, HEAD `ff0b997c596305a8876991f8ca02bdb66878489d`, tree `dc4f57b211b6d9a27cc756d03be80b906aa0a428`.
- 연결 계정 hyunjk11, 기술적 pull/push/admin 권한 있음. 원격 704개 tree entry에 AGENTS.md/.agents/.github 없음.
- 사용자 요청에 따라 `firebase-direct-review` 검토 브랜치에 22차 소스를 게시한다. 게시 직전 해당 브랜치는 존재하지 않았다. main 교체·강제 푸시·병합·Pages 배포는 포함하지 않는다.
- 기존 main을 부모 커밋으로 사용하고 원격 전용 13개 파일과 이력을 보존한다. 게시 확인 결과와 재현 명령은 [PUBLICATION.md](PUBLICATION.md)에 기록한다.

원격은 v34보다 이전 게임이다. 원격에만 있는 13개 파일은 삭제 대상으로 처리하지 않았다. 옛 Supabase 설정, unique.js, 하드/초월 검사·문서가 포함된다. 이 파일들은 기존 main 바이트 그대로 보존한다. Git 검토 브랜치 업로드는 실행 가능한 서비스 전환 완료를 뜻하지 않는다. 운영 및 Pages는 변경하지 않는다.

## Sites 실행 의존 제거

- cloud.js의 Sites 주소를 없애고 firestore-direct를 기본 모드로 지정했다. 실제 Web public config와 프로젝트 hero-defense-3d-independent, Auth 도메인 hero-defense-3d-independent.firebaseapp.com, DB (default)는 v34 값을 재사용했다. 11월4일 기록은 Standard/Native, asia-northeast3이며 이번 실제 설정 재조회·변경은 없다.
- 모든 직접 저장은 공식 `https://firestore.googleapis.com/v1/projects/hero-defense-3d-independent/databases/(default)/documents`를 같은 resolver에서 받는다. 잘못된 설정은 요청 전에 거부하고 Sites로 돌아가지 않는다.
- 기본 directActivation:'pending-rules-and-data'는 게시 전 보류 상태다. 승인된 실제 전환/검증 후에만 rules-and-data-verified로 바꾼다. 이 값은 보안 권한이 아니며 실제 권한은 Rules가 강제한다.
- Firebase app 이름과 Auth 저장 이름을 보존했다. origin이 바뀌면 이전 origin의 로그인과 local journal이 자동 이동하지 않는다. 같은 계정 재로그인이 필요하고, 기존 origin의 미정산 journal을 전환 전에 정리해야 한다. 클라우드 UID/세이브는 같은 계정으로 이관한다.
- main.js에서 확인한 237개 literal ES module import에 Sites/GPT 주소 또는 server/http.mjs 의존은 없다. 순수 정산 함수용 server 모듈은 브라우저 코드다. 이 정적 분석은 실제 네트워크 관측을 대신하지 않는다.

## 실제 전환에 남은 단계

1. 허용된 격리 Auth로 실제 로그인·새로고침·계정 전환·귀환을 검사한다. 기존 Auth CLI는 <user-profile>/.config/configstore/firebase-tools.json 읽기에서 OS EPERM으로 리스닝/계정 생성 전에 거부됐다. 재시도·경로 변경·대체 CLI 우회 없음. 최소 조치는 정상 권한 복구 또는 별도 승인된 기동된 격리 Auth QA 환경이다.
2. `node direct/prepare-release.mjs NEW-directory`로 생성하는 Rules/index/catalog를 검토한다. 본인 UID, 관리자 조건, 차단, 원자적 receipt/CAS를 유지하며 기존 루트의 일반 클라이언트 접근을 열지 않는다. bootstrap은 기존 자료가 있는 계정에 0원 기록을 덮어쓸 수 없다.
3. 신뢰할 전체 legacy export(빈 collection 수/global sequences 포함), pending run/journal 0, 기존 Worker writer 중단을 확보한다. 현재 operator-prepare.mjs/operator-local.mjs는 **demo 실행만** 지원한다. 실제 import executor/자격 정보는 만들지 않았다. demo 결과를 실제 이관 완료라 부르면 안 된다.
4. 검증된 변환의 실제 target resource names를 검토하고 모든 계정·전역 자료의 내용/개수/참조/숫자 ID 매핑을 확인한 뒤 _activation을 마지막으로 켠다. 충돌·유실·미정산은 안전 중단한다. 실제 export/Rules 배포/데이터 변경/writer 전환은 별도 승인 범위다.
5. 그 뒤 기본 activation 값을 바꾸고 승인된 정적 호스트에서 실제 검증한다. GitHub Pages의 실제 origin과 Firebase Auth 허용 도메인 적합성은 미확인이고 자동 변경하지 않았다.
6. rollback에는 기존 Worker와 원본 snapshot을 보존한다. direct 사용 후 새 데이터가 있으면 검증된 역이관이 먼저이며 과거 export만 덮어쓰지 않는다. 실제 주간 보상 스케줄도 활성화하지 않았다.

## 검토 자료와 한계

candidate-v34-firestore-direct-22, direct-firestore-evidence-22. 21차와 이전 고정본은 불변이다. runtime.patch는 이번 제품 변경, product.patch는 문서·검사 포함이다. review-source.zip은 검토 소스, static-review.zip은 서버 실행 파일/검사/로그를 제외한 정적 검토 패키지다. 둘 다 기본 연결 보류 상태이며 운영 배포/실로그인 성공을 뜻하지 않는다.

Node/Rules/SDK 모의 및 demo 격리 성공과 실제 Auth·브라우저·운영 미실행을 구분한다. 클라이언트는 합법 범위 추첨 결과를 조작할 수 있고 전투 사실도 증명하지 못한다. 수량·재화·소유권·한 번 지급 검사는 유지한다. H1-1 반복의 HTTP82→60, 커밋8→7, 쓰기32→20은 로컬2쌍 비교이며 과금 읽기나 실제 로딩 수치가 아니다.

공식 계약: [Firestore REST 인증/Rules](https://firebase.google.com/docs/firestore/use-rest-api), [웹 Auth persistence의 origin 제한](https://firebase.google.com/docs/auth/web/auth-state-persistence).
