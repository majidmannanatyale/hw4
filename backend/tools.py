"""Security and database helpers for Campus Customs auth.

Password storage
----------------
Existing (seed) users are stored as a 3-field string::

    pbkdf2_sha256$<salt>$<hexdigest>

That format does not record the PBKDF2 iteration count, so to verify a seed user we
compute the digest of the password *they type at login* against a short list of standard
iteration counts and accept the first that matches. Nothing is guessed — the password
always comes from the login form; this is ordinary password-algorithm migration logic.
The seed users are never modified.

New accounts are stored in a stronger, self-describing 4-field format that records its
own iteration count, so they never need the fallback::

    pbkdf2_sha256$<iterations>$<salt>$<hexdigest>
"""

import base64
import collections
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "campus_customs.db"
AUDIT_PATH = Path(__file__).resolve().parents[1] / "output" / "audit_trail.json"

ALGO = "pbkdf2_sha256"
HASH_NAME = "sha256"
DKLEN = 32  # 32 bytes -> 64 hex chars, matching the seed users.
NEW_ITERATIONS = 600_000
# Iteration counts to try for legacy 3-field hashes (no count is recorded in them).
# 120_000 is what this project's seed script used; the rest are common library defaults.
LEGACY_ITERATIONS = (120_000, 600_000, 260_000, 1_000_000, 100_000, 150_000, 390_000)

TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60  # one week


