# Electron 빌드 가이드

## 기본 방향

이 프로젝트의 Electron 앱은 로컬에서 직접 빌드하기보다 GitHub Actions로 빌드하는 것을 기본 경로로 가정합니다.

GitHub Actions는 아래 3개 환경에서 각각 빌드합니다.

- macOS
- Windows
- Linux

즉 각 OS에서 직접 명령을 실행한 것처럼 빌드됩니다.

워크플로우 파일:

- `.github/workflows/electron-build.yml`

## GitHub Actions 실행 방법

GitHub 저장소 웹사이트에서 아래 순서로 실행할 수 있습니다.

1. `Actions` 탭으로 이동
2. `Build Electron Apps` 선택
3. `Run workflow` 클릭

자동 실행 조건은 아래와 같습니다.

- `app-desktop-v*` 형식 태그 push
- 예: `app-desktop-v1.0.0`

## 결과물 위치

빌드가 끝나면 결과물은 GitHub Actions 실행 화면의 `Artifacts`에 업로드됩니다.

이 아티팩트는 임시 보관용입니다. 현재 워크플로우에서는 `7일` 보관되도록 설정했습니다.

업로드되는 파일:

- macOS: `.dmg`
- Windows: `.exe`
- Linux: `.AppImage`

아티팩트 이름:

- `nautilus-electron-macos`
- `nautilus-electron-windows`
- `nautilus-electron-linux`

## Hugging Face 업로드

`app-desktop-v*` 태그로 실행된 경우에는 결과물이 `Hugging Face`에도 업로드됩니다.

즉 흐름은 아래와 같습니다.

- `Run workflow` 수동 실행:
  - Actions `Artifacts`에만 업로드
- `app-desktop-v1.0.0` 같은 태그 push:
  - Actions `Artifacts`에 업로드
  - `Hugging Face dataset repo`의 `releases/desktop/app-desktop-v1.0.0/` 경로에 `.dmg`, `.exe`, `.AppImage` 업로드

필요한 GitHub 설정:

- `Settings -> Secrets and variables -> Actions -> Secrets`
  - `HF_TOKEN`
- `Settings -> Secrets and variables -> Actions -> Variables`
  - `HF_REPO_ID`
  - `HF_REPO_TYPE=dataset`

권장 Hugging Face 저장소:

- 타입: `Dataset`
- 공개 범위: `Public`
- 예: `yourname/nautilus-releases`

소개 페이지의 다운로드 버튼은 보통 아래 형태의 Hugging Face URL에 연결하면 됩니다.

```text
https://huggingface.co/datasets/<HF_REPO_ID>/resolve/main/releases/desktop/<tag>/<artifact-folder>/<filename>
```

예:

```text
https://huggingface.co/datasets/yourname/nautilus-releases/resolve/main/releases/desktop/app-desktop-v1.0.0/nautilus-electron-windows/Nautilus%20Setup%201.0.0.exe
```

## 로컬 빌드 명령

정말 필요할 때만 `electron` 폴더에서 아래 명령을 사용할 수 있습니다.

```bash
npm run build:bundle:mac
npm run build:bundle:win
npm run build:bundle:linux
```

이 명령은 아래를 한 번에 수행합니다.

1. `frontend` 빌드
2. `backend` 패키징
3. Electron 설치 파일 생성

## 로컬 빌드 산출물

로컬 빌드를 하면 아래 경로가 생성될 수 있습니다.

- `.build`
- `backend-dist`
- `electron/dist-electron`

이 경로들은 모두 빌드 산출물이므로, 현재 사용 중인 빌드가 아니라면 삭제해도 됩니다.

## 언어팩/모델 경로 정책

Electron 데스크톱 앱은 개발 실행과 배포 실행에서 언어 데이터 경로를 다르게 사용합니다.

- 개발 실행:
  - `backend/data/static`
  - `backend/models`
  - `backend/classla_models`
- 배포된 Electron 앱:
  - 앱 번들 안에 언어팩/모델을 기본 포함하지 않음
  - 사용자별 app data 경로에 설치
  - runtime 상태와 refcount도 사용자별 app data 경로에 기록

즉 배포 앱에서는 언어팩과 NLP 모델이 필요할 때 내려받아지고, 같은 언어의 마지막 lemma pack이 제거되면 해당 언어 모델도 함께 제거됩니다.

현재 배포 앱 기준 주요 경로는 아래와 같습니다.

- 언어팩 데이터: `.../language-data/static`
- 모델 데이터: `.../language-models/stanza`, `.../language-models/classla`
- runtime 상태 파일: `.../runtime/state`

경로를 직접 하드코딩하지 말고 `backend/runtime_paths.py`를 통해 접근해야 개발/배포 경로가 꼬이지 않습니다.

## 주의사항

`build:bundle:win`과 `build:bundle:linux`는 각 대상 OS에서 실행될 때 가장 자연스럽습니다.

즉:

- macOS용은 macOS runner
- Windows용은 Windows runner
- Linux용은 Linux runner

GitHub Actions를 쓰는 이유도 바로 이 점 때문입니다.

## 버전 관리 메모

현재 릴리스 버전은 플랫폼별로 따로 관리합니다.

- Desktop 버전: `electron/package.json`
- Android 버전: `frontend/package.json`

`scripts/sync-app-version.mjs`를 실행하면:

- Desktop 최신 버전 정보는 `central/static/latest-version-desktop.json`에 반영됩니다.
- Android 최신 버전 정보는 `central/static/latest-version-android.json`에 반영됩니다.
- Android 네이티브 버전은 `frontend/android/app/build.gradle`에 반영됩니다.

Electron 빌드 시에는 `scripts/build-electron.sh`가 `APP_VERSION_OVERRIDE`를 사용해서 데스크톱 버전 번호가 프론트 설정 페이지에도 보이도록 맞춥니다.
