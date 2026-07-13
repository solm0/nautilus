# Nautilus Monorepo

이 저장소는 여러 실행 표면이 한 repo 안에 함께 있는 멀티앱 구조입니다.

- `backend`: Electron과 로컬 워크플로우가 쓰는 로컬 FastAPI 서버
- `central`: 계정, 공유 콘텐츠, 모바일 API, 랜딩 페이지를 담당하는 중앙 FastAPI 서버
- `frontend`: 메인 Vite React 앱, Capacitor 모바일 앱, 랜딩 빌드, Chrome extension 빌드
- `electron`: 데스크톱 셸, 로컬 백엔드 실행, 딥링크, 로컬 now-playing 연동
- `shared`: 중앙/로컬 서버에서 재사용하거나 동기화하는 Python 서비스 로직
- `preprocess`: 코퍼스 전처리 스크립트
- `releases`: 언어별 데이터와 배포 아티팩트

## Where to start

작업 범위를 먼저 좁히는 것이 중요합니다.

- 로컬 분석, lemma lookup, 로컬 API 이슈: `backend`
- 로그인, 댓글, 공유 페이지, 모바일 클라우드 API: `central`
- 웹 UI, 모바일 UI, extension UI: `frontend`
- 데스크톱 앱 부팅, 패키징, 딥링크, 플레이어 연동: `electron`
- 양쪽 서버에서 공통으로 보이는 언어 처리 이슈: `shared`
- 데이터 생성 파이프라인: `preprocess`, 필요 시 `releases`

Codex용 운영 가이드는 각 폴더의 `AGENTS.md`를 참고하면 됩니다.

## App boundaries

- Electron은 계속 로컬 언어 백엔드를 사용합니다.
  - 기본 로컬 API 기준: `http://localhost:8000/api`
- Mobile은 계정/콘텐츠 호출에 중앙 API를 사용해야 합니다.
  - 분석, lookup, predict, search는 `central`의 `/api/mobile/*` 엔드포인트를 사용합니다.
- Electron/macOS는 AppleScript로 데스크톱 플레이어의 now-playing 정보를 로컬에서 읽습니다.
- Android는 active media session 기반으로 now-playing을 읽으며 notification access가 필요합니다.

## Key entrypoints

- `backend/main.py`: 로컬 API 엔트리포인트
- `central/main.py`: 중앙 API 엔트리포인트
- `frontend/package.json`: 메인 프론트엔드 및 Capacitor 스크립트
- `frontend/src`: 메인 UI 소스
- `electron/main.js`: Electron 메인 프로세스

## Frontend scripts

`frontend/package.json` 기준 주요 명령:

- `npm run dev`
- `npm run build`
- `npm run build:extension`
- `npm run build:landing`
- `npm run cap:sync`
- `npm run cap:run:android`
- `npm run cap:run:ios`

## Environment notes

중앙 API/모바일 분리 이후 기준 환경변수:

- Central
  - `PUBLIC_API_BASE_URL`: 공개 중앙 API base URL, 예: `https://api.example.com/api`
- Frontend
  - `VITE_ELECTRON_CENTRAL_API`
  - `VITE_ELECTRON_LOCAL_API`
  - `VITE_MOBILE_CENTRAL_API`
  - `VITE_MOBILE_LOCAL_API`

계정 이메일 인증과 비밀번호 재설정 페이지는 중앙 API 도메인에서 직접 서빙합니다.

## Data and packs

- 언어 팩은 `central/data/static/<lang>/<version>/...` 아래에 둡니다.
- 가사 페이지는 한 줄당 한 block을 저장합니다.
- 각 block은 이후 재생 동기화를 위해 `timestamp_ms`를 가질 수 있습니다.
- 트랙 메타데이터가 있으면 클라이언트에서 LRCLIB 기반으로 가사를 매칭합니다.

## Working in this repo

- 이 repo는 앱이 여러 개라서 전체를 한 번에 읽기보다, 작업 대상 폴더 하나와 필요 시 `shared`만 보는 편이 훨씬 효율적입니다.
- `node_modules`, 빌드 결과물, 생성 데이터는 해당 작업이 아니면 기본적으로 무시하는 것이 좋습니다.
- `frontend/frontend`는 중첩 패키지이므로 메인 앱으로 단정하지 말고, 작업이 명시적으로 가리킬 때만 확인하세요.
