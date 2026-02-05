from __future__ import annotations

import sys
from pathlib import Path

# Ensure `backend/` is on sys.path so `import app.*` works reliably across pytest import modes.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

