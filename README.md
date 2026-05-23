- preprocess: 코퍼스, 스크립트
- releases: 언어별 데이터, 모델
- central: 중앙 서버
- backend: 로컬 서버
- frontend: 로컬 프론트
- electron: 일렉트론
- shared: 중앙-로컬 간 공유 service들

Mobile migration notes

- Electron keeps using the local language backend at `http://localhost:8000/api`.
- Mobile should use the central API for account/content calls and `central`'s `/api/mobile/*` endpoints for analyze, lookup, predict, and search.
- Mobile OCR is intentionally unsupported.
- New central env vars:
  - `PUBLIC_API_BASE_URL`: public central API base URL, for example `https://api.example.com/api`
  - Account email verification and password reset pages are served directly from the central API domain.
- Language packs should live under `central/data/static/<lang>/<version>/...`
- New frontend env vars:
  - `VITE_ELECTRON_CENTRAL_API`
  - `VITE_ELECTRON_LOCAL_API`
  - `VITE_MOBILE_CENTRAL_API`
  - `VITE_MOBILE_LOCAL_API`

Local now-playing notes

- Electron/macOS reads current playback locally from supported desktop players using AppleScript.
- Android reads current playback locally from active media sessions and requires notification access.
- Lyrics are matched from LRCLIB on the client when track metadata is available.
- Lyric pages save one lyric line per block and may include `timestamp_ms` on each block so page sync can follow playback later.
