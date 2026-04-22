#!/usr/bin/env python3
"""
Extract mplsoccer's 68-formation position table into a JSON file for
consumption by @withqwerty/campos-core.

Run: pnpm generate:formations
Or:  python scripts/extract-mplsoccer-formations.py

Output: packages/core/src/formation-positions.json

Coordinates are converted from mplsoccer's StatsBomb convention
(120x80, top-left origin, y increases downward) to Campos's convention
(0..100 x 0..100, bottom-left origin, attacking left-to-right along x).

Each slot also carries the upstream provider IDs from mplsoccer so adapters
can translate between provider slot conventions and mplsoccer slots without
hand-maintaining per-formation tables. The Opta adapter, in particular,
uses the `opta` field to map Opta q30 positions to the correct mplsoccer
slot — mplsoccer is the authoritative source here and disagrees with
kloppy's formation_mapping.py on some formations (notably 4-2-3-1, where
Opta slot 4 is LDM in mplsoccer but RCM in kloppy; real match data confirms
mplsoccer is correct).

Fields per slot:
- `slot`     — 1-indexed position in the formation (1 = GK)
- `code`     — mplsoccer canonical code (e.g. "GK", "RDM", "LCF")
- `x`, `y`   — Campos 0..100 coordinates (attacking axis, width axis)
- `opta`     — integer Opta formation-place ID (q131 value), or None
- `statsbomb` — list of StatsBomb position IDs for this slot, or None
- `wyscout`  — Wyscout string position code (e.g. "rcmf3"), or None
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MPLSOCCER_PATH = Path("/Volumes/WQ/ref_code/mplsoccer")
OUTPUT_PATH = REPO_ROOT / "packages/core/src/formation-positions.json"

if not MPLSOCCER_PATH.exists():
    print(
        f"error: mplsoccer not found at {MPLSOCCER_PATH}\n"
        "Clone mplsoccer to /Volumes/WQ/ref_code/mplsoccer or update "
        "MPLSOCCER_PATH in this script.",
        file=sys.stderr,
    )
    sys.exit(1)

sys.path.insert(0, str(MPLSOCCER_PATH))

try:
    from mplsoccer import Pitch  # type: ignore
except ModuleNotFoundError as exc:
    print(
        f"error: cannot import mplsoccer ({exc})\n"
        "Ensure mplsoccer's dependencies are installed in the active Python env "
        "(pip install -e /Volumes/WQ/ref_code/mplsoccer) or that mplsoccer is "
        "on sys.path without needing extra deps.",
        file=sys.stderr,
    )
    sys.exit(2)


def convert_coords(x_sb: float, y_sb: float) -> tuple[float, float]:
    """Convert StatsBomb (120x80, top-left, y-down) to Campos (0..100, bottom-left)."""
    x_campos = round((x_sb / 120.0) * 100.0, 2)
    y_campos = round(100.0 - (y_sb / 80.0) * 100.0, 2)
    return x_campos, y_campos


def extract() -> dict[str, list[dict]]:
    pitch = Pitch(pitch_type="statsbomb")
    formations_out: dict[str, list[dict]] = {}

    # mplsoccer exposes formation names via `pitch.formations` (a list of str),
    # and positions for a specific formation via `pitch.get_formation(name)`
    # returning a list of `Position` dataclasses with `name`, `x`, `y` attrs.
    # Each Position also carries `opta`, `statsbomb`, `wyscout` attributes
    # when the formation is supported by that provider (None otherwise).
    formation_names = sorted(pitch.formations)

    for name in formation_names:
        positions = pitch.get_formation(name)
        slots = []
        for slot_index, pos in enumerate(positions, start=1):
            x_campos, y_campos = convert_coords(pos.x, pos.y)
            slot: dict = {
                "slot": slot_index,
                "code": pos.name,
                "x": x_campos,
                "y": y_campos,
            }
            # Provider ID mappings — only emit when the formation actually
            # ships with that provider's slot convention. Skipping keys
            # keeps the JSON compact for historical/partial formations.
            opta_id = getattr(pos, "opta", None)
            if opta_id is not None:
                slot["opta"] = opta_id
            statsbomb_ids = getattr(pos, "statsbomb", None)
            if statsbomb_ids:
                slot["statsbomb"] = list(statsbomb_ids)
            wyscout_code = getattr(pos, "wyscout", None)
            if wyscout_code is not None:
                slot["wyscout"] = wyscout_code
            slots.append(slot)
        formations_out[name] = slots

    return formations_out


def main() -> None:
    data = extract()

    # Regression assertions that catch silent upstream drift.
    #
    # NOTE: mplsoccer intentionally includes 15 historical/partial formations
    # with fewer than 11 positions (e.g., '44' has 9, '341' has 9, '342' has 10).
    # These are Wyscout-only historical shapes and only carry `wyscout='...'`
    # tags — no statsbomb/opta fields. Campos preserves them verbatim in the
    # data layer because it's a position mapping concern; downstream code
    # iterates whatever positions exist for the given formation key. Adapters
    # (Opta, WhoScored) are the layer that enforces "exactly 11 starters"
    # because their real data always has 11.
    assert len(data) == 68, f"expected 68 formations, got {len(data)}"
    for name, slots in data.items():
        assert 9 <= len(slots) <= 11, (
            f"formation {name!r} has {len(slots)} slots, expected between 9 and 11"
        )
        for slot in slots:
            assert 0 <= slot["x"] <= 100, f"{name} slot {slot['slot']} x out of range: {slot['x']}"
            assert 0 <= slot["y"] <= 100, f"{name} slot {slot['slot']} y out of range: {slot['y']}"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print(f"wrote {len(data)} formations to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
