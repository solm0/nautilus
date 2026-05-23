from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parents[2]
root_str = str(ROOT_DIR)

if root_str not in sys.path:
    sys.path.append(root_str)

from shared.services import pattern_service as _shared_module


for _name in dir(_shared_module):
    if _name.startswith("__"):
        continue
    globals()[_name] = getattr(_shared_module, _name)


__all__ = [name for name in dir(_shared_module) if not name.startswith("__")]
