[역사 문서] 아래는 2026-10-25 Supabase 독립 복사본의 기록입니다.
현재 Firebase 운영판의 설치·배포 안내가 아닙니다. 현재 구조는 README.md를 참고하세요.
사용되지 않던 Supabase 클라이언트 설정과 SDK는 2026-11-19 코드 정리에서 제거했습니다.
아래의 당시 설정 경로·검증 결과·계정 상태는 현재 운영판에 적용되지 않습니다.

Hero Defense 3D 독립 복사본 (2026-10-25)

경로: <local installation; path omitted>
원본: https://github.com/hyunjk11/hero-defense-3d
기준 커밋: ff0b997c596305a8876991f8ca02bdb66878489d (main)

실행: START-GAME.cmd를 실행한 뒤 http://127.0.0.1:8767/ 접속.
Python이 PATH에 있어야 합니다. 현재 PC에서 Python과 Node 실행을 확인했습니다.
이미 같은 포트의 서버가 실행 중이면 기존 주소로 접속하면 됩니다.
서버는 127.0.0.1에만 바인딩합니다. 이 주소는 이 PC에서만 접속됩니다.

독립 Supabase 프로젝트: hero-defense-3d-independent
프로젝트 ID: xgjbwdmviuhwfhsckdrh
당시 연결 설정: src/config/supabase.js (폐기됨; Git 이력에 보존)
계정 세션, 주요 저장 데이터, 구매/우편 복구 키, 던전/탑 입장 토큰을 분리했습니다.
원본 DB의 계정이나 플레이어 데이터는 이전하지 않았습니다.
독립 DB의 기존 6개 테이블을 최신 16개 테이블 구조로 업데이트했습니다.
실제로 적용한 SQL: supabase/independent-schema.sql
이 SQL은 원본 DB에 실행하지 마세요. 기존 schema.sql은 원본 이력 보존용입니다.
독립 DB에는 현재 실제 계정과 최고 관리자 계정이 없습니다.
관리자로 사용할 계정을 독립 프로젝트에 가입한 뒤 별도 관리자 등록이 필요합니다.

검증: JavaScript 113개 문법/import 검사, Node 테스트 33개 통과.
PC 브라우저 직접 플레이 및 저장/동기화 오류 재현.
확인된 원본 코드 문제는 분석 보고서에 기록했으며 게임 규칙을 바꾸는 수리는 하지 않았습니다.
GitHub 원본과 원본 DB에는 쓰기/배포/푸시하지 않았습니다.
