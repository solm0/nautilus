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

- `app-v*` 형식 태그 push
- 예: `app-v1.0.0`

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

## Release와의 관계

`app-v*` 태그로 실행된 경우에는 결과물이 `GitHub Release assets`에도 업로드됩니다.

즉 흐름은 아래와 같습니다.

- `Run workflow` 수동 실행:
  - Actions `Artifacts`에만 업로드
- `app-v1.0.0` 같은 태그 push:
  - Actions `Artifacts`에 업로드
  - 같은 태그 이름의 GitHub Release 생성
  - `.dmg`, `.exe`, `.AppImage`를 Release assets에 업로드

소개 페이지의 다운로드 버튼은 보통 `Release assets` URL에 연결하면 됩니다.

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

## 주의사항

`build:bundle:win`과 `build:bundle:linux`는 각 대상 OS에서 실행될 때 가장 자연스럽습니다.

즉:

- macOS용은 macOS runner
- Windows용은 Windows runner
- Linux용은 Linux runner

GitHub Actions를 쓰는 이유도 바로 이 점 때문입니다.
