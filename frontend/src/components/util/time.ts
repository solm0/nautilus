import type { AppLocale } from "../../i18n";

function parseApiDate(dateStr: string) {
  if (!dateStr) return new Date(NaN);

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(dateStr);
  return new Date(hasTimezone ? dateStr : `${dateStr}Z`);
}

export function formatRelative(
  dateStr: string,
  locale: AppLocale = "en",
) {
  const diff = Date.now() - parseApiDate(dateStr).getTime();

  if (Number.isNaN(diff)) return null;

  const sec = Math.floor(diff / 1000);
  if (sec < 60) {
    return locale === "ko" ? `${sec}초 전` : `${sec}s ago`;
  }

  const min = Math.floor(sec / 60);
  if (min < 60) {
    return locale === "ko" ? `${min}분 전` : `${min}m ago`;
  }

  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return locale === "ko" ? `${hr}시간 전` : `${hr}h ago`;
  }

  const day = Math.floor(hr / 24);
  return locale === "ko" ? `${day}일 전` : `${day}d ago`;
}
