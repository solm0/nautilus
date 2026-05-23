function parseApiDate(dateStr: string) {
  if (!dateStr) return new Date(NaN);

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(dateStr);
  return new Date(hasTimezone ? dateStr : `${dateStr}Z`);
}

export function formatRelative(dateStr: string) {
  const diff = Date.now() - parseApiDate(dateStr).getTime();

  if (Number.isNaN(diff)) return null;

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
