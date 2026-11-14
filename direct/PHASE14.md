14차 고정 후보 — 하드·던전 보상 직접 저장 (운영 미반영)

기준: 13차 1008파일 일치 확인 후 별도 후보에서 작업. 운영/실제 Firebase/원본 두 사본/GitHub/결제 불변.
구현: 던전 보스 추첨과 시간/소유권/중복 영수증, 하드1~5 정산 권리 예약→우편→기존 지급영수증→누적처치/정산seq 최종화. 첫클리어 영웅 보장·반복 목표1개·도감용 추가2개·기존200상자 자동분해 유지. 하드 2인 보상 한 번.
복구: 응답유실 각 단계, 새 클라이언트, 동시 호출, 로컬 journal 유실+정산 guard 잔존, 최종reload실패, 계정전환 회귀. 로컬 journal이 사라지면 guard가 잘못 풀리던 신규 경계 재현 후 수정.
검사: 최종 전체115/115 파일 exit0; 신선한 Firestore9518에서24개 명령 exit0 (이전223그룹 + 새 던전7 + 하드8), 마지막 status복구 수정 후 하드8 재실행 exit0. 30개 하드stage 행/부분귀환/구형version/포화199·200 별도 원시자료.
브라우저: 57492, Auth9199/Firestore9508 demo 프로젝트. 정상 가입, 합성 mage45+warrior45 fixture, 정상1배속 H1-1 첫웨이브11처치/core30, 귀환→마을→새로고침. 영혼석1000→1014, XP1000→1030, stats runs1/kills11/waves1, seq1, 상자0, pending0/guard없음. 부분귀환이라 완주상자 브라우저 검증은 아님; 완주상자는 실제Rules REST검사로 검증. 계정/진행 fixture는 로컬에만 적용. 화면의 공지는 다른 합성 공지 테스트 데이터이며 새UI 아님.
한계: Firestore Rules는 전투사실/공정 난수를 증명하지 못한다. 하드·던전 보스 원래 서버 추첨을 클라이언트가 수행하므로 유리한 등급/성공 난수 선택 노출이 커짐. 정확한 확률 공정성은 동등하지 않으며 운영 전 별도 수용 판단 필요. 직접 모드는 demo/emulator에만 연결 가능. 도전 정산, 전역 이관/역이관과 남은 관리자 쓰기/주간 자동 마감은 미완료. 기존Worker 삭제/전환 불가.
차단: Auth 에뮬레이터 최초 실행이 개인 CLI설정 파일 접근 EPERM으로 미실행. 해당 파일을 읽거나 우회하지 않고 지원되는 XDG_CONFIG_HOME의 빈 격리 설정으로 실행 완료. 현재 테스트 차단 없음. 이전 거부 URL/특성/CIM 접근은 하지 않음.
재현: python run-direct-regression-14.py. 새 demo Firestore 인스턴스에 direct/firestore.rules 로드 후 run-phase14-verified.py의 포트를 맞춰 실행. 기존 정해진 UID 테스트 때문에 이미 채운 DB에 전체suite 재실행 금지. Node와 Java 경로는 재현문서 사용. 직접 원격주소/production 프로젝트 사용 금지.
후속: 이 고정 후보는 독립 검수 가능. 이어질 작업은 새 후보에서만 한다.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for account ownership, immutable reward receipts, validated economy transitions, and restricted administrator actions. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.
