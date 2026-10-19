"""Export the FastAPI OpenAPI document for client generation and review."""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app  # noqa: E402

OUTPUT = PROJECT_ROOT / "docs" / "openapi.json"


def main() -> int:
    document = app.openapi()
    OUTPUT.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUTPUT} ({len(document.get('paths', {}))} paths)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