# --------------------------------------------------------------------------- passwords
def _pbkdf2(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac(HASH_NAME, password.encode("utf-8"), salt.encode("utf-8"), iterations, DKLEN).hex()


def hash_password(password: str) -> str:
    """Create a fresh salted hash for a new account (self-describing format)."""
    salt = secrets.token_hex(16)
    digest = _pbkdf2(password, salt, NEW_ITERATIONS)
    return f"{ALGO}${NEW_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a login password against a stored hash (new or legacy format)."""
    parts = stored.split("$")
    try:
        if len(parts) == 4:  # new: algo$iterations$salt$digest
            algo, iters, salt, digest = parts
            if algo != ALGO:
                return False
            return hmac.compare_digest(_pbkdf2(password, salt, int(iters)), digest)
        if len(parts) == 3:  # legacy: algo$salt$digest (iteration count not recorded)
            algo, salt, digest = parts
            if algo != ALGO:
                return False
            return any(hmac.compare_digest(_pbkdf2(password, salt, it), digest) for it in LEGACY_ITERATIONS)
    except (ValueError, TypeError):
        return False
    return False


# ------------------------------------------------------------------------------ tokens
def _secret() -> bytes:
    """Signing secret from the environment; a random dev secret if unset (logs a warning once)."""
    env = os.environ.get("APP_SECRET")
    if env:
        return env.encode("utf-8")
    if not hasattr(_secret, "_dev"):
        _secret._dev = secrets.token_bytes(32)  # type: ignore[attr-defined]
        print("WARNING: APP_SECRET is not set; using a random dev secret. Logins reset on restart.")
    return _secret._dev  # type: ignore[attr-defined]


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def create_token(user_id: int) -> str:
    payload = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode("utf-8"))
    sig = _b64(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str) -> int | None:
    """Return the user id for a valid, unexpired token, else None."""
    try:
        payload, sig = token.split(".")
        expected = _b64(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(payload))
        if data.get("exp", 0) < int(time.time()):
            return None
        return int(data["uid"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


# --------------------------------------------------------------------------- user store
def connect_rw() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_user_by_email(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email.lower(),)).fetchone()


def get_user_by_id(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def create_user(conn: sqlite3.Connection, first_name: str, last_name: str, email: str, password: str) -> sqlite3.Row:
    """Insert a new user with a freshly salted hash. Raises sqlite3.IntegrityError if the email exists."""
    full_name = f"{first_name} {last_name}".strip()
    cur = conn.execute(
        "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
        (full_name, email.lower(), hash_password(password), first_name, last_name),
    )
    conn.commit()
    row = get_user_by_id(conn, cur.lastrowid)
    assert row is not None
    return row


def public_user(row: sqlite3.Row) -> dict:
    """Trim a DB row down to the non-sensitive fields safe to send to the browser."""
    first = row["first_name"] or (row["name"].split(" ")[0] if row["name"] else "")
    last = row["last_name"] or (row["name"].split(" ", 1)[1] if row["name"] and " " in row["name"] else "")
    return {"id": row["id"], "first_name": first, "last_name": last, "email": row["email"]}


# ------------------------------------------------------------------ catalogue (chatbot)
# These are the only data the Concierge agent may read. They touch catalogue + inventory
# only — never the users table — so the agent physically cannot reach private account data.
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

# Ribbon thresholds, derived from the seed inventory distribution (see output/harness.md):
# "almost gone" = very little total stock left; "hot" = several sizes already sold out (selling fast).
ALMOST_GONE_TOTAL = 20
HOT_SOLDOUT_SIZES = 3


def compute_badge(sizes: list[dict]) -> str | None:
    """Return 'almost_gone', 'hot', or None from per-size stock. Almost-gone takes precedence."""
    total = sum(s["quantity"] for s in sizes)
    sold_out = sum(1 for s in sizes if s["quantity"] == 0)
    if total <= ALMOST_GONE_TOTAL:
        return "almost_gone"
    if sold_out >= HOT_SOLDOUT_SIZES:
        return "hot"
    return None


def connect_ro() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _size_stock(conn: sqlite3.Connection, product_id: str) -> list[dict]:
    """Every size for a product with its quantity and an in_stock flag, in size order."""
    rows = conn.execute(
        "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
    ).fetchall()
    ordered = sorted(
        rows, key=lambda r: SIZE_ORDER.index(r["size"]) if r["size"] in SIZE_ORDER else len(SIZE_ORDER)
    )
    return [{"size": r["size"], "quantity": r["quantity"], "in_stock": r["quantity"] > 0} for r in ordered]


def product_card(product_id: str) -> dict | None:
    """Authoritative card for a product id (price/image/stock from the DB, not the model)."""
    with connect_ro() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        sizes = _size_stock(conn, product_id)
        return {
            "product_id": row["product_id"],
            "name": row["name"],
            "price": row["price"],
            "image_url": f"/images/{row['image_file_path']}",
            "colors": json.loads(row["colors"]),
            "in_stock": any(s["in_stock"] for s in sizes),
            "sizes": sizes,
            "badge": compute_badge(sizes),
        }


def check_availability(product_id: str) -> dict:
    """Authoritative description, price and per-size stock for one product id.

    Always returns real values from campus_customs.db. If the id is unknown, returns
    {"found": False, ...} so the agent can say the item is unavailable rather than guess.
    """
    with connect_ro() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return {"found": False, "product_id": product_id}
        sizes = _size_stock(conn, product_id)
        return {
            "found": True,
            "product_id": row["product_id"],
            "name": row["name"],
            "description": row["description"],
            "price": row["price"],
            "colors": json.loads(row["colors"]),
            "total_stock": sum(s["quantity"] for s in sizes),
            "in_stock": any(s["in_stock"] for s in sizes),
            "sizes": sizes,
        }


def _sizes_available(conn: sqlite3.Connection, product_id: str) -> list[str]:
    return [s["size"] for s in _size_stock(conn, product_id) if s["in_stock"]]


def search_catalogue(query: str, limit: int = 6) -> list[dict]:
    """Read-only keyword search over name, description, type, colors and tags.

    Returns matching products (id, name, price, type, colors, description, availability) so the
    agent can show them as cards and talk about them. This is a SELECT only — it never writes
    to the database.
    """
    # Match every word of the query (AND), each against any searchable field. This lets
    # "blue hoodie" find navy-blue hoodies instead of looking for the literal phrase.
    words = [w for w in re.split(r"\s+", query.strip()) if w]
    if not words:
        return []
    # Stem a trailing plural "s" so "hoodies" matches the catalogue's "hoodie".
    stems = [w[:-1] if len(w) > 3 and w.lower().endswith("s") else w for w in words]
    clauses, params = [], []
    for w in stems:
        like = f"%{w}%"
        clauses.append("(name LIKE ? OR description LIKE ? OR garment_type LIKE ? OR colors LIKE ? OR search_tags LIKE ?)")
        params.extend([like, like, like, like, like])
    params.append(limit)
    with connect_ro() as conn:
        rows = conn.execute(
            f"SELECT * FROM catalogue WHERE {' AND '.join(clauses)} ORDER BY name LIMIT ?", params
        ).fetchall()
        result = []
        for r in rows:
            available = _sizes_available(conn, r["product_id"])
            result.append(
                {
                    "product_id": r["product_id"],
                    "name": r["name"],
                    "price": r["price"],
                    "garment_type": r["garment_type"],
                    "colors": json.loads(r["colors"]),
                    "description": r["description"],
                    "in_stock": bool(available),
                    "sizes_available": available,
                }
            )
        return result


def get_product_details(product_id: str) -> dict | None:
    """Full detail for one product, including per-size stock. None if it does not exist."""
    with connect_ro() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        inv = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
        stock = sorted(
            ({"size": r["size"], "quantity": r["quantity"]} for r in inv),
            key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else len(SIZE_ORDER),
        )
        return {
            "product_id": row["product_id"],
            "name": row["name"],
            "price": row["price"],
            "garment_type": row["garment_type"],
            "colors": json.loads(row["colors"]),
            "description": row["description"],
            "stock": stock,
        }


def find_in_color(color: str, keywords: str = "", limit: int = 6) -> list[dict]:
    """Read-only: find products available in a given color, optionally narrowed by keywords
    (e.g. the garment type of the item the guest is viewing). Supports 'do you have this in blue'."""
    color_like = f"%{color.strip()}%"
    kw_like = f"%{keywords.strip()}%"
    with connect_ro() as conn:
        rows = conn.execute(
            """SELECT * FROM catalogue
               WHERE colors LIKE ?
                 AND (? = '%%' OR name LIKE ? OR garment_type LIKE ? OR description LIKE ? OR search_tags LIKE ?)
               ORDER BY name LIMIT ?""",
            (color_like, kw_like, kw_like, kw_like, kw_like, kw_like, limit),
        ).fetchall()
        out = []
        for r in rows:
            available = _sizes_available(conn, r["product_id"])
            out.append(
                {
                    "product_id": r["product_id"],
                    "name": r["name"],
                    "price": r["price"],
                    "garment_type": r["garment_type"],
                    "colors": json.loads(r["colors"]),
                    "in_stock": bool(available),
                }
            )
        return out


def catalogue_overview() -> list[dict]:
    """A high-level menu of what the house sells: garment types with counts and price ranges."""
    with connect_ro() as conn:
        rows = conn.execute(
            """SELECT garment_type, COUNT(*) AS n, MIN(price) AS lo, MAX(price) AS hi
               FROM catalogue GROUP BY garment_type ORDER BY n DESC"""
        ).fetchall()
        return [
            {"garment_type": r["garment_type"], "count": r["n"], "min_price": r["lo"], "max_price": r["hi"]}
            for r in rows
        ]


# ---------------------------------------------------------------- chat history (logged in)
# Stored in the existing `chat_messages` table (user_id, role, content, products_json,
# created_at). Only signed-in users are persisted; anonymous chats are never saved here.
# products_json holds the list of product ids shown, so cards are re-resolved live on load.
def save_chat_turn(user_id: int, role: str, content: str, product_ids: list[str] | None = None) -> None:
    with connect_rw() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, ?, ?, ?)",
            (user_id, role, content, json.dumps(product_ids or [])),
        )
        conn.commit()


