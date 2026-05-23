// Electron 앱 내부에서는 항상 localhost:8000
// 개발 중에는 .env로 제어
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";