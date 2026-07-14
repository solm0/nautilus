from datetime import datetime


def log(message: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}", flush=True)


class ProgressLogger:
    def __init__(self, label: str, every: int, total: int | None = None, unit: str = "items"):
        self.label = label
        self.every = max(1, every)
        self.total = total
        self.unit = unit
        self._last_logged = 0

    def update(self, count: int, extra: str | None = None, force: bool = False):
        should_log = force or count == 0

        if not should_log and count - self._last_logged >= self.every:
            should_log = True

        if not should_log and self.total is not None and count >= self.total:
            should_log = True

        if not should_log:
            return

        self._last_logged = count

        if self.total is not None:
            percent = (count / self.total * 100) if self.total else 0
            message = f"{self.label}: {count:,}/{self.total:,} {self.unit} ({percent:.1f}%)"
        else:
            message = f"{self.label}: {count:,} {self.unit}"

        if extra:
            message = f"{message} | {extra}"

        log(message)