def load_chat_history(user_id: int, limit: int = 50) -> list[dict]:
    """Return a user's saved conversation (oldest first), with product cards re-resolved live."""
    with connect_ro() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    history = []
    for r in reversed(rows):  # back to oldest-first
        try:
            raw = json.loads(r["products_json"]) if r["products_json"] else []
        except (ValueError, TypeError):
            raw = []
        # New rows store a list of ids; legacy/seed rows store a list of product objects.
        ids = [item.get("product_id") if isinstance(item, dict) else item for item in raw]
        cards = [c for c in (product_card(pid) for pid in ids if pid) if c is not None]
        history.append({"role": r["role"], "content": r["content"], "products": cards})
    return history


def clear_chat_history(user_id: int) -> None:
    with connect_rw() as conn:
        conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
        conn.commit()


# ============================================================ cart & pickup (temp tables)
def ensure_tables() -> None:
    """Create the cart and pickup tables if they don't exist. These are lightweight holding
    tables (no checkout) — a cart belongs to an `owner` key: 'user:<id>' or 'anon:<token>'."""
    with connect_rw() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS cart_items (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   owner TEXT NOT NULL,
                   product_id TEXT NOT NULL,
                   size TEXT NOT NULL,
                   quantity INTEGER NOT NULL,
                   created_at TEXT NOT NULL DEFAULT (datetime('now'))
               )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS pickup_requests (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   owner TEXT NOT NULL,
                   product_id TEXT NOT NULL,
                   size TEXT,
                   pickup_date TEXT NOT NULL,
                   alternate_name TEXT,
                   created_at TEXT NOT NULL DEFAULT (datetime('now'))
               )"""
        )
        conn.commit()


def add_to_cart(owner: str, product_id: str, size: str, quantity: int) -> None:
    with connect_rw() as conn:
        row = conn.execute(
            "SELECT id, quantity FROM cart_items WHERE owner = ? AND product_id = ? AND size = ?",
            (owner, product_id, size),
        ).fetchone()
        if row:
            conn.execute("UPDATE cart_items SET quantity = ? WHERE id = ?", (row["quantity"] + quantity, row["id"]))
        else:
            conn.execute(
                "INSERT INTO cart_items (owner, product_id, size, quantity) VALUES (?, ?, ?, ?)",
                (owner, product_id, size, quantity),
            )
        conn.commit()


def get_cart(owner: str) -> dict:
    with connect_ro() as conn:
        rows = conn.execute(
            "SELECT product_id, size, quantity FROM cart_items WHERE owner = ? ORDER BY id", (owner,)
        ).fetchall()
        items, subtotal, count = [], 0.0, 0
        for r in rows:
            p = conn.execute(
                "SELECT name, price, image_file_path FROM catalogue WHERE product_id = ?", (r["product_id"],)
            ).fetchone()
            if not p:
                continue
            items.append(
                {
                    "product_id": r["product_id"],
                    "name": p["name"],
                    "price": p["price"],
                    "image_url": f"/images/{p['image_file_path']}",
                    "size": r["size"],
                    "quantity": r["quantity"],
                }
            )
            subtotal += p["price"] * r["quantity"]
            count += r["quantity"]
    return {"items": items, "count": count, "subtotal": round(subtotal, 2)}


def save_pickup_request(
    owner: str, product_id: str, size: str | None, pickup_date: str, alternate_name: str | None
) -> None:
    with connect_rw() as conn:
        conn.execute(
            "INSERT INTO pickup_requests (owner, product_id, size, pickup_date, alternate_name) VALUES (?, ?, ?, ?, ?)",
            (owner, product_id, size, pickup_date, alternate_name),
        )
        conn.commit()


# ================================================================ "goes well with" recos
def _category(garment_type: str) -> str:
    """Broad category so recommendations are a different kind of apparel than the seed item."""
    t = garment_type.lower()
    if "quarter-zip" in t:
        return "quarter-zip"
    if "jacket" in t or "full-zip" in t:
        return "outerwear"
    if "hood" in t:
        return "hoodie"
    if "crewneck" in t or "mockneck" in t:
        return "crewneck"
    return "tee"


def recommendations(product_id: str, limit: int = 4) -> list[dict]:
    """Items that pair with the given product: a DIFFERENT category, favouring 'hot' / 'almost
    gone' pieces that are still buyable. Read-only."""
    with connect_ro() as conn:
        base = conn.execute("SELECT garment_type FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if base is None:
            return []
        base_cat = _category(base["garment_type"])
        rows = conn.execute(
            "SELECT product_id, garment_type FROM catalogue WHERE product_id != ?", (product_id,)
        ).fetchall()
    candidates = []
    for r in rows:
        if _category(r["garment_type"]) == base_cat:
            continue
        card = product_card(r["product_id"])
        if card is None or not card["in_stock"]:
            continue
        candidates.append(card)
    rank = {"almost_gone": 0, "hot": 1}
    badged = sorted((c for c in candidates if c["badge"]), key=lambda c: rank.get(c["badge"], 2))
    rest = [c for c in candidates if not c["badge"]]
    return (badged + rest)[:limit]


# ==================================================== chat efficiency: smalltalk + memory
_GREETING_RE = re.compile(
    r"^\s*(hi|hey|hello|yo|hiya|good (morning|afternoon|evening)|howdy|greetings|"
    r"thanks?|thank you|thx|ty|cheers|ok|okay|cool|great|bye|goodbye|see ya)\b[\s!.?,]*$",
    re.IGNORECASE,
)


def smalltalk_reply(message: str) -> str | None:
    """Canned friendly reply for trivial greetings/pleasantries, else None. Lets the app answer
    'hi' without spending a model call."""
    if not _GREETING_RE.match(message):
        return None
    m = message.strip().lower()
    if any(w in m for w in ("thank", "thx", "ty", "cheers")):
        return "With pleasure. Is there a piece from the collection I can help you find?"
    if any(w in m for w in ("bye", "see ya", "goodbye")):
        return "A pleasure assisting you. Do come back to the house any time."
    return "Good day, and welcome to Campus Customs. How may I help you find the right piece?"


def normalize_question(message: str) -> str:
    return re.sub(r"\s+", " ", message.strip().lower()).strip(" ?!.")


# In-process cache: (owner, normalized question) -> prior answer. Avoids re-calling the model
# for a repeat question. Signed-in guests also fall back to their saved history (see recall_answer).
_MEMORY: "collections.OrderedDict[str, dict]" = collections.OrderedDict()
_MEMORY_MAX = 500


def remember_answer(owner: str, norm_q: str, reply: str, product_ids: list[str], follow_ups: list[str]) -> None:
    key = f"{owner}|{norm_q}"
    _MEMORY[key] = {"reply": reply, "product_ids": product_ids, "follow_ups": follow_ups}
    _MEMORY.move_to_end(key)
    while len(_MEMORY) > _MEMORY_MAX:
        _MEMORY.popitem(last=False)


def recall_answer(owner: str, norm_q: str, user_id: int | None) -> dict | None:
    """A previously-given answer for this question: in-process cache first, then (for signed-in
    guests) their own saved history. Returns {reply, product_ids, follow_ups} or None."""
    hit = _MEMORY.get(f"{owner}|{norm_q}")
    if hit:
        return hit
    if user_id is None:
        return None
    with connect_ro() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json FROM chat_messages WHERE user_id = ? ORDER BY id", (user_id,)
        ).fetchall()
    for i, r in enumerate(rows):
        if r["role"] == "user" and normalize_question(r["content"]) == norm_q:
            nxt = rows[i + 1] if i + 1 < len(rows) else None
            if nxt and nxt["role"] == "assistant":
                try:
                    raw = json.loads(nxt["products_json"]) if nxt["products_json"] else []
                except (ValueError, TypeError):
                    raw = []
                ids = [it.get("product_id") if isinstance(it, dict) else it for it in raw]
                return {"reply": nxt["content"], "product_ids": [x for x in ids if x], "follow_ups": []}
    return None


