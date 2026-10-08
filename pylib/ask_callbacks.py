"""ask_callbacks.py — callback codec + keyboard for the live speaker-ask flow.

Telegram caps callback_data at 64 bytes, so payloads stay terse:

    sa:c:{slug}:{spk}:{idx}   confirm candidate #idx — index into the ask's
                              stored candidate list, resolved by the server
                              that sent the ask
    sa:o:{slug}:{spk}         "Other" — human replies with a name
    sa:i:{slug}:{spk}         ignore this speaker for the session

Stdlib-only so it can be imported by CI tests, telegram_server, and the
GPU-server speaker-ask manager alike.
"""

ASK_PREFIX = "sa"
MAX_CALLBACK_BYTES = 64
# Longest market slug that fits: len("sa:c:") + slug + ":" + spk + ":" + idx
MAX_SLUG_LEN = 48


class CallbackTooLong(ValueError):
    """Raised when a callback payload would exceed Telegram's 64-byte cap."""


def _assert_within_budget(keyboard):
    for row in keyboard["inline_keyboard"]:
        for button in row:
            if len(button["callback_data"].encode()) > MAX_CALLBACK_BYTES:
                raise CallbackTooLong(button["callback_data"])


def build_ask_keyboard(candidates, slug, spk, per_row=2):
    """Build an inline-keyboard dict for one speaker ask.

    candidates: list of (display_name, entity_slug) in display order. The
    button index is what the server resolves against its stored candidate
    list, so the order here must match the order sent to the server.
    Rows are laid out `per_row` candidates per row, ending with Other/Ignore.
    """
    if len(slug) > MAX_SLUG_LEN:
        raise CallbackTooLong(f"slug too long for callback data: {slug!r}")
    rows = []
    row = []
    for i, (name, _entity_slug) in enumerate(candidates):
        row.append({"text": name, "callback_data": f"{ASK_PREFIX}:c:{slug}:{spk}:{i}"})
        if len(row) >= per_row:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([
        {"text": "✏️ Other", "callback_data": f"{ASK_PREFIX}:o:{slug}:{spk}"},
        {"text": "🚫 Ignore", "callback_data": f"{ASK_PREFIX}:i:{slug}:{spk}"},
    ])
    keyboard = {"inline_keyboard": rows}
    _assert_within_budget(keyboard)
    return keyboard


def parse_ask_callback(data):
    """Parse an `sa:` callback payload → dict, or None if it isn't one.

    Returns one of:
        {"action": "confirm", "slug", "spk", "idx"}
        {"action": "other",   "slug", "spk"}
        {"action": "ignore",  "slug", "spk"}
    """
    if not isinstance(data, str) or not data.startswith(ASK_PREFIX + ":"):
        return None
    parts = data.split(":", 4)
    if len(parts) < 4:
        return None
    _, action, slug, spk = parts[:4]
    if action == "c" and len(parts) == 5:
        try:
            idx = int(parts[4])
        except ValueError:
            return None
        return {"action": "confirm", "slug": slug, "spk": spk, "idx": idx}
    if action == "o":
        return {"action": "other", "slug": slug, "spk": spk}
    if action == "i":
        return {"action": "ignore", "slug": slug, "spk": spk}
    return None
