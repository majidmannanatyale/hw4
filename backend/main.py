"""Campus Customs API — product catalogue, images, and customer accounts."""

import json
import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import tools
from agent import run_chat
from models import (
    AuthResponse,
    Cart,
    CartItemRequest,
    ChatHistory,
    ChatReply,
    ChatRequest,
    HistoryMessage,
    LoginRequest,
    PickupRequestInput,
    ProductCard,
    PublicUser,
    RegisterRequest,
)

# Load secrets from env files; values already in the environment win. Never hard-coded.
# hw4/.env holds APP_SECRET; the course-root keys.env holds PORTKEY_API_KEY.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
for _parent in Path(__file__).resolve().parents:
    _keys = _parent / "keys.env"
    if _keys.is_file():
        load_dotenv(_keys)
        break

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DB_PATH = DATA_DIR / "campus_customs.db"
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

app = FastAPI(title="Campus Customs API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
# image_file_path in the DB is "products/<file>.jpg". Only the image folder is mounted
# (never data/ itself, which would expose the database file) at /images/products.
# data/products_clean holds the same photos with their black backgrounds turned white;
# fall back to the originals if it is missing.
IMAGE_DIR = DATA_DIR / "products_clean"
if not IMAGE_DIR.is_dir():
    IMAGE_DIR = DATA_DIR / "products"
app.mount("/images/products", StaticFiles(directory=IMAGE_DIR), name="images")

tools.ensure_tables()  # create the cart / pickup holding tables if they don't exist yet


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def product_dict(row: sqlite3.Row, inventory: list[sqlite3.Row]) -> dict:
    stock = sorted(
        ({"size": r["size"], "quantity": r["quantity"]} for r in inventory),
        key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else len(SIZE_ORDER),
    )
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "search_tags": json.loads(row["search_tags"]),
        "image_url": f"/images/{row['image_file_path']}",
        "price": row["price"],
        "inventory": stock,
        "total_stock": sum(s["quantity"] for s in stock),
        "badge": tools.compute_badge(stock),
    }


@app.get("/api/products")
def list_products() -> list[dict]:
    with connect() as conn:
        products = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        inventory = conn.execute("SELECT product_id, size, quantity FROM inventory").fetchall()
    by_product: dict[str, list[sqlite3.Row]] = {}
    for r in inventory:
        by_product.setdefault(r["product_id"], []).append(r)
    return [product_dict(p, by_product.get(p["product_id"], [])) for p in products]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with connect() as conn:
        product = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        inventory = conn.execute(
            "SELECT product_id, size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
    return product_dict(product, inventory)


@app.get("/api/products/{product_id}/recommendations", response_model=list[ProductCard])
def product_recommendations(product_id: str) -> list[ProductCard]:
    """Items that pair with this one: a different kind of apparel, favouring hot / almost-gone."""
    return [ProductCard(**c) for c in tools.recommendations(product_id)]


# --------------------------------------------------------------------------- cart & pickup
def _owner_key(authorization: str, cart_id: str | None) -> str:
    """Identify a cart: the signed-in user if a valid token is present, else the anon cart token."""
    user_id, _name = _optional_user(authorization)
    if user_id is not None:
        return f"user:{user_id}"
    return f"anon:{cart_id or 'guest'}"


@app.post("/api/cart", response_model=Cart)
def cart_add(body: CartItemRequest, authorization: str = Header(default="")) -> Cart:
    owner = _owner_key(authorization, body.cart_id)
    if tools.product_card(body.product_id) is None:
        raise HTTPException(status_code=404, detail="That piece is no longer available.")
    tools.add_to_cart(owner, body.product_id, body.size, body.quantity)
    return Cart(**tools.get_cart(owner))


@app.get("/api/cart", response_model=Cart)
def cart_get(authorization: str = Header(default=""), cart_id: str | None = None) -> Cart:
    return Cart(**tools.get_cart(_owner_key(authorization, cart_id)))


@app.post("/api/pickup", status_code=201)
def pickup_request(body: PickupRequestInput, authorization: str = Header(default="")) -> dict:
    owner = _owner_key(authorization, body.cart_id)
    if tools.product_card(body.product_id) is None:
        raise HTTPException(status_code=404, detail="That piece is no longer available.")
    alt = body.alternate_name if body.someone_else else None
    tools.save_pickup_request(owner, body.product_id, body.size, body.pickup_date, alt)
    return {"ok": True, "message": "Your pickup request has been noted. We will have it ready at the house."}


# --------------------------------------------------------------------------------- auth
def _royal_greeting(first_name: str, returning: bool) -> str:
    if returning:
        return f"Welcome back, {first_name}. The house has missed your custom."
    return f"Welcome to the house, {first_name}. Your account now awaits your pleasure."


def _auth_response(row: sqlite3.Row, returning: bool) -> AuthResponse:
    pub = tools.public_user(row)
    return AuthResponse(
        user=PublicUser(**pub),
        token=tools.create_token(pub["id"]),
        greeting=_royal_greeting(pub["first_name"], returning),
    )


@app.post("/api/auth/register", response_model=AuthResponse)
def register(body: RegisterRequest) -> AuthResponse:
    with tools.connect_rw() as conn:
        if tools.get_user_by_email(conn, body.email):
            raise HTTPException(
                status_code=409,
                detail="An account already graces us with that email. Perhaps Your Grace meant to sign in?",
            )
        try:
            row = tools.create_user(conn, body.first_name, body.last_name, body.email, body.password)
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="That email is already registered to a member of the house.")
    return _auth_response(row, returning=False)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    with tools.connect_rw() as conn:
        row = tools.get_user_by_email(conn, body.email)
    # Same message whether the email is unknown or the password is wrong — never reveal which.
    if row is None or not tools.verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Those credentials do not match our records, Your Grace.")
    return _auth_response(row, returning=True)