# ================================================================ audit trail (append-only)
# Records the Concierge's loop activity — tool calls and how each run stopped — plus any
# suspicious requests. This file is NEVER cleared between runs; entries are only appended.
_audit_lock = threading.Lock()


def append_audit(entry: dict) -> None:
    """Append one timestamped entry to output/audit_trail.json. Append-only; never truncates."""
    record = {"timestamp": datetime.now(timezone.utc).isoformat(), **entry}
    with _audit_lock:
        try:
            data = json.loads(AUDIT_PATH.read_text(encoding="utf-8")) if AUDIT_PATH.exists() else []
            if not isinstance(data, list):
                data = []
        except (ValueError, OSError):
            data = []
        data.append(record)
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        AUDIT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _short(value, limit: int = 120) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def audit_tool_call(tool: str, args: dict, result) -> None:
    """Log a single tool invocation with short args and a short result summary."""
    if isinstance(result, list):
        summary = f"{len(result)} result(s)"
    elif isinstance(result, dict):
        summary = _short({k: result[k] for k in list(result)[:4]})
    else:
        summary = _short(result)
    append_audit({"kind": "tool_call", "tool": tool, "args": _short(args), "result": summary})


# Patterns that suggest someone is probing for private data, trying to break out of the shop
# context, or injecting instructions. Matches are logged and the agent is told to refuse.
_SUSPICIOUS_RE = re.compile(
    r"\b(password|passwd|pwd|hash|salt|api[\s_-]?key|secret|token|"
    r"all (emails|users|customers)|list .*(emails|users|customers)|dump|"
    r"drop table|delete from|insert into|update .*set|union select|\bsql\b|"
    r"ignore (the |all |previous )?instructions|system prompt|developer message|"
    r"jailbreak|\.env|environment variable|server|database schema|admin)\b",
    re.IGNORECASE,
)


def is_suspicious(message: str) -> bool:
    return bool(_SUSPICIOUS_RE.search(message or ""))