def current_user(authorization: str = Header(default="")) -> sqlite3.Row:
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    user_id = tools.verify_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Your session has lapsed. Kindly sign in again.")
    with tools.connect_rw() as conn:
        row = tools.get_user_by_id(conn, user_id)
    if row is None:
        raise HTTPException(status_code=401, detail="We could no longer find your account.")
    return row


@app.get("/api/auth/me", response_model=PublicUser)
def me(user: sqlite3.Row = Depends(current_user)) -> PublicUser:
    return PublicUser(**tools.public_user(user))


# --------------------------------------------------------------------------------- chat
def _optional_user(authorization: str) -> tuple[int | None, str | None]:
    """Return (user_id, first_name) if a valid token is present, else (None, None)."""
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    user_id = tools.verify_token(token) if token else None
    if user_id is None:
        return None, None
    with tools.connect_rw() as conn:
        row = tools.get_user_by_id(conn, user_id)
    if row is None:
        return None, None
    return row["id"], tools.public_user(row)["first_name"]


def _cards_from_ids(product_ids: list[str]) -> list[ProductCard]:
    cards: list[ProductCard] = []
    seen: set[str] = set()
    for pid in product_ids:
        if pid in seen:
            continue
        seen.add(pid)
        card = tools.product_card(pid)
        if card is not None:
            cards.append(ProductCard(**card))
        if len(cards) >= 6:
            break
    return cards


DEFAULT_FOLLOW_UPS = ["What hoodies do you have?", "Gifts under $60", "Show me navy quarter-zips"]


@app.post("/api/chat", response_model=ChatReply)
async def chat(body: ChatRequest, authorization: str = Header(default="")) -> ChatReply:
    user_id, first_name = _optional_user(authorization)
    owner = f"user:{user_id}" if user_id is not None else "anon"
    message = body.message

    def _persist(reply_text: str, product_ids: list[str]) -> None:
        if user_id is not None:
            tools.save_chat_turn(user_id, "user", message)
            tools.save_chat_turn(user_id, "assistant", reply_text, product_ids)

    # 0) Flag anything that looks like probing for private data or an injection attempt.
    if tools.is_suspicious(message):
        tools.append_audit({"kind": "suspicious", "owner": owner, "message": message[:160]})

    # 1) Trivial greeting / pleasantry → answer locally, do NOT spend a model call.
    canned = tools.smalltalk_reply(message)
    if canned is not None:
        tools.append_audit({"kind": "run", "stop_reason": "smalltalk_bypass", "message": message[:80]})
        _persist(canned, [])
        return ChatReply(reply=canned, products=[], follow_ups=DEFAULT_FOLLOW_UPS)

    # 2) Already asked? Reuse the remembered answer instead of calling Portkey again.
    norm = tools.normalize_question(message)
    cached = tools.recall_answer(owner, norm, user_id)
    if cached is not None:
        tools.append_audit({"kind": "run", "stop_reason": "cache_hit", "message": message[:80]})
        cards = _cards_from_ids(cached["product_ids"])
        _persist(cached["reply"], [c.product_id for c in cards])
        return ChatReply(reply=cached["reply"], products=cards, follow_ups=cached.get("follow_ups") or [])

    # 3) Otherwise, run the agent through Portkey.
    if not os.environ.get("PORTKEY_API_KEY"):
        raise HTTPException(status_code=503, detail="The concierge is not available right now. Please try again later.")
    history = [{"role": t.role, "content": t.content} for t in body.history]
    page = body.page
    try:
        output = await run_chat(
            message,
            history,
            first_name,
            page_path=page.path if page else "",
            page_product_id=page.product_id if page else None,
        )
    except Exception:  # noqa: BLE001 — never surface model/gateway internals (incl. usage limits) to the client
        raise HTTPException(
            status_code=502,
            detail="Our concierge is momentarily indisposed. Please try again shortly.",
        )

    cards = _cards_from_ids(output.product_ids)
    follow_ups = output.follow_ups[:3]
    tools.remember_answer(owner, norm, output.reply, [c.product_id for c in cards], follow_ups)
    _persist(output.reply, [c.product_id for c in cards])
    return ChatReply(reply=output.reply, products=cards, follow_ups=follow_ups)


@app.get("/api/chat/history", response_model=ChatHistory)
def chat_history(user: sqlite3.Row = Depends(current_user)) -> ChatHistory:
    """A signed-in guest's saved conversation, with product cards re-resolved from the DB."""
    rows = tools.load_chat_history(user["id"])
    messages = [
        HistoryMessage(role=r["role"], content=r["content"], products=[ProductCard(**c) for c in r["products"]])
        for r in rows
    ]
    return ChatHistory(messages=messages)


@app.delete("/api/chat/history", status_code=204)
def clear_chat_history(user: sqlite3.Row = Depends(current_user)) -> None:
    tools.clear_chat_history(user["id"])
